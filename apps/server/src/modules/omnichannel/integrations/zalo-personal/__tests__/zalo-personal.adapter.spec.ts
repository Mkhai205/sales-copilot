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
    it('builds an envelope from a plain text listener message (regression: content, not msg)', () => {
      // zca-js TMessage carries text in `content` — reading `msg` produced empty
      // envelopes and every inbound text message was rejected as content-less.
      const envelope = buildIngestEnvelope({
        type: 0, // ThreadType.User
        threadId: 'user_1',
        isSelf: false,
        data: { msgId: 'm1', content: 'Xin chào shop ơi' },
      });

      expect(envelope).toMatchObject({
        kind: 'zalo_personal',
        v: 1,
        message: {
          msgId: 'm1',
          threadId: 'user_1',
          isSelf: false,
          text: 'Xin chào shop ơi',
          attachments: [],
        },
      });

      const [payload] = adapter.parseInboundPayload(envelope);
      expect(payload).toMatchObject({
        eventKind: 'message',
        externalContactId: 'user_1',
        externalMessageId: 'm1',
        content: 'Xin chào shop ơi',
        contentType: MessageContentType.TEXT,
      });
    });

    it('builds an envelope with attachments from an object-shaped attach payload', () => {
      const envelope = buildIngestEnvelope({
        type: 0,
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm2',
          content: {
            title: 'Photo',
            description: '',
            href: '',
            thumb: 'https://zalo/thumb.png',
          },
          attach: JSON.stringify({ photo: [{ type: 'chat.photo', href: 'https://zalo/img.png' }] }),
        },
      });

      expect(envelope?.message.attachments).toEqual([
        { type: 'chat.photo', url: 'https://zalo/img.png', fileName: undefined },
      ]);
    });

    it('falls back to the content thumbnail when attach yields no usable attachment', () => {
      const envelope = buildIngestEnvelope({
        type: 0,
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm3',
          msgType: 'chat.photo',
          content: { title: 'Photo', thumb: 'https://zalo/thumb.png' },
          attach: JSON.stringify({ photo: { notParseable: true } }),
        },
      });

      expect(envelope?.message.text).toBe('');
      expect(envelope?.message.attachments).toEqual([
        { type: 'unknown', url: 'https://zalo/thumb.png', fileName: 'Photo' },
      ]);

      const [payload] = adapter.parseInboundPayload(envelope);
      expect(payload.contentType).toBe(MessageContentType.IMAGE);
      expect(payload.attachments).toHaveLength(1);
    });

    it('maps a video message to VIDEO with the mp4 URL from its attach items', () => {
      const envelope = buildIngestEnvelope({
        type: 0,
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm4',
          msgType: 'chat.video.msg',
          content: { title: 'Video', thumb: 'https://zalo/poster.jpg' },
          attach: JSON.stringify({
            video: {
              items: [{ href: 'https://zalo/video.mp4', thumb: 'https://zalo/poster.jpg' }],
            },
          }),
        },
      });

      expect(envelope?.message.attachments).toEqual([
        { type: 'video', url: 'https://zalo/video.mp4', fileName: undefined },
      ]);

      const [payload] = adapter.parseInboundPayload(envelope);
      expect(payload.contentType).toBe(MessageContentType.VIDEO);
      expect(payload.attachments?.[0]?.contentType).toBe(MessageContentType.VIDEO);
    });

    it('maps a document message to FILE, reading the URL from content params when attach is absent', () => {
      const envelope = buildIngestEnvelope({
        type: 0,
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm5',
          msgType: 'share.file',
          content: { title: 'contract.pdf', params: '{"fileUrl":"https://zalo/contract.pdf"}' },
        },
      });

      expect(envelope?.message.attachments).toEqual([
        { type: 'unknown', url: 'https://zalo/contract.pdf', fileName: undefined },
      ]);

      const [payload] = adapter.parseInboundPayload(envelope);
      expect(payload.contentType).toBe(MessageContentType.FILE);
    });

    it('maps a document attached through file-keyed attach items with its file name', () => {
      const envelope = buildIngestEnvelope({
        type: 0,
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm6',
          msgType: 'share.file',
          content: { title: 'report.pdf' },
          attach: JSON.stringify({
            file: { items: [{ href: 'https://zalo/report.pdf', title: 'report.pdf' }] },
          }),
        },
      });

      expect(envelope?.message.attachments).toEqual([
        { type: 'file', url: 'https://zalo/report.pdf', fileName: 'report.pdf' },
      ]);

      const [payload] = adapter.parseInboundPayload(envelope);
      expect(payload.contentType).toBe(MessageContentType.FILE);
      expect(payload.attachments?.[0]?.fileName).toBe('report.pdf');
    });

    it('extracts the sticker id from a chat.sticker content object', () => {
      const envelope = buildIngestEnvelope({
        type: 0,
        threadId: 'user_1',
        isSelf: false,
        data: {
          msgId: 'm7',
          msgType: 'chat.sticker',
          content: { stickerId: 687090 },
        },
      });

      expect(envelope?.message.stickerId).toBe(687090);
      expect(envelope?.message.text).toBe('');
      expect(envelope?.message.attachments).toEqual([]);
      expect(envelope?.message.rawContent).toEqual({ stickerId: 687090 });
    });

    it('propagates the msgType content type onto attachments typed uselessly', () => {
      // Real payload: video attach items carry type "" and no file name
      const payloads = adapter.parseInboundPayload({
        kind: 'zalo_personal',
        v: 1,
        message: {
          msgId: 'm8',
          threadId: 'user_1',
          isSelf: false,
          msgType: 'chat.video.msg',
          text: '',
          attachments: [{ type: '', url: 'https://video-stal-39.dlmd.me/gr/xyz' }],
        },
      });

      expect(payloads[0].contentType).toBe(MessageContentType.VIDEO);
      expect(payloads[0].attachments?.[0]).toMatchObject({
        contentType: MessageContentType.VIDEO,
        fileType: MessageContentType.VIDEO,
        fileName: undefined,
      });
    });

    it('rejects group messages and messages without ids', () => {
      expect(
        buildIngestEnvelope({ type: 1, threadId: 'g1', isSelf: false, data: { msgId: 'm' } }),
      ).toBeNull();
      expect(
        buildIngestEnvelope({ type: 0, threadId: '', isSelf: false, data: { msgId: 'm' } }),
      ).toBeNull();
      expect(buildIngestEnvelope({ type: 0, threadId: 'u1', isSelf: false, data: {} })).toBeNull();
    });

    it('tolerates malformed or unusable attach JSON', () => {
      expect(parseListenerAttachments(undefined)).toEqual([]);
      expect(parseListenerAttachments('not json')).toEqual([]);
      expect(parseListenerAttachments('{"a":1}')).toEqual([]);
      expect(parseListenerAttachments('["just a string"]')).toEqual([]);
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
    const ONE_PX_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    function mockDownload(body: Buffer) {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length),
      }) as unknown as typeof fetch;
    }

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

    it('downloads an image attachment and sends it with parsed dimensions and caption', async () => {
      mockDownload(ONE_PX_PNG);
      const sendMessage = jest.fn().mockResolvedValue({
        message: null,
        attachment: [{ msgId: 'attach_1' }],
      });
      connectionService.getApiForChannel.mockResolvedValue({ sendMessage });

      const result = await adapter.sendMessage(channel, {
        recipientExternalId: 'user_1',
        content: 'Ảnh nè',
        attachments: [
          { fileUrl: 'https://minio/att/photo.png', fileName: 'photo.png', fileType: 'IMAGE' },
        ],
      } as unknown as OutboundMessagePayload);

      expect(result.externalMessageId).toBe('attach_1');
      expect(sendMessage).toHaveBeenCalledWith(
        {
          msg: 'Ảnh nè',
          attachments: [
            {
              data: expect.any(Buffer),
              filename: 'photo.png',
              metadata: { totalSize: ONE_PX_PNG.length, width: 1, height: 1 },
            },
          ],
        },
        'user_1',
        0,
      );
    });

    it('sends documents without image dimensions and falls back to a generated name', async () => {
      mockDownload(Buffer.from('%PDF-1.4 fake'));
      const sendMessage = jest.fn().mockResolvedValue({
        message: { msgId: 'text_1' },
        attachment: [{ msgId: 'file_1' }],
      });
      connectionService.getApiForChannel.mockResolvedValue({ sendMessage });

      await adapter.sendMessage(channel, {
        recipientExternalId: 'user_1',
        content: 'Gửi bạn tài liệu',
        attachments: [{ fileUrl: 'https://minio/att/doc.pdf', fileType: 'FILE' }],
      } as unknown as OutboundMessagePayload);

      expect(sendMessage).toHaveBeenCalledWith(
        {
          msg: 'Gửi bạn tài liệu',
          attachments: [
            {
              data: expect.any(Buffer),
              filename: expect.stringMatching(/^attachment-\d+$/),
              metadata: { totalSize: 13 },
            },
          ],
        },
        'user_1',
        0,
      );
    });

    it('surfaces a download failure as a delivery error', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
      connectionService.getApiForChannel.mockResolvedValue({ sendMessage: jest.fn() });

      await expect(
        adapter.sendMessage(channel, {
          recipientExternalId: 'user_1',
          attachments: [{ fileUrl: 'https://minio/att/gone.png', fileName: 'gone.png' }],
        } as unknown as OutboundMessagePayload),
      ).rejects.toThrow(/HTTP 404/);
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
