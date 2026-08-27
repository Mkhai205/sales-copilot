import { Injectable, Logger } from '@nestjs/common';
import {
  AutomationAction,
  AutomationActionType,
  AutomationRuleDto,
} from '@sales-copilot/shared-contracts';
import { ConversationsService } from '../conversations/conversations.service';
import { LabelsService } from '../labels/labels.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { RuleEvaluationContext } from './condition-matcher';

export interface ActionResult {
  type: AutomationActionType;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

export interface RuleExecutionSummary {
  ruleId: string;
  ruleName: string;
  conversationId: string;
  actionsExecuted: number;
  results: ActionResult[];
}

@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly labelsService: LabelsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Executes all actions for a matched automation rule against the given context.
   * Ensures error isolation so one failed action does not halt the others.
   */
  async executeRule(
    workspaceId: string,
    rule: AutomationRuleDto,
    context: RuleEvaluationContext,
  ): Promise<RuleExecutionSummary> {
    const conversationId = context.conversation.id;
    const results: ActionResult[] = [];

    this.logger.log(
      `Executing automation rule '${rule.name}' (${rule.id}) with ${rule.actions.length} action(s) for conversation '${conversationId}' in workspace '${workspaceId}'`,
    );

    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(workspaceId, action, context, rule);
        results.push(result);
      } catch (err: any) {
        const errorMsg = err?.message || String(err);
        this.logger.error(
          `Failed executing action '${action.type}' in rule '${rule.id}' for conversation '${conversationId}': ${errorMsg}`,
          err?.stack,
        );
        results.push({
          type: action.type,
          success: false,
          error: errorMsg,
        });
      }
    }

    // Record execution in AuditLog
    try {
      await this.auditLogService.log({
        workspaceId,
        userId: null,
        action: 'AUTOMATION_RULE_EXECUTED',
        resourceType: 'AUTOMATION_RULE',
        resourceId: rule.id,
        payload: {
          ruleId: rule.id,
          ruleName: rule.name,
          eventTrigger: rule.eventTrigger,
          conversationId,
          messageId: context.message?.id ?? null,
          results,
        },
      });
    } catch (auditErr: any) {
      this.logger.warn(
        `Failed to record audit log for rule execution '${rule.id}': ${auditErr?.message || auditErr}`,
      );
    }

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      conversationId,
      actionsExecuted: results.filter(r => r.success).length,
      results,
    };
  }

  /**
   * Executes a single automation action.
   */
  async executeAction(
    workspaceId: string,
    action: AutomationAction,
    context: RuleEvaluationContext,
    rule: AutomationRuleDto,
  ): Promise<ActionResult> {
    const conversationId = context.conversation.id;
    const performedBy = { type: 'AUTOMATION_RULE', id: rule.id };

    switch (action.type) {
      case AutomationActionType.ASSIGN_AGENT: {
        const agentId = action.params.agentId;
        await this.conversationsService.assign(
          workspaceId,
          conversationId,
          { assigneeId: agentId },
          null,
          undefined,
          performedBy,
        );
        return { type: action.type, success: true, details: { agentId } };
      }

      case AutomationActionType.ASSIGN_TEAM: {
        const teamId = action.params.teamId;
        await this.conversationsService.assign(
          workspaceId,
          conversationId,
          { teamId },
          null,
          undefined,
          performedBy,
        );
        return { type: action.type, success: true, details: { teamId } };
      }

      case AutomationActionType.ADD_LABEL: {
        const labelTitle = action.params.labelTitle.trim();
        const existingLabels = await this.labelsService.list(workspaceId, { q: labelTitle });
        let targetLabel = existingLabels.find(
          l => l.title.toLowerCase() === labelTitle.toLowerCase(),
        );

        if (!targetLabel) {
          try {
            targetLabel = await this.labelsService.create(workspaceId, {
              title: labelTitle,
              color: '#2563eb',
              showOnSidebar: true,
            });
          } catch (createErr: any) {
            // Check race condition where label was concurrently created
            const refreshed = await this.labelsService.list(workspaceId, { q: labelTitle });
            targetLabel = refreshed.find(l => l.title.toLowerCase() === labelTitle.toLowerCase());
            if (!targetLabel) {
              throw createErr;
            }
          }
        }

        await this.conversationsService.assignLabels(
          workspaceId,
          conversationId,
          [targetLabel.id],
          undefined,
          performedBy,
        );
        return {
          type: action.type,
          success: true,
          details: { labelId: targetLabel.id, labelTitle },
        };
      }

      case AutomationActionType.REMOVE_LABEL: {
        const labelTitle = action.params.labelTitle.trim();
        const existingLabels = await this.labelsService.list(workspaceId, { q: labelTitle });
        const targetLabel = existingLabels.find(
          l => l.title.toLowerCase() === labelTitle.toLowerCase(),
        );

        if (targetLabel) {
          try {
            await this.conversationsService.removeLabel(
              workspaceId,
              conversationId,
              targetLabel.id,
            );
          } catch {
            // Gracefully ignore if label was not assigned to this conversation
          }
        }

        return {
          type: action.type,
          success: true,
          details: { labelTitle, removed: Boolean(targetLabel) },
        };
      }

      case AutomationActionType.CHANGE_STATUS: {
        const status = action.params.status;
        await this.conversationsService.updateStatus(
          workspaceId,
          conversationId,
          { status },
          undefined,
          performedBy,
        );
        return { type: action.type, success: true, details: { status } };
      }

      case AutomationActionType.CHANGE_PRIORITY: {
        const priority = action.params.priority;
        await this.conversationsService.updatePriority(
          workspaceId,
          conversationId,
          { priority },
          undefined,
          performedBy,
        );
        return { type: action.type, success: true, details: { priority } };
      }

      case AutomationActionType.SEND_WEBHOOK: {
        const url = action.params.url;
        await this.dispatchWebhook(url, rule, context);
        return { type: action.type, success: true, details: { url } };
      }

      default:
        throw new Error(`Unsupported action type: ${(action as any)?.type}`);
    }
  }

  private async dispatchWebhook(
    url: string,
    rule: AutomationRuleDto,
    context: RuleEvaluationContext,
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SalesCopilot-AutomationRules/1.0',
        },
        body: JSON.stringify({
          event: 'automation_rule.triggered',
          rule: {
            id: rule.id,
            name: rule.name,
            eventTrigger: rule.eventTrigger,
          },
          conversation: context.conversation,
          message: context.message ?? null,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook endpoint responded with HTTP status ${response.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Webhook request to '${url}' timed out after 5000ms`, { cause: err });
      }
      throw err;
    }
  }
}
