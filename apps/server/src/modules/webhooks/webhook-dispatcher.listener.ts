import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DomainEvent, WebhookDeliveryStatus } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { WEBHOOK_DELIVERY_QUEUE, type WebhookDeliveryJobData } from '../../infrastructure/queue';

/**
 * WebhookDispatcherListener listens to domain events and creates
 * BullMQ delivery jobs for any active webhook subscriptions matching the event.
 *
 * Implements strict error isolation: any failure in subscription lookup or job enqueuing
 * is logged and safely caught, preventing disruptions to upstream workflows.
 */
@Injectable()
export class WebhookDispatcherListener {
  private readonly logger = new Logger(WebhookDispatcherListener.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<WebhookDeliveryJobData>,
  ) {}

  /**
   * Core dispatcher that finds matching active subscriptions in the workspace,
   * persists initial WebhookDelivery record (PENDING), and enqueues BullMQ delivery job.
   */
  async dispatch(eventType: string, payload: any): Promise<void> {
    try {
      const workspaceId = payload?.workspaceId;
      if (!workspaceId || typeof workspaceId !== 'string') {
        return;
      }

      const client = this.prisma.getClient();

      // 1. Fetch active subscriptions for workspace
      const subscriptions = await client.webhookSubscription.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
      });

      if (!subscriptions || subscriptions.length === 0) {
        return;
      }

      // 2. Filter subscriptions that subscribe to this specific event
      const matchingSubscriptions = subscriptions.filter(sub => {
        let eventList: string[] = [];
        if (Array.isArray(sub.subscriptions)) {
          eventList = sub.subscriptions as string[];
        } else if (typeof sub.subscriptions === 'string') {
          try {
            const parsed = JSON.parse(sub.subscriptions);
            if (Array.isArray(parsed)) eventList = parsed;
          } catch {
            eventList = [];
          }
        }
        return eventList.includes(eventType);
      });

      if (matchingSubscriptions.length === 0) {
        return;
      }

      // 3. Prepare standardized outbound payload envelope
      const formattedPayload = {
        event: eventType,
        data: payload,
        timestamp: new Date().toISOString(),
        workspaceId,
      };

      // 4. Create WebhookDelivery record & dispatch BullMQ job for each matching subscription
      for (const sub of matchingSubscriptions) {
        try {
          const eventId = randomUUID();

          const delivery = await client.webhookDelivery.create({
            data: {
              subscriptionId: sub.id,
              eventId,
              eventType,
              payload: formattedPayload as any,
              status: WebhookDeliveryStatus.PENDING,
              attemptCount: 0,
            },
          });

          const requestId =
            payload?.requestId || payload?.metadata?.requestId || payload?.context?.requestId;
          const tracePrefix = requestId ? `[${requestId}] ` : '';

          await this.deliveryQueue.add(
            'deliver-webhook',
            {
              deliveryId: delivery.id,
              subscriptionId: sub.id,
              workspaceId,
              url: sub.url,
              secretKey: sub.secretKey,
              eventType,
              payload: formattedPayload,
              ...(requestId ? { requestId: String(requestId) } : {}),
            },
            {
              jobId: delivery.id,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 30_000,
              },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );

          this.logger.log(
            `${tracePrefix}Enqueued webhook delivery '${delivery.id}' for event '${eventType}' to subscription '${sub.id}' (${sub.url})`,
          );
        } catch (subErr) {
          this.logger.error(
            `Failed to enqueue webhook delivery for subscription '${sub.id}': ${(subErr as Error).message}`,
            (subErr as Error).stack,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Unexpected error in WebhookDispatcherListener for event '${eventType}': ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ==========================================================================
  // Conversation Domain Event Listeners
  // ==========================================================================

  @OnEvent(DomainEvent.CONVERSATION_CREATED, { async: true })
  @OnEvent('conversation.created', { async: true })
  async handleConversationCreated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_CREATED, payload);
  }

  @OnEvent(DomainEvent.CONVERSATION_UPDATED, { async: true })
  @OnEvent('conversation.updated', { async: true })
  async handleConversationUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CONVERSATION_STATUS_UPDATED, { async: true })
  @OnEvent('conversation.status_updated', { async: true })
  async handleConversationStatusUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_STATUS_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CONVERSATION_REOPENED, { async: true })
  @OnEvent('conversation.reopened', { async: true })
  async handleConversationReopened(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_REOPENED, payload);
  }

  @OnEvent(DomainEvent.CONVERSATION_ASSIGNED, { async: true })
  @OnEvent('conversation.assigned', { async: true })
  async handleConversationAssigned(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_ASSIGNED, payload);
  }

  @OnEvent(DomainEvent.CONVERSATION_PRIORITY_UPDATED, { async: true })
  @OnEvent('conversation.priority_updated', { async: true })
  async handleConversationPriorityUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_PRIORITY_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CONVERSATION_LABELS_UPDATED, { async: true })
  @OnEvent('conversation.labels_updated', { async: true })
  async handleConversationLabelsUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONVERSATION_LABELS_UPDATED, payload);
  }

  // ==========================================================================
  // Message Domain Event Listeners
  // ==========================================================================

  @OnEvent(DomainEvent.MESSAGE_CREATED, { async: true })
  @OnEvent('message.created', { async: true })
  async handleMessageCreated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.MESSAGE_CREATED, payload);
  }

  @OnEvent(DomainEvent.MESSAGE_UPDATED, { async: true })
  @OnEvent('message.updated', { async: true })
  async handleMessageUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.MESSAGE_UPDATED, payload);
  }

  @OnEvent(DomainEvent.MESSAGE_DELETED, { async: true })
  @OnEvent('message.deleted', { async: true })
  async handleMessageDeleted(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.MESSAGE_DELETED, payload);
  }

  @OnEvent(DomainEvent.MESSAGE_DELIVERY_STATUS_UPDATED, { async: true })
  @OnEvent('message.delivery_status_updated', { async: true })
  async handleMessageDeliveryStatusUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.MESSAGE_DELIVERY_STATUS_UPDATED, payload);
  }

  // ==========================================================================
  // Contact Domain Event Listeners
  // ==========================================================================

  @OnEvent(DomainEvent.CONTACT_CREATED, { async: true })
  @OnEvent('contact.created', { async: true })
  async handleContactCreated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONTACT_CREATED, payload);
  }

  @OnEvent(DomainEvent.CONTACT_UPDATED, { async: true })
  @OnEvent('contact.updated', { async: true })
  async handleContactUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONTACT_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CONTACT_DELETED, { async: true })
  @OnEvent('contact.deleted', { async: true })
  async handleContactDeleted(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONTACT_DELETED, payload);
  }

  @OnEvent(DomainEvent.CONTACT_MERGED, { async: true })
  @OnEvent('contact.merged', { async: true })
  async handleContactMerged(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CONTACT_MERGED, payload);
  }

  // ==========================================================================
  // Channel Identity Domain Event Listeners
  // ==========================================================================

  @OnEvent(DomainEvent.CHANNEL_IDENTITY_CREATED, { async: true })
  @OnEvent('channel_identity.created', { async: true })
  async handleChannelIdentityCreated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CHANNEL_IDENTITY_CREATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_IDENTITY_DELETED, { async: true })
  @OnEvent('channel_identity.deleted', { async: true })
  async handleChannelIdentityDeleted(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CHANNEL_IDENTITY_DELETED, payload);
  }

  // ==========================================================================
  // Label Domain Event Listeners
  // ==========================================================================

  @OnEvent(DomainEvent.LABEL_CREATED, { async: true })
  @OnEvent('label.created', { async: true })
  async handleLabelCreated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.LABEL_CREATED, payload);
  }

  @OnEvent(DomainEvent.LABEL_UPDATED, { async: true })
  @OnEvent('label.updated', { async: true })
  async handleLabelUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.LABEL_UPDATED, payload);
  }

  @OnEvent(DomainEvent.LABEL_DELETED, { async: true })
  @OnEvent('label.deleted', { async: true })
  async handleLabelDeleted(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.LABEL_DELETED, payload);
  }

  // ==========================================================================
  // Channel Domain Event Listeners
  // ==========================================================================

  @OnEvent(DomainEvent.CHANNEL_CREATED, { async: true })
  @OnEvent('channel.created', { async: true })
  async handleChannelCreated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CHANNEL_CREATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_UPDATED, { async: true })
  @OnEvent('channel.updated', { async: true })
  async handleChannelUpdated(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CHANNEL_UPDATED, payload);
  }

  @OnEvent(DomainEvent.CHANNEL_DELETED, { async: true })
  @OnEvent('channel.deleted', { async: true })
  async handleChannelDeleted(payload: any): Promise<void> {
    await this.dispatch(DomainEvent.CHANNEL_DELETED, payload);
  }
}
