'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  WsServerEvent,
  type OrderPaidEventPayload,
  type OrderPartiallyPaidEventPayload,
  type OrderConfirmedEventPayload,
  type OrderCancelledEventPayload,
  type OrderShippedEventPayload,
  type PosDraftSuggestedEventPayload,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { useSocketEvent } from '@/lib/socket/use-socket';

interface UsePosRealtimeSyncOptions {
  workspaceId?: string;
  conversationId?: string;
  onDraftSuggested?: (payload: PosDraftSuggestedEventPayload) => void;
}

/**
 * Real-time synchronization hook for In-Chat POS & automated bank reconciliation.
 * Listens for WebSocket events (order.paid, order.partially_paid, order.confirmed, order.cancelled)
 * and invalidates relevant TanStack Query caches while dispatching celebratory Sonner notifications.
 */
export function usePosRealtimeSync({
  workspaceId,
  conversationId,
  onDraftSuggested,
}: UsePosRealtimeSyncOptions): void {
  const queryClient = useQueryClient();

  const invalidatePosQueries = React.useCallback(
    (orderId?: string) => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['pos-orders', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['active-conversation-order', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['pos-products', workspaceId] });
      }

      if (orderId && workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['pos-order', workspaceId, orderId] });
      }

      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['active-order', conversationId] });
      }
    },
    [queryClient, workspaceId, conversationId],
  );

  // 1. Order Paid (Reconciliation success)
  useSocketEvent<OrderPaidEventPayload>(WsServerEvent.ORDER_PAID, data => {
    if (!data) return;

    // Invalidate caches immediately
    invalidatePosQueries(data.orderId);

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

    invalidatePosQueries(data.orderId);

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
    invalidatePosQueries(data.orderId);
  });

  // 4. Order Cancelled (Stock released)
  useSocketEvent<OrderCancelledEventPayload>(WsServerEvent.ORDER_CANCELLED, data => {
    if (!data) return;
    invalidatePosQueries(data.orderId);
  });

  // 5. Order Shipped (Dispatched to carrier)
  useSocketEvent<OrderShippedEventPayload>(WsServerEvent.ORDER_SHIPPED, data => {
    if (!data) return;
    invalidatePosQueries(data.orderId);

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

  // 6. POS Draft Suggested (AI In-Chat Order Extractor)
  useSocketEvent<PosDraftSuggestedEventPayload>(WsServerEvent.POS_DRAFT_SUGGESTED, data => {
    if (!data) return;

    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || data.conversationId === conversationId)
    ) {
      if (onDraftSuggested) {
        onDraftSuggested(data);
      }
      toast.info(`✨ AI phát hiện đơn hàng (${data.confidenceScore}% tin cậy)`, {
        description: `${data.suggestedCustomer?.recipientName || 'Khách hàng'} - ${data.suggestedCustomer?.phoneNumber || ''}`,
      });
    }
  });
}
