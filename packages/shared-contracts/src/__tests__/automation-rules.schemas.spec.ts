import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  AutomationEventTrigger,
  AutomationAttribute,
  AutomationOperator,
  AutomationActionType,
  automationConditionSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  automationRuleListQuerySchema,
  ConversationStatus,
  ConversationPriority,
} from '../index';

describe('Shared Contracts — Automation Rules Schemas (F-1.9.1)', () => {
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

    it('should reject when actions array is empty', () => {
      assert.throws(() => {
        createAutomationRuleSchema.parse({
          name: 'No Action Rule',
          eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
          conditions: [],
          actions: [],
        });
      });
    });

    it('should reject invalid webhook URL format in actions', () => {
      assert.throws(() => {
        createAutomationRuleSchema.parse({
          name: 'Invalid Webhook Action',
          eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
          conditions: [],
          actions: [
            {
              type: AutomationActionType.SEND_WEBHOOK,
              params: { url: 'not-a-valid-url' },
            },
          ],
        });
      });
    });

    it('should reject invalid action params', () => {
      assert.throws(() => {
        createAutomationRuleSchema.parse({
          name: 'Missing agentId',
          eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
          actions: [
            {
              type: AutomationActionType.ASSIGN_AGENT,
              params: { agentId: '' },
            },
          ],
        });
      });

      assert.throws(() => {
        createAutomationRuleSchema.parse({
          name: 'Invalid status',
          eventTrigger: AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
          actions: [
            {
              type: AutomationActionType.CHANGE_STATUS,
              params: { status: 'INVALID_STATUS' },
            },
          ],
        });
      });
    });
  });

  describe('updateAutomationRuleSchema', () => {
    it('should allow partial updates', () => {
      const partial = {
        name: 'Updated Name',
        isActive: false,
      };
      const result = updateAutomationRuleSchema.parse(partial);
      assert.strictEqual(result.name, 'Updated Name');
      assert.strictEqual(result.isActive, false);
      assert.strictEqual(result.actions, undefined);
    });

    it('should reject empty actions array if actions field is provided', () => {
      assert.throws(() => {
        updateAutomationRuleSchema.parse({
          actions: [],
        });
      });
    });
  });

  describe('automationRuleListQuerySchema', () => {
    it('should parse boolean string for isActive', () => {
      const parsedTrue = automationRuleListQuerySchema.parse({ isActive: 'true' });
      assert.strictEqual(parsedTrue.isActive, true);

      const parsedFalse = automationRuleListQuerySchema.parse({ isActive: 'false' });
      assert.strictEqual(parsedFalse.isActive, false);

      const parsedTrigger = automationRuleListQuerySchema.parse({
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        search: 'pricing',
      });
      assert.strictEqual(parsedTrigger.eventTrigger, AutomationEventTrigger.MESSAGE_CREATED);
      assert.strictEqual(parsedTrigger.search, 'pricing');
    });
  });
});
