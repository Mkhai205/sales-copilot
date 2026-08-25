import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookSubscriptionDto,
  WebhookSubscriptionListQueryDto,
  WebhookDeliveryDto,
  WebhookDeliveryDetailDto,
  WebhookDeliveryListQueryDto,
} from '@sales-copilot/shared-contracts';
import { WebhookDeliveryStatus } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { WEBHOOK_DELIVERY_QUEUE, type WebhookDeliveryJobData } from '../../infrastructure/queue';
import { generateWebhookSecret } from './webhook-signer';
import {
  mapWebhookSubscriptionToDto,
  mapWebhookDeliveryToDto,
  mapWebhookDeliveryToDetailDto,
} from './webhook-subscriptions.mapper';

@Injectable()
export class WebhookSubscriptionsService {
  private readonly logger = new Logger(WebhookSubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly deliveryQueue?: Queue<WebhookDeliveryJobData>,
  ) {}

  /**
   * Creates a new outbound Webhook Subscription for a workspace.
   * Auto-generates an HMAC secretKey if not provided.
   */
  async create(
    workspaceId: string,
    dto: CreateWebhookSubscriptionDto,
    actorUserId?: string,
  ): Promise<WebhookSubscriptionDto> {
    const client = this.prisma.getClient();
    const url = dto.url?.trim();

    if (!url) {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_URL',
        message: 'Webhook URL cannot be empty',
      });
    }

    const providedSecret = dto.secretKey || dto.secret;
    const secretKey = providedSecret?.trim() || generateWebhookSecret();
    const rawSubs = dto.subscriptions || dto.events || [];
    const subscriptions = Array.from(new Set(rawSubs));

    const created = await client.webhookSubscription.create({
      data: {
        workspaceId,
        url,
        secretKey,
        subscriptions: subscriptions as any,
        isActive: dto.isActive ?? true,
      },
    });

    const responseDto = mapWebhookSubscriptionToDto(created);

    this.eventEmitter.emit('webhook_subscription.created', {
      workspaceId,
      subscription: responseDto,
      userId: actorUserId,
    });

    this.logger.log(
      `Created webhook subscription (${responseDto.id}) for URL '${responseDto.url}' in workspace '${workspaceId}'`,
    );

    return responseDto;
  }

  /**
   * Lists all webhook subscriptions for a workspace with optional filters.
   */
  async list(
    workspaceId: string,
    query?: WebhookSubscriptionListQueryDto,
  ): Promise<WebhookSubscriptionDto[]> {
    const client = this.prisma.getClient();
    const where: Record<string, unknown> = { workspaceId };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const rawSearch = query?.search || query?.q;
    if (rawSearch && rawSearch.trim() !== '') {
      const searchTerm = rawSearch.trim();
      where.url = { contains: searchTerm, mode: 'insensitive' };
    }

    let records = await client.webhookSubscription.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (query?.event) {
      records = records.filter(rec => {
        let eventsList: unknown[] = [];
        if (Array.isArray(rec.subscriptions)) {
          eventsList = rec.subscriptions;
        } else if (typeof rec.subscriptions === 'string') {
          try {
            const parsed = JSON.parse(rec.subscriptions);
            if (Array.isArray(parsed)) eventsList = parsed;
          } catch {
            eventsList = [];
          }
        }
        return eventsList.includes(query.event);
      });
    }

    return records.map(mapWebhookSubscriptionToDto);
  }

  /**
   * Retrieves a single webhook subscription by ID within a workspace.
   */
  async getById(workspaceId: string, id: string): Promise<WebhookSubscriptionDto> {
    const client = this.prisma.getClient();
    const found = await client.webhookSubscription.findFirst({
      where: { id, workspaceId },
    });

    if (!found) {
      throw new NotFoundException({
        code: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
        message: `Webhook subscription with id '${id}' not found in this workspace`,
      });
    }

    return mapWebhookSubscriptionToDto(found);
  }

  /**
   * Updates an existing webhook subscription in the workspace.
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateWebhookSubscriptionDto,
    actorUserId?: string,
  ): Promise<WebhookSubscriptionDto> {
    const client = this.prisma.getClient();
    const existing = await client.webhookSubscription.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
        message: `Webhook subscription with id '${id}' not found in this workspace`,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (dto.url !== undefined) {
      const trimmedUrl = dto.url.trim();
      if (!trimmedUrl) {
        throw new BadRequestException({
          code: 'INVALID_WEBHOOK_URL',
          message: 'Webhook URL cannot be empty',
        });
      }
      updateData.url = trimmedUrl;
    }

    const rawSubs = dto.subscriptions !== undefined ? dto.subscriptions : dto.events;
    if (rawSubs !== undefined) {
      updateData.subscriptions = Array.from(new Set(rawSubs)) as any;
    }

    const rawSecret = dto.secretKey !== undefined ? dto.secretKey : dto.secret;
    if (rawSecret !== undefined) {
      updateData.secretKey = rawSecret ? rawSecret.trim() : null;
    }

    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }

    const updated = await client.webhookSubscription.update({
      where: { id },
      data: updateData,
    });

    const responseDto = mapWebhookSubscriptionToDto(updated);

    this.eventEmitter.emit('webhook_subscription.updated', {
      workspaceId,
      subscription: responseDto,
      userId: actorUserId,
    });

    this.logger.log(
      `Updated webhook subscription (${responseDto.id}) in workspace '${workspaceId}'`,
    );

    return responseDto;
  }

  /**
   * Deletes a webhook subscription from the workspace.
   */
  async delete(workspaceId: string, id: string, actorUserId?: string): Promise<{ success: true }> {
    const client = this.prisma.getClient();
    const existing = await client.webhookSubscription.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'WEBHOOK_SUBSCRIPTION_NOT_FOUND',
        message: `Webhook subscription with id '${id}' not found in this workspace`,
      });
    }

    await client.webhookSubscription.delete({
      where: { id },
    });

    this.eventEmitter.emit('webhook_subscription.deleted', {
      workspaceId,
      subscriptionId: id,
      url: existing.url,
      userId: actorUserId,
    });

    this.logger.log(`Deleted webhook subscription (${id}) from workspace '${workspaceId}'`);

    return { success: true };
  }

  /**
   * Lists delivery history for a webhook subscription in a workspace.
   */
  async listDeliveries(
    workspaceId: string,
    subscriptionId: string,
    query?: WebhookDeliveryListQueryDto,
  ): Promise<{
    items: WebhookDeliveryDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    // 1. Verify subscription belongs to workspace
    await this.getById(workspaceId, subscriptionId);

    const client = this.prisma.getClient();
    const page = query?.page ? Number(query.page) : 1;
    const limit = query?.limit ? Number(query.limit) : 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      subscriptionId,
    };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.eventType) {
      where.eventType = query.eventType;
    }

    const [total, records] = await Promise.all([
      client.webhookDelivery.count({ where }),
      client.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map(mapWebhookDeliveryToDto),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Gets a specific webhook delivery details log.
   */
  async getDeliveryById(
    workspaceId: string,
    subscriptionId: string,
    deliveryId: string,
  ): Promise<WebhookDeliveryDetailDto> {
    // Verify subscription belongs to workspace
    await this.getById(workspaceId, subscriptionId);

    const client = this.prisma.getClient();
    const delivery = await client.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        subscriptionId,
      },
    });

    if (!delivery) {
      throw new NotFoundException({
        code: 'WEBHOOK_DELIVERY_NOT_FOUND',
        message: `Webhook delivery '${deliveryId}' not found for subscription '${subscriptionId}'`,
      });
    }

    return mapWebhookDeliveryToDetailDto(delivery);
  }

  /**
   * Manually retries a webhook delivery by resetting its status and enqueuing a BullMQ delivery job.
   */
  async retryDelivery(
    workspaceId: string,
    subscriptionId: string,
    deliveryId: string,
  ): Promise<WebhookDeliveryDetailDto> {
    const subscription = await this.getById(workspaceId, subscriptionId);
    const client = this.prisma.getClient();

    const delivery = await client.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        subscriptionId,
      },
    });

    if (!delivery) {
      throw new NotFoundException({
        code: 'WEBHOOK_DELIVERY_NOT_FOUND',
        message: `Webhook delivery '${deliveryId}' not found for subscription '${subscriptionId}'`,
      });
    }

    // Reset status to PENDING and update nextRetryAt
    const updated = await client.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: WebhookDeliveryStatus.PENDING,
        nextRetryAt: null,
      },
    });

    if (this.deliveryQueue) {
      await this.deliveryQueue.add(
        'deliver-webhook',
        {
          deliveryId: updated.id,
          subscriptionId: subscription.id,
          workspaceId,
          url: subscription.url,
          secretKey: subscription.secretKey,
          eventType: updated.eventType,
          payload: updated.payload as any,
        },
        {
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
        `Manually re-enqueued webhook delivery '${deliveryId}' for subscription '${subscriptionId}'`,
      );
    }

    return mapWebhookDeliveryToDetailDto(updated);
  }
}
