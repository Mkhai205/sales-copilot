import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database';

export interface ChannelIngestionJobData {
  channelId: string;
  channelEventId: string;
  eventType: string;
  payload: unknown;
}

@Processor('channel-ingestion')
export class ChannelIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelIngestionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ChannelIngestionJobData, void, string>): Promise<void> {
    const { channelId, channelEventId, eventType } = job.data;
    this.logger.log(
      `Received ingestion job ${job.id} for channel '${channelId}' (event: '${eventType}', eventId: '${channelEventId}')`,
    );

    // 1. Mark event as processed in database
    if (channelEventId) {
      try {
        const client = this.prisma.getClient();
        await client.channelEvent.update({
          where: { id: channelEventId },
          data: { processedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to update processedAt for channelEvent '${channelEventId}': ${(err as Error).message}`,
        );
      }
    }

    // TODO (Epic 1.4 / Epic 1.5): Full conversation & message processing
    // 1. Identity Resolution: ContactIdentifyService & ChannelIdentityService
    // 2. Conversation Threading: ConversationService.findOrCreateActiveConversation
    // 3. Message Storage: MessagesService.createInboundMessage
    // 4. Automation & Event Dispatch: Outbound Webhooks & WebSocket Broadcast
  }
}
