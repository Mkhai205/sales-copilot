import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { FacebookAdapter } from '../facebook.adapter';
import {
  ChannelContext,
  OutboundMessagePayload,
  WebhookVerificationRequest,
} from '../../channel-adapter.types';

describe('FacebookAdapter (Facebook Messenger Platform Integration)', () => {
  let adapter: FacebookAdapter;
  let originalFetch: typeof globalThis.fetch;

  const mockAppSecret = 'test_app_secret_998877665544332211';
  const mockPageAccessToken = 'EAABcdef1234567890abcdef1234567890';
  const mockPageId = '10987654321';

  const mockChannelContext: ChannelContext = {
    channelId: 'chan_fb_1',
    inboxId: 'inbox_fb_1',
    workspaceId: 'ws_test_1',
    channelType: ChannelType.FACEBOOK_MESSENGER,
    credentials: {
      pageAccessToken: mockPageAccessToken,
      appSecret: mockAppSecret,
      pageId: mockPageId,
    },
    settings: {},
  };

  /**
   * Helper to compute valid X-Hub-Signature-256
   */
  function createSignature(payload: string | Buffer, secret: string = mockAppSecret): string {
    const buffer = typeof payload === 'string' ? Buffer.from(payload, 'utf-8') : payload;
    const hash = crypto.createHmac('sha256', secret).update(buffer).digest('hex');
    return `sha256=${hash}`;
  }

  beforeEach(() => {
    adapter = new FacebookAdapter();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Adapter Configuration', () => {
    it('should declare channelType as FACEBOOK_MESSENGER', () => {
      assert.strictEqual(adapter.channelType, ChannelType.FACEBOOK_MESSENGER);
    });
  });

  describe('verifyWebhook()', () => {
    it('should verify valid HMAC-SHA256 signature from X-Hub-Signature-256 header', () => {
      const rawBody = JSON.stringify({ object: 'page', entry: [] });
      const signature = createSignature(rawBody, mockAppSecret);

      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': signature,
        },
        rawBody,
      };

      const credentials = { appSecret: mockAppSecret };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should verify signature when rawBody is a Buffer', () => {
      const rawBody = Buffer.from(JSON.stringify({ object: 'page', entry: [] }));
      const signature = createSignature(rawBody, mockAppSecret);

      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': signature,
        },
        rawBody,
      };

      const credentials = { appSecret: mockAppSecret };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should verify signature when rawBody is a parsed object', () => {
      const bodyObj = { object: 'page', entry: [] };
      const signature = createSignature(JSON.stringify(bodyObj), mockAppSecret);

      const request: WebhookVerificationRequest = {
        headers: {
          'X-Hub-Signature-256': signature,
        },
        rawBody: bodyObj,
      };

      const credentials = { app_secret: mockAppSecret };
      assert.strictEqual(adapter.verifyWebhook(request, credentials), true);
    });

    it('should support array header values for X-Hub-Signature-256', () => {
      const rawBody = '{"test": true}';
      const signature = createSignature(rawBody, mockAppSecret);

      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': [signature],
        },
        rawBody,
      };

      assert.strictEqual(adapter.verifyWebhook(request, { clientSecret: mockAppSecret }), true);
    });

    it('should support fallback SHA-1 signature (x-hub-signature)', () => {
      const rawBody = '{"test": true}';
      const sha1Hash = crypto.createHmac('sha1', mockAppSecret).update(rawBody).digest('hex');
      const signature = `sha1=${sha1Hash}`;

      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature': signature,
        },
        rawBody,
      };

      assert.strictEqual(adapter.verifyWebhook(request, { appSecret: mockAppSecret }), true);
    });

    it('should return false when HMAC signature does not match (tampered payload)', () => {
      const rawBody = JSON.stringify({ object: 'page', entry: [] });
      const tamperedBody = JSON.stringify({ object: 'page', entry: [{ tampered: true }] });
      const signature = createSignature(rawBody, mockAppSecret);

      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': signature,
        },
        rawBody: tamperedBody,
      };

      assert.strictEqual(adapter.verifyWebhook(request, { appSecret: mockAppSecret }), false);
    });

    it('should return false when wrong secret is used', () => {
      const rawBody = JSON.stringify({ object: 'page', entry: [] });
      const signature = createSignature(rawBody, 'wrong_secret');

      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': signature,
        },
        rawBody,
      };

      assert.strictEqual(adapter.verifyWebhook(request, { appSecret: mockAppSecret }), false);
    });

    it('should return false when signature header is missing', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        rawBody: '{"object":"page"}',
      };

      assert.strictEqual(adapter.verifyWebhook(request, { appSecret: mockAppSecret }), false);
    });

    it('should return false when app secret is not provided in credentials or request', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': 'sha256=1234567890abcdef',
        },
        rawBody: '{"object":"page"}',
      };

      assert.strictEqual(adapter.verifyWebhook(request, {}), false);
    });

    it('should return false when rawBody is undefined or null', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': 'sha256=1234567890abcdef',
        },
        rawBody: undefined,
      };

      assert.strictEqual(adapter.verifyWebhook(request, { appSecret: mockAppSecret }), false);
    });

    it('should verify GET challenge verification handshake (hub.mode=subscribe)', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my_verify_token_123',
          'hub.challenge': 'challenge_code_456',
        },
      };

      assert.strictEqual(
        adapter.verifyWebhook(request, { verifyToken: 'my_verify_token_123' }),
        true,
      );
      assert.strictEqual(
        adapter.verifyWebhook(request, { verify_token: 'my_verify_token_123' }),
        true,
      );
      assert.strictEqual(
        adapter.verifyWebhook(request, { webhookSecret: 'my_verify_token_123' }),
        true,
      );
      assert.strictEqual(adapter.verifyWebhook(request, { verifyToken: 'wrong_token' }), false);
    });
  });

  describe('parseInboundPayload()', () => {
    it('should return empty array for non-JSON or invalid rawBody', () => {
      assert.deepStrictEqual(adapter.parseInboundPayload('not a json'), []);
      assert.deepStrictEqual(adapter.parseInboundPayload(null), []);
      assert.deepStrictEqual(adapter.parseInboundPayload(undefined), []);
      assert.deepStrictEqual(adapter.parseInboundPayload(12345), []);
    });

    it('should return empty array for non-page webhook objects', () => {
      const payload = {
        object: 'user',
        entry: [{ id: '123', time: Date.now() }],
      };
      assert.deepStrictEqual(adapter.parseInboundPayload(payload), []);
    });

    it('should return empty array for empty entry list', () => {
      const payload = {
        object: 'page',
        entry: [],
      };
      assert.deepStrictEqual(adapter.parseInboundPayload(payload), []);
    });

    it('should parse inbound text message correctly', () => {
      const timestamp = 1700000000000;
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: timestamp,
            messaging: [
              {
                sender: { id: 'psid_user_123' },
                recipient: { id: mockPageId },
                timestamp,
                message: {
                  mid: 'mid.1457764197618:41d102a3e1',
                  text: 'Xin chào, tôi muốn hỏi về sản phẩm',
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);

      const msg = results[0];
      assert.strictEqual(msg.eventKind, 'message');
      assert.strictEqual(msg.externalContactId, 'psid_user_123');
      assert.strictEqual(msg.externalMessageId, 'mid.1457764197618:41d102a3e1');
      assert.strictEqual(msg.content, 'Xin chào, tôi muốn hỏi về sản phẩm');
      assert.strictEqual(msg.contentType, MessageContentType.TEXT);
      assert.strictEqual(msg.attachments, undefined);
      assert.strictEqual(msg.timestamp.getTime(), timestamp);
    });

    it('should parse inbound text message from serialized JSON string', () => {
      const timestamp = 1700000000000;
      const payloadString = JSON.stringify({
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: timestamp,
            messaging: [
              {
                sender: { id: 'psid_user_123' },
                recipient: { id: mockPageId },
                timestamp,
                message: {
                  mid: 'mid.1457764197618:41d102a3e1',
                  text: 'Hello from string payload',
                },
              },
            ],
          },
        ],
      });

      const results = adapter.parseInboundPayload(payloadString);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].content, 'Hello from string payload');
    });

    it('should parse message with quick reply button payload', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'psid_user_456' },
                recipient: { id: mockPageId },
                timestamp: 1700000000000,
                message: {
                  mid: 'mid.quick_reply_1',
                  quick_reply: {
                    payload: 'PRICING_INQUIRY',
                  },
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].content, 'PRICING_INQUIRY');
    });

    it('should parse inbound image attachment message', () => {
      const timestamp = 1700000000000;
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: timestamp,
            messaging: [
              {
                sender: { id: 'psid_user_123' },
                recipient: { id: mockPageId },
                timestamp,
                message: {
                  mid: 'mid.img_1',
                  attachments: [
                    {
                      type: 'image',
                      payload: {
                        url: 'https://cdn.facebook.com/images/photo_123.jpg',
                        title: 'photo_123.jpg',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);

      const msg = results[0];
      assert.strictEqual(msg.contentType, MessageContentType.IMAGE);
      assert.strictEqual(msg.attachments?.length, 1);
      assert.strictEqual(
        msg.attachments?.[0].fileUrl,
        'https://cdn.facebook.com/images/photo_123.jpg',
      );
      assert.strictEqual(msg.attachments?.[0].contentType, MessageContentType.IMAGE);
      assert.strictEqual(msg.attachments?.[0].fileName, 'photo_123.jpg');
    });

    it('should parse inbound video, audio, and file attachments', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'psid_user_1' },
                message: {
                  mid: 'mid.video_1',
                  attachments: [
                    {
                      type: 'video',
                      payload: { url: 'https://cdn.facebook.com/video.mp4' },
                    },
                  ],
                },
              },
              {
                sender: { id: 'psid_user_2' },
                message: {
                  mid: 'mid.audio_1',
                  attachments: [
                    {
                      type: 'audio',
                      payload: { url: 'https://cdn.facebook.com/audio.mp3' },
                    },
                  ],
                },
              },
              {
                sender: { id: 'psid_user_3' },
                message: {
                  mid: 'mid.file_1',
                  attachments: [
                    {
                      type: 'file',
                      payload: {
                        url: 'https://cdn.facebook.com/document.pdf',
                        title: 'contract.pdf',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 3);

      assert.strictEqual(results[0].attachments?.[0].contentType, MessageContentType.VIDEO);
      assert.strictEqual(results[1].attachments?.[0].contentType, MessageContentType.AUDIO);
      assert.strictEqual(results[2].attachments?.[0].contentType, MessageContentType.FILE);
      assert.strictEqual(results[2].attachments?.[0].fileName, 'contract.pdf');
    });

    it('should parse location coordinates attachment', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'psid_user_loc' },
                message: {
                  mid: 'mid.location_1',
                  attachments: [
                    {
                      type: 'location',
                      payload: {
                        coordinates: {
                          lat: 10.7769,
                          long: 106.7009,
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].contentType, MessageContentType.TEXT);
      assert.strictEqual(results[0].content, '📍 Location: 10.7769, 106.7009');
    });

    it('should skip echo messages (is_echo: true)', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            messaging: [
              {
                sender: { id: mockPageId },
                recipient: { id: 'psid_user_123' },
                message: {
                  mid: 'mid.echo_123',
                  text: 'Our reply message',
                  is_echo: true,
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 0);
    });

    it('should parse Postback events (Get Started / Persistent Menu)', () => {
      const timestamp = 1700000000000;
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: timestamp,
            messaging: [
              {
                sender: { id: 'psid_postback_user' },
                recipient: { id: mockPageId },
                timestamp,
                postback: {
                  mid: 'mid.postback_1',
                  title: 'Bắt đầu',
                  payload: 'GET_STARTED_CLICKED',
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);

      const msg = results[0];
      assert.strictEqual(msg.eventKind, 'message');
      assert.strictEqual(msg.externalContactId, 'psid_postback_user');
      assert.strictEqual(msg.externalMessageId, 'mid.postback_1');
      assert.strictEqual(msg.content, 'Bắt đầu');
      assert.strictEqual(msg.contentType, MessageContentType.TEXT);
    });

    it('should parse Delivery Receipts with mids into delivery_status events', () => {
      const watermark = 1700000050000;
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: watermark,
            messaging: [
              {
                sender: { id: 'psid_delivery_user' },
                delivery: {
                  mids: ['mid.1', 'mid.2'],
                  watermark,
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 2);

      assert.strictEqual(results[0].eventKind, 'delivery_status');
      assert.strictEqual(results[0].externalMessageId, 'mid.1');
      assert.strictEqual(results[0].deliveryStatusInfo?.status, DeliveryStatus.DELIVERED);
      assert.strictEqual(results[0].deliveryStatusInfo?.externalMessageId, 'mid.1');

      assert.strictEqual(results[1].eventKind, 'delivery_status');
      assert.strictEqual(results[1].externalMessageId, 'mid.2');
      assert.strictEqual(results[1].deliveryStatusInfo?.status, DeliveryStatus.DELIVERED);
    });

    it('should parse Delivery Receipts without mids using watermark', () => {
      const watermark = 1700000050000;
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: watermark,
            messaging: [
              {
                sender: { id: 'psid_delivery_user' },
                delivery: {
                  watermark,
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].eventKind, 'delivery_status');
      assert.strictEqual(results[0].externalMessageId, `watermark_${watermark}`);
      assert.strictEqual(results[0].deliveryStatusInfo?.status, DeliveryStatus.DELIVERED);
    });

    it('should parse Read Receipts into delivery_status events', () => {
      const watermark = 1700000080000;
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: watermark,
            messaging: [
              {
                sender: { id: 'psid_read_user' },
                read: {
                  watermark,
                  mid: 'mid.read_msg_1',
                },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 1);

      const res = results[0];
      assert.strictEqual(res.eventKind, 'delivery_status');
      assert.strictEqual(res.externalMessageId, 'mid.read_msg_1');
      assert.strictEqual(res.deliveryStatusInfo?.status, DeliveryStatus.READ);
      assert.strictEqual(res.deliveryStatusInfo?.externalMessageId, 'mid.read_msg_1');
    });

    it('should parse multiple entries and standby events correctly', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: mockPageId,
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'user_1' },
                message: { mid: 'mid.1', text: 'Msg 1' },
              },
            ],
          },
          {
            id: mockPageId,
            time: 1700000000000,
            standby: [
              {
                sender: { id: 'user_2' },
                message: { mid: 'mid.2', text: 'Standby Msg' },
              },
            ],
          },
        ],
      };

      const results = adapter.parseInboundPayload(payload);
      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].content, 'Msg 1');
      assert.strictEqual(results[1].content, 'Standby Msg');
    });
  });

  describe('sendMessage()', () => {
    it('should send outbound text message via Graph API /me/messages', async () => {
      let interceptedUrl = '';
      let interceptedHeaders: Record<string, string> = {};
      let interceptedBody: Record<string, any> = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        interceptedUrl = String(url);
        interceptedHeaders = (init?.headers as Record<string, string>) || {};
        interceptedBody = JSON.parse((init?.body as string) || '{}');

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            recipient_id: 'psid_recipient_1',
            message_id: 'mid.sent_outbound_123',
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'psid_recipient_1',
        content: 'Xin chào, chúng tôi có thể hỗ trợ gì cho bạn?',
      };

      const result = await adapter.sendMessage(mockChannelContext, outboundPayload);

      assert.strictEqual(interceptedUrl, 'https://graph.facebook.com/v19.0/me/messages');
      assert.strictEqual(interceptedHeaders['Authorization'], `Bearer ${mockPageAccessToken}`);
      assert.strictEqual(interceptedBody.recipient.id, 'psid_recipient_1');
      assert.strictEqual(
        interceptedBody.message.text,
        'Xin chào, chúng tôi có thể hỗ trợ gì cho bạn?',
      );
      assert.strictEqual(interceptedBody.messaging_type, 'RESPONSE');

      assert.strictEqual(result.externalMessageId, 'mid.sent_outbound_123');
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
    });

    it('should send outbound image attachment message via Graph API', async () => {
      let interceptedBody: Record<string, any> = {};

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        interceptedBody = JSON.parse((init?.body as string) || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            recipient_id: 'psid_recipient_1',
            message_id: 'mid.attachment_sent_456',
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'psid_recipient_1',
        contentType: MessageContentType.IMAGE,
        attachments: [
          {
            fileUrl: 'https://minio.salescopilot.com/images/catalog.png',
            fileName: 'catalog.png',
            fileType: 'image/png',
          },
        ],
      };

      const result = await adapter.sendMessage(mockChannelContext, outboundPayload);

      assert.strictEqual(interceptedBody.message.attachment.type, 'image');
      assert.strictEqual(
        interceptedBody.message.attachment.payload.url,
        'https://minio.salescopilot.com/images/catalog.png',
      );
      assert.strictEqual(result.externalMessageId, 'mid.attachment_sent_456');
    });

    it('should send outbound video and file attachment with correct type', async () => {
      let interceptedBody: Record<string, any> = {};

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        interceptedBody = JSON.parse((init?.body as string) || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            recipient_id: 'psid_recipient_1',
            message_id: 'mid.video_sent',
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      await adapter.sendMessage(mockChannelContext, {
        recipientExternalId: 'psid_recipient_1',
        contentType: MessageContentType.VIDEO,
        attachments: [
          {
            fileUrl: 'https://minio.salescopilot.com/videos/demo.mp4',
            fileType: 'video/mp4',
          },
        ],
      });

      assert.strictEqual(interceptedBody.message.attachment.type, 'video');
    });

    it('should support HUMAN_AGENT tag for 24h window bypass', async () => {
      let interceptedBody: Record<string, any> = {};

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        interceptedBody = JSON.parse((init?.body as string) || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            recipient_id: 'psid_recipient_1',
            message_id: 'mid.tagged_msg_1',
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const channelWithTag: ChannelContext = {
        ...mockChannelContext,
        settings: { useHumanAgentTag: true },
      };

      await adapter.sendMessage(channelWithTag, {
        recipientExternalId: 'psid_recipient_1',
        content: 'Agent response after 24 hours',
      });

      assert.strictEqual(interceptedBody.messaging_type, 'MESSAGE_TAG');
      assert.strictEqual(interceptedBody.tag, 'HUMAN_AGENT');
    });

    it('should throw error when recipientExternalId is missing', async () => {
      await assert.rejects(async () => {
        await adapter.sendMessage(mockChannelContext, {
          recipientExternalId: '',
          content: 'Hello',
        });
      }, /Recipient external ID \(PSID\) is required/);
    });

    it('should throw error when page access token is missing', async () => {
      const emptyCredsContext: ChannelContext = {
        ...mockChannelContext,
        credentials: {},
      };

      await assert.rejects(async () => {
        await adapter.sendMessage(emptyCredsContext, {
          recipientExternalId: 'psid_1',
          content: 'Hello',
        });
      }, /Facebook Page Access Token is missing/);
    });

    it('should throw error when Facebook API returns error', async () => {
      globalThis.fetch = (async () => ({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token.',
            type: 'OAuthException',
            code: 190,
            fbtrace_id: 'E7B3',
          },
        }),
      })) as unknown as typeof globalThis.fetch;

      await assert.rejects(async () => {
        await adapter.sendMessage(mockChannelContext, {
          recipientExternalId: 'psid_1',
          content: 'Hello',
        });
      }, /Facebook API sendMessage error: \[190\] Invalid OAuth access token\./);
    });
  });

  describe('getChannelInfo()', () => {
    it('should fetch Page metadata via Graph API /me', async () => {
      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        assert.ok(urlStr.includes('https://graph.facebook.com/v19.0/me'));
        assert.ok(urlStr.includes('fields=id,name,picture.type(large)'));

        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: mockPageId,
            name: 'Alpha Global Store',
            picture: {
              data: {
                url: 'https://cdn.facebook.com/pages/avatar_1098.png',
                width: 200,
                height: 200,
              },
            },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const channelInfo = await adapter.getChannelInfo(mockChannelContext);

      assert.strictEqual(channelInfo.providerAccountId, mockPageId);
      assert.strictEqual(channelInfo.name, 'Alpha Global Store');
      assert.strictEqual(channelInfo.avatarUrl, 'https://cdn.facebook.com/pages/avatar_1098.png');
      assert.strictEqual(channelInfo.metadata?.pageId, mockPageId);
    });

    it('should throw error when getChannelInfo API call fails', async () => {
      globalThis.fetch = (async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            message: 'Session has expired.',
            code: 190,
          },
        }),
      })) as unknown as typeof globalThis.fetch;

      await assert.rejects(async () => {
        await adapter.getChannelInfo(mockChannelContext);
      }, /Facebook API getChannelInfo error: \[190\] Session has expired\./);
    });
  });

  describe('Helper Methods', () => {
    describe('fetchUserProfile()', () => {
      it('should fetch user profile data for PSID', async () => {
        globalThis.fetch = (async (url: string | URL | Request) => {
          const urlStr = String(url);
          assert.ok(urlStr.includes('psid_12345'));

          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 'psid_12345',
              first_name: 'Nguyễn',
              last_name: 'Văn A',
              name: 'Nguyễn Văn A',
              profile_pic: 'https://cdn.facebook.com/profile/12345.jpg',
            }),
          } as unknown as Response;
        }) as typeof globalThis.fetch;

        const profile = await adapter.fetchUserProfile(mockPageAccessToken, 'psid_12345');
        assert.ok(profile);
        assert.strictEqual(profile?.name, 'Nguyễn Văn A');
        assert.strictEqual(profile?.avatarUrl, 'https://cdn.facebook.com/profile/12345.jpg');
      });

      it('should return null when profile fetch fails gracefully', async () => {
        globalThis.fetch = (async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Cannot access user' } }),
        })) as unknown as typeof globalThis.fetch;

        const profile = await adapter.fetchUserProfile(mockPageAccessToken, 'invalid_psid');
        assert.strictEqual(profile, null);
      });
    });

    describe('subscribeApps() and unsubscribeApps()', () => {
      it('should subscribe page to webhook events via POST /me/subscribed_apps', async () => {
        let interceptedMethod = '';
        let interceptedBody: Record<string, any> = {};

        globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
          interceptedMethod = init?.method || 'GET';
          interceptedBody = JSON.parse((init?.body as string) || '{}');
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as unknown as Response;
        }) as typeof globalThis.fetch;

        const res = await adapter.subscribeApps(mockPageAccessToken);
        assert.strictEqual(interceptedMethod, 'POST');
        assert.deepStrictEqual(interceptedBody.subscribed_fields, [
          'messages',
          'messaging_postbacks',
          'message_deliveries',
          'message_reads',
        ]);
        assert.strictEqual(res.success, true);
      });

      it('should unsubscribe page from webhook events via DELETE /me/subscribed_apps', async () => {
        let interceptedMethod = '';

        globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
          interceptedMethod = init?.method || 'GET';
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as unknown as Response;
        }) as typeof globalThis.fetch;

        const res = await adapter.unsubscribeApps(mockPageAccessToken);
        assert.strictEqual(interceptedMethod, 'DELETE');
        assert.strictEqual(res.success, true);
      });
    });

    describe('sendSenderAction()', () => {
      it('should send sender action indicator (typing_on)', async () => {
        let interceptedBody: Record<string, any> = {};

        globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
          interceptedBody = JSON.parse((init?.body as string) || '{}');
          return {
            ok: true,
            status: 200,
            json: async () => ({ recipient_id: 'psid_recipient_1' }),
          } as unknown as Response;
        }) as typeof globalThis.fetch;

        const success = await adapter.sendSenderAction(
          mockPageAccessToken,
          'psid_recipient_1',
          'typing_on',
        );

        assert.strictEqual(success, true);
        assert.strictEqual(interceptedBody.recipient.id, 'psid_recipient_1');
        assert.strictEqual(interceptedBody.sender_action, 'typing_on');
      });
    });
  });
});
