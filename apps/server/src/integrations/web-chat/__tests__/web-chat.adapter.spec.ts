import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
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
      assert.strictEqual(adapter.channelType, ChannelType.WEB_CHAT);
    });
  });

  describe('verifyWebhook()', () => {
    it('should verify token from x-widget-token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-widget-token': 'wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token from x-website-token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-website-token': 'wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token from x-channel-token header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-channel-token': 'wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token from Authorization Bearer header', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          authorization: 'Bearer wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token from query parameters (widget_token)', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        query: {
          widget_token: 'wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token from query parameters (website_token)', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        query: {
          website_token: 'wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token from rawBody object', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
        rawBody: {
          widget_token: 'wt_secret_token_12345',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
    });

    it('should verify token matching request.webhookSecret when credentials token is not explicitly set', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-widget-token': 'custom_secret_abc',
        },
        webhookSecret: 'custom_secret_abc',
      };
      assert.strictEqual(adapter.verifyWebhook(request, {}), true);
    });

    it('should return false when configured token does not match provided token', () => {
      const request: WebhookVerificationRequest = {
        headers: {
          'x-widget-token': 'wrong_token',
        },
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), false);
    });

    it('should return false when configured token is required but no token is provided', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), false);
    });

    it('should return true when no token is configured and no credentials supplied', () => {
      const request: WebhookVerificationRequest = {
        headers: {},
      };
      assert.strictEqual(adapter.verifyWebhook(request, {}), true);
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
        assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
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
        assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), true);
      });

      it('should reject invalid HMAC signature', () => {
        const request: WebhookVerificationRequest = {
          headers: {
            'x-widget-token': 'wt_secret_token_12345',
            'x-signature-sha256': 'invalid_signature_hex_value',
          },
          query: { identifier },
        };
        assert.strictEqual(adapter.verifyWebhook(request, mockChannelContext.credentials), false);
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
        assert.strictEqual(adapter.verifyWebhook(request, credentialsWithMandatoryHmac), false);
      });
    });
  });

  describe('parseInboundPayload()', () => {
    it('should return empty array for null, undefined, or primitive rawBody', () => {
      assert.deepStrictEqual(adapter.parseInboundPayload(null), []);
      assert.deepStrictEqual(adapter.parseInboundPayload(undefined), []);
      assert.deepStrictEqual(adapter.parseInboundPayload('string_payload'), []);
      assert.deepStrictEqual(adapter.parseInboundPayload(12345), []);
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

      assert.strictEqual(results.length, 1);
      const parsed = results[0];
      assert.strictEqual(parsed.eventKind, 'message');
      assert.strictEqual(parsed.externalContactId, 'contact_tok_123');
      assert.strictEqual(parsed.externalMessageId, 'msg_client_999');
      assert.strictEqual(parsed.content, 'Hello, I need help with my billing invoice.');
      assert.strictEqual(parsed.contentType, MessageContentType.TEXT);
      assert.strictEqual(parsed.attachments, undefined);
      assert.strictEqual(parsed.senderInfo?.name, 'Jane Doe');
      assert.strictEqual(parsed.senderInfo?.email, 'jane@example.com');
      assert.strictEqual(parsed.senderInfo?.phoneNumber, '+1555123456');
      assert.strictEqual(parsed.senderInfo?.avatarUrl, 'https://example.com/avatar.png');
      assert.strictEqual(parsed.timestamp.toISOString(), '2026-08-24T00:00:00.000Z');
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

      assert.strictEqual(results.length, 1);
      const parsed = results[0];
      assert.strictEqual(parsed.externalContactId, 'visitor_abc');
      assert.strictEqual(parsed.externalMessageId, 'msg_media_001');
      assert.strictEqual(parsed.contentType, MessageContentType.IMAGE);
      assert.strictEqual(parsed.attachments?.length, 1);
      assert.strictEqual(
        parsed.attachments![0].fileUrl,
        'https://s3.amazonaws.com/uploads/screenshot.png',
      );
      assert.strictEqual(parsed.attachments![0].fileName, 'screenshot.png');
      assert.strictEqual(parsed.attachments![0].fileSize, 1048576);
      assert.strictEqual(parsed.attachments![0].contentType, MessageContentType.IMAGE);
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

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].contentType, MessageContentType.FILE);
    });

    it('should parse an array of messages', () => {
      const rawPayload = [
        { content: 'Message 1', visitorId: 'vis_1', messageId: 'm1' },
        { content: 'Message 2', visitorId: 'vis_1', messageId: 'm2' },
      ];

      const results = adapter.parseInboundPayload(rawPayload);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].content, 'Message 1');
      assert.strictEqual(results[1].content, 'Message 2');
    });

    it('should parse wrapped messages under messages property', () => {
      const rawPayload = {
        messages: [
          { content: 'Hello 1', visitorId: 'v1', messageId: 'm1' },
          { content: 'Hello 2', visitorId: 'v1', messageId: 'm2' },
        ],
      };

      const results = adapter.parseInboundPayload(rawPayload);

      assert.strictEqual(results.length, 2);
      assert.strictEqual(results[0].content, 'Hello 1');
      assert.strictEqual(results[1].content, 'Hello 2');
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

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].content, 'Wrapped data payload');
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

      assert.strictEqual(results.length, 1);
      const parsed = results[0];
      assert.strictEqual(parsed.eventKind, 'delivery_status');
      assert.strictEqual(parsed.externalMessageId, 'msg_original_456');
      assert.strictEqual(parsed.deliveryStatusInfo?.status, DeliveryStatus.READ);
      assert.strictEqual(parsed.deliveryStatusInfo?.externalMessageId, 'msg_original_456');
      assert.strictEqual(
        parsed.deliveryStatusInfo?.timestamp.toISOString(),
        '2026-08-24T00:10:00.000Z',
      );
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

      assert.strictEqual(pDate.timestamp.getTime(), now.getTime());
      assert.strictEqual(pSec.timestamp.getTime(), unixSec * 1000);
      assert.strictEqual(pMs.timestamp.getTime(), unixMs);
      assert.ok(pInvalid.timestamp instanceof Date && !isNaN(pInvalid.timestamp.getTime()));
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

      assert.strictEqual(result.externalMessageId, 'ext_conv_789');
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
      assert.strictEqual(typeof result.rawResponse, 'object');

      assert.strictEqual(emittedEvents.length, 2);
      assert.strictEqual(emittedEvents[0].event, 'widget.outbound_message');
      assert.strictEqual(emittedEvents[1].event, 'widget:message');

      const payload = emittedEvents[0].payload as any;
      assert.strictEqual(payload.workspaceId, mockChannelContext.workspaceId);
      assert.strictEqual(payload.channelId, mockChannelContext.channelId);
      assert.strictEqual(payload.recipientExternalId, 'visitor_jane_123');
      assert.strictEqual(
        payload.message.content,
        'Hi Jane, our billing team has resolved your ticket.',
      );
    });

    it('should generate externalMessageId when not provided in payload', async () => {
      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'visitor_john_456',
        content: 'Hello John',
      };

      const result = await adapter.sendMessage(mockChannelContext, outboundPayload);

      assert.ok(result.externalMessageId.startsWith('web_'));
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
    });

    it('should handle sendMessage when EventEmitter2 is not provided', async () => {
      const standaloneAdapter = new WebChatAdapter();
      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'visitor_john_456',
        content: 'Hello John',
      };

      const result = await standaloneAdapter.sendMessage(mockChannelContext, outboundPayload);

      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
    });
  });

  describe('getChannelInfo()', () => {
    it('should return complete widget configuration from channel settings and credentials', async () => {
      const info = await adapter.getChannelInfo(mockChannelContext);

      assert.strictEqual(info.name, 'Acme Support Widget');
      assert.strictEqual(info.providerAccountId, 'wt_secret_token_12345');
      assert.strictEqual(typeof info.metadata, 'object');

      const meta = info.metadata as any;
      assert.strictEqual(meta.widgetToken, 'wt_secret_token_12345');
      assert.strictEqual(meta.widgetColor, '#0066ff');
      assert.strictEqual(meta.welcomeTitle, 'Chat with Acme Team');
      assert.strictEqual(meta.welcomeTagline, 'We reply immediately');
      assert.strictEqual(meta.greetingMessage, 'Welcome! How can we assist you?');
      assert.strictEqual(meta.websiteUrl, 'https://example.com');
      assert.strictEqual(meta.replyTime, 'in_a_few_minutes');
      assert.strictEqual(meta.preChatFormEnabled, true);
      assert.strictEqual(meta.allowedDomains, 'https://example.com,https://shop.example.com');
      assert.strictEqual(meta.hmacMandatory, false);
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

      assert.strictEqual(info.name, 'Welcome to our live chat');
      const meta = info.metadata as any;
      assert.strictEqual(meta.widgetColor, '#1f93ff');
      assert.strictEqual(meta.welcomeTitle, 'Welcome to our live chat');
      assert.strictEqual(meta.welcomeTagline, 'How can we help you today?');
      assert.strictEqual(meta.greetingMessage, 'Hi! Let us know if you have any questions.');
      assert.strictEqual(meta.replyTime, 'in_a_few_minutes');
      assert.strictEqual(meta.preChatFormEnabled, false);
      assert.strictEqual(meta.allowedDomains, '*');
      assert.strictEqual(meta.hmacMandatory, false);
      assert.ok(Array.isArray(meta.preChatFormOptions?.preChatFields));
    });
  });

  describe('Helper Utilities', () => {
    describe('generateWidgetToken()', () => {
      it('should generate a random hex string with default length 40 chars (20 bytes)', () => {
        const token1 = adapter.generateWidgetToken();
        const token2 = adapter.generateWidgetToken();

        assert.strictEqual(token1.length, 40);
        assert.strictEqual(token2.length, 40);
        assert.notStrictEqual(token1, token2);
        assert.match(token1, /^[0-9a-f]+$/);
      });

      it('should respect custom byte length parameter', () => {
        const token = adapter.generateWidgetToken(16);
        assert.strictEqual(token.length, 32);
      });
    });

    describe('generateHmacSignature() & verifyHmacSignature()', () => {
      const identifier = 'user_test_identifier_123';
      const secret = 'super_secret_signing_key_456';

      it('should generate HMAC-SHA256 hex string', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        assert.strictEqual(signature.length, 64);
        assert.match(signature, /^[0-9a-f]+$/);
      });

      it('should return true for identical signature verification', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        assert.strictEqual(adapter.verifyHmacSignature(identifier, signature, secret), true);
      });

      it('should support case-insensitive hex comparison', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        assert.strictEqual(
          adapter.verifyHmacSignature(identifier, signature.toUpperCase(), secret),
          true,
        );
      });

      it('should return false for invalid signature or mismatched secret', () => {
        const signature = adapter.generateHmacSignature(identifier, secret);
        assert.strictEqual(
          adapter.verifyHmacSignature(identifier, 'wrong_signature_hex_1234', secret),
          false,
        );
        assert.strictEqual(
          adapter.verifyHmacSignature(identifier, signature, 'wrong_secret_key'),
          false,
        );
        assert.strictEqual(adapter.verifyHmacSignature('different_user', signature, secret), false);
      });

      it('should return false for empty/null arguments', () => {
        assert.strictEqual(adapter.verifyHmacSignature('', 'sig', secret), false);
        assert.strictEqual(adapter.verifyHmacSignature(identifier, '', secret), false);
        assert.strictEqual(adapter.verifyHmacSignature(identifier, 'sig', ''), false);
      });
    });

    describe('buildEmbedScript()', () => {
      it('should generate script snippet containing websiteToken and default baseUrl', () => {
        const script = adapter.buildEmbedScript('tok_website_xyz_123');

        assert.ok(script.includes("websiteToken: 'tok_website_xyz_123'"));
        assert.ok(script.includes('https://app.salescopilot.com'));
        assert.ok(script.includes('/widget/sdk.js'));
        assert.ok(script.includes('window.SalesCopilotWidget.init'));
      });

      it('should support custom baseUrl and strip trailing slash', () => {
        const script = adapter.buildEmbedScript(
          'tok_website_xyz_123',
          'https://chat.example.com///',
        );

        assert.ok(script.includes('var BASE_URL = "https://chat.example.com";'));
      });
    });
  });
});
