import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MESSAGE_OUTBOUND_QUEUE, MessageType, SenderType } from '@sales-copilot/shared-contracts';

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
    contentType: string;
    content?: string | null;
    isPrivate?: boolean;
    deliveryStatus?: string;
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

export interface OutboundDeliveryJobData {
  workspaceId: string;
  conversationId: string;
  messageId: string;
}

/**
 * Producer side of outbound delivery. Watches message.created and enqueues
 * deliverable messages onto the message-outbound queue; the
 * OutboundDeliveryProcessor owns the provider call so a slow channel API
 * never blocks the request path and transient failures are retried.
 */
@Injectable()
export class OutboundMessageListener {
  private readonly logger = new Logger(OutboundMessageListener.name);

  constructor(
    @InjectQueue(MESSAGE_OUTBOUND_QUEUE)
    private readonly outboundQueue: Queue<OutboundDeliveryJobData>,
  ) {}

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

    // 4. Skip messages that must not be delivered outward (e.g. personal-Zalo
    // messages sent by the account owner from their phone, mirrored into the inbox).
    if ((message.metadata as Record<string, unknown> | null | undefined)?.suppressOutbound) {
      return;
    }

    await this.outboundQueue.add(
      'deliver-message',
      { workspaceId, conversationId, messageId: message.id },
      {
        // Deterministic id: duplicate message.created emissions never double-deliver.
        jobId: `out_${message.id}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
      },
    );

    this.logger.log(
      `Queued outbound delivery for message '${message.id}' (conversation '${conversationId}')`,
    );
  }
}
