import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  AutomationAttribute,
  AutomationOperator,
  ConversationPriority,
  ConversationStatus,
} from '@sales-copilot/shared-contracts';
import { ConditionMatcher, RuleEvaluationContext } from '../condition-matcher';

describe('ConditionMatcher (Feature F-1.9.2)', () => {
  const baseContext: RuleEvaluationContext = {
    conversation: {
      id: 'conv_1',
      workspaceId: 'ws_1',
      inboxId: 'inbox_100',
      teamId: 'team_sales',
      assigneeId: 'usr_agent_1',
      status: ConversationStatus.OPEN,
      priority: ConversationPriority.HIGH,
      messages: [{ content: 'Fallback conversation message text' }],
    },
    message: {
      id: 'msg_1',
      content: 'Can I get pricing for Enterprise license?',
      senderType: 'CONTACT',
      isPrivate: false,
    },
  };

  describe('Empty or Null Conditions', () => {
    it('should return true when conditions array is empty or undefined', () => {
      assert.strictEqual(ConditionMatcher.match(baseContext, []), true);
      assert.strictEqual(ConditionMatcher.match(baseContext, null), true);
      assert.strictEqual(ConditionMatcher.match(baseContext, undefined), true);
    });
  });

  describe('Attribute Extraction & Operators', () => {
    describe('EQUAL Operator', () => {
      it('should match status with EQUAL (case-insensitive)', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.STATUS,
            operator: AutomationOperator.EQUAL,
            values: ['open'],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should match any value in the values array (OR among values)', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.STATUS,
            operator: AutomationOperator.EQUAL,
            values: ['PENDING', 'OPEN', 'RESOLVED'],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should return false if value does not match', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.STATUS,
            operator: AutomationOperator.EQUAL,
            values: ['RESOLVED', 'PENDING'],
          },
        ]);
        assert.strictEqual(match, false);
      });

      it('should return false if entity value is null', () => {
        const contextWithoutTeam: RuleEvaluationContext = {
          conversation: { ...baseContext.conversation, teamId: null },
        };
        const match = ConditionMatcher.match(contextWithoutTeam, [
          {
            attribute: AutomationAttribute.TEAM_ID,
            operator: AutomationOperator.EQUAL,
            values: ['team_sales'],
          },
        ]);
        assert.strictEqual(match, false);
      });
    });

    describe('NOT_EQUAL Operator', () => {
      it('should match when entity value does not equal specified values', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.PRIORITY,
            operator: AutomationOperator.NOT_EQUAL,
            values: [ConversationPriority.LOW, ConversationPriority.URGENT],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should return false when entity value equals one of specified values', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.PRIORITY,
            operator: AutomationOperator.NOT_EQUAL,
            values: [ConversationPriority.HIGH],
          },
        ]);
        assert.strictEqual(match, false);
      });
    });

    describe('CONTAINS Operator', () => {
      it('should match message content containing substring (case-insensitive)', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['pricing', 'discount'],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should fallback to conversation message content if message is not present', () => {
        const contextWithoutMessage: RuleEvaluationContext = {
          conversation: baseContext.conversation,
          message: null,
        };
        const match = ConditionMatcher.match(contextWithoutMessage, [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['Fallback conversation'],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should return false when substring is not contained', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['refund', 'cancel'],
          },
        ]);
        assert.strictEqual(match, false);
      });
    });

    describe('NOT_CONTAINS Operator', () => {
      it('should match when message content does not contain forbidden words', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.NOT_CONTAINS,
            values: ['spam', 'promotional'],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should return false when message content contains one of forbidden words', () => {
        const match = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.NOT_CONTAINS,
            values: ['enterprise', 'other'],
          },
        ]);
        assert.strictEqual(match, false);
      });
    });

    describe('IS_PRESENT & IS_NOT_PRESENT Operators', () => {
      it('should evaluate IS_PRESENT on populated attributes', () => {
        const matchAssignee = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.ASSIGNEE_ID,
            operator: AutomationOperator.IS_PRESENT,
            values: [],
          },
        ]);
        assert.strictEqual(matchAssignee, true);
      });

      it('should evaluate IS_NOT_PRESENT on unassigned conversations', () => {
        const unassignedContext: RuleEvaluationContext = {
          conversation: {
            ...baseContext.conversation,
            assigneeId: null,
          },
        };
        const match = ConditionMatcher.match(unassignedContext, [
          {
            attribute: AutomationAttribute.ASSIGNEE_ID,
            operator: AutomationOperator.IS_NOT_PRESENT,
            values: [],
          },
        ]);
        assert.strictEqual(match, true);
      });

      it('should evaluate IS_PRESENT as false on empty or whitespace strings', () => {
        const emptyMsgContext: RuleEvaluationContext = {
          conversation: { ...baseContext.conversation, messages: [] },
          message: { id: 'msg_2', content: '   ', senderType: 'USER' },
        };
        const match = ConditionMatcher.match(emptyMsgContext, [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.IS_PRESENT,
            values: [],
          },
        ]);
        assert.strictEqual(match, false);
      });
    });

    describe('SENDER_TYPE & INBOX_ID Attributes', () => {
      it('should match senderType attribute', () => {
        const matchContact = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.SENDER_TYPE,
            operator: AutomationOperator.EQUAL,
            values: ['CONTACT'],
          },
        ]);
        assert.strictEqual(matchContact, true);

        const matchUser = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.SENDER_TYPE,
            operator: AutomationOperator.EQUAL,
            values: ['USER'],
          },
        ]);
        assert.strictEqual(matchUser, false);
      });

      it('should match inboxId attribute', () => {
        const matchInbox = ConditionMatcher.match(baseContext, [
          {
            attribute: AutomationAttribute.INBOX_ID,
            operator: AutomationOperator.EQUAL,
            values: ['inbox_100'],
          },
        ]);
        assert.strictEqual(matchInbox, true);
      });
    });
  });

  describe('Multi-Condition Combinations (AND logic)', () => {
    it('should return true when all conditions pass', () => {
      const match = ConditionMatcher.match(baseContext, [
        {
          attribute: AutomationAttribute.STATUS,
          operator: AutomationOperator.EQUAL,
          values: [ConversationStatus.OPEN],
        },
        {
          attribute: AutomationAttribute.INBOX_ID,
          operator: AutomationOperator.EQUAL,
          values: ['inbox_100'],
        },
        {
          attribute: AutomationAttribute.CONTENT,
          operator: AutomationOperator.CONTAINS,
          values: ['pricing'],
        },
        {
          attribute: AutomationAttribute.SENDER_TYPE,
          operator: AutomationOperator.EQUAL,
          values: ['CONTACT'],
        },
      ]);
      assert.strictEqual(match, true);
    });

    it('should return false if any single condition in the array fails', () => {
      const match = ConditionMatcher.match(baseContext, [
        {
          attribute: AutomationAttribute.STATUS,
          operator: AutomationOperator.EQUAL,
          values: [ConversationStatus.OPEN],
        },
        {
          attribute: AutomationAttribute.TEAM_ID,
          operator: AutomationOperator.EQUAL,
          values: ['team_support'], // Fail (is team_sales)
        },
      ]);
      assert.strictEqual(match, false);
    });
  });
});
