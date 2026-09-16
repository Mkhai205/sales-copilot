import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  AutomationActionType,
  AutomationEventTrigger,
  AutomationRuleDto,
  ConversationPriority,
  ConversationStatus,
} from '@sales-copilot/shared-contracts';
import { AutomationExecutorService } from '../automation-executor.service';
import { RuleEvaluationContext } from '../condition-matcher';

describe('AutomationExecutorService (Feature F-1.9.2)', () => {
  let service: AutomationExecutorService;
  let mockConversationsService: any;
  let mockLabelsService: any;
  let mockAuditLogService: any;

  let assignedCalls: Array<any>;
  let statusCalls: Array<any>;
  let priorityCalls: Array<any>;
  let assignLabelsCalls: Array<any>;
  let removeLabelCalls: Array<any>;
  let auditLogs: Array<any>;
  let labelsDb: Array<{ id: string; workspaceId: string; title: string; color?: string }>;

  const baseRule: AutomationRuleDto = {
    id: 'rule_1',
    workspaceId: 'ws_1',
    name: 'VIP Customer Handler',
    description: 'Auto assign and tag VIP customers',
    eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
    conditions: [],
    actions: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const baseContext: RuleEvaluationContext = {
    conversation: {
      id: 'conv_123',
      workspaceId: 'ws_1',
      inboxId: 'inbox_1',
      status: ConversationStatus.OPEN,
      priority: ConversationPriority.MEDIUM,
    },
    message: {
      id: 'msg_456',
      content: 'Hello VIP',
    },
  };

  beforeEach(() => {
    assignedCalls = [];
    statusCalls = [];
    priorityCalls = [];
    assignLabelsCalls = [];
    removeLabelCalls = [];
    auditLogs = [];
    labelsDb = [{ id: 'lbl_existing', workspaceId: 'ws_1', title: 'existing-label' }];

    mockConversationsService = {
      assign: async (workspaceId: string, id: string, dto: any, user: any) => {
        assignedCalls.push({ workspaceId, id, dto, user });
        return { id, ...dto };
      },
      updateStatus: async (workspaceId: string, id: string, dto: any) => {
        statusCalls.push({ workspaceId, id, dto });
        return { id, status: dto.status };
      },
      updatePriority: async (workspaceId: string, id: string, dto: any) => {
        priorityCalls.push({ workspaceId, id, dto });
        return { id, priority: dto.priority };
      },
      assignLabels: async (workspaceId: string, id: string, labelIds: string[]) => {
        assignLabelsCalls.push({ workspaceId, id, labelIds });
        return labelIds.map(lid => ({ id: lid, title: 'label' }));
      },
      removeLabel: async (workspaceId: string, id: string, labelId: string) => {
        removeLabelCalls.push({ workspaceId, id, labelId });
        return { success: true };
      },
    };

    mockLabelsService = {
      list: async (workspaceId: string, query?: any) => {
        return labelsDb.filter(l => {
          if (l.workspaceId !== workspaceId) return false;
          if (query?.q && !l.title.toLowerCase().includes(query.q.toLowerCase())) return false;
          return true;
        });
      },
      create: async (workspaceId: string, dto: any) => {
        const newLabel = {
          id: `lbl_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          workspaceId,
          title: dto.title,
          color: dto.color || '#2563eb',
        };
        labelsDb.push(newLabel);
        return newLabel;
      },
    };

    mockAuditLogService = {
      log: async (params: any) => {
        auditLogs.push(params);
        return { id: 'audit_1', ...params };
      },
    };

    service = new AutomationExecutorService(
      mockConversationsService,
      mockLabelsService,
      mockAuditLogService,
    );
  });

  describe('Individual Action Handlers', () => {
    it('should execute ASSIGN_AGENT action', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.ASSIGN_AGENT,
            params: { agentId: 'usr_agent_vip' },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(assignedCalls.length, 1);
      assert.strictEqual(assignedCalls[0].dto.assigneeId, 'usr_agent_vip');
      assert.strictEqual(assignedCalls[0].id, 'conv_123');
    });

    it('should execute ASSIGN_TEAM action', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.ASSIGN_TEAM,
            params: { teamId: 'team_enterprise' },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(assignedCalls.length, 1);
      assert.strictEqual(assignedCalls[0].dto.teamId, 'team_enterprise');
    });

    it('should execute ADD_LABEL action with existing label', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.ADD_LABEL,
            params: { labelTitle: 'existing-label' },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(assignLabelsCalls.length, 1);
      assert.deepStrictEqual(assignLabelsCalls[0].labelIds, ['lbl_existing']);
    });

    it('should auto-create missing label on ADD_LABEL action', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.ADD_LABEL,
            params: { labelTitle: 'new-vip-tag' },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(assignLabelsCalls.length, 1);
      assert.strictEqual(
        labelsDb.some(l => l.title === 'new-vip-tag'),
        true,
      );
    });

    it('should execute REMOVE_LABEL action when label exists', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.REMOVE_LABEL,
            params: { labelTitle: 'existing-label' },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(removeLabelCalls.length, 1);
      assert.strictEqual(removeLabelCalls[0].labelId, 'lbl_existing');
    });

    it('should gracefully handle REMOVE_LABEL when label does not exist', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.REMOVE_LABEL,
            params: { labelTitle: 'non-existent-label' },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(removeLabelCalls.length, 0);
    });

    it('should execute CHANGE_STATUS action', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.CHANGE_STATUS,
            params: { status: ConversationStatus.PENDING },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(statusCalls.length, 1);
      assert.strictEqual(statusCalls[0].dto.status, ConversationStatus.PENDING);
    });

    it('should execute CHANGE_PRIORITY action', async () => {
      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.URGENT },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(priorityCalls.length, 1);
      assert.strictEqual(priorityCalls[0].dto.priority, ConversationPriority.URGENT);
    });

    it('should execute SEND_WEBHOOK action using global fetch', async () => {
      const originalFetch = global.fetch;
      let webhookDispatched = false;
      let webhookPayload: any = null;

      global.fetch = (async (url: string, init?: any) => {
        webhookDispatched = true;
        webhookPayload = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
        } as any;
      }) as any;

      try {
        const rule: AutomationRuleDto = {
          ...baseRule,
          actions: [
            {
              type: AutomationActionType.SEND_WEBHOOK,
              params: { url: 'https://example.com/api/webhook' },
            },
          ],
        };

        const summary = await service.executeRule('ws_1', rule, baseContext);

        assert.strictEqual(summary.actionsExecuted, 1);
        assert.strictEqual(webhookDispatched, true);
        assert.strictEqual(webhookPayload.rule.id, 'rule_1');
        assert.strictEqual(webhookPayload.conversation.id, 'conv_123');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Error Isolation & Audit Logging', () => {
    it('should isolate action failures and continue executing subsequent actions', async () => {
      // Make assign throw error
      mockConversationsService.assign = async () => {
        throw new Error('Assignee is not a member of the Inbox');
      };

      const rule: AutomationRuleDto = {
        ...baseRule,
        actions: [
          {
            type: AutomationActionType.ASSIGN_AGENT,
            params: { agentId: 'invalid_agent' },
          },
          {
            type: AutomationActionType.CHANGE_PRIORITY,
            params: { priority: ConversationPriority.URGENT },
          },
        ],
      };

      const summary = await service.executeRule('ws_1', rule, baseContext);

      // 1 action succeeded, 1 failed
      assert.strictEqual(summary.actionsExecuted, 1);
      assert.strictEqual(summary.results.length, 2);
      assert.strictEqual(summary.results[0].success, false);
      assert.strictEqual(summary.results[0].error?.includes('Assignee is not a member'), true);
      assert.strictEqual(summary.results[1].success, true);

      // Second action was executed despite first action failing
      assert.strictEqual(priorityCalls.length, 1);

      // Audit log was recorded
      assert.strictEqual(auditLogs.length, 1);
      assert.strictEqual(auditLogs[0].action, 'AUTOMATION_RULE_EXECUTED');
      assert.strictEqual(auditLogs[0].resourceType, 'AUTOMATION_RULE');
      assert.strictEqual(auditLogs[0].resourceId, 'rule_1');
      assert.strictEqual(auditLogs[0].payload.results.length, 2);
    });
  });
});
