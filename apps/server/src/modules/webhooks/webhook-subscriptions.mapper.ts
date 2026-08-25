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
