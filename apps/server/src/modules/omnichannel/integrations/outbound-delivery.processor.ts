import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ChannelType,
  DeliveryStatus,
  MESSAGE_OUTBOUND_QUEUE,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { StorageService } from '../../../infrastructure/storage/storage.service';
import { ChannelCredentialService } from '../../../infrastructure/crypto/channel-credential.service';
import { MessagesService } from '../messages/messages.service';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import {
  ChannelContext,
  OutboundAttachment,
  OutboundMessagePayload,
} from './channel-adapter.types';
import { OutboundDeliveryJobData } from './outbound-message.listener';

const OUTBOUND_LOCK_TTL_MS = 15_000;

/**
 * Delivers queued outgoing messages to their channel provider via the
 * matching ChannelAdapter. Heavy work lives here instead of the
 * message.created request path: BullMQ retries transient provider errors
 * with backoff, and a per-conversation Redis lock keeps messages of the
 * same conversation ordered.
 */
@Processor(MESSAGE_OUTBOUND_QUEUE, { concurrency: 5 })
@Injectable()
export class OutboundDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: ChannelAdapterRegistry,
    private readonly credentialService: ChannelCredentialService,
    private readonly messagesService: MessagesService,
    private readonly redisService: RedisService,
    @Optional() private readonly storageService?: StorageService,
  ) {
    super();
  }

  async process(job: Job<OutboundDeliveryJobData>): Promise<void> {
    const { workspaceId, conversationId, messageId } = job.data;
    const client = this.prisma.getClient();

    const message = await client.message.findFirst({
      where: { id: messageId, workspaceId },
      include: { attachments: true },
    });
    // Deleted before delivery reached the front of the queue — nothing to do.
    if (!message) {
      this.logger.warn(`Outbound message '${messageId}' no longer exists, dropping job`);
      return;
    }

    // A previous attempt already reached the provider; never double-send.
    if (message.externalId && message.deliveryStatus !== DeliveryStatus.PENDING) {
      this.logger.warn(
        `Outbound message '${messageId}' already has externalId '${message.externalId}', dropping duplicate delivery`,
      );
      return;
    }

    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: {
        inbox: { include: { channel: true } },
        channelIdentity: true,
        contact: true,
      },
    });

    if (!conversation) {
      this.logger.warn(
        `Conversation '${conversationId}' not found in workspace '${workspaceId}' during outbound delivery`,
      );
      return;
    }

    const channel = conversation.inbox?.channel;
    if (!channel) {
      await this.failTerminal(workspaceId, messageId, 'CHANNEL_NOT_BOUND');
      return;
    }

    const channelType = channel.channelType as ChannelType;
    if (!this.adapterRegistry.has(channelType)) {
      await this.failTerminal(workspaceId, messageId, 'CHANNEL_ADAPTER_NOT_FOUND');
      return;
    }

    // 5. Resolve recipient external ID from ChannelIdentity or contact identifier
    let recipientExternalId = conversation.channelIdentity?.externalContactId;
    if (!recipientExternalId) {
      const fallbackIdentity = await client.channelIdentity.findFirst({
        where: { workspaceId, channelId: channel.id, contactId: conversation.contactId },
      });
      recipientExternalId =
        fallbackIdentity?.externalContactId || conversation.contact?.identifier || undefined;
    }

    if (!recipientExternalId) {
      this.logger.error(
        `Cannot deliver outbound message '${messageId}': no externalContactId found for contact '${conversation.contactId}' on channel '${channel.id}'`,
      );
      await this.failTerminal(workspaceId, messageId, 'NO_RECIPIENT_EXTERNAL_ID');
      return;
    }

    // Per-conversation serialization: contention throws so BullMQ retries the
    // job later instead of interleaving provider sends out of order.
    const lockKey = `lock:outbound:conv:${conversationId}`;
    const lockToken = await this.redisService.acquireLock(lockKey, OUTBOUND_LOCK_TTL_MS);
    if (!lockToken) {
      this.logger.debug(
        `Outbound lock busy for conversation '${conversationId}', retrying message '${messageId}' later`,
      );
      throw new Error(`OUTBOUND_LOCK_CONTENTION: conversation '${conversationId}'`);
    }

    try {
      const adapter = this.adapterRegistry.get(channelType);
      const channelContext: ChannelContext = {
        channelId: channel.id,
        inboxId: conversation.inboxId,
        workspaceId,
        channelType,
        credentials: this.credentialService.decryptChannelCredentials(channel.credentials),
        settings: (channel.settings as Record<string, unknown>) || {},
        providerAccountId: channel.providerAccountId,
      };

      const outboundAttachments: OutboundAttachment[] = await Promise.all(
        (message.attachments || []).map(async att => ({
          fileUrl: att.storagePath?.startsWith('http')
            ? att.storagePath
            : (await this.storageService?.getSignedUrl(att.storagePath)) || '',
          fileName: att.fileName,
          fileType: att.fileType,
          fileSize: att.fileSize,
        })),
      );

      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId,
        content: message.content || undefined,
        contentType: message.contentType as OutboundMessagePayload['contentType'],
        attachments: outboundAttachments.length > 0 ? outboundAttachments : undefined,
        externalConversationId:
          ((conversation.customAttributes as Record<string, unknown> | null)?.chat_id as
            string | undefined) ||
          ((conversation.channelIdentity?.metadata as Record<string, unknown> | null)?.chat_id as
            string | undefined) ||
          undefined,
        metadata: {
          ...((message.metadata as Record<string, unknown>) ?? {}),
          messageId: message.id,
        },
      };

      this.logger.log(
        `Delivering outbound message '${messageId}' to recipient '${recipientExternalId}' via '${channelType}' (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1})`,
      );

      const result = await adapter.sendMessage(channelContext, outboundPayload);

      await this.messagesService.markOutboundDelivery(workspaceId, messageId, {
        externalId: result.externalMessageId || message.externalId,
        deliveryStatus: result.deliveryStatus || DeliveryStatus.SENT,
      });

      this.logger.log(
        `Successfully delivered outbound message '${messageId}' (externalId: '${result.externalMessageId}')`,
      );
    } catch (err) {
      const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
      if (isFinalAttempt) {
        const errorMessage = (err as Error).message || 'Outbound delivery failed';
        this.logger.error(
          `Failed to deliver outbound message '${messageId}' via '${channelType}' after ${job.attemptsMade} attempts: ${errorMessage}`,
        );
        await this.failTerminal(workspaceId, messageId, errorMessage);
        return;
      }
      throw err;
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }

  private async failTerminal(
    workspaceId: string,
    messageId: string,
    deliveryError: string,
  ): Promise<void> {
    await this.messagesService.markOutboundDelivery(workspaceId, messageId, {
      deliveryStatus: DeliveryStatus.FAILED,
      deliveryError,
    });
  }
}
