import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AutomationEventTrigger,
  ConversationResponseDto,
  MessageResponseDto,
} from '@sales-copilot/shared-contracts';
import { ConversationsService } from '../conversations/conversations.service';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationExecutorService } from './automation-executor.service';
import { ConditionMatcher, RuleEvaluationContext } from './condition-matcher';

@Injectable()
export class AutomationRulesListener {
  private readonly logger = new Logger(AutomationRulesListener.name);

  constructor(
    private readonly automationRulesService: AutomationRulesService,
    private readonly executorService: AutomationExecutorService,
    private readonly conversationsService: ConversationsService,
  ) {}

  /**
   * Evaluates automation rules triggered on new message arrival.
   */
  @OnEvent('message.created', { async: true })
  async handleMessageCreated(payload: {
    workspaceId: string;
    conversationId: string;
    message: MessageResponseDto;
    isPrivate?: boolean;
    performedBy?: { type: string; id?: string };
  }): Promise<void> {
    try {
      if (!payload?.workspaceId || !payload?.conversationId) return;

      // 1. Loop prevention: Skip events produced by automation rules
      if (payload.performedBy?.type === 'AUTOMATION_RULE') {
        return;
      }

      // 2. Ignore private notes / internal activity
      if (payload.isPrivate || payload.message?.isPrivate) {
        return;
      }

      // 3. Fetch latest conversation entity
      let conversation: ConversationResponseDto;
      try {
        conversation = await this.conversationsService.getById(
          payload.workspaceId,
          payload.conversationId,
        );
      } catch (err) {
        this.logger.warn(
          `Could not load conversation '${payload.conversationId}' for message.created automation: ${(err as Error).message}`,
        );
        return;
      }

      await this.evaluateTrigger(
        payload.workspaceId,
        AutomationEventTrigger.MESSAGE_CREATED,
        conversation,
        payload.message,
      );
    } catch (err) {
      this.logger.error(
        `Unexpected error in handleMessageCreated automation listener: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Evaluates automation rules triggered on conversation creation.
   */
  @OnEvent('conversation.created', { async: true })
  async handleConversationCreated(payload: {
    workspaceId: string;
    conversation: ConversationResponseDto;
    performedBy?: { type: string; id?: string };
  }): Promise<void> {
    try {
      if (!payload?.workspaceId || !payload?.conversation?.id) return;

      if (payload.performedBy?.type === 'AUTOMATION_RULE') {
        return;
      }

      await this.evaluateTrigger(
        payload.workspaceId,
        AutomationEventTrigger.CONVERSATION_CREATED,
        payload.conversation,
        null,
      );
    } catch (err) {
      this.logger.error(
        `Unexpected error in handleConversationCreated automation listener: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Evaluates automation rules triggered on conversation status change.
   */
  @OnEvent('conversation.status_updated', { async: true })
  async handleConversationStatusUpdated(payload: {
    workspaceId: string;
    conversationId: string;
    conversation?: ConversationResponseDto;
    performedBy?: { type: string; id?: string };
  }): Promise<void> {
    try {
      if (!payload?.workspaceId || !payload?.conversationId) return;

      if (payload.performedBy?.type === 'AUTOMATION_RULE') {
        return;
      }

      let conversation = payload.conversation;
      if (!conversation) {
        try {
          conversation = await this.conversationsService.getById(
            payload.workspaceId,
            payload.conversationId,
          );
        } catch (err) {
          this.logger.warn(
            `Could not load conversation '${payload.conversationId}' for status_updated automation: ${(err as Error).message}`,
          );
          return;
        }
      }

      await this.evaluateTrigger(
        payload.workspaceId,
        AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
        conversation,
        null,
      );
    } catch (err) {
      this.logger.error(
        `Unexpected error in handleConversationStatusUpdated automation listener: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Core evaluator that fetches active rules, matches conditions, and executes actions sequentially.
   */
  private async evaluateTrigger(
    workspaceId: string,
    eventTrigger: AutomationEventTrigger,
    initialConversation: ConversationResponseDto,
    message: MessageResponseDto | null,
  ): Promise<void> {
    const rules = await this.automationRulesService.list(workspaceId, {
      isActive: true,
      eventTrigger,
    });

    if (!rules || rules.length === 0) {
      return;
    }

    let currentConversation = initialConversation;

    for (const rule of rules) {
      const context: RuleEvaluationContext = {
        conversation: currentConversation,
        message,
      };

      const isMatch = ConditionMatcher.match(context, rule.conditions);

      if (isMatch) {
        this.logger.log(
          `Rule '${rule.name}' (${rule.id}) matched for conversation '${currentConversation.id}'`,
        );

        const executionSummary = await this.executorService.executeRule(workspaceId, rule, context);

        // If any actions mutated the conversation, refresh state for subsequent rules
        if (executionSummary.actionsExecuted > 0) {
          try {
            currentConversation = await this.conversationsService.getById(
              workspaceId,
              currentConversation.id,
            );
          } catch {
            // Keep existing currentConversation if fetch fails
          }
        }
      }
    }
  }
}
