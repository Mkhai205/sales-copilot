import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { WebChatAdapter } from '../web-chat.adapter';
import {
  ChannelContext,
  OutboundMessagePayload,
  WebhookVerificationRequest,
} from '../../channel-adapter.types';

describe('WebChatAdapter (Web Chat Widget Channel Integration)', () => {
  let adapter: WebChatAdapter;
  let mockEventEmitter: EventEmitter2;
  let emittedEvents: Array<{ event: string; payload: unknown }>;

  const mockChannelContext: ChannelContext = {
    channelId: 'chan_webchat_1',
    inboxId: 'inbox_webchat_1',
    workspaceId: 'ws_test_1',
    channelType: ChannelType.WEB_CHAT,
    credentials: {
      widgetToken: 'wt_secret_token_12345',
      hmacSecret: 'hmac_super_secret_key',
    },
    settings: {
      name: 'Acme Support Widget',
      widgetColor: '#0066ff',
      welcomeTitle: 'Chat with Acme Team',
      welcomeTagline: 'We reply immediately',
      greetingMessage: 'Welcome! How can we assist you?',
      websiteUrl: 'https://example.com',
      replyTime: 'in_a_few_minutes',
      preChatFormEnabled: true,
      allowedDomains: 'https://example.com,https://shop.example.com',
      hmacMandatory: false,
    },
    providerAccountId: 'wt_secret_token_12345',
  };

  beforeEach(() => {
    emittedEvents = [];
    mockEventEmitter = {
      emit: (event: string, payload: unknown) => {
        emittedEvents.push({ event, payload });
        return true;
      },
    } as unknown as EventEmitter2;

    adapter = new WebChatAdapter(mockEventEmitter);
  });

  describe('Adapter Configuration', () => {
    it('should declare channelType as WEB_CHAT', () => {
      expect(adapter.channelType).toBe(ChannelType.WEB_CHAT);
    });
  });

  describe('verifyWebhook()', () => {
    it('should verify token from x-widget-token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-widget-token': 'wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token from x-website-token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-website-token': 'wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token from x-channel-token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-channel-token': 'wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token from Authorization Bearer header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          authorization: 'Bearer wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token from query parameters (widget_token)', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        query: {
          widget_token: 'wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token from query parameters (website_token)', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        query: {
          website_token: 'wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token from rawBody object', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        rawBody: {
          widget_token: 'wt_secret_token_12345',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
    });

    it('should verify token matching request.webhookSecret when credentials token is not explicitly set', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-widget-token': 'custom_secret_abc',
        },
        webhookSecret: 'custom_secret_abc',
      };
      expect(adapter.verifyWebhook(request, {})).toBe(true);
    });

    it('should return false when configured token does not match provided token', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-widget-token': 'wrong_token',
        },
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
    });

    it('should return false when configured token is required but no token is provided', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
    });

    it('should return true when no token is configured and no credentials supplied', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      expect(adapter.verifyWebhook(request, {})).toBe(true);
    });

    describe('HMAC verification in verifyWebhook()', () => {
      const identifier = 'user_john_doe_99';
      const secret = 'hmac_super_secret_key';

      it('should verify valid HMAC signature with x-signature-sha256 header', () => {
        const validSignature = adapter.generateHmacSignature(identifier, secret);
        const request: WebhookVerificationRequest = {
          headers: {
            'x-widget-token': 'wt_secret_token_12345',
            'x-signature-sha256': validSignature,
          },
          query: { identifier },
        };
        expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
      });

      it('should strip sha256= prefix and verify valid signature with x-hub-signature-256', () => {
        const validSignature = adapter.generateHmacSignature(identifier, secret);
        const request: WebhookVerificationRequest = {
          headers: {
            'x-widget-token': 'wt_secret_token_12345',
            'x-hub-signature-256': `sha256=${validSignature}`,
          },
          query: { identifier },
        };
        expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(true);
      });

      it('should reject invalid HMAC signature', () => {
        const request: WebhookVerificationRequest = {
          headers: {
            'x-widget-token': 'wt_secret_token_12345',
            'x-signature-sha256': 'invalid_signature_hex_value',
          },
          query: { identifier },
        };
        expect(adapter.verifyWebhook(request, mockChannelContext.credentials)).toBe(false);
      });

      it('should reject when HMAC is mandatory but signature header is missing', () => {
        const credentialsWithMandatoryHmac = {
          widgetToken: 'wt_secret_token_12345',
          hmacSecret: secret,
          hmacMandatory: true,
        };
        const request: WebhookVerificationRequest = {
          headers: {
            'x-widget-token': 'wt_secret_token_12345',
          },
          query: { identifier },
        };
        expect(adapter.verifyWebhook(request, credentialsWithMandatoryHmac)).toBe(false);
      });
    });
  });

  describe('parseInboundPayload()', () => {
    it('should return empty array for null, undefined, or primitive rawBody', () => {
      expect(adapter.parseInboundPayload(null)).toEqual([]);
      expect(adapter.parseInboundPayload(undefined)).toEqual([]);
      expect(adapter.parseInboundPayload('string_payload')).toEqual([]);
      expect(adapter.parseInboundPayload(12345)).toEqual([]);
    });

    it('should parse single standard text message payload', () => {
      const rawPayload = {
        content: 'Hello, I need help with my billing invoice.',
        contentType: 'TEXT',
        contactToken: 'contact_tok_123',
        externalMessageId: 'msg_client_999',
        senderInfo: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '+1555123456',
          avatarUrl: 'https://example.com/avatar.png',
        },
        timestamp: '2026-08-24T00:00:00.000Z',
      };

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(1);
      const parsed = results[0];
      expect(parsed.eventKind).toBe('message');
      expect(parsed.externalContactId).toBe('contact_tok_123');
      expect(parsed.externalMessageId).toBe('msg_client_999');
      expect(parsed.content).toBe('Hello, I need help with my billing invoice.');
      expect(parsed.contentType).toBe(MessageContentType.TEXT);
      expect(parsed.attachments).toBe(undefined);
      expect(parsed.senderInfo?.name).toBe('Jane Doe');
      expect(parsed.senderInfo?.email).toBe('jane@example.com');
      expect(parsed.senderInfo?.phoneNumber).toBe('+1555123456');
      expect(parsed.senderInfo?.avatarUrl).toBe('https://example.com/avatar.png');
      expect(parsed.timestamp.toISOString()).toBe('2026-08-24T00:00:00.000Z');
    });

    it('should parse message with media attachments', () => {
      const rawPayload = {
        content: 'Here is the screenshot',
        contentType: 'IMAGE',
        visitorId: 'visitor_abc',
        messageId: 'msg_media_001',
        attachments: [
          {
            fileUrl: 'https://s3.amazonaws.com/uploads/screenshot.png',
            fileName: 'screenshot.png',
            fileType: 'image/png',
            fileSize: 1048576,
            contentType: 'IMAGE',
          },
        ],
      };

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(1);
      const parsed = results[0];
      expect(parsed.externalContactId).toBe('visitor_abc');
      expect(parsed.externalMessageId).toBe('msg_media_001');
      expect(parsed.contentType).toBe(MessageContentType.IMAGE);
      expect(parsed.attachments?.length).toBe(1);
      expect(parsed.attachments![0].fileUrl).toBe(
        'https://s3.amazonaws.com/uploads/screenshot.png',
      );
      expect(parsed.attachments![0].fileName).toBe('screenshot.png');
      expect(parsed.attachments![0].fileSize).toBe(1048576);
      expect(parsed.attachments![0].contentType).toBe(MessageContentType.IMAGE);
    });

    it('should derive contentType from attachments when content is empty', () => {
      const rawPayload = {
        visitorId: 'visitor_abc',
        attachments: [
          {
            fileUrl: 'https://example.com/document.pdf',
            fileName: 'document.pdf',
            contentType: 'FILE',
          },
        ],
      };

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(1);
      expect(results[0].contentType).toBe(MessageContentType.FILE);
    });

    it('should parse an array of messages', () => {
      const rawPayload = [
        { content: 'Message 1', visitorId: 'vis_1', messageId: 'm1' },
        { content: 'Message 2', visitorId: 'vis_1', messageId: 'm2' },
      ];

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(2);
      expect(results[0].content).toBe('Message 1');
      expect(results[1].content).toBe('Message 2');
    });

    it('should parse wrapped messages under messages property', () => {
      const rawPayload = {
        messages: [
          { content: 'Hello 1', visitorId: 'v1', messageId: 'm1' },
          { content: 'Hello 2', visitorId: 'v1', messageId: 'm2' },
        ],
      };

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(2);
      expect(results[0].content).toBe('Hello 1');
      expect(results[1].content).toBe('Hello 2');
    });

    it('should parse wrapped payload under data property', () => {
      const rawPayload = {
        data: {
          content: 'Wrapped data payload',
          visitorId: 'v_data',
          messageId: 'm_data',
        },
      };

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Wrapped data payload');
    });

    it('should parse delivery_status events accurately', () => {
      const rawPayload = {
        eventKind: 'delivery_status',
        visitorId: 'visitor_123',
        deliveryStatusInfo: {
          externalMessageId: 'msg_original_456',
          status: DeliveryStatus.READ,
          timestamp: '2026-08-24T00:10:00.000Z',
        },
      };

      const results = adapter.parseInboundPayload(rawPayload);

      expect(results.length).toBe(1);
      const parsed = results[0];
      expect(parsed.eventKind).toBe('delivery_status');
      expect(parsed.externalMessageId).toBe('msg_original_456');
      expect(parsed.deliveryStatusInfo?.status).toBe(DeliveryStatus.READ);
      expect(parsed.deliveryStatusInfo?.externalMessageId).toBe('msg_original_456');
      expect(parsed.deliveryStatusInfo?.timestamp.toISOString()).toBe('2026-08-24T00:10:00.000Z');
    });

    it('should handle timestamp formats: unix seconds, unix milliseconds, Date instance, and fallback', () => {
      const now = new Date();
      const unixSec = 1700000000;
      const unixMs = 1700000000000;

      const pDate = adapter.parseInboundPayload({ content: 'Test', timestamp: now })[0];
      const pSec = adapter.parseInboundPayload({ content: 'Test', timestamp: unixSec })[0];
      const pMs = adapter.parseInboundPayload({ content: 'Test', timestamp: unixMs })[0];
      const pInvalid = adapter.parseInboundPayload({
        content: 'Test',
        timestamp: 'invalid_date',
      })[0];

      expect(pDate.timestamp.getTime()).toBe(now.getTime());
      expect(pSec.timestamp.getTime()).toBe(unixSec * 1000);
      expect(pMs.timestamp.getTime()).toBe(unixMs);
      expect(
        pInvalid.timestamp instanceof Date && !isNaN(pInvalid.timestamp.getTime()),
      ).toBeTruthy();
    });
  });

  describe('sendMessage()', () => {
    it('should emit widget outbound event via EventEmitter2 and return SendMessageResult', async () => {
      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'visitor_jane_123',
        content: 'Hi Jane, our billing team has resolved your ticket.',
        contentType: MessageContentType.TEXT,
        externalConversationId: 'ext_conv_789',
      };

      const result = await adapter.sendMessage(mockChannelContext, outboundPayload);

      expect(result.externalMessageId).toBe('ext_conv_789');
      expect(result.deliveryStatus).toBe(DeliveryStatus.SENT);
      expect(typeof result.rawResponse).toBe('object');

      expect(emittedEvents.length).toBe(2);
      expect(emittedEvents[0].event).toBe('widget.outbound_message');
      expect(emittedEvents[1].event).toBe('widget:message');

      const payload = emittedEvents[0].payload as any;
      expect(payload.workspaceId).toBe(mockChannelContext.workspaceId);
      expect(payload.channelId).toBe(mockChannelContext.channelId);
      expect(payload.recipientExternalId).toBe('visitor_jane_123');
      expect(payload.message.content).toBe('Hi Jane, our billing team has resolved your ticket.');
    });

    it('should generate externalMessageId when not provided in payload', async () => {
      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'visitor_john_456',
        content: 'Hello John',
      };

      const result = await adapter.sendMessage(mockChannelContext, outboundPayload);

      expect(result.externalMessageId.startsWith('web_')).toBeTruthy();
      expect(result.deliveryStatus).toBe(DeliveryStatus.SENT);
    });

    it('should handle sendMessage when EventEmitter2 is not provided', async () => {
      const standaloneAdapter = new WebChatAdapter();
      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'visitor_john_456',
        content: 'Hello John',
      };

      const result = await standaloneAdapter.sendMessage(mockChannelContext, outboundPayload);

      expect(result.deliveryStatus).toBe(DeliveryStatus.SENT);
    });
  });

  describe('getChannelInfo()', () => {
    it('should return complete widget configuration from channel settings and credentials', async () => {
      const info = await adapter.getChannelInfo(mockChannelContext);

      expect(info.name).toBe('Acme Support Widget');
      expect(info.providerAccountId).toBe('wt_secret_token_12345');
      expect(typeof info.metadata).toBe('object');

      const meta = info.metadata as any;
      expect(meta.widgetToken).toBe('wt_secret_token_12345');
      expect(meta.widgetColor).toBe('#0066ff');
      expect(meta.welcomeTitle).toBe('Chat with Acme Team');
      expect(meta.welcomeTagline).toBe('We reply immediately');
      expect(meta.greetingMessage).toBe('Welcome! How can we assist you?');
      expect(meta.websiteUrl).toBe('https://example.com');
      expect(meta.replyTime).toBe('in_a_few_minutes');
      expect(meta.preChatFormEnabled).toBe(true);
      expect(meta.allowedDomains).toBe('https://example.com,https://shop.example.com');
      expect(meta.hmacMandatory).toBe(false);
    });

    it('should return default fallback widget config when settings are empty', async () => {
      const emptyContext: ChannelContext = {
        channelId: 'chan_empty',
        inboxId: 'inbox_empty',
        workspaceId: 'ws_empty',
        channelType: ChannelType.WEB_CHAT,
        credentials: {},
        settings: {},
      };

      const info = await adapter.getChannelInfo(emptyContext);

      expect(info.name).toBe('Welcome to our live chat');
      const meta = info.metadata as any;
      expect(meta.widgetColor).toBe('#1f93ff');
      expect(meta.welcomeTitle).toBe('Welcome to our live chat');
      expect(meta.welcomeTagline).toBe('How can we help you today?');
      expect(meta.greetingMessage).toBe('Hi! Let us know if you have any questions.');
      expect(meta.replyTime).toBe('in_a_few_minutes');
      expect(meta.preChatFormEnabled).toBe(false);
      expect(meta.allowedDomains).toBe('*');
      expect(meta.hmacMandatory).toBe(false);
      expect(Array.isArray(meta.preChatFormOptions?.preChatFields)).toBeTruthy();
    });
  });

  describe('Helper Utilities', () => {
    describe('generateWidgetToken()', () => {
      it('should generate a random hex string with default length 40 chars (20 bytes)', () => {
        const token1 = adapter.generateWidgetToken();
        const token2 = adapter.generateWidgetToken();

        expect(token1.length).toBe(40);
        expect(token2.length).toBe(40);
        expect(token1).not.toBe(token2);
        expect(token1).toMatch(/^[0-9a-f]+$/);
      });

      it('should respect custom byte length parameter', () => {
        const token = adapter.generateWidgetToken(16);
        expect(token.length).toBe(32);
      });
    });

    describe('generateHmacSignature() & verifyHmacSignature()', () => {
      const identifier = 'user_test_identifier_123';
      const secret = 'super_secret_signing_key_456';

      it('should generate HMAC-SHA256 hex string', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        expect(signature.length).toBe(64);
        expect(signature).toMatch(/^[0-9a-f]+$/);
      });

      it('should return true for identical signature verification', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        expect(adapter.verifyHmacSignature(identifier, signature, secret)).toBe(true);
      });

      it('should support case-insensitive hex comparison', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        expect(adapter.verifyHmacSignature(identifier, signature.toUpperCase(), secret)).toBe(true);
      });

      it('should return false for invalid signature or mismatched secret', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        expect(adapter.verifyHmacSignature(identifier, 'wrong_signature_hex_1234', secret)).toBe(
          false,
        );
        expect(adapter.verifyHmacSignature(identifier, signature, 'wrong_secret_key')).toBe(false);
        expect(adapter.verifyHmacSignature('different_user', signature, secret)).toBe(false);
      });

      it('should return false for empty/null arguments', () => {
        expect(adapter.verifyHmacSignature('', 'sig', secret)).toBe(false);
        expect(adapter.verifyHmacSignature(identifier, '', secret)).toBe(false);
        expect(adapter.verifyHmacSignature(identifier, 'sig', '')).toBe(false);
      });
    });

    describe('buildEmbedScript()', () => {
      it('should generate script snippet containing websiteToken and default baseUrl', () => {
        const script = adapter.buildEmbedScript('tok_website_xyz_123');

        expect(script.includes("websiteToken: 'tok_website_xyz_123'")).toBeTruthy();
        expect(script.includes('https://app.salescopilot.com')).toBeTruthy();
        expect(script.includes('/widget/sdk.js')).toBeTruthy();
        expect(script.includes('window.SalesCopilotWidget.init')).toBeTruthy();
      });

      it('should support custom baseUrl and strip trailing slash', () => {
        const script = adapter.buildEmbedScript(
          'tok_website_xyz_123',
          'https://chat.example.com///',
        );

        expect(script.includes('var BASE_URL = "https://chat.example.com";')).toBeTruthy();
      });
    });
  });
});
