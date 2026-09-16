import type { WebhookSubscriptionDto } from '@sales-copilot/shared-contracts';

/**
 * Maps a Prisma WebhookSubscription entity to a clean API response DTO.
 */
export function mapWebhookSubscriptionToDto(subscription: {
  id: string;
  workspaceId: string;
  url: string;
  secretKey?: string | null;
  subscriptions: unknown;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}): WebhookSubscriptionDto {
  let subscriptionsList: string[] = [];

  if (Array.isArray(subscription.subscriptions)) {
    subscriptionsList = subscription.subscriptions as string[];
  } else if (typeof subscription.subscriptions === 'string') {
    try {
      const parsed = JSON.parse(subscription.subscriptions);
      if (Array.isArray(parsed)) {
        subscriptionsList = parsed;
      }
    } catch {
      subscriptionsList = [];
    }
  }

  return {
    id: subscription.id,
    workspaceId: subscription.workspaceId,
    url: subscription.url,
    subscriptions: subscriptionsList,
    secretKey: subscription.secretKey ?? null,
    isActive: subscription.isActive,
    createdAt:
      subscription.createdAt instanceof Date
        ? subscription.createdAt.toISOString()
        : String(subscription.createdAt),
    updatedAt:
      subscription.updatedAt instanceof Date
        ? subscription.updatedAt.toISOString()
        : String(subscription.updatedAt),
  };
}

/**
 * Maps a Prisma WebhookDelivery entity to a WebhookDeliveryDto.
 */
export function mapWebhookDeliveryToDto(delivery: {
  id: string;
  subscriptionId: string;
  eventId?: string;
  eventType: string;
  status: any;
  attemptCount: number;
  responseStatus?: number | null;
  createdAt: Date | string;
}): any {
  return {
    id: delivery.id,
    subscriptionId: delivery.subscriptionId,
    eventId: delivery.eventId,
    event: delivery.eventType,
    eventType: delivery.eventType,
    status: delivery.status,
    attempts: delivery.attemptCount,
    attemptCount: delivery.attemptCount,
    responseStatusCode: delivery.responseStatus ?? undefined,
    responseStatus: delivery.responseStatus ?? null,
    createdAt:
      delivery.createdAt instanceof Date
        ? delivery.createdAt.toISOString()
        : String(delivery.createdAt),
  };
}

/**
 * Maps a Prisma WebhookDelivery entity to a full WebhookDeliveryDetailDto.
 */
export function mapWebhookDeliveryToDetailDto(delivery: {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: any;
  status: any;
  attemptCount: number;
  responseStatus?: number | null;
  responseBody?: string | null;
  lastAttemptAt?: Date | null;
  nextRetryAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): any {
  return {
    id: delivery.id,
    subscriptionId: delivery.subscriptionId,
    eventId: delivery.eventId,
    eventType: delivery.eventType,
    payload: delivery.payload,
    status: delivery.status,
    attemptCount: delivery.attemptCount,
    responseStatus: delivery.responseStatus ?? null,
    responseBody: delivery.responseBody ?? null,
    lastAttemptAt:
      delivery.lastAttemptAt instanceof Date
        ? delivery.lastAttemptAt.toISOString()
        : delivery.lastAttemptAt
          ? String(delivery.lastAttemptAt)
          : null,
    nextRetryAt:
      delivery.nextRetryAt instanceof Date
        ? delivery.nextRetryAt.toISOString()
        : delivery.nextRetryAt
          ? String(delivery.nextRetryAt)
          : null,
    deliveredAt:
      delivery.deliveredAt instanceof Date
        ? delivery.deliveredAt.toISOString()
        : delivery.deliveredAt
          ? String(delivery.deliveredAt)
          : null,
    createdAt:
      delivery.createdAt instanceof Date
        ? delivery.createdAt.toISOString()
        : String(delivery.createdAt),
    updatedAt:
      delivery.updatedAt instanceof Date
        ? delivery.updatedAt.toISOString()
        : String(delivery.updatedAt),
  };
}
