import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ChannelType,
  FileType,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../database';
import { ContactResolutionService } from '../../modules/contacts/contact-resolution.service';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { MessagesService } from '../../modules/messages/messages.service';
import { ChannelAdapterRegistry } from '../../integrations/channel-adapter.registry';
import type { InboundMessagePayload } from '../../integrations/channel-adapter.types';

export interface ChannelIngestionJobData {
  channelId: string;
  channelEventId: string;
  eventType: string;
  payload: unknown;
}

@Processor('channel-ingestion')
@Injectable()
export class ChannelIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactResolutionService: ContactResolutionService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    @Optional() private readonly adapterRegistry?: ChannelAdapterRegistry,
  ) {
    super();
  }

  async process(job: Job<ChannelIngestionJobData, void, string>): Promise<void> {
    const { channelId, channelEventId, eventType, payload } = job.data;
    this.logger.log(
      `Received ingestion job ${job.id} for channel '${channelId}' (event: '${eventType}', eventId: '${channelEventId}')`,
    );

    const client = this.prisma.getClient();

    // 1. Fetch channel and inbox details
    const channel = await client.channel.findUnique({
      where: { id: channelId },
      include: { inbox: true },
    });

    if (!channel) {
      this.logger.warn(`Channel with ID '${channelId}' not found during ingestion`);
      return;
    }

    const workspaceId = channel.workspaceId;
    const inboxId = channel.inboxId;

    // 2. Parse inbound message payloads using adapter or fallback normalization
    let inboundMessages: InboundMessagePayload[] = [];

    if (this.adapterRegistry && this.adapterRegistry.has(channel.channelType as ChannelType)) {
      try {
        const adapter = this.adapterRegistry.get(channel.channelType as ChannelType);
        inboundMessages = await adapter.parseInboundPayload(payload);
      } catch (parseErr) {
        this.logger.warn(
          `Adapter parsing failed for channel '${channelId}': ${(parseErr as Error).message}`,
        );
      }
    }

    // Fallback: If adapter was not registered or returned empty, check for pre-normalized or direct structure
    if (!inboundMessages || inboundMessages.length === 0) {
      const p = payload as any;
      if (
        p &&
        (p.externalContactId || p.senderId || p.from) &&
        (p.externalMessageId || p.messageId || p.mid || p.id)
      ) {
        inboundMessages = [
          {
            externalContactId: String(p.externalContactId || p.senderId || p.from),
            externalMessageId: String(p.externalMessageId || p.messageId || p.mid || p.id),
            content: p.content ?? p.text ?? null,
            contentType: p.contentType ?? MessageContentType.TEXT,
            attachments: p.attachments,
            senderInfo:
              p.senderInfo ??
              (p.name || p.senderName
                ? {
                    name: p.name || p.senderName,
                    email: p.email,
                    phoneNumber: p.phoneNumber || p.phone,
                    avatarUrl: p.avatarUrl,
                    username: p.username,
                  }
                : undefined),
            timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
            rawPayload: p.rawPayload ?? (typeof p === 'object' ? p : {}),
          },
        ];
      }
    }

    // 3. Process each normalized message
    for (const msg of inboundMessages) {
      try {
        // 3a. Resolve Contact & ChannelIdentity
        const resolution = await this.contactResolutionService.resolveFromChannel({
          workspaceId,
          channelId,
          externalContactId: msg.externalContactId,
          contactInfo: msg.senderInfo
            ? {
                name: msg.senderInfo.name,
                email: msg.senderInfo.email,
                phoneNumber: msg.senderInfo.phoneNumber,
                avatarUrl: msg.senderInfo.avatarUrl,
              }
            : undefined,
          username: msg.senderInfo?.username,
          metadata: msg.rawPayload,
        });

        const contact = resolution.contact;
        const identity = resolution.channelIdentity;

        // 3b. Find active conversation or create new one
        const conversation = await this.conversationsService.findOrCreateActiveConversation(
          workspaceId,
          {
            contactId: contact.id,
            inboxId,
            channelIdentityId: identity?.id,
          },
        );

        // 3c. Prepare attachments
        const attachments = msg.attachments?.map(att => ({
          fileName: att.fileName || 'attachment',
          fileType: (att.fileType as FileType) || FileType.FILE,
          fileSize: att.fileSize || 1000,
          storagePath: att.fileUrl,
          contentType: att.contentType ? String(att.contentType) : 'application/octet-stream',
          fileUrl: att.fileUrl,
        }));

        // 3d. Create inbound message
        await this.messagesService.create(workspaceId, conversation.id, {
          senderType: SenderType.CONTACT,
          senderId: contact.id,
          content: msg.content ?? null,
          contentType: msg.contentType ?? MessageContentType.TEXT,
          messageType: MessageType.INCOMING,
          externalId: msg.externalMessageId,
          attachments,
          metadata: msg.rawPayload || {},
        });

        this.logger.log(
          `Ingested message '${msg.externalMessageId}' on conversation '${conversation.id}' for contact '${contact.id}' (workspace: '${workspaceId}')`,
        );
      } catch (msgErr) {
        this.logger.error(
          `Failed to process inbound message '${msg.externalMessageId}' on channel '${channelId}': ${(msgErr as Error).message}`,
          (msgErr as Error).stack,
        );
      }
    }

    // 4. Mark ChannelEvent as processed in database
    if (channelEventId) {
      try {
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
  }
}
