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

export function usePosOrders(workspaceId?: string) {
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
      const res = await posApi.updateOrder(workspaceId, orderId, dto);
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
      const res = await posApi.confirmOrder(workspaceId, orderId);
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
      const res = await posApi.payOrder(workspaceId, orderId, dto);
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
      const res = await posApi.cancelOrder(workspaceId, orderId, dto);
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
