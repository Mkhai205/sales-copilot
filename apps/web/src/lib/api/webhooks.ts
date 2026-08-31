import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookDeliveryDetailDto,
  WebhookDeliveryDto,
  WebhookDeliveryListQueryDto,
  WebhookSubscriptionDto,
  WebhookSubscriptionListQueryDto,
} from '@sales-copilot/shared-contracts';

export const webhooksApi = {
  listSubscriptions: (workspaceId: string, query?: WebhookSubscriptionListQueryDto) =>
    fetchApi<WebhookSubscriptionDto[]>(`/webhook-subscriptions${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getSubscription: (workspaceId: string, id: string) =>
    fetchApi<WebhookSubscriptionDto>(`/webhook-subscriptions/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  createSubscription: (workspaceId: string, dto: CreateWebhookSubscriptionDto) =>
    fetchApi<WebhookSubscriptionDto>('/webhook-subscriptions', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateSubscription: (workspaceId: string, id: string, dto: UpdateWebhookSubscriptionDto) =>
    fetchApi<WebhookSubscriptionDto>(`/webhook-subscriptions/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  deleteSubscription: (workspaceId: string, id: string) =>
    fetchApi<{ success: true }>(`/webhook-subscriptions/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),

  listDeliveries: (
    workspaceId: string,
    subscriptionId: string,
    query?: WebhookDeliveryListQueryDto,
  ) =>
    fetchApi<{
      items: WebhookDeliveryDto[];
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(`/webhook-subscriptions/${subscriptionId}/deliveries${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getDeliveryDetail: (workspaceId: string, subscriptionId: string, deliveryId: string) =>
    fetchApi<WebhookDeliveryDetailDto>(
      `/webhook-subscriptions/${subscriptionId}/deliveries/${deliveryId}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  retryDelivery: (workspaceId: string, subscriptionId: string, deliveryId: string) =>
    fetchApi<WebhookDeliveryDetailDto>(
      `/webhook-subscriptions/${subscriptionId}/deliveries/${deliveryId}/retry`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
      },
    ),
};
