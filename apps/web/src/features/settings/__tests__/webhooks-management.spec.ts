import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  WebhookDeliveryStatus,
  WebhookEventType,
  type WebhookSubscriptionDto,
} from '@sales-copilot/shared-contracts';
import {
  WEBHOOK_EVENT_CATEGORIES,
  ALL_WEBHOOK_EVENT_TYPES,
  DELIVERY_STATUS_META,
} from '../constants/webhook-options';

describe('Webhook Subscriptions & Delivery Logs (Task 35)', () => {
  describe('createWebhookSubscriptionSchema Validation', () => {
    it('should validate valid webhook subscription with HTTPS URL and event types', () => {
      const payload = {
        url: 'https://api.example.com/webhooks/sales-copilot',
        subscriptions: [WebhookEventType.CONVERSATION_CREATED, WebhookEventType.MESSAGE_CREATED],
        secretKey: 'super-secret-key-123',
        isActive: true,
      };

      const parsed = createWebhookSubscriptionSchema.parse(payload);
      assert.strictEqual(parsed.url, 'https://api.example.com/webhooks/sales-copilot');
      assert.strictEqual(parsed.subscriptions.length, 2);
      assert.strictEqual(parsed.secretKey, 'super-secret-key-123');
      assert.strictEqual(parsed.isActive, true);
    });

    it('should reject HTTP non-HTTPS URLs', () => {
      const invalidPayload = {
        url: 'http://insecure-api.example.com/webhooks',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      };

      assert.throws(() => createWebhookSubscriptionSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject invalid or malformed URLs', () => {
      const invalidPayload = {
        url: 'not-a-valid-url',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      };

      assert.throws(() => createWebhookSubscriptionSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject empty event subscriptions', () => {
      const invalidPayload = {
        url: 'https://api.example.com/webhooks',
        subscriptions: [],
      };

      assert.throws(() => createWebhookSubscriptionSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject secret key shorter than 8 characters', () => {
      const invalidPayload = {
        url: 'https://api.example.com/webhooks',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
        secretKey: 'short',
      };

      assert.throws(() => createWebhookSubscriptionSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should deduplicate repeated event types', () => {
      const payload = {
        url: 'https://api.example.com/webhooks',
        subscriptions: [
          WebhookEventType.MESSAGE_CREATED,
          WebhookEventType.MESSAGE_CREATED,
          WebhookEventType.CONVERSATION_CREATED,
        ],
      };

      const parsed = createWebhookSubscriptionSchema.parse(payload);
      assert.strictEqual(parsed.subscriptions.length, 2);
    });
  });

  describe('updateWebhookSubscriptionSchema Validation', () => {
    it('should allow partial update of active state', () => {
      const payload = {
        isActive: false,
      };

      const parsed = updateWebhookSubscriptionSchema.parse(payload);
      assert.strictEqual(parsed.isActive, false);
      assert.strictEqual(parsed.url, undefined);
    });

    it('should allow partial update of subscriptions list', () => {
      const payload = {
        subscriptions: [WebhookEventType.CONTACT_CREATED, WebhookEventType.CONTACT_UPDATED],
      };

      const parsed = updateWebhookSubscriptionSchema.parse(payload);
      assert.strictEqual(parsed.subscriptions?.length, 2);
      assert.strictEqual(parsed.url, undefined);
    });
  });

  describe('Webhook Categories & Metadata Helpers', () => {
    it('should define 5 distinct event categories', () => {
      assert.strictEqual(WEBHOOK_EVENT_CATEGORIES.length, 5);
      const categoryIds = WEBHOOK_EVENT_CATEGORIES.map(c => c.id);
      assert.deepStrictEqual(categoryIds, [
        'conversations',
        'messages',
        'contacts',
        'channels',
        'labels',
      ]);
    });

    it('should contain all supported event types in ALL_WEBHOOK_EVENT_TYPES', () => {
      assert.ok(ALL_WEBHOOK_EVENT_TYPES.length >= 20);
      assert.ok(ALL_WEBHOOK_EVENT_TYPES.includes(WebhookEventType.CONVERSATION_CREATED));
      assert.ok(ALL_WEBHOOK_EVENT_TYPES.includes(WebhookEventType.MESSAGE_CREATED));
      assert.ok(ALL_WEBHOOK_EVENT_TYPES.includes(WebhookEventType.CONTACT_MERGED));
    });

    it('should provide complete status metadata for all WebhookDeliveryStatus values', () => {
      const statuses = [
        WebhookDeliveryStatus.DELIVERED,
        WebhookDeliveryStatus.FAILED,
        WebhookDeliveryStatus.EXHAUSTED,
        WebhookDeliveryStatus.RETRYING,
        WebhookDeliveryStatus.PENDING,
      ];

      for (const st of statuses) {
        const meta = DELIVERY_STATUS_META[st];
        assert.ok(meta, `Missing metadata for status ${st}`);
        assert.strictEqual(meta.status, st);
        assert.ok(meta.label.length > 0);
        assert.ok(meta.badgeStyle.length > 0);
      }
    });
  });

  describe('Webhooks Search & Filter Logic', () => {
    const mockSubscriptions: WebhookSubscriptionDto[] = [
      {
        id: 'sub-1',
        workspaceId: 'ws-1',
        url: 'https://crm.example.com/api/webhooks',
        subscriptions: [WebhookEventType.CONVERSATION_CREATED, WebhookEventType.MESSAGE_CREATED],
        secretKey: 'sec-12345678',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'sub-2',
        workspaceId: 'ws-1',
        url: 'https://analytics.example.com/events',
        subscriptions: [WebhookEventType.CONTACT_CREATED, WebhookEventType.CONTACT_UPDATED],
        secretKey: null,
        isActive: false,
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'sub-3',
        workspaceId: 'ws-1',
        url: 'https://billing.example.com/hooks/sales-copilot',
        subscriptions: [WebhookEventType.CONVERSATION_STATUS_UPDATED],
        secretKey: 'sec-87654321',
        isActive: true,
        createdAt: '2026-01-03T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
      },
    ];

    const filterSubs = (list: WebhookSubscriptionDto[], search: string, statusFilter: string) => {
      return list.filter(sub => {
        const url = sub.url.toLowerCase();
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          url.includes(q) ||
          (sub.subscriptions && sub.subscriptions.some(s => s.toLowerCase().includes(q)));

        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' && sub.isActive) ||
          (statusFilter === 'INACTIVE' && !sub.isActive);

        return matchesSearch && matchesStatus;
      });
    };

    it('should return all subscriptions when query is empty and status is ALL', () => {
      const result = filterSubs(mockSubscriptions, '', 'ALL');
      assert.strictEqual(result.length, 3);
    });

    it('should filter by URL keyword search', () => {
      const result = filterSubs(mockSubscriptions, 'crm.example', 'ALL');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'sub-1');
    });

    it('should filter by subscribed event type string', () => {
      const result = filterSubs(mockSubscriptions, 'contact.created', 'ALL');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'sub-2');
    });

    it('should filter by active/paused status', () => {
      const activeOnly = filterSubs(mockSubscriptions, '', 'ACTIVE');
      assert.strictEqual(activeOnly.length, 2);

      const pausedOnly = filterSubs(mockSubscriptions, '', 'INACTIVE');
      assert.strictEqual(pausedOnly.length, 1);
      assert.strictEqual(pausedOnly[0].id, 'sub-2');
    });
  });
});
