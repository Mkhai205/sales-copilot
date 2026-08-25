import { z } from 'zod';
import { WebhookDeliveryStatus, WebhookEventType } from './enums';

const baseCreateWebhookSubscriptionSchema = z
  .object({
    url: z
      .string()
      .trim()
      .url('Invalid URL format')
      .refine(val => val.startsWith('https://'), {
        message: 'Webhook URL must use HTTPS protocol',
      }),
    subscriptions: z
      .array(z.nativeEnum(WebhookEventType))
      .min(1, 'At least one event subscription is required')
      .optional(),
    events: z
      .array(z.nativeEnum(WebhookEventType))
      .min(1, 'At least one event subscription is required')
      .optional(),
    secret: z.string().trim().min(8, 'Secret must be at least 8 characters').max(256).optional(),
    secretKey: z.string().trim().min(8, 'Secret must be at least 8 characters').max(256).optional(),
    isActive: z.boolean().optional().default(true),
  })
  .refine(
    data =>
      (data.subscriptions && data.subscriptions.length > 0) ||
      (data.events && data.events.length > 0),
    {
      message: 'At least one event subscription is required in subscriptions or events',
      path: ['subscriptions'],
    },
  );

export const createWebhookSubscriptionSchema = baseCreateWebhookSubscriptionSchema.transform(
  data => {
    const rawSubs = data.subscriptions || data.events || [];
    const sec = data.secretKey || data.secret;
    return {
      url: data.url,
      subscriptions: Array.from(new Set(rawSubs)) as WebhookEventType[],
      ...(sec !== undefined && { secretKey: sec }),
      isActive: data.isActive ?? true,
    };
  },
);

export type CreateWebhookSubscriptionDto = z.input<typeof baseCreateWebhookSubscriptionSchema>;

const baseUpdateWebhookSubscriptionSchema = z.object({
  url: z
    .string()
    .trim()
    .url('Invalid URL format')
    .refine(val => val.startsWith('https://'), {
      message: 'Webhook URL must use HTTPS protocol',
    })
    .optional(),
  subscriptions: z
    .array(z.nativeEnum(WebhookEventType))
    .min(1, 'At least one event subscription is required')
    .optional(),
  events: z
    .array(z.nativeEnum(WebhookEventType))
    .min(1, 'At least one event subscription is required')
    .optional(),
  secret: z.string().trim().min(8, 'Secret must be at least 8 characters').max(256).optional(),
  secretKey: z.string().trim().min(8, 'Secret must be at least 8 characters').max(256).optional(),
  isActive: z.boolean().optional(),
});

export const updateWebhookSubscriptionSchema = baseUpdateWebhookSubscriptionSchema.transform(
  data => {
    const rawSubs = data.subscriptions || data.events;
    const sec = data.secretKey !== undefined ? data.secretKey : data.secret;
    return {
      ...(data.url !== undefined && { url: data.url }),
      ...(rawSubs !== undefined && {
        subscriptions: Array.from(new Set(rawSubs)) as WebhookEventType[],
      }),
      ...(sec !== undefined && { secretKey: sec }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    };
  },
);

export type UpdateWebhookSubscriptionDto = z.input<typeof baseUpdateWebhookSubscriptionSchema>;

export const webhookSubscriptionListQuerySchema = z.object({
  isActive: z
    .preprocess(val => {
      if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') return true;
        if (val.toLowerCase() === 'false') return false;
      }
      return val;
    }, z.boolean().optional())
    .optional(),
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  event: z.nativeEnum(WebhookEventType).optional(),
});

export type WebhookSubscriptionListQueryDto = z.input<typeof webhookSubscriptionListQuerySchema>;

export interface WebhookSubscriptionDto {
  id: string;
  workspaceId: string;
  url: string;
  subscriptions: WebhookEventType[] | string[];
  secretKey?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryDto {
  id: string;
  subscriptionId: string;
  eventId?: string;
  event: string;
  eventType?: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  attemptCount?: number;
  responseStatusCode?: number;
  responseStatus?: number | null;
  createdAt: string;
}

export interface WebhookDeliveryDetailDto {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown> | unknown;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  responseStatus?: number | null;
  responseBody?: string | null;
  lastAttemptAt?: string | null;
  nextRetryAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const webhookDeliveryListQuerySchema = z.object({
  status: z.nativeEnum(WebhookDeliveryStatus).optional(),
  eventType: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type WebhookDeliveryListQueryDto = z.input<typeof webhookDeliveryListQuerySchema>;
export type WebhookDeliveryListQueryOutput = z.output<typeof webhookDeliveryListQuerySchema>;
