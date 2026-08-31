import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  ConversationPriority,
  ConversationStatus,
  type AutomationRuleDto,
} from '@sales-copilot/shared-contracts';

describe('Automation Rules Management (Task 34)', () => {
  describe('createAutomationRuleSchema Validation', () => {
    it('should validate valid rule with trigger, condition, and multiple actions', () => {
      const payload = {
        name: 'Auto Assign VIP Tickets',
        description: 'Assign VIP tickets to Senior Team and set Urgent priority',
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['vip', 'enterprise'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ASSIGN_TEAM,
            params: { teamId: 'team-vip-123' },
          },
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.URGENT },
          },
          {
            type: AutomationActionType.ADD_LABEL,
            params: { labelTitle: 'VIP-Enterprise' },
          },
        ],
        isActive: true,
      };

      const parsed = createAutomationRuleSchema.parse(payload);
      assert.strictEqual(parsed.name, 'Auto Assign VIP Tickets');
      assert.strictEqual(parsed.eventTrigger, AutomationEventTrigger.CONVERSATION_CREATED);
      assert.strictEqual(parsed.conditions?.length, 1);
      assert.strictEqual(parsed.actions.length, 3);
      assert.strictEqual(parsed.isActive, true);
    });

    it('should reject empty rule name', () => {
      const invalidPayload = {
        name: '',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        actions: [
          {
            type: AutomationActionType.CHANGE_STATUS,
            params: { status: ConversationStatus.OPEN },
          },
        ],
      };

      assert.throws(() => createAutomationRuleSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject rule without any actions', () => {
      const invalidPayload = {
        name: 'No Action Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        actions: [],
      };

      assert.throws(() => createAutomationRuleSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject invalid webhook action with malformed URL', () => {
      const invalidPayload = {
        name: 'Bad Webhook Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        actions: [
          {
            type: AutomationActionType.SEND_WEBHOOK,
            params: { url: 'not-a-valid-url' },
          },
        ],
      };

      assert.throws(() => createAutomationRuleSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should validate valid SEND_WEBHOOK action', () => {
      const validPayload = {
        name: 'Webhook Dispatch Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        actions: [
          {
            type: AutomationActionType.SEND_WEBHOOK,
            params: { url: 'https://webhook.site/abc-123' },
          },
        ],
      };

      const parsed = createAutomationRuleSchema.parse(validPayload);
      assert.strictEqual(parsed.actions[0].type, AutomationActionType.SEND_WEBHOOK);
    });

    it('should validate presence operators without values', () => {
      const validPayload = {
        name: 'Presence Check Rule',
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.INBOX_ID,
            operator: AutomationOperator.IS_PRESENT,
            values: [],
          },
        ],
        actions: [
          {
            type: AutomationActionType.CHANGE_STATUS,
            params: { status: ConversationStatus.OPEN },
          },
        ],
      };

      const parsed = createAutomationRuleSchema.parse(validPayload);
      assert.strictEqual(parsed.conditions?.[0].operator, AutomationOperator.IS_PRESENT);
      assert.deepStrictEqual(parsed.conditions?.[0].values, []);
    });
  });

  describe('updateAutomationRuleSchema Validation', () => {
    it('should allow partial update of active state', () => {
      const payload = {
        isActive: false,
      };

      const parsed = updateAutomationRuleSchema.parse(payload);
      assert.strictEqual(parsed.isActive, false);
      assert.strictEqual(parsed.name, undefined);
    });

    it('should allow updating actions only', () => {
      const payload = {
        actions: [
          {
            type: AutomationActionType.ASSIGN_AGENT,
            params: { agentId: 'agent-999' },
          },
        ],
      };

      const parsed = updateAutomationRuleSchema.parse(payload);
      assert.strictEqual(parsed.actions?.length, 1);
      assert.strictEqual(parsed.actions?.[0].type, AutomationActionType.ASSIGN_AGENT);
    });
  });

  describe('Automation Rules Search & Filter Logic', () => {
    const mockRules: AutomationRuleDto[] = [
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        name: 'Auto-route Billing Enquiries',
        description: 'Routes billing inquiries to Finance team',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['invoice', 'billing', 'refund'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ASSIGN_TEAM,
            params: { teamId: 'team-finance' },
          },
        ],
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'rule-2',
        workspaceId: 'ws-1',
        name: 'Resolve Inactive Chats',
        description: 'Auto marks conversation resolved when status changed',
        eventTrigger: AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
        conditions: [
          {
            attribute: AutomationAttribute.STATUS,
            operator: AutomationOperator.EQUAL,
            values: ['SNOOZED'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.CHANGE_STATUS,
            params: { status: ConversationStatus.RESOLVED },
          },
        ],
        isActive: false,
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'rule-3',
        workspaceId: 'ws-1',
        name: 'Urgent Telegram Messages',
        description: 'Set urgent priority on Telegram channel incoming tickets',
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.INBOX_ID,
            operator: AutomationOperator.EQUAL,
            values: ['inbox-tg-1'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.URGENT },
          },
        ],
        isActive: true,
        createdAt: '2026-01-03T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
      },
    ];

    const filterRules = (
      list: AutomationRuleDto[],
      search: string,
      triggerFilter: string,
      statusFilter: string,
    ) => {
      return list.filter(rule => {
        const name = rule.name.toLowerCase();
        const desc = (rule.description || '').toLowerCase();
        const q = search.trim().toLowerCase();

        const matchesSearch = !q || name.includes(q) || desc.includes(q);
        const matchesTrigger = triggerFilter === 'ALL' || rule.eventTrigger === triggerFilter;
        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' && rule.isActive) ||
          (statusFilter === 'INACTIVE' && !rule.isActive);

        return matchesSearch && matchesTrigger && matchesStatus;
      });
    };

    it('should return all rules when no filters applied', () => {
      const result = filterRules(mockRules, '', 'ALL', 'ALL');
      assert.strictEqual(result.length, 3);
    });

    it('should filter rules by text query in name or description', () => {
      const result = filterRules(mockRules, 'Billing', 'ALL', 'ALL');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'rule-1');
    });

    it('should filter rules by event trigger', () => {
      const result = filterRules(mockRules, '', AutomationEventTrigger.CONVERSATION_CREATED, 'ALL');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].id, 'rule-3');
    });

    it('should filter rules by active status', () => {
      const activeRules = filterRules(mockRules, '', 'ALL', 'ACTIVE');
      assert.strictEqual(activeRules.length, 2);

      const inactiveRules = filterRules(mockRules, '', 'ALL', 'INACTIVE');
      assert.strictEqual(inactiveRules.length, 1);
      assert.strictEqual(inactiveRules[0].id, 'rule-2');
    });
  });
});
