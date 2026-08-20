import { z } from 'zod';
import { WebhookDeliveryStatus } from './enums';

export const createWebhookSubscriptionSchema = z.object({
  url: z.string().url(),
  subscriptions: z.array(z.string()).min(1),
  secret: z.string().optional(),
});
export type CreateWebhookSubscriptionDto = z.infer<typeof createWebhookSubscriptionSchema>;

export interface WebhookSubscriptionDto {
  id: string;
  workspaceId: string;
  url: string;
  subscriptions: string[];
  createdAt: string;
}

export interface WebhookDeliveryDto {
  id: string;
  subscriptionId: string;
  event: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatusCode?: number;
  createdAt: string;
}
