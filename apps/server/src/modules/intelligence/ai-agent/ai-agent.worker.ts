import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  AI_AUTOPILOT_QUEUE,
  MessageType,
  SenderType,
  type AiAgentJobData,
  type AiAgentResult,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/redis';
import { MessagesService } from '../../omnichannel/messages/messages.service';
import { getAiDebounceKey, HumanTakeoverAbortError } from './ai-agent.constants';
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
  ) {
    super();
  }

  async process(job: Job<AiAgentJobData>): Promise<AiAgentResult> {
    const { workspaceId, conversationId, inboxId, scheduledAt } = job.data;

    this.logger.debug(
      `Processing AI job ${job.id} for conversation '${conversationId}' (scheduledAt: ${scheduledAt})`,
    );

    // 1. Debounce check: If newer inbound messages arrived, drop this job
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
          },
        });

        // Update lastAiMessageAt timestamp
        await client.conversation.updateMany({
          where: { id: conversationId, workspaceId },
          data: { lastAiMessageAt: new Date() },
        });
      }

      return result;
    } catch (err) {
      if (err instanceof HumanTakeoverAbortError) {
        this.logger.log(
          `AI execution aborted due to Human Takeover for conversation '${conversationId}'`,
        );
        return { skipped: true, reason: 'HUMAN_TAKEOVER' };
      }

      this.logger.error(
        `Error executing AI agent for conversation '${conversationId}': ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
