'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CancelOrderDto,
  CompleteOrderDto,
  CreateOrderDto,
  ListOrdersQueryDto,
  ManualPayOrderDto,
  UpdateOrderDto,
} from '@sales-copilot/shared-contracts';
import { commerceApi } from '../api/commerce-client';
import { commerceKeys } from '@/lib/query-keys';

export function useCommerceOrders(workspaceId?: string) {
  const queryClient = useQueryClient();

  const invalidateOrderQueries = (orderId?: string) => {
    queryClient.invalidateQueries({ queryKey: commerceKeys.orders(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.activeOrder(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.products(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.inventoryVariants(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.inventorySummary(workspaceId) });
    queryClient.invalidateQueries({ queryKey: commerceKeys.inventoryTransactions(workspaceId) });
    if (orderId) {
      queryClient.invalidateQueries({ queryKey: commerceKeys.order(workspaceId, orderId) });
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (dto: CreateOrderDto) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.createOrder(workspaceId, dto);

      return res.data;
    },
    onSuccess: data => {
      toast.success(`Đã tạo đơn hàng #${data.displayId || data.orderNumber}`);
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error('Lỗi khi tạo đơn hàng', {
        description: err?.error?.message || err?.message || 'Vui lòng thử lại',
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
      toast.success(`Đã cập nhật đơn hàng #${data.displayId || data.orderNumber}`);
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error('Lỗi khi cập nhật đơn hàng', {
        description: err?.error?.message || err?.message || 'Vui lòng thử lại',
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
      toast.success(`Đã xác nhận đơn hàng #${data.displayId}`);
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error('Lỗi khi xác nhận đơn hàng', {
        description: err?.error?.message || err?.message || 'Vui lòng thử lại',
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
      toast.success(`Đã ghi nhận thanh toán cho đơn #${data.displayId}`);
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error('Lỗi khi thanh toán đơn hàng', {
        description: err?.error?.message || err?.message || 'Vui lòng thử lại',
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
      toast.success(`Đã hủy đơn hàng #${data.displayId}`);
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error('Lỗi khi hủy đơn hàng', {
        description: err?.error?.message || err?.message || 'Vui lòng thử lại',
      });
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async ({ orderId, dto }: { orderId: string; dto?: CompleteOrderDto }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.completeOrder(workspaceId, orderId, dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(`Đã hoàn tất đơn hàng #${data.displayId}`);
      invalidateOrderQueries(data.id);
    },
    onError: (err: any) => {
      toast.error('Lỗi khi hoàn tất đơn hàng', {
        description: err?.error?.message || err?.message || 'Vui lòng thử lại',
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

    completeOrder: completeOrderMutation.mutateAsync,
    isCompleting: completeOrderMutation.isPending,
  };
}

export const usePosOrders = useCommerceOrders;

export function useCommerceOrdersList(workspaceId?: string, query?: ListOrdersQueryDto) {
  return useQuery({
    queryKey: commerceKeys.orders(workspaceId, query),
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await commerceApi.listOrders(workspaceId, query);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 30 * 1000,
  });
}

export function useCommerceOrder(workspaceId?: string, orderId?: string) {
  return useQuery({
    queryKey: commerceKeys.order(workspaceId, orderId),
    queryFn: async () => {
      if (!workspaceId || !orderId) throw new Error('Workspace ID and Order ID are required');
      const res = await commerceApi.getOrder(workspaceId, orderId);
      return res.data;
    },
    enabled: Boolean(workspaceId && orderId),
    staleTime: 30 * 1000,
  });
}
