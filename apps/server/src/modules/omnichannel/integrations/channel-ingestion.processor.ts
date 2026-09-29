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
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { ContactResolutionService } from '../contacts/contact-resolution.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { ChannelCredentialService } from '../../../infrastructure/crypto/channel-credential.service';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import type { InboundMessagePayload } from './channel-adapter.types';

export interface ChannelIngestionJobData {
  channelId: string;
  channelEventId: string;
  eventType: string;
  payload: unknown;
  requestId?: string;
}

@Processor('channel-ingestion', { concurrency: 5 })
@Injectable()
export class ChannelIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(ChannelIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactResolutionService: ContactResolutionService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly adapterRegistry: ChannelAdapterRegistry,
    private readonly credentialService: ChannelCredentialService,
    @Optional() private readonly storageService?: StorageService,
  ) {
    super();
  }

  /**
   * Helper to safely decrypt channel credentials.
   */
  private decryptCredentials(credentials: unknown): Record<string, unknown> {
    if (!credentials) return {};
    if (typeof credentials === 'object' && credentials !== null) {
      if ('encrypted' in credentials && typeof (credentials as any).encrypted === 'string') {
        if (this.credentialService) {
          try {
            return this.credentialService.decrypt((credentials as any).encrypted);
          } catch (err) {
            this.logger.warn(`Failed to decrypt channel credentials: ${(err as Error).message}`);
            return {};
          }
        }
      }
      return credentials as Record<string, unknown>;
    }
    if (typeof credentials === 'string' && this.credentialService) {
      try {
        return this.credentialService.decrypt(credentials);
      } catch (err) {
        this.logger.warn(`Failed to decrypt channel credentials string: ${(err as Error).message}`);
        return {};
      }
    }
    return {};
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
      this.logger.warn(`${tracePrefix}Channel with ID '${channelId}' not found during ingestion`);
      return;
    }

    const workspaceId = channel.workspaceId;
    const inboxId = channel.inboxId;

    // 2. Parse inbound message payloads using adapter or fallback normalization
    let inboundMessages: InboundMessagePayload[] = [];
    let parseFailed = false;

    if (this.adapterRegistry && this.adapterRegistry.has(channel.channelType as ChannelType)) {
      try {
        const adapter = this.adapterRegistry.get(channel.channelType as ChannelType);
        inboundMessages = await adapter.parseInboundPayload(payload);
      } catch (parseErr) {
        parseFailed = true;
        this.logger.warn(
          `${tracePrefix}Adapter parsing failed for channel '${channelId}': ${(parseErr as Error).message}`,
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

    if (parseFailed && (!inboundMessages || inboundMessages.length === 0)) {
      // Adapter failed AND the fallback normalizer produced nothing: retrying is the only
      // chance to ingest this event — fail the job so BullMQ retries it.
      throw new Error(
        `${tracePrefix}Adapter parsing failed and no message could be normalized for channel '${channelId}' (event '${eventType}'). Job will be retried.`,
      );
    }

    // 3. Process each normalized message, collecting per-message failures. A failed
    // message must NOT be silently dropped: the ChannelEvent is left unprocessed and the
    // job throws so BullMQ retries. Retrying is idempotent — Message dedup
    // (@@unique([conversationId, externalId])) skips already-created messages.
    const failedMessages: Array<{ externalId: string; error: string }> = [];

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
                where: {
                  workspaceId_id: {
                    workspaceId,
                    id: existingMessage.id,
                  },
                },
                data: {
                  deliveryStatus: newStatus,
                },
              });

              this.logger.log(
                `${tracePrefix}Updated deliveryStatus to '${newStatus}' for message '${existingMessage.id}' (externalId: '${externalMsgId}', workspace: '${workspaceId}')`,
              );
            } else if (/^(watermark_|read_)/.test(externalMsgId)) {
              // Synthetic receipt ids from Facebook (see facebook.adapter.ts) can never
              // match a Message row — warn and move on instead of failing the job.
              this.logger.debug(
                `${tracePrefix}Skipping synthetic delivery receipt '${externalMsgId}' in workspace '${workspaceId}'`,
              );
            } else {
              // Real message id not in DB yet — the message row may still be in-flight in
              // a concurrent job, so treat this as a retryable failure.
              failedMessages.push({
                externalId: externalMsgId,
                error: `message with externalId not found for delivery status update`,
              });
              this.logger.warn(
                `${tracePrefix}Message with externalId '${externalMsgId}' not found for delivery status update in workspace '${workspaceId}'`,
              );
            }
          }
          continue;
        }

        // 3b. Enrich sender profile if missing
        if (
          (!msg.senderInfo?.name || !msg.senderInfo?.avatarUrl) &&
          this.adapterRegistry?.has(channel.channelType as ChannelType)
        ) {
          try {
            const adapter = this.adapterRegistry.get(channel.channelType as ChannelType);
            if (adapter.fetchSenderInfo) {
              const decryptedCreds = this.decryptCredentials(channel.credentials);
              const fetchedSender = await adapter.fetchSenderInfo(
                {
                  channelId: channel.id,
                  inboxId: channel.inboxId,
                  channelType: channel.channelType as ChannelType,
                  credentials: decryptedCreds,
                  settings: (channel.settings as Record<string, unknown>) || {},
                  workspaceId: channel.workspaceId,
                },
                msg.externalContactId,
              );
              if (fetchedSender) {
                msg.senderInfo = {
                  ...msg.senderInfo,
                  name: fetchedSender.name || msg.senderInfo?.name,
                  avatarUrl: fetchedSender.avatarUrl || msg.senderInfo?.avatarUrl,
                  username: fetchedSender.username || msg.senderInfo?.username,
                  phoneNumber: fetchedSender.phoneNumber || msg.senderInfo?.phoneNumber,
                  email: fetchedSender.email || msg.senderInfo?.email,
                };
              }
            }
          } catch (profileErr) {
            this.logger.debug(
              `${tracePrefix}Could not enrich sender info from adapter for '${msg.externalContactId}': ${(profileErr as Error).message}`,
            );
          }
        }

        // 3c. Resolve Contact & ChannelIdentity
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
                  `${tracePrefix}Failed to download media file from '${att.fileUrl}' for channel '${channelId}': ${(downloadErr as Error).message}. Proceeding with external URL.`,
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
          `${tracePrefix}Ingested message '${msg.externalMessageId}' on conversation '${conversation.id}' for contact '${contact.id}' (workspace: '${workspaceId}')`,
        );
      } catch (msgErr) {
        this.logger.error(
          `${tracePrefix}Failed to process inbound message '${msg.externalMessageId}' on channel '${channelId}': ${(msgErr as Error).message}`,
          (msgErr as Error).stack,
        );
        failedMessages.push({
          externalId: msg.externalMessageId,
          error: (msgErr as Error).message,
        });
      }
    }

    if (failedMessages.length > 0) {
      // Do NOT mark the ChannelEvent processed — fail the job so BullMQ retries it.
      throw new Error(
        `${tracePrefix}Failed to process ${failedMessages.length}/${inboundMessages.length} inbound messages for channel '${channelId}' (first failure: '${failedMessages[0].externalId}': ${failedMessages[0].error}). Job will be retried.`,
      );
    }

    // 4. Mark ChannelEvent as processed in database
    if (channelEventId) {
      try {
        await client.channelEvent.updateMany({
          where: { id: channelEventId, channelId },
          data: { processedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(
          `${tracePrefix}Failed to update processedAt for channelEvent '${channelEventId}': ${(err as Error).message}`,
        );
      }
    }
  }
}
