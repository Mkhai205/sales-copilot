import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import {
  ChannelType,
  FileType,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../database';
import { StorageService } from '../storage/storage.service';
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
  requestId?: string;
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
    @Optional() private readonly storageService?: StorageService,
  ) {
    super();
  }

  /**
   * Downloads media file from external URL and stores it into MinIO via StorageService.
   */
  private async downloadAndStoreMedia(
    workspaceId: string,
    externalUrl: string,
    fileName: string,
    fallbackContentType: string,
  ): Promise<{
    storagePath: string;
    fileUrl: string;
    fileSize: number;
    contentType: string;
  } | null> {
    if (!this.storageService) {
      return null;
    }

    const response = await fetch(externalUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || fallbackContentType;
    const sanitized =
      path
        .basename(fileName)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 100) || 'attachment';
    const storageKey = `attachments/${workspaceId}/inbound/${randomUUID()}-${sanitized}`;

    await this.storageService.upload(buffer, contentType, storageKey);

    return {
      storagePath: storageKey,
      fileUrl: this.storageService.getPublicUrl(storageKey),
      fileSize: buffer.length,
      contentType,
    };
  }

  async process(job: Job<ChannelIngestionJobData, void, string>): Promise<void> {
    const { channelId, channelEventId, eventType, payload, requestId } = job.data;
    const tracePrefix = requestId ? `[${requestId}] ` : '';
    this.logger.log(
      `${tracePrefix}Received ingestion job ${job.id} for channel '${channelId}' (event: '${eventType}', eventId: '${channelEventId}')`,
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
        (p.externalContactId ||
          p.senderId ||
          p.from ||
          p.deliveryStatusInfo ||
          p.eventKind === 'delivery_status') &&
        (p.externalMessageId ||
          p.messageId ||
          p.mid ||
          p.id ||
          p.deliveryStatusInfo?.externalMessageId)
      ) {
        inboundMessages = [
          {
            eventKind: p.eventKind || (p.deliveryStatusInfo ? 'delivery_status' : 'message'),
            externalContactId: String(
              p.externalContactId ||
                p.senderId ||
                p.from ||
                p.deliveryStatusInfo?.externalMessageId ||
                'system',
            ),
            externalMessageId: String(
              p.externalMessageId ||
                p.messageId ||
                p.mid ||
                p.id ||
                p.deliveryStatusInfo?.externalMessageId,
            ),
            content: p.content ?? p.text ?? null,
            contentType: p.contentType ?? MessageContentType.TEXT,
            attachments: p.attachments,
            deliveryStatusInfo: p.deliveryStatusInfo,
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
        // 3a. Handle delivery status updates (e.g. delivered / read receipts)
        if (msg.eventKind === 'delivery_status' || msg.deliveryStatusInfo) {
          const statusInfo = msg.deliveryStatusInfo;
          const externalMsgId = statusInfo?.externalMessageId || msg.externalMessageId;
          const newStatus = statusInfo?.status;

          if (externalMsgId && newStatus) {
            const existingMessage = await client.message.findFirst({
              where: {
                workspaceId,
                externalId: externalMsgId,
              },
            });

            if (existingMessage) {
              await client.message.update({
                where: { id: existingMessage.id },
                data: {
                  deliveryStatus: newStatus,
                },
              });

              this.logger.log(
                `Updated deliveryStatus to '${newStatus}' for message '${existingMessage.id}' (externalId: '${externalMsgId}', workspace: '${workspaceId}')`,
              );
            } else {
              this.logger.warn(
                `Message with externalId '${externalMsgId}' not found for delivery status update in workspace '${workspaceId}'`,
              );
            }
          }
          continue;
        }

        // 3b. Resolve Contact & ChannelIdentity
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

        // 3c. Find active conversation or create new one
        const conversation = await this.conversationsService.findOrCreateActiveConversation(
          workspaceId,
          {
            contactId: contact.id,
            inboxId,
            channelIdentityId: identity?.id,
          },
        );

        // 3d. Prepare attachments (with MinIO download if external URL provided)
        const attachments = [];
        if (msg.attachments && msg.attachments.length > 0) {
          for (const att of msg.attachments) {
            let storagePath = att.fileUrl;
            let fileUrl = att.fileUrl;
            let fileSize = att.fileSize || 1000;
            let contentType = att.contentType
              ? String(att.contentType)
              : 'application/octet-stream';
            const fileName = att.fileName || 'attachment';

            if (
              this.storageService &&
              att.fileUrl &&
              (att.fileUrl.startsWith('http://') || att.fileUrl.startsWith('https://'))
            ) {
              try {
                const downloaded = await this.downloadAndStoreMedia(
                  workspaceId,
                  att.fileUrl,
                  fileName,
                  contentType,
                );
                if (downloaded) {
                  storagePath = downloaded.storagePath;
                  fileUrl = downloaded.fileUrl;
                  fileSize = downloaded.fileSize;
                  contentType = downloaded.contentType;
                }
              } catch (downloadErr) {
                this.logger.warn(
                  `Failed to download media file from '${att.fileUrl}' for channel '${channelId}': ${(downloadErr as Error).message}. Proceeding with external URL.`,
                );
              }
            }

            attachments.push({
              fileName,
              fileType: (att.fileType as FileType) || FileType.FILE,
              fileSize,
              storagePath,
              contentType,
              fileUrl,
            });
          }
        }

        // 3e. Create inbound message
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
