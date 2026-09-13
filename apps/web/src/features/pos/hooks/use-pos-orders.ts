'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CancelOrderDto,
  CreateOrderDto,
  ManualPayOrderDto,
  UpdateOrderDto,
} from '@sales-copilot/shared-contracts';
import { posApi } from '../api/pos-client';
import { useI18n } from '@/lib/i18n';

export function usePosOrders(workspaceId?: string) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const invalidateOrderQueries = (orderId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['pos-orders', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['active-conversation-order', workspaceId] });
    queryClient.invalidateQueries({ queryKey: ['pos-products', workspaceId] });
    if (orderId) {
      queryClient.invalidateQueries({ queryKey: ['pos-order', workspaceId, orderId] });
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (dto: CreateOrderDto) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await posApi.createOrder(workspaceId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(
        t('pos.toasts.orderCreatedSuccess', { ref: data.displayId || data.orderNumber }),
      );
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('pos.toasts.orderCreatedError'), {
        description: err?.error?.message || err?.message || t('pos.toasts.pleaseRetry'),
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: UpdateOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await posApi.updateOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(
        t('pos.toasts.orderUpdatedSuccess', { ref: data.displayId || data.orderNumber }),
      );
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('pos.toasts.orderUpdatedError'), {
        description: err?.error?.message || err?.message || t('pos.toasts.pleaseRetry'),
      });
    },
  });

  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await posApi.confirmOrder(workspaceId, orderId);
      return res.data;
    },
    onSuccess: data => {
      toast.success(t('pos.toasts.orderConfirmedSuccess', { ref: data.displayId }));
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('pos.toasts.orderConfirmedError'), {
        description: err?.error?.message || err?.message || t('pos.toasts.pleaseRetry'),
      });
    },
  });

  const payOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: ManualPayOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await posApi.payOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(t('pos.toasts.paymentRecordedSuccess', { ref: data.displayId }));
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('pos.toasts.paymentRecordedError'), {
        description: err?.error?.message || err?.message || t('pos.toasts.pleaseRetry'),
      });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto: CancelOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await posApi.cancelOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(t('pos.toasts.orderCancelledSuccess', { ref: data.displayId }));
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error(t('pos.toasts.orderCancelledError'), {
        description: err?.error?.message || err?.message || t('pos.toasts.pleaseRetry'),
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
