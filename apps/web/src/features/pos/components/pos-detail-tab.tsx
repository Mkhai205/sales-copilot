'use client';

import * as React from 'react';
import { OrderStatus, PaymentMethod, type OrderResponseDto } from '@sales-copilot/shared-contracts';
import {
  ShoppingBag,
  Plus,
  CheckCircle,
  CreditCard,
  XCircle,
  Edit,
  MapPin,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';
import { CarrierBadge } from './carrier-badge';
import { OrderHistoryList } from './order-history-list';
import { useActiveConversationOrder } from '../hooks/use-active-conversation-order';
import { usePosOrders } from '../hooks/use-pos-orders';

interface PosDetailTabProps {
  workspaceId: string;
  conversationId?: string;
  contactId?: string;
  onOpenDrawer: (orderToEdit?: OrderResponseDto | null) => void;
}

export function PosDetailTab({
  workspaceId,
  conversationId,
  contactId,
  onOpenDrawer,
}: PosDetailTabProps) {
  const { activeOrder, orders, isLoading } = useActiveConversationOrder({
    workspaceId,
    conversationId,
    contactId,
  });

  const { confirmOrder, payOrder, cancelOrder, isConfirming, isPaying, isCancelling } =
    usePosOrders(workspaceId);

  const formatCurrency = (val: number | string) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(Number(val));
  };

  const handleConfirm = async () => {
    if (!activeOrder) return;
    await confirmOrder(activeOrder.id);
  };

  const handlePay = async () => {
    if (!activeOrder) return;
    const remaining = Math.max(0, Number(activeOrder.totalAmount) - Number(activeOrder.paidAmount));
    await payOrder({
      orderId: activeOrder.id,
      dto: {
        paymentMethod: PaymentMethod.CASH,
        amount: remaining || Number(activeOrder.totalAmount),
        notes: 'Thanh toán trực tiếp',
      },
    });
  };

  const handleCancel = async () => {
    if (!activeOrder) return;
    const reason = window.prompt('Nhập lý do hủy đơn hàng:');
    if (!reason || reason.trim().length < 3) return;
    await cancelOrder({
      orderId: activeOrder.id,
      dto: { cancelReason: reason.trim() },
    });
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        Đang tải thông tin đơn hàng...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Active Order Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <ShoppingBag className="size-3.5 text-primary" />
            Đơn hàng hiện tại
          </h4>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[11px] gap-1 font-medium text-primary"
            onClick={() => onOpenDrawer(null)}
          >
            <Plus className="size-3" />
            Tạo đơn mới (F4)
          </Button>
        </div>

        {activeOrder ? (
          <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3 text-xs shadow-2xs">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                #{activeOrder.displayId}
                <span className="text-xs text-muted-foreground font-mono font-normal">
                  ({activeOrder.orderNumber})
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <OrderStatusBadge status={activeOrder.status} />
                <PaymentStatusBadge status={activeOrder.paymentStatus} />
              </div>
            </div>

            {/* Line items list */}
            <div className="flex flex-col gap-1 rounded bg-muted/40 p-2 text-[11px]">
              {(activeOrder.items || []).map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="truncate max-w-[180px] text-foreground">
                    {item.quantity}x {item.productName} ({item.variantName})
                  </span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* Shipping details */}
            {activeOrder.shippingAddress && (
              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {activeOrder.shippingAddress.recipientName}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono">{activeOrder.shippingAddress.phoneNumber}</span>
                    <CarrierBadge phone={activeOrder.shippingAddress.phoneNumber} />
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <MapPin className="size-3 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="line-clamp-2">
                    {activeOrder.shippingAddress.streetAddress}, {activeOrder.shippingAddress.ward},{' '}
                    {activeOrder.shippingAddress.district}, {activeOrder.shippingAddress.province}
                  </span>
                </div>
              </div>
            )}

            {/* Financials */}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-muted-foreground">Tổng thanh toán:</span>
              <span className="font-bold text-sm text-primary">
                {formatCurrency(activeOrder.totalAmount)}
              </span>
            </div>

            {/* Action Buttons based on status */}
            <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/60">
              {activeOrder.status === OrderStatus.DRAFT && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive px-2"
                    onClick={handleCancel}
                    disabled={isCancelling}
                  >
                    <XCircle className="size-3.5 mr-1" />
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() => onOpenDrawer(activeOrder)}
                  >
                    <Edit className="size-3.5" />
                    Sửa đơn (F4)
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-2.5 gap-1 font-semibold"
                    onClick={handleConfirm}
                    disabled={isConfirming}
                  >
                    <CheckCircle className="size-3.5" />
                    Xác nhận
                  </Button>
                </>
              )}

              {activeOrder.status === OrderStatus.CONFIRMED && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive px-2"
                    onClick={handleCancel}
                    disabled={isCancelling}
                  >
                    <XCircle className="size-3.5 mr-1" />
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 text-xs px-2.5 gap-1 font-semibold"
                    onClick={handlePay}
                    disabled={isPaying}
                  >
                    <CreditCard className="size-3.5" />
                    Thanh toán
                  </Button>
                </>
              )}

              {activeOrder.status === OrderStatus.PAID && (
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle className="size-3.5" />
                  Đã hoàn tất thanh toán
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 rounded-lg border border-dashed border-border/80 bg-muted/20 text-center">
            <Package className="size-7 text-muted-foreground/60 mb-1.5" />
            <p className="text-xs font-medium text-foreground">Chưa có đơn hàng cho hội thoại</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">
              Tạo đơn hàng nhanh để giữ kho và gửi xác nhận cho khách
            </p>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1 font-medium"
              onClick={() => onOpenDrawer(null)}
            >
              <Plus className="size-3.5" />
              Tạo đơn ngay (F4)
            </Button>
          </div>
        )}
      </div>

      {/* 2. Contact Order History Section */}
      {orders.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
            Lịch sử đơn của khách ({orders.length})
          </h4>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <OrderHistoryList
              orders={orders}
              activeOrderId={activeOrder?.id}
              onSelectOrder={order => onOpenDrawer(order)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
