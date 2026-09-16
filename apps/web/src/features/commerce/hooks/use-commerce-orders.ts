'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CancelOrderDto,
  CreateOrderDto,
  ManualPayOrderDto,
  UpdateOrderDto,
} from '@sales-copilot/shared-contracts';
import { commerceApi } from '../api/commerce-client';
import { useI18n } from '@/lib/i18n';

export function useCommerceOrders(workspaceId?: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const invalidateOrderQueries = (orderId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['commerce-orders', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['commerce-orders', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['active-conversation-order', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['commerce-products', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['commerce-products', workspaceId] });
    if (orderId) {
      queryClient.invalidateQueries({ queryKey: ['commerce-order', workspaceId, orderId] });
      queryClient.invalidateQueries({ queryKey: ['commerce-order', workspaceId, orderId] });
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (dto: CreateOrderDto) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.createOrder(workspaceId, dto);

      return res.data;
    },
    onSuccess: data => {
      toast.success(
        t('commerce.toasts.orderCreatedSuccess', { ref: data.displayId || data.orderNumber }),
      );
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('commerce.toasts.orderCreatedError'), {
        description: err?.error?.message || err?.message || t('commerce.toasts.pleaseRetry'),
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: UpdateOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.updateOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(
        t('commerce.toasts.orderUpdatedSuccess', { ref: data.displayId || data.orderNumber }),
      );
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('commerce.toasts.orderUpdatedError'), {
        description: err?.error?.message || err?.message || t('commerce.toasts.pleaseRetry'),
      });
    },
  });

  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.confirmOrder(workspaceId, orderId);
      return res.data;
    },
    onSuccess: data => {
      toast.success(t('commerce.toasts.orderConfirmedSuccess', { ref: data.displayId }));
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('commerce.toasts.orderConfirmedError'), {
        description: err?.error?.message || err?.message || t('commerce.toasts.pleaseRetry'),
      });
    },
  });

  const payOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: ManualPayOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.payOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(t('commerce.toasts.paymentRecordedSuccess', { ref: data.displayId }));
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('commerce.toasts.paymentRecordedError'), {
        description: err?.error?.message || err?.message || t('commerce.toasts.pleaseRetry'),
      });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: CancelOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.cancelOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(t('commerce.toasts.orderCancelledSuccess', { ref: data.displayId }));
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('commerce.toasts.orderCancelledError'), {
        description: err?.error?.message || err?.message || t('commerce.toasts.pleaseRetry'),
      });
    },
  });

  return {
    createOrder: createOrderMutation.mutateAsync,
    isCreating: createOrderMutation.isPending,

    updateOrder: updateOrderMutation.mutateAsync,
    isUpdating: updateOrderMutation.isPending,

    confirmOrder: confirmOrderMutation.mutateAsync,
    isConfirming: confirmOrderMutation.isPending,

    payOrder: payOrderMutation.mutateAsync,
    isPaying: payOrderMutation.isPending,

    cancelOrder: cancelOrderMutation.mutateAsync,
    isCancelling: cancelOrderMutation.isPending,
  };
}

export const usePosOrders = useCommerceOrders;
