'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookDeliveryDetailDto,
  WebhookDeliveryDto,
  WebhookDeliveryListQueryDto,
  WebhookSubscriptionDto,
  WebhookSubscriptionListQueryDto,
} from '@sales-copilot/shared-contracts';
import { webhooksApi } from '@/lib/api/webhooks';

export function useWebhookSubscriptions(
  workspaceId?: string,
  query?: WebhookSubscriptionListQueryDto,
) {
  return useQuery<WebhookSubscriptionDto[]>({
    queryKey: ['workspaces', workspaceId, 'webhook-subscriptions', query],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await webhooksApi.listSubscriptions(workspaceId, query);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useWebhookSubscription(workspaceId?: string, subscriptionId?: string) {
  return useQuery<WebhookSubscriptionDto>({
    queryKey: ['workspaces', workspaceId, 'webhook-subscriptions', subscriptionId],
    queryFn: async () => {
      if (!workspaceId || !subscriptionId) {
        throw new Error('Workspace ID and Subscription ID are required');
      }
      const res = await webhooksApi.getSubscription(workspaceId, subscriptionId);
      return res.data;
    },
    enabled: !!workspaceId && !!subscriptionId,
    staleTime: 30 * 1000,
  });
}

export function useCreateWebhookSubscription(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateWebhookSubscriptionDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await webhooksApi.createSubscription(workspaceId, dto);
      return res.data;
    },
    onSuccess: newSub => {
      queryClient.setQueriesData<WebhookSubscriptionDto[]>(
        { queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'] },
        old => {
          if (!old) return [newSub];
          if (old.some(s => s.id === newSub.id)) return old;
          return [...old, newSub];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'],
      });
      toast.success('Webhook subscription created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create webhook subscription');
    },
  });
}

export function useUpdateWebhookSubscription(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      dto,
    }: {
      subscriptionId: string;
      dto: UpdateWebhookSubscriptionDto;
    }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await webhooksApi.updateSubscription(workspaceId, subscriptionId, dto);
      return res.data;
    },
    onSuccess: updatedSub => {
      queryClient.setQueriesData<WebhookSubscriptionDto[]>(
        { queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'] },
        old => {
          if (!old) return [updatedSub];
          return old.map(s => (s.id === updatedSub.id ? updatedSub : s));
        },
      );
      queryClient.setQueryData(
        ['workspaces', workspaceId, 'webhook-subscriptions', updatedSub.id],
        updatedSub,
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'],
      });
      toast.success('Webhook subscription updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update webhook subscription');
    },
  });
}

export function useToggleWebhookSubscriptionActive(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subscriptionId,
      isActive,
    }: {
      subscriptionId: string;
      isActive: boolean;
    }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await webhooksApi.updateSubscription(workspaceId, subscriptionId, { isActive });
      return res.data;
    },
    onMutate: async ({ subscriptionId, isActive }) => {
      await queryClient.cancelQueries({
        queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'],
      });

      const previousSubs = queryClient.getQueryData<WebhookSubscriptionDto[]>([
        'workspaces',
        workspaceId,
        'webhook-subscriptions',
      ]);

      queryClient.setQueriesData<WebhookSubscriptionDto[]>(
        { queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'] },
        old => {
          if (!old) return old;
          return old.map(s => (s.id === subscriptionId ? { ...s, isActive } : s));
        },
      );

      return { previousSubs };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousSubs) {
        queryClient.setQueryData(
          ['workspaces', workspaceId, 'webhook-subscriptions'],
          context.previousSubs,
        );
      }
      toast.error(error.message || 'Failed to toggle webhook active state');
    },
    onSuccess: sub => {
      toast.success(`Webhook endpoint is now ${sub.isActive ? 'active' : 'paused'}`);
    },
  });
}

export function useDeleteWebhookSubscription(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await webhooksApi.deleteSubscription(workspaceId, subscriptionId);
      return { subscriptionId, success: res.success };
    },
    onSuccess: ({ subscriptionId }) => {
      queryClient.setQueriesData<WebhookSubscriptionDto[]>(
        { queryKey: ['workspaces', workspaceId, 'webhook-subscriptions'] },
        old => {
          if (!old) return old;
          return old.filter(s => s.id !== subscriptionId);
        },
      );
      toast.success('Webhook subscription deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete webhook subscription');
    },
  });
}

export function useWebhookDeliveries(
  workspaceId?: string,
  subscriptionId?: string,
  query?: WebhookDeliveryListQueryDto,
) {
  return useQuery<{
    items: WebhookDeliveryDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: [
      'workspaces',
      workspaceId,
      'webhook-subscriptions',
      subscriptionId,
      'deliveries',
      query,
    ],
    queryFn: async () => {
      if (!workspaceId || !subscriptionId) {
        throw new Error('Workspace ID and Subscription ID are required');
      }
      const res = await webhooksApi.listDeliveries(workspaceId, subscriptionId, query);
      return res.data;
    },
    enabled: !!workspaceId && !!subscriptionId,
    staleTime: 10 * 1000,
  });
}

export function useWebhookDeliveryDetail(
  workspaceId?: string,
  subscriptionId?: string,
  deliveryId?: string,
) {
  return useQuery<WebhookDeliveryDetailDto>({
    queryKey: [
      'workspaces',
      workspaceId,
      'webhook-subscriptions',
      subscriptionId,
      'deliveries',
      deliveryId,
    ],
    queryFn: async () => {
      if (!workspaceId || !subscriptionId || !deliveryId) {
        throw new Error('Workspace ID, Subscription ID, and Delivery ID are required');
      }
      const res = await webhooksApi.getDeliveryDetail(workspaceId, subscriptionId, deliveryId);
      return res.data;
    },
    enabled: !!workspaceId && !!subscriptionId && !!deliveryId,
    staleTime: 10 * 1000,
  });
}

export function useRetryWebhookDelivery(workspaceId?: string, subscriptionId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliveryId: string) => {
      if (!workspaceId || !subscriptionId) {
        throw new Error('Workspace ID and Subscription ID are required');
      }
      const res = await webhooksApi.retryDelivery(workspaceId, subscriptionId, deliveryId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          'workspaces',
          workspaceId,
          'webhook-subscriptions',
          subscriptionId,
          'deliveries',
        ],
      });
      toast.success('Webhook delivery re-enqueued for delivery');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to retry webhook delivery');
    },
  });
}
