import { expectReject } from '../../../../../../test/test-assertions';
import * as crypto from 'crypto';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { FacebookAdapter, FacebookRateLimitError } from '../facebook.adapter';
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
      expect(adapter.channelType).toBe(ChannelType.FACEBOOK_MESSENGER);
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
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
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
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
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
      expect(adapter.verifyWebhook(request, credentials)).toBe(true);
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

      expect(adapter.verifyWebhook(request, { clientSecret: mockAppSecret })).toBe(true);
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

      expect(adapter.verifyWebhook(request, { appSecret: mockAppSecret })).toBe(true);
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

      expect(adapter.verifyWebhook(request, { appSecret: mockAppSecret })).toBe(false);
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

      expect(adapter.verifyWebhook(request, { appSecret: mockAppSecret })).toBe(false);
    });

    it('should return false when signature header is missing', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        rawBody: '{"object":"page"}',
      };

      expect(adapter.verifyWebhook(request, { appSecret: mockAppSecret })).toBe(false);
    });

    it('should return false when app secret is not provided in credentials or request', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': 'sha256=1234567890abcdef',
        },
        rawBody: '{"object":"page"}',
      };

      expect(adapter.verifyWebhook(request, {})).toBe(false);
    });

    it('should return false when rawBody is undefined or null', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-hub-signature-256': 'sha256=1234567890abcdef',
        },
        rawBody: undefined,
      };

      expect(adapter.verifyWebhook(request, { appSecret: mockAppSecret })).toBe(false);
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

      expect(adapter.verifyWebhook(request, { verifyToken: 'my_verify_token_123' })).toBe(true);
      expect(adapter.verifyWebhook(request, { verify_token: 'my_verify_token_123' })).toBe(true);
      expect(adapter.verifyWebhook(request, { webhookSecret: 'my_verify_token_123' })).toBe(true);
      expect(adapter.verifyWebhook(request, { verifyToken: 'wrong_token' })).toBe(false);
    });
  });

  describe('parseInboundPayload()', () => {
    it('should return empty array for non-JSON or invalid rawBody', () => {
      expect(adapter.parseInboundPayload('not a json')).toEqual([]);
      expect(adapter.parseInboundPayload(null)).toEqual([]);
      expect(adapter.parseInboundPayload(undefined)).toEqual([]);
      expect(adapter.parseInboundPayload(12345)).toEqual([]);
    });

    it('should return empty array for non-page webhook objects', () => {
      const payload = {
        object: 'user',
        entry: [{ id: '123', time: Date.now() }],
      };
      expect(adapter.parseInboundPayload(payload)).toEqual([]);
    });

    it('should return empty array for empty entry list', () => {
      const payload = {
        object: 'page',
        entry: [],
      };
      expect(adapter.parseInboundPayload(payload)).toEqual([]);
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
      expect(results.length).toBe(1);

      const msg = results[0];
      expect(msg.eventKind).toBe('message');
      expect(msg.externalContactId).toBe('psid_user_123');
      expect(msg.externalMessageId).toBe('mid.1457764197618:41d102a3e1');
      expect(msg.content).toBe('Xin chào, tôi muốn hỏi về sản phẩm');
      expect(msg.contentType).toBe(MessageContentType.TEXT);
      expect(msg.attachments).toBe(undefined);
      expect(msg.timestamp.getTime()).toBe(timestamp);
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
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Hello from string payload');
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
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('PRICING_INQUIRY');
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
      expect(results.length).toBe(1);

      const msg = results[0];
      expect(msg.contentType).toBe(MessageContentType.IMAGE);
      expect(msg.attachments?.length).toBe(1);
      expect(msg.attachments?.[0].fileUrl).toBe('https://cdn.facebook.com/images/photo_123.jpg');
      expect(msg.attachments?.[0].contentType).toBe(MessageContentType.IMAGE);
      expect(msg.attachments?.[0].fileName).toBe('photo_123.jpg');
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
      expect(results.length).toBe(3);

      expect(results[0].attachments?.[0].contentType).toBe(MessageContentType.VIDEO);
      expect(results[1].attachments?.[0].contentType).toBe(MessageContentType.AUDIO);
      expect(results[2].attachments?.[0].contentType).toBe(MessageContentType.FILE);
      expect(results[2].attachments?.[0].fileName).toBe('contract.pdf');
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
      expect(results.length).toBe(1);
      expect(results[0].contentType).toBe(MessageContentType.TEXT);
      expect(results[0].content).toBe('📍 Location: 10.7769, 106.7009');
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
      expect(results.length).toBe(0);
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
      expect(results.length).toBe(1);

      const msg = results[0];
      expect(msg.eventKind).toBe('message');
      expect(msg.externalContactId).toBe('psid_postback_user');
      expect(msg.externalMessageId).toBe('mid.postback_1');
      expect(msg.content).toBe('Bắt đầu');
      expect(msg.contentType).toBe(MessageContentType.TEXT);
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
      expect(results.length).toBe(2);

      expect(results[0].eventKind).toBe('delivery_status');
      expect(results[0].externalMessageId).toBe('mid.1');
      expect(results[0].deliveryStatusInfo?.status).toBe(DeliveryStatus.DELIVERED);
      expect(results[0].deliveryStatusInfo?.externalMessageId).toBe('mid.1');

      expect(results[1].eventKind).toBe('delivery_status');
      expect(results[1].externalMessageId).toBe('mid.2');
      expect(results[1].deliveryStatusInfo?.status).toBe(DeliveryStatus.DELIVERED);
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
      expect(results.length).toBe(1);
      expect(results[0].eventKind).toBe('delivery_status');
      expect(results[0].externalMessageId).toBe(`watermark_${watermark}`);
      expect(results[0].deliveryStatusInfo?.status).toBe(DeliveryStatus.DELIVERED);
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
      expect(results.length).toBe(1);

      const res = results[0];
      expect(res.eventKind).toBe('delivery_status');
      expect(res.externalMessageId).toBe('mid.read_msg_1');
      expect(res.deliveryStatusInfo?.status).toBe(DeliveryStatus.READ);
      expect(res.deliveryStatusInfo?.externalMessageId).toBe('mid.read_msg_1');
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
      expect(results.length).toBe(2);
      expect(results[0].content).toBe('Msg 1');
      expect(results[1].content).toBe('Standby Msg');
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

      expect(interceptedUrl).toBe('https://graph.facebook.com/v26.0/me/messages');
      expect(interceptedHeaders['Authorization']).toBe(`Bearer ${mockPageAccessToken}`);
      expect(interceptedBody.recipient.id).toBe('psid_recipient_1');
      expect(interceptedBody.message.text).toBe('Xin chào, chúng tôi có thể hỗ trợ gì cho bạn?');
      expect(interceptedBody.messaging_type).toBe('RESPONSE');

      expect(result.externalMessageId).toBe('mid.sent_outbound_123');
      expect(result.deliveryStatus).toBe(DeliveryStatus.SENT);
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

      expect(interceptedBody.message.attachment.type).toBe('image');
      expect(interceptedBody.message.attachment.payload.url).toBe(
        'https://minio.salescopilot.com/images/catalog.png',
      );
      expect(result.externalMessageId).toBe('mid.attachment_sent_456');
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

      expect(interceptedBody.message.attachment.type).toBe('video');
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

      expect(interceptedBody.messaging_type).toBe('MESSAGE_TAG');
      expect(interceptedBody.tag).toBe('HUMAN_AGENT');
    });

    it('should throw error when recipientExternalId is missing', async () => {
      await expectReject(async () => {
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

      await expectReject(async () => {
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

      await expectReject(async () => {
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
        expect(urlStr.includes('https://graph.facebook.com/v26.0/me')).toBeTruthy();
        expect(urlStr.includes('fields=id,name,picture.type(large)')).toBeTruthy();

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

      expect(channelInfo.providerAccountId).toBe(mockPageId);
      expect(channelInfo.name).toBe('Alpha Global Store');
      expect(channelInfo.avatarUrl).toBe('https://cdn.facebook.com/pages/avatar_1098.png');
      expect(channelInfo.metadata?.pageId).toBe(mockPageId);
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

      await expectReject(async () => {
        await adapter.getChannelInfo(mockChannelContext);
      }, /Facebook API getChannelInfo error: \[190\] Session has expired\./);
    });
  });

  describe('Helper Methods', () => {
    describe('fetchUserProfile()', () => {
      it('should fetch user profile data for PSID', async () => {
        globalThis.fetch = (async (url: string | URL | Request) => {
          const urlStr = String(url);
          expect(urlStr.includes('psid_12345')).toBeTruthy();

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
        expect(profile).toBeTruthy();
        expect(profile?.name).toBe('Nguyễn Văn A');
        expect(profile?.avatarUrl).toBe('https://cdn.facebook.com/profile/12345.jpg');
      });

      it('should return null when profile fetch fails gracefully', async () => {
        globalThis.fetch = (async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Cannot access user' } }),
        })) as unknown as typeof globalThis.fetch;

        const profile = await adapter.fetchUserProfile(mockPageAccessToken, 'invalid_psid');
        expect(profile).toBe(null);
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
        expect(interceptedMethod).toBe('POST');
        expect(interceptedBody.subscribed_fields).toEqual([
          'messages',
          'messaging_postbacks',
          'message_deliveries',
          'message_reads',
        ]);
        expect(res.success).toBe(true);
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
        expect(interceptedMethod).toBe('DELETE');
        expect(res.success).toBe(true);
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

        expect(success).toBe(true);
        expect(interceptedBody.recipient.id).toBe('psid_recipient_1');
        expect(interceptedBody.sender_action).toBe('typing_on');
      });

      it('should return false when sendSenderAction fails', async () => {
        globalThis.fetch = (async () => ({
          ok: false,
          status: 400,
          json: async () => ({ error: { message: 'Failed' } }),
        })) as unknown as typeof globalThis.fetch;

        const success = await adapter.sendSenderAction(
          mockPageAccessToken,
          'psid_recipient_1',
          'typing_off',
        );

        expect(success).toBe(false);
      });

      it('should return false when sendSenderAction throws network error', async () => {
        globalThis.fetch = (async () => {
          throw new Error('Network error');
        }) as unknown as typeof globalThis.fetch;

        const success = await adapter.sendSenderAction(
          mockPageAccessToken,
          'psid_recipient_1',
          'mark_seen',
        );

        expect(success).toBe(false);
      });
    });

    describe('subscribeApps() and unsubscribeApps() error branches', () => {
      it('should return error description when subscribeApps API returns error object', async () => {
        globalThis.fetch = (async () => ({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({
            error: {
              code: 100,
              message: 'Invalid field specified',
            },
          }),
        })) as unknown as typeof globalThis.fetch;

        const res = await adapter.subscribeApps(mockPageAccessToken, ['invalid_field']);
        expect(res.success).toBe(false);
        expect(res.description).toBe('[100] Invalid field specified');
      });

      it('should return error description when unsubscribeApps API returns error object', async () => {
        globalThis.fetch = (async () => ({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: async () => ({
            error: {
              code: 200,
              message: 'Permission denied',
            },
          }),
        })) as unknown as typeof globalThis.fetch;

        const res = await adapter.unsubscribeApps(mockPageAccessToken);
        expect(res.success).toBe(false);
        expect(res.description).toBe('[200] Permission denied');
      });
    });

    describe('Custom Graph API Version Support', () => {
      it('should use custom graphApiVersion from channel settings for sendMessage', async () => {
        let interceptedUrl = '';

        globalThis.fetch = (async (url: string | URL | Request) => {
          interceptedUrl = String(url);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              recipient_id: 'psid_1',
              message_id: 'mid.custom_version_1',
            }),
          } as unknown as Response;
        }) as typeof globalThis.fetch;

        const contextWithCustomVersion: ChannelContext = {
          ...mockChannelContext,
          settings: {
            graphApiVersion: 'v21.0',
          },
        };

        const result = await adapter.sendMessage(contextWithCustomVersion, {
          recipientExternalId: 'psid_1',
          content: 'Hello v21.0',
        });

        expect(
          interceptedUrl.includes('https://graph.facebook.com/v21.0/me/messages'),
        ).toBeTruthy();
        expect(result.externalMessageId).toBe('mid.custom_version_1');
      });

      it('should use custom graphApiVersion from channel settings for getChannelInfo', async () => {
        let interceptedUrl = '';

        globalThis.fetch = (async (url: string | URL | Request) => {
          interceptedUrl = String(url);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: mockPageId,
              name: 'Store v21',
            }),
          } as unknown as Response;
        }) as typeof globalThis.fetch;

        const contextWithCustomVersion: ChannelContext = {
          ...mockChannelContext,
          settings: {
            graphApiVersion: 'v21.0',
          },
        };

        const info = await adapter.getChannelInfo(contextWithCustomVersion);
        expect(interceptedUrl.includes('https://graph.facebook.com/v21.0/me')).toBeTruthy();
        expect(info.name).toBe('Store v21');
      });
    });

    describe('Comment Guard Graph API Methods', () => {
      const mockCreds = { pageAccessToken: 'EAA_test_token_123' };
      const commentId = '123456_789012';

      describe('hideComment()', () => {
        it('should hide comment via POST /{commentId} with is_hidden: true', async () => {
          let interceptedUrl = '';
          let interceptedHeaders: Record<string, string> = {};
          let interceptedBody: any = {};

          globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            interceptedUrl = String(url);
            interceptedHeaders = (init?.headers as Record<string, string>) || {};
            interceptedBody = JSON.parse((init?.body as string) || '{}');
            return {
              ok: true,
              status: 200,
              json: async () => ({ success: true }),
            } as unknown as Response;
          }) as typeof globalThis.fetch;

          const result = await adapter.hideComment(mockCreds, commentId);

          expect(result).toBe(true);
          expect(interceptedUrl.includes(`/v26.0/${commentId}`)).toBeTruthy();
          expect(interceptedHeaders.Authorization).toBe('Bearer EAA_test_token_123');
          expect(interceptedBody.is_hidden).toBe(true);
        });

        it('should throw error when commentId is empty', async () => {
          await expectReject(async () => {
            await adapter.hideComment(mockCreds, '');
          }, /Comment ID is required to hide comment/);
        });

        it('should throw error when pageAccessToken is missing', async () => {
          await expectReject(async () => {
            await adapter.hideComment({}, commentId);
          }, /Facebook Page Access Token is missing/);
        });

        it('should throw error when Facebook API returns error or fails', async () => {
          globalThis.fetch = (async () => ({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            json: async () => ({
              error: {
                message: '(#200) Requires pages_manage_engagement permission.',
                type: 'OAuthException',
                code: 200,
              },
            }),
          })) as unknown as typeof globalThis.fetch;

          await expectReject(async () => {
            await adapter.hideComment(mockCreds, commentId);
          }, /Facebook API hideComment error: \[200\]/);
        });

        it('should throw FacebookRateLimitError when Facebook API returns HTTP 429', async () => {
          globalThis.fetch = (async () => ({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              error: {
                message: 'Application request limit reached',
                code: 4,
              },
            }),
          })) as unknown as typeof globalThis.fetch;

          await expectReject(
            async () => {
              await adapter.hideComment(mockCreds, commentId);
            },
            (err: any) => {
              expect(err instanceof FacebookRateLimitError).toBeTruthy();
              expect(err.isRateLimit).toBe(true);
              expect(err.status).toBe(429);
              expect(err.code).toBe(4);
              return true;
            },
          );
        });
      });

      describe('sendPrivateReply()', () => {
        it('should send private reply via POST /{commentId}/private_replies', async () => {
          let interceptedUrl = '';
          let interceptedHeaders: Record<string, string> = {};
          let interceptedBody: any = {};

          globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            interceptedUrl = String(url);
            interceptedHeaders = (init?.headers as Record<string, string>) || {};
            interceptedBody = JSON.parse((init?.body as string) || '{}');
            return {
              ok: true,
              status: 200,
              json: async () => ({ id: 'm_pr_123456' }),
            } as unknown as Response;
          }) as typeof globalThis.fetch;

          const result = await adapter.sendPrivateReply(mockCreds, commentId, 'Shop chào bạn!');

          expect(result.id).toBe('m_pr_123456');
          expect(interceptedUrl.includes(`/v26.0/${commentId}/private_replies`)).toBeTruthy();
          expect(interceptedHeaders.Authorization).toBe('Bearer EAA_test_token_123');
          expect(interceptedBody.message).toBe('Shop chào bạn!');
        });

        it('should throw error when commentId or message is empty', async () => {
          await expectReject(async () => {
            await adapter.sendPrivateReply(mockCreds, '', 'Hello');
          }, /Comment ID is required to send private reply/);

          await expectReject(async () => {
            await adapter.sendPrivateReply(mockCreds, commentId, '   ');
          }, /Message content is required to send private reply/);
        });

        it('should throw error when Facebook API returns error', async () => {
          globalThis.fetch = (async () => ({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: async () => ({
              error: {
                message: 'Comment is too old to send private reply.',
                code: 100,
              },
            }),
          })) as unknown as typeof globalThis.fetch;

          await expectReject(async () => {
            await adapter.sendPrivateReply(mockCreds, commentId, 'Hello');
          }, /Facebook API sendPrivateReply error: \[100\]/);
        });

        it('should throw FacebookRateLimitError when sendPrivateReply receives HTTP 429', async () => {
          globalThis.fetch = (async () => ({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              error: {
                message: 'Page request limit reached',
                code: 32,
              },
            }),
          })) as unknown as typeof globalThis.fetch;

          await expectReject(
            async () => {
              await adapter.sendPrivateReply(mockCreds, commentId, 'Hello');
            },
            (err: any) => {
              expect(err instanceof FacebookRateLimitError).toBeTruthy();
              expect(err.isRateLimit).toBe(true);
              expect(err.status).toBe(429);
              expect(err.code).toBe(32);
              return true;
            },
          );
        });
      });

      describe('sendPublicCommentReply()', () => {
        it('should post public comment reply via POST /{commentId}/comments', async () => {
          let interceptedUrl = '';
          let interceptedHeaders: Record<string, string> = {};
          let interceptedBody: any = {};

          globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
            interceptedUrl = String(url);
            interceptedHeaders = (init?.headers as Record<string, string>) || {};
            interceptedBody = JSON.parse((init?.body as string) || '{}');
            return {
              ok: true,
              status: 200,
              json: async () => ({ id: 'comm_reply_999' }),
            } as unknown as Response;
          }) as typeof globalThis.fetch;

          const result = await adapter.sendPublicCommentReply(
            mockCreds,
            commentId,
            'Đã inbox bạn nhé!',
          );

          expect(result.id).toBe('comm_reply_999');
          expect(interceptedUrl.includes(`/v26.0/${commentId}/comments`)).toBeTruthy();
          expect(interceptedHeaders.Authorization).toBe('Bearer EAA_test_token_123');
          expect(interceptedBody.message).toBe('Đã inbox bạn nhé!');
        });

        it('should throw error when commentId or message is empty', async () => {
          await expectReject(async () => {
            await adapter.sendPublicCommentReply(mockCreds, '', 'Hello');
          }, /Comment ID is required to send public comment reply/);

          await expectReject(async () => {
            await adapter.sendPublicCommentReply(mockCreds, commentId, '');
          }, /Message content is required to send public comment reply/);
        });

        it('should throw error when Facebook API returns error', async () => {
          globalThis.fetch = (async () => ({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            json: async () => ({
              error: {
                message: 'Cannot comment on hidden post.',
                code: 100,
              },
            }),
          })) as unknown as typeof globalThis.fetch;

          await expectReject(async () => {
            await adapter.sendPublicCommentReply(mockCreds, commentId, 'Hello');
          }, /Facebook API sendPublicCommentReply error: \[100\]/);
        });

        it('should throw FacebookRateLimitError when sendPublicCommentReply receives HTTP 429', async () => {
          globalThis.fetch = (async () => ({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              error: {
                message: 'Rate limit exceeded',
                code: 613,
              },
            }),
          })) as unknown as typeof globalThis.fetch;

          await expectReject(
            async () => {
              await adapter.sendPublicCommentReply(mockCreds, commentId, 'Hello');
            },
            (err: any) => {
              expect(err instanceof FacebookRateLimitError).toBeTruthy();
              expect(err.isRateLimit).toBe(true);
              expect(err.status).toBe(429);
              expect(err.code).toBe(613);
              return true;
            },
          );
        });
      });
    });
  });
});
