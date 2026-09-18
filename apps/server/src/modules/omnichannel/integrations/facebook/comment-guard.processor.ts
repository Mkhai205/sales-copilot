import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  COMMENT_GUARD_QUEUE,
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  MessageType,
  MessageContentType,
  SenderType,
  extractVietnamesePhoneNumbers,
  normalizeVietnamesePhoneNumber,
  type ChannelSettings,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../../infrastructure/database';
import { ContactResolutionService } from '../../../omnichannel/contacts/contact-resolution.service';
import { ConversationsService } from '../../../omnichannel/conversations/conversations.service';
import { MessagesService } from '../../../omnichannel/messages/messages.service';
import { ChannelCredentialService } from '../../../omnichannel/inboxes/channel-credential.service';
import { FacebookAdapter, FacebookRateLimitError } from './facebook.adapter';

export interface CommentGuardJobData {
  workspaceId: string;
  channelId: string;
  channelEventId?: string;
  commentId: string;
  parentId?: string;
  postId?: string;
  senderId: string;
  senderName?: string;
  message: string;
  verb: 'add' | 'edited';
  timestamp: string;
  requestId?: string;
}

export interface CommentGuardResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  commentId?: string;
  phoneExtracted?: string;
  hidden?: boolean;
  privateReplyId?: string;
  publicReplyId?: string;
  conversationId?: string;
  messageId?: string;
}

@Processor(COMMENT_GUARD_QUEUE, {
  limiter: {
    max: 180,
    duration: 3600000,
  },
})
@Injectable()
export class CommentGuardProcessor extends WorkerHost {
  private readonly logger = new Logger(CommentGuardProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactResolutionService: ContactResolutionService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly adapter: FacebookAdapter,
    @Optional() private readonly credentialService?: ChannelCredentialService,
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

  async process(job: Job<CommentGuardJobData>): Promise<CommentGuardResult> {
    const {
      workspaceId,
      channelId,
      channelEventId,
      commentId,
      parentId,
      postId,
      senderId,
      senderName,
      message,
    } = job.data;

    const tracePrefix = `[CommentGuard][job=${job.id}][comment=${commentId}] `;
    this.logger.log(`${tracePrefix}Processing comment guard job for channel '${channelId}'`);

    const client = this.prisma.getClient();

    // 1. Strict Multi-Tenancy: Fetch channel by channelId and workspaceId
    const channel = await client.channel.findFirst({
      where: { id: channelId, workspaceId },
    });

    if (!channel) {
      this.logger.warn(
        `${tracePrefix}Channel '${channelId}' not found in workspace '${workspaceId}', skipping.`,
      );
      return { success: false, skipped: true, reason: 'CHANNEL_NOT_FOUND' };
    }

    // Check if Comment Guard is enabled
    const settings = (channel.settings as ChannelSettings) || {};
    const commentGuard = settings.commentGuard;

    if (!commentGuard?.enabled) {
      this.logger.debug(
        `${tracePrefix}Comment Guard is disabled on channel '${channelId}', skipping.`,
      );
      return { success: true, skipped: true, reason: 'GUARD_DISABLED' };
    }

    // 2. Scan text using regex to extract Vietnamese phone numbers
    const extractedPhones = extractVietnamesePhoneNumbers(message);
    if (!extractedPhones || extractedPhones.length === 0) {
      this.logger.debug(
        `${tracePrefix}No Vietnamese phone number found in comment message, skipping.`,
      );
      return { success: true, skipped: true, reason: 'NO_PHONE_DETECTED' };
    }

    const primaryPhone = normalizeVietnamesePhoneNumber(extractedPhones[0]);
    this.logger.log(`${tracePrefix}Extracted phone number: '${primaryPhone}'`);

    const credentials = this.decryptCredentials(channel.credentials);
    const graphVersion = (channel.settings as any)?.graphApiVersion || undefined;

    // 3. Step 1: Hide Comment (Fail-safe: continue on non-rate-limit error)
    let hidden = false;
    try {
      hidden = await this.adapter.hideComment(credentials, commentId, graphVersion);
      this.logger.log(`${tracePrefix}Comment '${commentId}' hidden successfully.`);
    } catch (err: any) {
      if (err instanceof FacebookRateLimitError || err?.isRateLimit || err?.status === 429) {
        this.logger.warn(
          `${tracePrefix}Rate limit (HTTP 429) encountered on hideComment. Re-throwing for BullMQ backoff retry.`,
        );
        throw err;
      }
      this.logger.warn(
        `${tracePrefix}Fail-safe: hideComment failed for comment '${commentId}': ${(err as Error).message}. Proceeding with message delivery & contact capture.`,
      );
    }

    // 4. Step 2: Send Private Reply via Messenger
    let privateReplyResult: { id: string } | null = null;
    const privateReplyTemplate =
      commentGuard.privateReplyTemplate?.trim() || DEFAULT_COMMENT_GUARD_PRIVATE_REPLY;
    try {
      privateReplyResult = await this.adapter.sendPrivateReply(
        credentials,
        commentId,
        privateReplyTemplate,
        graphVersion,
      );
      this.logger.log(
        `${tracePrefix}Sent private reply for comment '${commentId}', response id: ${privateReplyResult.id}`,
      );
    } catch (err: any) {
      if (err instanceof FacebookRateLimitError || err?.isRateLimit || err?.status === 429) {
        this.logger.warn(
          `${tracePrefix}Rate limit (HTTP 429) encountered on sendPrivateReply. Re-throwing for BullMQ backoff retry.`,
        );
        throw err;
      }
      this.logger.warn(
        `${tracePrefix}Failed to send private reply for comment '${commentId}': ${(err as Error).message}`,
      );
    }

    // 5. Step 3: Post Public Comment Reply (if publicReplyEnabled !== false)
    let publicReplyResult: { id: string } | null = null;
    if (commentGuard.publicReplyEnabled !== false) {
      const publicReplyTemplate =
        commentGuard.publicReplyTemplate?.trim() || DEFAULT_COMMENT_GUARD_PUBLIC_REPLY;
      try {
        publicReplyResult = await this.adapter.sendPublicCommentReply(
          credentials,
          commentId,
          publicReplyTemplate,
          graphVersion,
        );
        this.logger.log(
          `${tracePrefix}Posted public comment reply for comment '${commentId}', response id: ${publicReplyResult.id}`,
        );
      } catch (err: any) {
        if (err instanceof FacebookRateLimitError || err?.isRateLimit || err?.status === 429) {
          this.logger.warn(
            `${tracePrefix}Rate limit (HTTP 429) encountered on sendPublicCommentReply. Re-throwing for BullMQ backoff retry.`,
          );
          throw err;
        }
        this.logger.warn(
          `${tracePrefix}Failed to post public comment reply for comment '${commentId}': ${(err as Error).message}`,
        );
      }
    }

    // 6. Step 4: Resolve Contact via ContactResolutionService and populate phone number
    const resolvedResult = await this.contactResolutionService.resolveFromChannel({
      workspaceId,
      channelId,
      externalContactId: senderId,
      contactInfo: {
        name: senderName || 'Facebook User',
        phoneNumber: primaryPhone,
      },
      username: senderName,
    });

    const contact = resolvedResult.contact;
    const channelIdentity = resolvedResult.channelIdentity;

    // Strict Multi-Tenancy: update phoneNumber if not already populated on contact
    if (!contact.phoneNumber && primaryPhone) {
      await client.contact.updateMany({
        where: { id: contact.id, workspaceId },
        data: { phoneNumber: primaryPhone },
      });
    }

    // 7. Step 5: Find or create active conversation in Unified Inbox
    const conversation = await this.conversationsService.findOrCreateActiveConversation(
      workspaceId,
      {
        contactId: contact.id,
        inboxId: channel.inboxId,
        channelIdentityId: channelIdentity.id,
      },
    );

    // 8. Step 6: Create Message in conversation (emits message.created event for AI Dispatcher)
    const messageExternalId =
      job.data.verb === 'edited'
        ? `fb_comment_${commentId}_edit_${Date.now()}`
        : `fb_comment_${commentId}`;

    const existingMessage = await client.message.findFirst({
      where: {
        workspaceId,
        conversationId: conversation.id,
        externalId: messageExternalId,
      },
    });

    let createdMessage: any = existingMessage;
    if (!existingMessage) {
      createdMessage = await this.messagesService.create(workspaceId, conversation.id, {
        senderType: SenderType.CONTACT,
        senderId: contact.id,
        content: message,
        messageType: MessageType.INCOMING,
        contentType: MessageContentType.TEXT,
        externalId: messageExternalId,
        metadata: {
          commentId,
          parentId,
          postId,
          source: 'comment_guard',
          extractedPhone: primaryPhone,
          hidden,
          privateReplyId: privateReplyResult?.id,
          publicReplyId: publicReplyResult?.id,
          verb: job.data.verb,
        },
      });
    }

    // 9. Mark ChannelEvent as processed if channelEventId provided
    if (channelEventId) {
      try {
        await client.channelEvent.update({
          where: { id: channelEventId },
          data: { processedAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(
          `${tracePrefix}Failed to update processedAt for channelEvent '${channelEventId}': ${(err as Error).message}`,
        );
      }
    }

    return {
      success: true,
      commentId,
      phoneExtracted: primaryPhone,
      hidden,
      privateReplyId: privateReplyResult?.id,
      publicReplyId: publicReplyResult?.id,
      conversationId: conversation.id,
      messageId: createdMessage?.id,
    };
  }
}
