import * as crypto from 'crypto';
import { assertDefined, expectReject } from '../../../../../../test/test-assertions';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { ZaloOaAdapter } from '../zalo.adapter';
import { ZaloOaTokenService } from '../zalo-oa-token.service';
import {
  ChannelContext,
  OutboundMessagePayload,
  WebhookVerificationRequest,
} from '../../channel-adapter.types';

const APP_ID = '1234567890';
const OA_SECRET = 'zalo_oa_secret_key';
const ACCESS_TOKEN = 'zalo_access_token_x';

/** Mirrors the documented MAC: sha256(app_id + rawBody + timestamp + oa_secret_key). */
function signBody(rawBody: string, timestamp: string, secret = OA_SECRET): string {
  return crypto
    .createHash('sha256')
    .update(`${APP_ID}${rawBody}${timestamp}${secret}`)
    .digest('hex');
}

function buildEventBody(data: unknown, timestamp = '1700000000000'): string {
  return JSON.stringify({
    event_name: 'user_send_text',
    app_id: APP_ID,
    timestamp,
    data: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

describe('ZaloOaAdapter (Zalo OA OpenAPI v3 Integration)', () => {
  let adapter: ZaloOaAdapter;
  let originalFetch: typeof globalThis.fetch;
  let tokenService: { getValidAccessToken: jest.Mock; forceRefresh: jest.Mock };

  const mockChannelContext: ChannelContext = {
    channelId: 'chan_zalo_1',
    inboxId: 'inbox_1',
    workspaceId: 'ws_1',
    channelType: ChannelType.ZALO,
    credentials: {
      appId: APP_ID,
      accessToken: ACCESS_TOKEN,
      refreshToken: 'refresh_token',
      accessTokenExpiresAt: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
      oaSecretKey: OA_SECRET,
      oaId: 'oa_123',
    },
    settings: {},
  };

  beforeEach(() => {
    tokenService = {
      getValidAccessToken: jest.fn().mockResolvedValue(ACCESS_TOKEN),
      forceRefresh: jest.fn().mockResolvedValue('fresh_token'),
    };
    adapter = new ZaloOaAdapter(tokenService as unknown as ZaloOaTokenService);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Adapter Configuration', () => {
    it('should declare channelType as ZALO', () => {
      expect(adapter.channelType).toBe(ChannelType.ZALO);
    });
  });

  describe('handleCallbackVerification()', () => {
    it('should echo the verify token for oa_callback_verify events', () => {
      const body = JSON.stringify({
        event_name: 'oa_callback_verify',
        app_id: APP_ID,
        timestamp: '1700000000000',
        data: JSON.stringify({ verify_token: 'vt_abc' }),
      });

      const response = adapter.handleCallbackVerification(body);
      assertDefined(response);
      expect(response).toEqual({ code: 0, data: { verify_token: 'vt_abc' } });
    });

    it('should handle oa_callback_verify with object-shaped data', () => {
      const body = {
        event_name: 'oa_callback_verify',
        app_id: APP_ID,
        timestamp: '1700000000000',
        data: { verify_token: 'vt_obj' },
      };

      const response = adapter.handleCallbackVerification(body);
      assertDefined(response);
      expect(response.data).toEqual({ verify_token: 'vt_obj' });
    });

    it('should return null for normal message events (normal ingestion flow)', () => {
      expect(adapter.handleCallbackVerification(buildEventBody({}))).toBeNull();
      expect(adapter.handleCallbackVerification('not json')).toBeNull();
      expect(adapter.handleCallbackVerification(null)).toBeNull();
    });
  });

  describe('verifyWebhook()', () => {
    it('should accept a correctly signed request', () => {
      const timestamp = String(Date.now());
      const rawBody = buildEventBody(
        {
          sender: { id: 'user_1' },
          message: { msg_id: 'm1', text: 'hello' },
        },
        timestamp,
      );
      const mac = signBody(rawBody, timestamp);

      const request: WebhookVerificationRequest = {
        headers: { 'x-zevent-signature': mac },
        rawBody: Buffer.from(rawBody, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should accept sha256= prefixed signatures', () => {
      const timestamp = String(Date.now());
      const rawBody = buildEventBody({}, timestamp);
      const mac = signBody(rawBody, timestamp);

      const request: WebhookVerificationRequest = {
        headers: { 'X-ZEvent-Signature': `sha256=${mac}` },
        rawBody: Buffer.from(rawBody, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should accept string rawBody (no buffer)', () => {
      const timestamp = String(Date.now());
      const rawBody = buildEventBody({}, timestamp);
      const mac = signBody(rawBody, timestamp);

      const request: WebhookVerificationRequest = {
        headers: { 'x-zevent-signature': mac },
        rawBody,
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should reject a tampered body', () => {
      const rawBody = buildEventBody({});
      const mac = signBody(rawBody, '1700000000000');
      const tampered = rawBody.replace('user_send_text', 'user_send_image');

      const request: WebhookVerificationRequest = {
        headers: { 'x-zevent-signature': mac },
        rawBody: Buffer.from(tampered, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
    });

    it('should reject a wrong secret', () => {
      const rawBody = buildEventBody({});
      const mac = signBody(rawBody, '1700000000000', 'attacker_secret');

      const request: WebhookVerificationRequest = {
        headers: { 'x-zevent-signature': mac },
        rawBody: Buffer.from(rawBody, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
    });

    it('should fail closed when the channel has no OA Secret Key configured', () => {
      const rawBody = buildEventBody({});
      const mac = signBody(rawBody, '1700000000000');

      const request: WebhookVerificationRequest = {
        headers: { 'x-zevent-signature': mac },
        rawBody: Buffer.from(rawBody, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, {})).toBe(false);
      expect(adapter.verifyWebhook(request, undefined)).toBe(false);
    });

    it('should reject requests without a signature header', () => {
      const rawBody = buildEventBody({});
      const request: WebhookVerificationRequest = {
        headers: {},
        rawBody: Buffer.from(rawBody, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
    });

    it('should reject stale timestamps (replay protection)', () => {
      const staleTimestamp = String(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const rawBody = buildEventBody({}, staleTimestamp);
      const mac = signBody(rawBody, staleTimestamp);

      const request: WebhookVerificationRequest = {
        headers: { 'x-zevent-signature': mac },
        rawBody: Buffer.from(rawBody, 'utf8'),
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
    });
  });

  describe('parseInboundPayload()', () => {
    it('should parse user_send_text with string-encoded data', () => {
      const rawBody = buildEventBody({
        sender: { id: 'user_1' },
        recipient: { id: 'oa_123' },
        message: { msg_id: 'msg_1', text: 'Xin chào shop' },
      });

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads).toHaveLength(1);
      expect(payloads[0]).toMatchObject({
        eventKind: 'message',
        externalContactId: 'user_1',
        externalMessageId: 'msg_1',
        content: 'Xin chào shop',
        contentType: MessageContentType.TEXT,
      });
      expect(payloads[0].timestamp).toBeInstanceOf(Date);
      assertDefined(payloads[0].rawPayload);
    });

    it('should parse user_send_image with object-encoded data', () => {
      const rawBody = {
        event_name: 'user_send_image',
        app_id: APP_ID,
        timestamp: '1700000000001',
        data: {
          sender: { id: 'user_2' },
          message: {
            msg_id: 'msg_2',
            attachments: [{ type: 'image', payload: { url: 'https://zalo/img.png' } }],
          },
        },
      };

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads).toHaveLength(1);
      expect(payloads[0].contentType).toBe(MessageContentType.IMAGE);
      assertDefined(payloads[0].attachments);
      expect(payloads[0].attachments?.[0]).toMatchObject({
        fileUrl: 'https://zalo/img.png',
        contentType: MessageContentType.IMAGE,
      });
    });

    it('should parse user_send_file as FILE', () => {
      const rawBody = {
        event_name: 'user_send_file',
        app_id: APP_ID,
        timestamp: '1700000000002',
        data: {
          sender: { id: 'user_3' },
          message: {
            msg_id: 'msg_3',
            attachments: [
              { type: 'file', payload: { url: 'https://zalo/doc.pdf', name: 'invoice.pdf' } },
            ],
          },
        },
      };

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads[0].contentType).toBe(MessageContentType.FILE);
      expect(payloads[0].attachments?.[0]?.fileName).toBe('invoice.pdf');
    });

    it('should parse user_send_link as TEXT with the link content', () => {
      const rawBody = {
        event_name: 'user_send_link',
        app_id: APP_ID,
        timestamp: '1700000000003',
        data: {
          sender: { id: 'user_4' },
          message: { msg_id: 'msg_4', link: 'https://example.com/product' },
        },
      };

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads[0].contentType).toBe(MessageContentType.TEXT);
      expect(payloads[0].content).toBe('https://example.com/product');
    });

    it('should parse user_send_voice as AUDIO', () => {
      const rawBody = {
        event_name: 'user_send_voice',
        app_id: APP_ID,
        timestamp: '1700000000004',
        data: {
          sender: { id: 'user_5' },
          message: {
            msg_id: 'msg_5',
            attachments: [{ type: 'voice', payload: { url: 'https://zalo/voice.mp3' } }],
          },
        },
      };

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads[0].contentType).toBe(MessageContentType.AUDIO);
    });

    it('should map user_receive_message to a DELIVERED delivery_status', () => {
      const rawBody = {
        event_name: 'user_receive_message',
        app_id: APP_ID,
        timestamp: '1700000000005',
        data: {
          sender: { id: 'oa_123' },
          recipient: { id: 'user_1' },
          message: { msg_id: 'msg_out_1' },
        },
      };

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads).toHaveLength(1);
      expect(payloads[0].eventKind).toBe('delivery_status');
      expect(payloads[0].deliveryStatusInfo).toMatchObject({
        externalMessageId: 'msg_out_1',
        status: DeliveryStatus.DELIVERED,
      });
    });

    it('should map oa_message_seen (msg_ids array) to READ delivery statuses', () => {
      const rawBody = {
        event_name: 'oa_message_seen',
        app_id: APP_ID,
        timestamp: '1700000000006',
        data: {
          recipient: { id: 'user_1' },
          msg_ids: ['msg_out_1', 'msg_out_2'],
        },
      };

      const payloads = adapter.parseInboundPayload(rawBody);
      expect(payloads).toHaveLength(2);
      for (const payload of payloads) {
        expect(payload.eventKind).toBe('delivery_status');
        expect(payload.deliveryStatusInfo?.status).toBe(DeliveryStatus.READ);
      }
      expect(payloads.map(p => p.externalMessageId)).toEqual(['msg_out_1', 'msg_out_2']);
    });

    it('should ignore follow / unfollow / oa_send_message events', () => {
      for (const eventName of [
        'follow',
        'unfollow',
        'oa_send_message',
        'user_update_display_name',
      ]) {
        const rawBody = {
          event_name: eventName,
          app_id: APP_ID,
          timestamp: '1700000000007',
          data: { user_id: 'user_1' },
        };
        expect(adapter.parseInboundPayload(rawBody)).toEqual([]);
      }
    });

    it('should return [] for events missing sender or msg id', () => {
      const rawBody = {
        event_name: 'user_send_text',
        app_id: APP_ID,
        timestamp: '1700000000008',
        data: { message: { text: 'no sender' } },
      };
      expect(adapter.parseInboundPayload(rawBody)).toEqual([]);
    });

    it('should return [] for malformed payloads', () => {
      expect(adapter.parseInboundPayload('not json')).toEqual([]);
      expect(adapter.parseInboundPayload(null)).toEqual([]);
      expect(
        adapter.parseInboundPayload({ event_name: 'user_send_text', data: 'broken {' }),
      ).toEqual([]);
    });
  });

  describe('sendMessage()', () => {
    const textMessage: OutboundMessagePayload = {
      recipientExternalId: 'user_1',
      content: 'Cảm ơn anh đã đặt hàng',
      contentType: MessageContentType.TEXT,
    };

    it('should send a text CS message with the access token header', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 0, msg_id: 'out_msg_1' }), { status: 200 }),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await adapter.sendMessage(mockChannelContext, textMessage);

      expect(result).toMatchObject({
        externalMessageId: 'out_msg_1',
        deliveryStatus: DeliveryStatus.SENT,
      });
      expect(tokenService.getValidAccessToken).toHaveBeenCalledWith(mockChannelContext);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://openapi.zalo.me/v3.0/oa/message/cs');
      expect(init.headers).toMatchObject({ access_token: ACCESS_TOKEN });
      expect(JSON.parse(init.body)).toEqual({
        recipient: { user_id: 'user_1' },
        message: { text: 'Cảm ơn anh đã đặt hàng' },
      });
    });

    it('should send an image attachment as attachment payload', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 0, msg_id: 'out_msg_2' }), { status: 200 }),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await adapter.sendMessage(mockChannelContext, {
        recipientExternalId: 'user_1',
        content: 'Ảnh sản phẩm',
        contentType: MessageContentType.IMAGE,
        attachments: [{ fileUrl: 'https://storage/product.png' }],
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        recipient: { user_id: 'user_1' },
        message: {
          text: 'Ảnh sản phẩm',
          attachment: { type: 'image', payload: { url: 'https://storage/product.png' } },
        },
      });
    });

    it('should send metadata.zaloTemplate as a template attachment payload', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: 0, msg_id: 'out_msg_3' }), { status: 200 }),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await adapter.sendMessage(mockChannelContext, {
        recipientExternalId: 'user_1',
        content: 'Chọn hành động',
        metadata: {
          zaloTemplate: {
            template_type: 'buttons',
            text: 'Chọn hành động',
            buttons: [{ type: 'QUICK_REPLY', title: 'Có', payload: 'yes' }],
          },
        },
      });

      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.message.attachment.type).toBe('template');
      expect(body.message.attachment.payload.template_type).toBe('buttons');
      expect(body.message.attachment.payload.buttons).toHaveLength(1);
    });

    it('should reject file/video attachments (upload API out of scope) with a clear error', async () => {
      await expectReject(
        adapter.sendMessage(mockChannelContext, {
          recipientExternalId: 'user_1',
          contentType: MessageContentType.FILE,
          attachments: [{ fileUrl: 'https://storage/invoice.pdf' }],
        }),
        err => err.message.includes('ZALO_OUTBOUND_FILE_UNSUPPORTED'),
      );
    });

    it('should force-refresh the token once and retry on auth rejection', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: -216, message: 'Invalid access token' }), {
            status: 401,
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 0, msg_id: 'out_msg_4' }), { status: 200 }),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await adapter.sendMessage(mockChannelContext, textMessage);

      expect(result.externalMessageId).toBe('out_msg_4');
      expect(tokenService.forceRefresh).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should not retry more than once on continued auth rejection', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: -216, message: 'Invalid access token' }), {
          status: 401,
        }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expectReject(adapter.sendMessage(mockChannelContext, textMessage));
      expect(tokenService.forceRefresh).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should throw a descriptive error including the Zalo error code (CS window)', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: -103, message: 'user has not interacted in 7 days' }),
            { status: 200 },
          ),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expectReject(
        adapter.sendMessage(mockChannelContext, textMessage),
        err => err.message.includes('[-103]') && err.message.includes('CS_WINDOW_EXCEEDED'),
      );
    });

    it('should throw when recipientExternalId is missing', async () => {
      await expectReject(
        adapter.sendMessage(mockChannelContext, {
          recipientExternalId: '',
          content: 'no recipient',
        }),
      );
    });
  });

  describe('getChannelInfo()', () => {
    it('should fetch OA info via GET /oa', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              oa_id: 'oa_123',
              name: 'Shop Test OA',
              avatar: 'https://zalo/oa.png',
            }),
            { status: 200 },
          ),
        );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const info = await adapter.getChannelInfo(mockChannelContext);

      expect(info).toMatchObject({
        providerAccountId: 'oa_123',
        name: 'Shop Test OA',
        avatarUrl: 'https://zalo/oa.png',
      });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('https://openapi.zalo.me/v3.0/oa');
    });

    it('should throw when the OA info response is empty', async () => {
      globalThis.fetch = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: -10, message: 'failed' }), { status: 200 }),
        ) as unknown as typeof fetch;

      await expectReject(adapter.getChannelInfo(mockChannelContext), /Zalo OA info fetch failed/);
    });
  });

  describe('fetchSenderInfo()', () => {
    it('should fetch user profile via POST /oa/user/info', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user_id: 'user_1',
            display_name: 'Nguyễn Văn A',
            avatar: 'https://zalo/avatar.png',
            user_alias: 'nguyenvana',
          }),
          { status: 200 },
        ),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const info = await adapter.fetchSenderInfo(mockChannelContext, 'user_1');

      assertDefined(info);
      expect(info).toEqual({
        name: 'Nguyễn Văn A',
        avatarUrl: 'https://zalo/avatar.png',
        username: 'nguyenvana',
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://openapi.zalo.me/v3.0/oa/user/info');
      expect(JSON.parse(init.body)).toEqual({ user_id: 'user_1' });
    });

    it('should return null when the user info API errors', async () => {
      globalThis.fetch = jest
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: -1400, message: 'user not found' }), {
            status: 200,
          }),
        ) as unknown as typeof fetch;

      const info = await adapter.fetchSenderInfo(mockChannelContext, 'unknown_user');
      expect(info).toBeNull();
    });

    it('should return null when the network call throws', async () => {
      globalThis.fetch = jest
        .fn()
        .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

      const info = await adapter.fetchSenderInfo(mockChannelContext, 'user_1');
      expect(info).toBeNull();
    });
  });
});
