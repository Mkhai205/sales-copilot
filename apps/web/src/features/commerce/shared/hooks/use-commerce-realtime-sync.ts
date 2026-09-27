'use client';

import {
  WsServerEvent,
  type OrderPaidEventPayload,
  type OrderPartiallyPaidEventPayload,
  type OrderCompletedEventPayload,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { useSocketEvent } from '@/lib/socket/use-socket';

export interface UseCommerceRealtimeSyncOptions {
  workspaceId?: string;
  conversationId?: string;
}

/**
 * Real-time notification hook for In-Chat Commerce & automated bank reconciliation.
 * Listens for WebSocket events (order.paid, order.partially_paid, order.completed)
 * and dispatches celebratory Sonner notifications according to the active workspace/conversation context.
 * Cache invalidation is handled globally by useRealtimeSync.
 */
export function useCommerceRealtimeSync({
  workspaceId,
  conversationId,
}: UseCommerceRealtimeSyncOptions): void {
  // 1. Order Paid (Reconciliation success)
  useSocketEvent<OrderPaidEventPayload>(WsServerEvent.ORDER_PAID, data => {
    if (!data) return;

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

  // 3. Order Completed
  useSocketEvent<OrderCompletedEventPayload>(WsServerEvent.ORDER_COMPLETED, data => {
    if (!data) return;

    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || !data.conversationId || data.conversationId === conversationId)
    ) {
      const orderRef = data.displayId ? `#${data.displayId}` : data.orderNumber;
      toast.success(`Đã hoàn tất đơn hàng ${orderRef}`);
    }
  });
}
