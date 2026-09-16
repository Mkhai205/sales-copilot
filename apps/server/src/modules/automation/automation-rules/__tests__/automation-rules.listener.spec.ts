import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  AutomationRuleDto,
  ConversationPriority,
  ConversationResponseDto,
  ConversationStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { AutomationRulesListener } from '../automation-rules.listener';

describe('AutomationRulesListener (Feature F-1.9.2)', () => {
  let listener: AutomationRulesListener;
  let mockAutomationRulesService: any;
  let mockExecutorService: any;
  let mockConversationsService: any;

  let executedRules: Array<{ rule: AutomationRuleDto; context: any }>;
  let rulesDb: AutomationRuleDto[];
  let conversationsDb: Map<string, ConversationResponseDto>;

  const sampleConversation: ConversationResponseDto = {
    id: 'conv_1',
    displayId: 101,
    workspaceId: 'ws_1',
    inboxId: 'inbox_main',
    contactId: 'cnt_1',
    channelIdentityId: null,
    assigneeId: null,
    teamId: null,
    status: ConversationStatus.OPEN,
    priority: ConversationPriority.MEDIUM,
    unreadMessagesCount: 0,
    lastActivityAt: new Date().toISOString(),
    customAttributes: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    executedRules = [];
    rulesDb = [];
    conversationsDb = new Map([['conv_1', { ...sampleConversation }]]);

    mockAutomationRulesService = {
      list: async (workspaceId: string, query?: any) => {
        return rulesDb.filter(r => {
          if (r.workspaceId !== workspaceId) return false;
          if (query?.isActive !== undefined && r.isActive !== query.isActive) return false;
          if (query?.eventTrigger && r.eventTrigger !== query.eventTrigger) return false;
          return true;
        });
      },
    };

    mockExecutorService = {
      executeRule: async (workspaceId: string, rule: AutomationRuleDto, context: any) => {
        executedRules.push({ rule, context });
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          conversationId: context.conversation.id,
          actionsExecuted: rule.actions.length,
          results: rule.actions.map(a => ({ type: a.type, success: true })),
        };
      },
    };

    mockConversationsService = {
      getById: async (workspaceId: string, id: string) => {
        const found = conversationsDb.get(id);
        if (!found || found.workspaceId !== workspaceId) {
          throw new Error('Conversation not found');
        }
        return { ...found };
      },
    };

    listener = new AutomationRulesListener(
      mockAutomationRulesService,
      mockExecutorService,
      mockConversationsService,
    );
  });

  describe('handleMessageCreated Trigger', () => {
    it('should evaluate and execute active rule matching message content', async () => {
      rulesDb.push({
        id: 'rule_msg_1',
        workspaceId: 'ws_1',
        name: 'Auto Tag Pricing Messages',
        description: null,
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['quote', 'pricing'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ADD_LABEL,
            params: { labelTitle: 'pricing-inquiry' },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await listener.handleMessageCreated({
        workspaceId: 'ws_1',
        conversationId: 'conv_1',
        message: {
          id: 'msg_1',
          workspaceId: 'ws_1',
          conversationId: 'conv_1',
          senderType: SenderType.CONTACT,
          messageType: MessageType.INCOMING,
          contentType: MessageContentType.TEXT,
          content: 'Hi, I need a pricing quote please',
          isPrivate: false,
          deliveryStatus: 'SENT' as any,
          attachments: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      assert.strictEqual(executedRules.length, 1);
      assert.strictEqual(executedRules[0].rule.id, 'rule_msg_1');
      assert.strictEqual(executedRules[0].context.conversation.id, 'conv_1');
      assert.strictEqual(executedRules[0].context.message.id, 'msg_1');
    });

    it('should ignore private notes (isPrivate = true)', async () => {
      rulesDb.push({
        id: 'rule_msg_1',
        workspaceId: 'ws_1',
        name: 'Auto Tag Messages',
        description: null,
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.HIGH },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await listener.handleMessageCreated({
        workspaceId: 'ws_1',
        conversationId: 'conv_1',
        isPrivate: true,
        message: {
          id: 'msg_private',
          workspaceId: 'ws_1',
          conversationId: 'conv_1',
          senderType: SenderType.USER,
          messageType: MessageType.OUTGOING,
          contentType: MessageContentType.TEXT,
          content: 'Private note to team',
          isPrivate: true,
          deliveryStatus: 'SENT' as any,
          attachments: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      assert.strictEqual(executedRules.length, 0);
    });

    it('should prevent infinite loops by skipping events with performedBy.type = AUTOMATION_RULE', async () => {
      rulesDb.push({
        id: 'rule_loop_test',
        workspaceId: 'ws_1',
        name: 'Loop Prevention Rule',
        description: null,
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.URGENT },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await listener.handleMessageCreated({
        workspaceId: 'ws_1',
        conversationId: 'conv_1',
        performedBy: { type: 'AUTOMATION_RULE', id: 'rule_prev' },
        message: {
          id: 'msg_auto',
          workspaceId: 'ws_1',
          conversationId: 'conv_1',
          senderType: SenderType.SYSTEM,
          messageType: MessageType.ACTIVITY,
          contentType: MessageContentType.TEXT,
          content: 'System message',
          isPrivate: false,
          deliveryStatus: 'SENT' as any,
          attachments: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      assert.strictEqual(executedRules.length, 0);
    });

    it('should skip rule when conditions do not match', async () => {
      rulesDb.push({
        id: 'rule_no_match',
        workspaceId: 'ws_1',
        name: 'Refund Rules',
        description: null,
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.CONTENT,
            operator: AutomationOperator.CONTAINS,
            values: ['refund'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.CHANGE_STATUS,
            params: { status: ConversationStatus.PENDING },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await listener.handleMessageCreated({
        workspaceId: 'ws_1',
        conversationId: 'conv_1',
        message: {
          id: 'msg_greeting',
          workspaceId: 'ws_1',
          conversationId: 'conv_1',
          senderType: SenderType.CONTACT,
          messageType: MessageType.INCOMING,
          contentType: MessageContentType.TEXT,
          content: 'Good morning!',
          isPrivate: false,
          deliveryStatus: 'SENT' as any,
          attachments: [],
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      assert.strictEqual(executedRules.length, 0);
    });
  });

  describe('handleConversationCreated Trigger', () => {
    it('should evaluate rules when a new conversation is created', async () => {
      rulesDb.push({
        id: 'rule_conv_created',
        workspaceId: 'ws_1',
        name: 'Assign Default Team on New Conversation',
        description: null,
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.INBOX_ID,
            operator: AutomationOperator.EQUAL,
            values: ['inbox_main'],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ASSIGN_TEAM,
            params: { teamId: 'team_support' },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await listener.handleConversationCreated({
        workspaceId: 'ws_1',
        conversation: sampleConversation,
      });

      assert.strictEqual(executedRules.length, 1);
      assert.strictEqual(executedRules[0].rule.id, 'rule_conv_created');
    });

    it('should skip conversation created events with performedBy.type = AUTOMATION_RULE', async () => {
      rulesDb.push({
        id: 'rule_conv_created',
        workspaceId: 'ws_1',
        name: 'Assign Default Team',
        description: null,
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [],
        actions: [
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.HIGH },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await listener.handleConversationCreated({
        workspaceId: 'ws_1',
        conversation: sampleConversation,
        performedBy: { type: 'AUTOMATION_RULE', id: 'rule_some' },
      });

      assert.strictEqual(executedRules.length, 0);
    });
  });

  describe('handleConversationStatusUpdated Trigger', () => {
    it('should evaluate rules when conversation status changes', async () => {
      rulesDb.push({
        id: 'rule_status_changed',
        workspaceId: 'ws_1',
        name: 'Auto Resolve Actions',
        description: null,
        eventTrigger: AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
        conditions: [
          {
            attribute: AutomationAttribute.STATUS,
            operator: AutomationOperator.EQUAL,
            values: [ConversationStatus.RESOLVED],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ADD_LABEL,
            params: { labelTitle: 'completed' },
          },
        ],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const resolvedConv: ConversationResponseDto = {
        ...sampleConversation,
        status: ConversationStatus.RESOLVED,
      };

      await listener.handleConversationStatusUpdated({
        workspaceId: 'ws_1',
        conversationId: 'conv_1',
        conversation: resolvedConv,
      });

      assert.strictEqual(executedRules.length, 1);
      assert.strictEqual(executedRules[0].rule.id, 'rule_status_changed');
    });
  });

  describe('Multiple Rules Evaluation & Execution', () => {
    it('should evaluate multiple matching rules sequentially', async () => {
      rulesDb.push(
        {
          id: 'rule_1',
          workspaceId: 'ws_1',
          name: 'Rule 1: Priority Urgent',
          description: null,
          eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
          conditions: [],
          actions: [
            {
              type: AutomationActionType.CHANGE_PRIORITY,
              params: { priority: ConversationPriority.URGENT },
            },
          ],
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'rule_2',
          workspaceId: 'ws_1',
          name: 'Rule 2: Add Label VIP',
          description: null,
          eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
          conditions: [],
          actions: [
            {
              type: AutomationActionType.ADD_LABEL,
              params: { labelTitle: 'vip' },
            },
          ],
          isActive: true,
          createdAt: '2026-01-02T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      );

      await listener.handleConversationCreated({
        workspaceId: 'ws_1',
        conversation: sampleConversation,
      });

      assert.strictEqual(executedRules.length, 2);
      assert.strictEqual(executedRules[0].rule.id, 'rule_1');
      assert.strictEqual(executedRules[1].rule.id, 'rule_2');
    });
  });
});
