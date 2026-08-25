import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookSubscriptionDto,
  WebhookSubscriptionListQueryDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { generateWebhookSecret } from './webhook-signer';
import { mapWebhookSubscriptionToDto } from './webhook-subscriptions.mapper';

@Injectable()
export class WebhookSubscriptionsService {
  private readonly logger = new Logger(WebhookSubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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
}
