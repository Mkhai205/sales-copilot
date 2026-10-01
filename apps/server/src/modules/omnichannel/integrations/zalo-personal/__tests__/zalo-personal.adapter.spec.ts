import {
  ZaloPersonalAdapter,
  buildIngestEnvelope,
  parseListenerAttachments,
} from '../zalo-personal.adapter';
import { ZaloPersonalRateLimiterService } from '../zalo-personal-rate-limiter.service';
import { ZaloPersonalConnectionService } from '../zalo-personal-connection.service';
import { ChannelType, MessageContentType } from '@sales-copilot/shared-contracts';
import type { ChannelContext, OutboundMessagePayload } from '../../channel-adapter.types';

describe('ZaloPersonalAdapter', () => {
  let connectionService: { getApiForChannel: jest.Mock };
  let rateLimiter: ZaloPersonalRateLimiterService;
  let adapter: ZaloPersonalAdapter;

  const channel: ChannelContext = {
    channelId: 'chan_zp_1',
    inboxId: 'inbox_1',
    workspaceId: 'ws_1',
    channelType: ChannelType.ZALO_PERSONAL,
    credentials: {},
    settings: {},
    providerAccountId: 'own_id_1',
  };

  beforeEach(() => {
    connectionService = { getApiForChannel: jest.fn() };
    rateLimiter = new ZaloPersonalRateLimiterService();
    adapter = new ZaloPersonalAdapter(
      connectionService as unknown as ZaloPersonalConnectionService,
      rateLimiter,
    );
  });

  describe('envelope building & parsing', () => {
    it('should build an envelope from a 1-1 listener message with attachments', () => {
      const envelope = buildIngestEnvelope({
        type: 0, // ThreadType.User
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm1',
          msg: 'Xin chào',
          attach: JSON.stringify([{ type: 'chat.photo', href: 'https://zalo/img.png' }]),
        },
      });

      expect(envelope).toEqual({
        kind: 'zalo_personal',
        v: 1,
        message: {
          msgId: 'm1',
          threadId: 'user_1',
          isSelf: false,
          text: 'Xin chào',
          attachments: [{ type: 'chat.photo', url: 'https://zalo/img.png', fileName: undefined }],
        },
      });
    });

    it('should reject group messages and messages without ids', () => {
      expect(
        buildIngestEnvelope({ type: 1, threadId: 'g1', isSelf: false, data: { msgId: 'm' } }),
      ).toBeNull();
      expect(
        buildIngestEnvelope({ type: 0, threadId: '', isSelf: false, data: { msgId: 'm' } }),
      ).toBeNull();
      expect(buildIngestEnvelope({ type: 0, threadId: 'u1', isSelf: false, data: {} })).toBeNull();
    });

    it('should tolerate malformed attach JSON', () => {
      expect(parseListenerAttachments(undefined)).toEqual([]);
      expect(parseListenerAttachments('not json')).toEqual([]);
      expect(parseListenerAttachments('{"a":1}')).toEqual([]);
    });

    it('should map an envelope into an inbound payload with image attachment typing', () => {
      const payloads = adapter.parseInboundPayload({
        kind: 'zalo_personal',
        v: 1,
        message: {
          msgId: 'm1',
          threadId: 'user_1',
          isSelf: false,
          text: '',
          attachments: [{ type: 'chat.photo', url: 'https://zalo/img.png' }],
        },
      });

      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        eventKind: 'message',
        externalContactId: 'user_1',
        externalMessageId: 'm1',
        contentType: MessageContentType.IMAGE,
      });
      expect(payloads[0].attachments?.[0]?.contentType).toBe(MessageContentType.IMAGE);
    });

    it('should skip self envelopes (they are ingested directly as outgoing)', () => {
      const payloads = adapter.parseInboundPayload({
        kind: 'zalo_personal',
        v: 1,
        message: {
          msgId: 'm1',
          threadId: 'user_1',
          isSelf: true,
          text: 'hi',
          attachments: [],
        },
      });
      expect(payloads).toEqual([]);
    });

    it('should ignore non-envelope payloads', () => {
      expect(adapter.parseInboundPayload({ foo: 'bar' })).toEqual([]);
      expect(adapter.parseInboundPayload(null)).toEqual([]);
    });
  });

  describe('sendMessage()', () => {
    it('should send text via the live api with ThreadType.User and record msgId', async () => {
      const sendMessage = jest.fn().mockResolvedValue({
        message: { msgId: 'out_1' },
        attachment: [],
      });
      connectionService.getApiForChannel.mockResolvedValue({ sendMessage });

      const result = await adapter.sendMessage(channel, {
        recipientExternalId: 'user_1',
        content: 'Chào bạn',
      } as OutboundMessagePayload);

      expect(result).toMatchObject({ externalMessageId: 'out_1' });
      expect(sendMessage).toHaveBeenCalledWith('Chào bạn', 'user_1', 0);
      expect(connectionService.getApiForChannel).toHaveBeenCalledWith('chan_zp_1');
    });

    it('should reject outbound media attachments with a clear error', async () => {
      await expect(
        adapter.sendMessage(channel, {
          recipientExternalId: 'user_1',
          contentType: 'IMAGE',
          attachments: [{ fileUrl: 'https://x/a.png' }],
        } as OutboundMessagePayload),
      ).rejects.toThrow(/ZALO_PERSONAL_OUTBOUND_MEDIA_UNSUPPORTED/);
      expect(connectionService.getApiForChannel).not.toHaveBeenCalled();
    });

    it('should require a recipient', async () => {
      await expect(
        adapter.sendMessage(channel, {
          recipientExternalId: '',
          content: 'x',
        } as OutboundMessagePayload),
      ).rejects.toThrow(/Recipient user id/);
    });
  });

  describe('webhook surface', () => {
    it('should fail closed on verifyWebhook (no inbound HTTP for personal accounts)', () => {
      expect(adapter.verifyWebhook({ headers: {} }, {})).toBe(false);
      expect(adapter.handleCallbackVerification({})).toBeNull();
    });
  });
});
