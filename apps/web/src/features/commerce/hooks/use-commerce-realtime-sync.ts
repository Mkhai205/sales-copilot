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
  type CommerceDraftSuggestedEventPayload,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { useSocketEvent } from '@/lib/socket/use-socket';
import { useI18n } from '@/lib/i18n';

export interface UseCommerceRealtimeSyncOptions {
  workspaceId?: string;
  conversationId?: string;
  onDraftSuggested?: (payload: CommerceDraftSuggestedEventPayload) => void;
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
  onDraftSuggested,
}: UseCommerceRealtimeSyncOptions): void {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const invalidateCommerceQueries = React.useCallback(
    (orderId?: string) => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['commerce-orders', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['commerce-orders', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['active-conversation-order', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['commerce-products', workspaceId] });
        queryClient.invalidateQueries({ queryKey: ['commerce-products', workspaceId] });
      }

      if (orderId && workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['commerce-order', workspaceId, orderId] });
        queryClient.invalidateQueries({ queryKey: ['commerce-order', workspaceId, orderId] });
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
    invalidateCommerceQueries(data.orderId);

    // Filter toast to current context or current workspace
    if (
      (!workspaceId || data.workspaceId === workspaceId) &&
      (!conversationId || !data.conversationId || data.conversationId === conversationId)
    ) {
      const orderRef = data.displayId ? `#${data.displayId}` : data.orderNumber || '';
      const method = data.paymentMethod || 'VietQR';
      toast.success(t('commerce.toasts.orderPaidSuccess', { ref: orderRef, method }), {
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
      toast.info(t('commerce.toasts.orderPartiallyPaid', { ref: orderRef }), {
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
      toast.success(
        t('commerce.toasts.orderShipped', { ref: orderRef, carrier: data.shippingCarrier }),
        {
          description: `Mã vận đơn: ${data.trackingCode}`,
        },
      );
    }
  });

  // 6. Commerce Draft Suggested (AI In-Chat Order Extractor)
  useSocketEvent<CommerceDraftSuggestedEventPayload>(
    WsServerEvent.COMMERCE_DRAFT_SUGGESTED,
    data => {
      if (!data) return;

      if (
        (!workspaceId || data.workspaceId === workspaceId) &&
        (!conversationId || data.conversationId === conversationId)
      ) {
        if (onDraftSuggested) {
          onDraftSuggested(data);
        }
        toast.info(t('commerce.toasts.aiDraftDetected', { confidence: data.confidenceScore }), {
          description: `${data.suggestedCustomer?.recipientName || 'Khách hàng'} - ${data.suggestedCustomer?.phoneNumber || ''}`,
        });
      }
    },
  );
}

export const usePosRealtimeSync = useCommerceRealtimeSync;
