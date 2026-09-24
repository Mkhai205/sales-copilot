'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  WsServerEvent,
  type OrderPaidEventPayload,
  type OrderPartiallyPaidEventPayload,
  type OrderConfirmedEventPayload,
  type OrderCancelledEventPayload,
  type OrderCompletedEventPayload,
  type OrderShippedEventPayload,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { useSocketEvent } from '@/lib/socket/use-socket';
import { commerceKeys, conversationKeys } from '@/lib/query-keys';

export interface UseCommerceRealtimeSyncOptions {
  workspaceId?: string;
  conversationId?: string;
}
export type UsePosRealtimeSyncOptions = UseCommerceRealtimeSyncOptions;

/**
 * Real-time synchronization hook for In-Chat Commerce & automated bank reconciliation.
 * Listens for WebSocket events (order.paid, order.partially_paid, order.confirmed, order.cancelled)
 * and invalidates relevant TanStack Query caches while dispatching celebratory Sonner notifications.
 */
export function useCommerceRealtimeSync({
  workspaceId,
  conversationId,
}: UseCommerceRealtimeSyncOptions): void {
  const queryClient = useQueryClient();

  const invalidateCommerceQueries = React.useCallback(
    (orderId?: string) => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: commerceKeys.orders(workspaceId) });
        queryClient.invalidateQueries({ queryKey: commerceKeys.activeOrder(workspaceId) });
        queryClient.invalidateQueries({ queryKey: commerceKeys.products(workspaceId) });
        queryClient.invalidateQueries({ queryKey: commerceKeys.inventoryVariants(workspaceId) });
        queryClient.invalidateQueries({ queryKey: commerceKeys.inventorySummary(workspaceId) });
        queryClient.invalidateQueries({
          queryKey: commerceKeys.inventoryTransactions(workspaceId),
        });
      }

      if (orderId && workspaceId) {
        queryClient.invalidateQueries({ queryKey: commerceKeys.order(workspaceId, orderId) });
      }

      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: workspaceId
            ? conversationKeys.messages(workspaceId, conversationId)
            : ['messages'],
        });
        queryClient.invalidateQueries({ queryKey: commerceKeys.activeOrder(workspaceId) });
      }
    },
    [queryClient, workspaceId, conversationId],
  );

  // 1. Order Paid (Reconciliation success)
  useSocketEvent<OrderPaidEventPayload>(WsServerEvent.ORDER_PAID, data => {
    if (!data) return;

    // Invalidate caches immediately
    invalidateCommerceQueries(data.orderId);

    // Filter toast to current context or current workspace
    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || !data.conversationId || data.conversationId === conversationId)
    ) {
      const orderRef = data.displayId ? `#${data.displayId}` : data.orderNumber || '';
      const method = data.paymentMethod || 'VietQR';
      toast.success(`Đơn hàng ${orderRef} đã thanh toán thành công qua ${method}!`, {
        description: data.paidAmount
          ? `Số tiền: ${new Intl.NumberFormat('vi-VN').format(data.paidAmount)}đ`
          : undefined,
      });
    }
  });

  // 2. Order Partially Paid
  useSocketEvent<OrderPartiallyPaidEventPayload>(WsServerEvent.ORDER_PARTIALLY_PAID, data => {
    if (!data) return;

    invalidateCommerceQueries(data.orderId);

    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || !data.conversationId || data.conversationId === conversationId)
    ) {
      const orderRef = data.displayId ? `#${data.displayId}` : data.orderNumber || '';
      toast.info(`Đơn hàng ${orderRef} đã nhận đặt cọc / thanh toán một phần`, {
        description: data.paidAmount
          ? `Đã nhận: ${new Intl.NumberFormat('vi-VN').format(data.paidAmount)}đ / Còn lại: ${new Intl.NumberFormat(
              'vi-VN',
            ).format(data.remainingAmount)}đ`
          : undefined,
      });
    }
  });

  // 3. Order Confirmed (Stock reserved)
  useSocketEvent<OrderConfirmedEventPayload>(WsServerEvent.ORDER_CONFIRMED, data => {
    if (!data) return;
    invalidateCommerceQueries(data.orderId);
  });

  // 4. Order Cancelled (Stock released)
  useSocketEvent<OrderCancelledEventPayload>(WsServerEvent.ORDER_CANCELLED, data => {
    if (!data) return;
    invalidateCommerceQueries(data.orderId);
  });

  // 5. Order Shipped (Dispatched to carrier)
  useSocketEvent<OrderShippedEventPayload>(WsServerEvent.ORDER_SHIPPED, data => {
    if (!data) return;
    invalidateCommerceQueries(data.orderId);

    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || !data.conversationId || data.conversationId === conversationId)
    ) {
      const orderRef = data.displayId ? `#${data.displayId}` : data.orderNumber;
      toast.success(`Đơn hàng ${orderRef} đã xuất kho giao cho ${data.shippingCarrier}!`, {
        description: `Mã vận đơn: ${data.trackingCode}`,
      });
    }
  });

  // 6. Order Completed
  useSocketEvent<OrderCompletedEventPayload>(WsServerEvent.ORDER_COMPLETED, data => {
    if (!data) return;
    invalidateCommerceQueries(data.orderId);

    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || !data.conversationId || data.conversationId === conversationId)
    ) {
      const orderRef = data.displayId ? `#${data.displayId}` : data.orderNumber;
      toast.success(`Đã hoàn tất đơn hàng #${orderRef}`);
    }
  });
}

export const usePosRealtimeSync = useCommerceRealtimeSync;
