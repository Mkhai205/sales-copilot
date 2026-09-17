import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ConversationStatus, ConversationPriority } from '../../omnichannel';
import {
  AutomationEventTrigger,
  AutomationAttribute,
  AutomationOperator,
  AutomationActionType,
  automationConditionSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  automationRuleListQuerySchema,
  createWebhookSubscriptionSchema,
  updateWebhookSubscriptionSchema,
  webhookSubscriptionListQuerySchema,
  webhookDeliveryListQuerySchema,
  WebhookEventType,
  WebhookDeliveryStatus,
} from '../index';

describe('Shared Contracts — Automation Context Schemas', () => {
  describe('Automation Rules Schemas', () => {
    describe('automationConditionSchema', () => {
      it('should validate valid condition payload', () => {
        const valid = {
          attribute: AutomationAttribute.INBOX_ID,
          operator: AutomationOperator.EQUAL,
          values: ['inbox_123'],
        };
        const result = automationConditionSchema.parse(valid);
        assert.strictEqual(result.attribute, AutomationAttribute.INBOX_ID);
        assert.strictEqual(result.operator, AutomationOperator.EQUAL);
        assert.deepStrictEqual(result.values, ['inbox_123']);
      });

      it('should default values to empty array if omitted', () => {
        const condition = {
          attribute: AutomationAttribute.CONTENT,
          operator: AutomationOperator.IS_PRESENT,
        };
        const result = automationConditionSchema.parse(condition);
        assert.deepStrictEqual(result.values, []);
      });

      it('should reject invalid attribute or operator', () => {
        assert.throws(() => {
          automationConditionSchema.parse({
            attribute: 'invalid_attr',
            operator: AutomationOperator.EQUAL,
          });
        });

        assert.throws(() => {
          automationConditionSchema.parse({
            attribute: AutomationAttribute.STATUS,
            operator: 'INVALID_OP',
          });
        });
      });
    });

    describe('createAutomationRuleSchema', () => {
      it('should validate full createAutomationRule payload', () => {
        const valid = {
          name: 'Auto Assign VIP Inquiries',
          description: 'Assigns VIP inquiries to high priority team',
          eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
          conditions: [
            {
              attribute: AutomationAttribute.STATUS,
              operator: AutomationOperator.EQUAL,
              values: [ConversationStatus.OPEN],
            },
            {
              attribute: AutomationAttribute.CONTENT,
              operator: AutomationOperator.CONTAINS,
              values: ['pricing', 'quote'],
            },
          ],
          actions: [
            {
              type: AutomationActionType.ASSIGN_TEAM,
              params: { teamId: 'team_sales' },
            },
            {
              type: AutomationActionType.ADD_LABEL,
              params: { labelTitle: 'vip' },
            },
            {
              type: AutomationActionType.CHANGE_PRIORITY,
              params: { priority: ConversationPriority.URGENT },
            },
            {
              type: AutomationActionType.SEND_WEBHOOK,
              params: { url: 'https://webhook.site/abc' },
            },
          ],
          isActive: true,
        };

        const result = createAutomationRuleSchema.parse(valid);
        assert.strictEqual(result.name, 'Auto Assign VIP Inquiries');
        assert.strictEqual(result.eventTrigger, AutomationEventTrigger.CONVERSATION_CREATED);
        assert.strictEqual(result.conditions.length, 2);
        assert.strictEqual(result.actions.length, 4);
        assert.strictEqual(result.isActive, true);
      });

      it('should validate minimal rule and apply default values', () => {
        const minimal = {
          name: 'Simple Rule',
          eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
          actions: [
            {
              type: AutomationActionType.ADD_LABEL,
              params: { labelTitle: 'new' },
            },
          ],
        };
        const result = createAutomationRuleSchema.parse(minimal);
        assert.strictEqual(result.name, 'Simple Rule');
        assert.deepStrictEqual(result.conditions, []);
        assert.strictEqual(result.actions.length, 1);
        assert.strictEqual(result.isActive, true);
      });

      it('should reject missing name or eventTrigger or empty actions', () => {
        assert.throws(() => {
          createAutomationRuleSchema.parse({
            eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
            actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'new' } }],
          });
        });

        assert.throws(() => {
          createAutomationRuleSchema.parse({
            name: 'Rule Without Trigger',
            actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'new' } }],
          });
        });

        assert.throws(() => {
          createAutomationRuleSchema.parse({
            name: 'Rule Without Actions',
            eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
            actions: [],
          });
        });
      });
    });

    describe('updateAutomationRuleSchema', () => {
      it('should allow partial updates', () => {
        const result = updateAutomationRuleSchema.parse({
          name: 'Updated Name',
          isActive: false,
        });
        assert.strictEqual(result.name, 'Updated Name');
        assert.strictEqual(result.isActive, false);
      });
    });

    describe('automationRuleListQuerySchema', () => {
      it('should parse query with boolean coercion and filters', () => {
        const parsed = automationRuleListQuerySchema.parse({
          isActive: 'true',
          search: 'VIP',
          eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        });
        assert.strictEqual(parsed.isActive, true);
        assert.strictEqual(parsed.search, 'VIP');
        assert.strictEqual(parsed.eventTrigger, AutomationEventTrigger.CONVERSATION_CREATED);
      });
    });
  });

  describe('Webhook Subscriptions Schemas', () => {
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
            WebhookEventType.CONVERSATION_CREATED,
          ],
        };

        const parsed = createWebhookSubscriptionSchema.parse(payload);
        assert.strictEqual(parsed.subscriptions.length, 2);
        assert.deepStrictEqual(parsed.subscriptions, ['message.created', 'conversation.created']);
      });
    });

    describe('updateWebhookSubscriptionSchema', () => {
      it('should allow partial updates', () => {
        const parsed = updateWebhookSubscriptionSchema.parse({
          isActive: false,
        });
        assert.strictEqual(parsed.isActive, false);
      });

      it('should reject non-HTTPS URLs on update', () => {
        assert.throws(() => {
          updateWebhookSubscriptionSchema.parse({
            url: 'http://insecure.example.com/webhook',
          });
        }, /Webhook URL must use HTTPS protocol/);
      });
    });

    describe('webhookSubscriptionListQuerySchema & Delivery Query', () => {
      it('should parse boolean string for isActive', () => {
        const parsed = webhookSubscriptionListQuerySchema.parse({
          isActive: 'true',
          search: 'crm',
        });
        assert.strictEqual(parsed.isActive, true);
        assert.strictEqual(parsed.search, 'crm');
      });

      it('should parse valid delivery query options with defaults', () => {
        const parsed = webhookDeliveryListQuerySchema.parse({
          status: WebhookDeliveryStatus.FAILED,
        });
        assert.strictEqual(parsed.status, WebhookDeliveryStatus.FAILED);
        assert.strictEqual(parsed.page, 1);
        assert.strictEqual(parsed.limit, 20);
      });
    });
  });
});
