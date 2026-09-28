import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  AI_AUTOPILOT_QUEUE,
  ConversationStatus,
  MessageType,
  SenderType,
  type AiAgentFollowUpJobData,
  type AiAgentJobData,
  type AiAgentResult,
  type AiAutopilotJobData,
  type InboxAiCommercePolicyConfig,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { MessagesService } from '../../omnichannel/messages/messages.service';
import { AI_AGENT_CONSTANTS, getAiDebounceKey } from './ai-agent.constants';
import { AiAgentService } from './ai-agent.service';

@Processor(AI_AUTOPILOT_QUEUE, { concurrency: 5 })
@Injectable()
export class AiAgentWorker extends WorkerHost {
  private readonly logger = new Logger(AiAgentWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly aiAgentService: AiAgentService,
    private readonly messagesService: MessagesService,
    @Optional()
    @InjectQueue(AI_AUTOPILOT_QUEUE)
    private readonly aiQueue?: Queue,
  ) {
    super();
  }

  async process(job: Job<AiAutopilotJobData>): Promise<AiAgentResult> {
    if (job.name === AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME) {
      return this.processFollowUp(job as Job<AiAgentFollowUpJobData>);
    }

    return this.processMessage(job as Job<AiAgentJobData>);
  }

  private async processMessage(job: Job<AiAgentJobData>): Promise<AiAgentResult> {
    const { workspaceId, conversationId, inboxId, scheduledAt } = job.data;

    this.logger.debug(
      `Processing AI job ${job.id} for conversation '${conversationId}' (scheduledAt: ${scheduledAt})`,
    );

    // 1. Debounce check: drop this job when a newer dispatch reserved a later slot.
    // The dispatcher reserves slots with an atomic max(now, prev + 1) script, so each
    // job's scheduledAt equals exactly the value its own dispatch wrote and any newer
    // dispatch strictly increases the key. `>` (not `>=`) is therefore sufficient: a job
    // is only dropped when a genuinely newer message superseded it — equal timestamps
    // can never double-run because the key can never repeat.
    const debounceKey = getAiDebounceKey(workspaceId, conversationId);
    const latestTimestampStr = await this.redisService.get(debounceKey);

    if (latestTimestampStr) {
      const latestTimestamp = Number(latestTimestampStr);
      if (latestTimestamp > scheduledAt) {
        this.logger.debug(
          `Dropping job ${job.id} for conversation '${conversationId}': superseded by newer message (${latestTimestamp} > ${scheduledAt})`,
        );
        return { skipped: true, reason: 'SUPERSEDED_BY_NEWER_MESSAGE' };
      }
    }

    const client = this.prisma.getClient();

    // 2. Re-check if Human Takeover was activated before job started
    const conv = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      select: { isAiPaused: true },
    });

    if (!conv || conv.isAiPaused) {
      this.logger.debug(
        `Skipping job ${job.id}: conversation '${conversationId}' is paused or missing`,
      );
      return { skipped: true, reason: 'HUMAN_TAKEOVER' };
    }

    // 3. Run AI agent loop
    try {
      const result = await this.aiAgentService.processConversation(
        workspaceId,
        conversationId,
        inboxId,
      );

      // 4. Save response to DB -> emits message.created -> OutboundMessageListener auto-sends to external channel
      if (result.text && result.text.trim()) {
        await this.messagesService.create(workspaceId, conversationId, {
          content: result.text.trim(),
          senderType: SenderType.SYSTEM,
          messageType: MessageType.OUTGOING,
          isPrivate: false,
          metadata: {
            isAiGenerated: true,
            aiSteps: result.stepsCount ?? 1,
            aiTokenUsage: result.usage,
            aiDebug: result.aiDebug,
          },
        });

        // 5. Rollup conversation.customAttributes.aiUsage for fast, multi-tenant UI observability
        const currentConv = await client.conversation.findFirst({
          where: { id: conversationId, workspaceId },
          select: { customAttributes: true, inbox: true },
        });

        const currentAttrs = (currentConv?.customAttributes as Record<string, any>) || {};
        const prevAiUsage = (currentAttrs.aiUsage as Record<string, any>) || {};

        const newCost = (prevAiUsage.totalCostUsd || 0) + (result.aiDebug?.estimatedCostUsd || 0);
        const newTotalTokens = (prevAiUsage.totalTokens || 0) + (result.usage?.totalTokens || 0);
        const newInputTokens =
          (prevAiUsage.inputTokens || 0) +
          (result.aiDebug?.usage?.input || result.usage?.promptTokens || 0);
        const newOutputTokens =
          (prevAiUsage.outputTokens || 0) +
          (result.aiDebug?.usage?.output || result.usage?.completionTokens || 0);
        const newAiMessagesCount = (prevAiUsage.aiMessagesCount || 0) + 1;

        const updatedAiUsage = {
          totalCostUsd: Math.round(newCost * 1e7) / 1e7,
          totalTokens: newTotalTokens,
          inputTokens: newInputTokens,
          outputTokens: newOutputTokens,
          aiMessagesCount: newAiMessagesCount,
          lastCalculatedAt: new Date().toISOString(),
        };

        // Update lastAiMessageAt timestamp and customAttributes in a single multi-tenant query
        await client.conversation.updateMany({
          where: { id: conversationId, workspaceId },
          data: {
            lastAiMessageAt: new Date(),
            customAttributes: {
              ...currentAttrs,
              aiUsage: updatedAiUsage,
            },
          },
        });

        // 6. Schedule proactive follow-up job (configurable delay or default 5 minutes)
        if (this.aiQueue) {
          const inboxSettings = currentConv?.inbox?.settings as Record<string, any> | undefined;
          const aiPolicy = inboxSettings?.aiCommercePolicy as
            InboxAiCommercePolicyConfig | undefined;
          const followUpDelayMs =
            aiPolicy?.followUpDelayMinutes && aiPolicy.followUpDelayMinutes > 0
              ? aiPolicy.followUpDelayMinutes * 60 * 1000
              : AI_AGENT_CONSTANTS.FOLLOW_UP_DELAY_MS;
          const followUpMessage =
            aiPolicy?.followUpMessage?.trim() || AI_AGENT_CONSTANTS.FOLLOW_UP_MESSAGE;

          const followUpJobId = `follow-up:${conversationId}`;
          try {
            const existingJob = await this.aiQueue.getJob(followUpJobId);
            if (existingJob) {
              await existingJob.remove();
            }
          } catch (err: any) {
            this.logger.warn(`Failed to clean up existing follow-up job: ${err?.message}`);
          }

          await this.aiQueue.add(
            AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
            {
              workspaceId,
              conversationId,
              aiMessageTimestamp: Date.now(),
              followUpMessage,
            },
            {
              delay: followUpDelayMs,
              jobId: followUpJobId,
              removeOnComplete: true,
              removeOnFail: true,
            },
          );
        }
      }

      return result;
    } catch (err) {
      // Human takeover is handled inside AiAgentService (stopWhen condition returns
      // { skipped: true, reason: 'HUMAN_TAKEOVER' }) — no abort error escapes here.
      this.logger.error(
        `Error executing AI agent for conversation '${conversationId}': ${(err as Error).message}`,
        (err as Error).stack,
      );

      // On fatal AI failure on final retry, send graceful fallback message so customer is never left hanging
      if (job.attemptsMade >= (job.opts.attempts || 2) - 1) {
        try {
          await this.messagesService.create(workspaceId, conversationId, {
            content: AI_AGENT_CONSTANTS.FALLBACK_MESSAGE,
            senderType: SenderType.SYSTEM,
            messageType: MessageType.OUTGOING,
            isPrivate: false,
            metadata: {
              isAiGenerated: true,
              isFallback: true,
              error: (err as Error).message,
            },
          });
        } catch (msgErr) {
          this.logger.error(`Failed to dispatch fallback message: ${(msgErr as Error).message}`);
        }
      }

      throw err;
    }
  }

  private async processFollowUp(job: Job<AiAgentFollowUpJobData>): Promise<AiAgentResult> {
    const { workspaceId, conversationId, aiMessageTimestamp, followUpMessage } = job.data;
    const client = this.prisma.getClient();

    const conv = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      select: { isAiPaused: true, status: true, lastContactMessageAt: true },
    });

    // Cancel conditions:
    if (!conv) {
      return { skipped: true, reason: 'CONVERSATION_NOT_FOUND' };
    }
    if (conv.isAiPaused) {
      return { skipped: true, reason: 'HUMAN_TAKEOVER' };
    }
    if (conv.status === ConversationStatus.RESOLVED || (conv.status as string) === 'RESOLVED') {
      return { skipped: true, reason: 'RESOLVED' };
    }

    // If customer replied after our AI message → skip
    if (conv.lastContactMessageAt && conv.lastContactMessageAt.getTime() > aiMessageTimestamp) {
      return { skipped: true, reason: 'CUSTOMER_ALREADY_REPLIED' };
    }

    const messageContent = followUpMessage?.trim() || AI_AGENT_CONSTANTS.FOLLOW_UP_MESSAGE;

    // Send follow-up (no LLM call)
    await this.messagesService.create(workspaceId, conversationId, {
      content: messageContent,
      senderType: SenderType.SYSTEM,
      messageType: MessageType.OUTGOING,
      isPrivate: false,
      metadata: { isAiGenerated: true, isFollowUp: true },
    });

    // Update lastAiMessageAt timestamp (Strict Multi-Tenancy)
    await client.conversation.updateMany({
      where: { id: conversationId, workspaceId },
      data: { lastAiMessageAt: new Date() },
    });

    this.logger.log(`Sent follow-up to conversation '${conversationId}'`);
    return { skipped: false, reason: 'FOLLOW_UP_SENT', text: messageContent };
  }
}
