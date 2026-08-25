import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  webhookSubscriptionListQuerySchema,
  WebhookEventType,
  WebhookDeliveryStatus,
} from '../index';

describe('Shared Contracts — Webhook Subscriptions Schemas (F-1.9.3)', () => {
  describe('createWebhookSubscriptionSchema', () => {
    it('should validate valid payload with HTTPS url and subscriptions array', () => {
      const valid = {
        url: 'https://example.com/webhooks/sales',
        subscriptions: [
          WebhookEventType.MESSAGE_CREATED,
          WebhookEventType.CONVERSATION_STATUS_UPDATED,
        ],
        secretKey: 'custom-secret-key-123',
        isActive: true,
      };

      const parsed = createWebhookSubscriptionSchema.parse(valid);
      assert.strictEqual(parsed.url, 'https://example.com/webhooks/sales');
      assert.deepStrictEqual(parsed.subscriptions, [
        'message.created',
        'conversation.status_updated',
      ]);
      assert.strictEqual(parsed.secretKey, 'custom-secret-key-123');
      assert.strictEqual(parsed.isActive, true);
    });

    it('should accept events alias and secret alias', () => {
      const payload = {
        url: 'https://api.crm.com/incoming',
        events: [WebhookEventType.CONTACT_CREATED],
        secret: 'my-super-secure-token',
      };

      const parsed = createWebhookSubscriptionSchema.parse(payload);
      assert.strictEqual(parsed.url, 'https://api.crm.com/incoming');
      assert.deepStrictEqual(parsed.subscriptions, ['contact.created']);
      assert.strictEqual(parsed.secretKey, 'my-super-secure-token');
      assert.strictEqual(parsed.isActive, true);
    });

    it('should reject non-HTTPS URLs (e.g. http:// or invalid format)', () => {
      assert.throws(() => {
        createWebhookSubscriptionSchema.parse({
          url: 'http://insecure.example.com/webhook',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
        });
      }, /Webhook URL must use HTTPS protocol/);

      assert.throws(() => {
        createWebhookSubscriptionSchema.parse({
          url: 'not-a-valid-url',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
        });
      }, /Invalid URL format/);
    });

    it('should reject empty subscriptions/events', () => {
      assert.throws(() => {
        createWebhookSubscriptionSchema.parse({
          url: 'https://example.com/webhook',
          subscriptions: [],
        });
      });

      assert.throws(() => {
        createWebhookSubscriptionSchema.parse({
          url: 'https://example.com/webhook',
        });
      });
    });

    it('should reject invalid/unsupported event types', () => {
      assert.throws(() => {
        createWebhookSubscriptionSchema.parse({
          url: 'https://example.com/webhook',
          subscriptions: ['unknown.event.type'],
        });
      });
    });

    it('should reject secret shorter than 8 characters', () => {
      assert.throws(() => {
        createWebhookSubscriptionSchema.parse({
          url: 'https://example.com/webhook',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
          secretKey: 'short',
        });
      }, /Secret must be at least 8 characters/);
    });

    it('should deduplicate subscription event items', () => {
      const payload = {
        url: 'https://example.com/webhook',
        subscriptions: [
          WebhookEventType.MESSAGE_CREATED,
          WebhookEventType.MESSAGE_CREATED,
          WebhookEventType.CONTACT_CREATED,
        ],
      };

      const parsed = createWebhookSubscriptionSchema.parse(payload);
      assert.deepStrictEqual(parsed.subscriptions, [
        WebhookEventType.MESSAGE_CREATED,
        WebhookEventType.CONTACT_CREATED,
      ]);
    });
  });

  describe('updateWebhookSubscriptionSchema', () => {
    it('should allow partial updates', () => {
      const partial1 = { isActive: false };
      const parsed1 = updateWebhookSubscriptionSchema.parse(partial1);
      assert.strictEqual(parsed1.isActive, false);
      assert.strictEqual(parsed1.url, undefined);

      const partial2 = {
        url: 'https://new-endpoint.com/webhook',
        subscriptions: [WebhookEventType.CHANNEL_CREATED],
      };
      const parsed2 = updateWebhookSubscriptionSchema.parse(partial2);
      assert.strictEqual(parsed2.url, 'https://new-endpoint.com/webhook');
      assert.deepStrictEqual(parsed2.subscriptions, [WebhookEventType.CHANNEL_CREATED]);
    });

    it('should reject non-HTTPS URLs on update', () => {
      assert.throws(() => {
        updateWebhookSubscriptionSchema.parse({
          url: 'http://insecure.endpoint.com/hook',
        });
      }, /Webhook URL must use HTTPS protocol/);
    });
  });

  describe('webhookSubscriptionListQuerySchema', () => {
    it('should parse boolean string for isActive', () => {
      const q1 = webhookSubscriptionListQuerySchema.parse({ isActive: 'true' });
      assert.strictEqual(q1.isActive, true);

      const q2 = webhookSubscriptionListQuerySchema.parse({ isActive: 'false' });
      assert.strictEqual(q2.isActive, false);

      const q3 = webhookSubscriptionListQuerySchema.parse({});
      assert.strictEqual(q3.isActive, undefined);
    });

    it('should parse search query and event filter', () => {
      const query = webhookSubscriptionListQuerySchema.parse({
        search: 'https://example.com',
        event: WebhookEventType.MESSAGE_CREATED,
      });

      assert.strictEqual(query.search, 'https://example.com');
      assert.strictEqual(query.event, WebhookEventType.MESSAGE_CREATED);
    });
  });

  describe('WebhookDeliveryStatus Enum', () => {
    it('should have all expected status values', () => {
      assert.strictEqual(WebhookDeliveryStatus.PENDING, 'PENDING');
      assert.strictEqual(WebhookDeliveryStatus.DELIVERED, 'DELIVERED');
      assert.strictEqual(WebhookDeliveryStatus.FAILED, 'FAILED');
      assert.strictEqual(WebhookDeliveryStatus.RETRYING, 'RETRYING');
      assert.strictEqual(WebhookDeliveryStatus.EXHAUSTED, 'EXHAUSTED');
    });
  });
});
