import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ChannelType,
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../infrastructure/database';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { ChannelCredentialService } from '../modules/inboxes/channel-credential.service';
import {
  ChannelContext,
  OutboundAttachment,
  OutboundMessagePayload,
} from './channel-adapter.types';

export interface MessageCreatedEventPayload {
  workspaceId: string;
  conversationId: string;
  message: {
    id: string;
    conversationId: string;
    workspaceId: string;
    senderType: SenderType;
    senderId?: string | null;
    messageType: MessageType;
    contentType: MessageContentType;
    content?: string | null;
    isPrivate?: boolean;
    deliveryStatus?: DeliveryStatus;
    externalId?: string | null;
    attachments?: Array<{
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    }>;
    metadata?: Record<string, unknown>;
  };
  isPrivate?: boolean;
}

/**
 * Event listener that dispatches outbound agent messages to third-party channel providers
 * (e.g. Facebook Messenger, Telegram Bot, Web Chat) via registered ChannelAdapters.
 */
@Injectable()
export class OutboundMessageListener {
  private readonly logger = new Logger(OutboundMessageListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: ChannelAdapterRegistry,
    private readonly credentialService: ChannelCredentialService,
  ) {}

  /**
   * Helper to decrypt stored channel credentials.
   */
  private decryptCredentials(rawCredentials: unknown): Record<string, unknown> {
    if (!rawCredentials) return {};
    if (typeof rawCredentials === 'object' && rawCredentials !== null) {
      const credsObj = rawCredentials as Record<string, any>;
      if (credsObj.encrypted && typeof credsObj.encrypted === 'string') {
        try {
          return this.credentialService.decrypt(credsObj.encrypted);
        } catch {
          this.logger.warn('Failed to decrypt channel credentials');
          return {};
        }
      }
      return credsObj;
    } else if (typeof rawCredentials === 'string' && rawCredentials.includes(':')) {
      try {
        return this.credentialService.decrypt(rawCredentials);
      } catch {
        this.logger.warn('Failed to decrypt channel credentials string');
        return {};
      }
    }
    return {};
  }

  @OnEvent('message.created')
  async handleOutboundMessage(payload: MessageCreatedEventPayload): Promise<void> {
    const { workspaceId, conversationId, message } = payload;

    // 1. Skip non-outgoing messages (e.g. incoming messages from contacts, system activity logs)
    if (message.messageType !== MessageType.OUTGOING) {
      return;
    }

    // 2. Skip private notes (internal agent-to-agent notes)
    if (payload.isPrivate || message.isPrivate) {
      this.logger.debug(
        `Skipping outbound dispatch for private note '${message.id}' in conversation '${conversationId}'`,
      );
      return;
    }

    // 3. Skip messages originating from contacts
    if (message.senderType === SenderType.CONTACT) {
      return;
    }

    const client = this.prisma.getClient();

    // 4. Fetch conversation with Inbox & Channel
    const conversation = await client.conversation.findFirst({
      where: {
        id: conversationId,
        workspaceId,
      },
      include: {
        inbox: {
          include: {
            channel: true,
          },
        },
        channelIdentity: true,
        contact: true,
      },
    });

    if (!conversation) {
      this.logger.warn(
        `Conversation '${conversationId}' not found in workspace '${workspaceId}' during outbound dispatch`,
      );
      return;
    }

    const channel = conversation.inbox?.channel;
    if (!channel) {
      this.logger.warn(
        `No channel bound to inbox '${conversation.inboxId}' in conversation '${conversationId}'`,
      );
      return;
    }

    // 5. Resolve recipient external ID from ChannelIdentity or contact identifier
    let recipientExternalId = conversation.channelIdentity?.externalContactId;

    if (!recipientExternalId) {
      const fallbackIdentity = await client.channelIdentity.findFirst({
        where: {
          workspaceId,
          channelId: channel.id,
          contactId: conversation.contactId,
        },
      });
      recipientExternalId =
        fallbackIdentity?.externalContactId || conversation.contact?.identifier || undefined;
    }

    if (!recipientExternalId) {
      this.logger.error(
        `Cannot deliver outbound message '${message.id}': no externalContactId found for contact '${conversation.contactId}' on channel '${channel.id}'`,
      );
      await client.message.update({
        where: { id: message.id },
        data: {
          deliveryStatus: DeliveryStatus.FAILED,
          metadata: {
            ...(message.metadata || {}),
            deliveryError: 'NO_RECIPIENT_EXTERNAL_ID',
          },
        },
      });
      return;
    }

    // 6. Check adapter registry
    const channelType = channel.channelType as ChannelType;
    if (!this.adapterRegistry.has(channelType)) {
      this.logger.warn(
        `No adapter registered for channelType '${channelType}' (channel: '${channel.id}'). Skipping outbound dispatch.`,
      );
      return;
    }

    const adapter = this.adapterRegistry.get(channelType);
    const decryptedCreds = this.decryptCredentials(channel.credentials);

    const channelContext: ChannelContext = {
      channelId: channel.id,
      inboxId: conversation.inboxId,
      workspaceId,
      channelType,
      credentials: decryptedCreds,
      settings: (channel.settings as Record<string, unknown>) || {},
      providerAccountId: channel.providerAccountId,
    };

    const outboundAttachments: OutboundAttachment[] | undefined = message.attachments?.map(att => ({
      fileUrl: att.fileUrl || '',
      fileName: att.fileName,
      fileType: att.fileType,
      fileSize: att.fileSize,
    }));

    const outboundPayload: OutboundMessagePayload = {
      recipientExternalId,
      content: message.content || undefined,
      contentType: message.contentType,
      attachments:
        outboundAttachments && outboundAttachments.length > 0 ? outboundAttachments : undefined,
      externalConversationId:
        (conversation.customAttributes as any)?.chat_id ||
        (conversation.channelIdentity?.metadata as any)?.chat_id ||
        undefined,
      metadata: {
        ...(message.metadata || {}),
        messageId: message.id,
      },
    };

    try {
      this.logger.log(
        `Delivering outbound message '${message.id}' to recipient '${recipientExternalId}' via '${channelType}'`,
      );

      const result = await adapter.sendMessage(channelContext, outboundPayload);

      await client.message.update({
        where: { id: message.id },
        data: {
          externalId: result.externalMessageId || message.externalId,
          deliveryStatus: result.deliveryStatus || DeliveryStatus.SENT,
        },
      });

      this.logger.log(
        `Successfully delivered outbound message '${message.id}' (externalId: '${result.externalMessageId}', status: '${result.deliveryStatus}')`,
      );
    } catch (sendErr) {
      const errorMessage = (sendErr as Error).message || 'Outbound delivery failed';
      this.logger.error(
        `Failed to deliver outbound message '${message.id}' via '${channelType}': ${errorMessage}`,
        (sendErr as Error).stack,
      );

      await client.message.update({
        where: { id: message.id },
        data: {
          deliveryStatus: DeliveryStatus.FAILED,
          metadata: {
            ...(message.metadata || {}),
            deliveryError: errorMessage,
          },
        },
      });
    }
  }
}
