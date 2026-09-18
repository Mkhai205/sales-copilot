'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OrderStatusBadge, PaymentStatusBadge } from './order-status-badge';
import { ThermalPrintDialog } from './thermal-print-dialog';
import { useCommerceOrders } from '../hooks/use-commerce-orders';
import { formatVND } from '@/features/commerce/lib/currency';
import { OrderStatus, type OrderResponseDto } from '@sales-copilot/shared-contracts';
import {
  Printer,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Package,
  CreditCard,
  User,
  MapPin,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

function formatDateTime(dateInput: Date | string): string {
  try {
    const d = new Date(dateInput);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateInput);
  }
}

export interface OrderDetailSheetProps {
  order: OrderResponseDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceSlug: string;
  onOrderUpdated?: () => void;
}

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
  onOrderUpdated,
}: OrderDetailSheetProps) {
  const { completeOrder, cancelOrder, isCompleting, isCancelling } = useCommerceOrders(workspaceId);

  const [printOpen, setPrintOpen] = React.useState(false);
  const [printFormat, setPrintFormat] = React.useState<'K80' | 'K58'>('K80');

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');

  // Complete confirmation dialog state
  const [completeDialogOpen, setCompleteDialogOpen] = React.useState(false);

  if (!order) return null;

  const canComplete =
    order.status === OrderStatus.CONFIRMED ||
    order.status === OrderStatus.PAID ||
    order.status === OrderStatus.SHIPPING;

  const canCancel =
    order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED;

  const handleConfirmComplete = async () => {
    try {
      await completeOrder({ orderId: order.id });
      setCompleteDialogOpen(false);
      if (onOrderUpdated) onOrderUpdated();
    } catch {
      // Toast handled in mutation
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim() || cancelReason.trim().length < 3) return;
    try {
      await cancelOrder({
        orderId: order.id,
        dto: { cancelReason: cancelReason.trim() },
      });
      setCancelDialogOpen(false);
      setCancelReason('');
      if (onOrderUpdated) onOrderUpdated();
    } catch {
      // Toast handled in mutation
    }
  };

  const paidAmount = Number(order.paidAmount || 0);
  const totalAmount = Number(order.totalAmount || 0);
  const codDue = Math.max(0, totalAmount - paidAmount);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <SheetHeader className="p-4 border-b border-border/70 shrink-0 bg-muted/20">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-bold font-mono text-foreground">
                  {order.displayId || order.orderNumber}
                </SheetTitle>
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              {formatDateTime(order.createdAt)}
            </SheetDescription>
          </SheetHeader>

          {/* Action Bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-card/60 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 cursor-pointer"
              onClick={() => {
                setPrintFormat('K80');
                setPrintOpen(true);
              }}
            >
              <Printer className="size-3.5" />
              {'In phiếu gửi (K80)'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 cursor-pointer"
              onClick={() => {
                setPrintFormat('K58');
                setPrintOpen(true);
              }}
            >
              <Printer className="size-3.5" />
              {'In hóa đơn (K58)'}
            </Button>

            {order.conversationId && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 cursor-pointer"
              >
                <Link href={`/${workspaceSlug}/inbox?conversationId=${order.conversationId}`}>
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                  {'Xem hội thoại'}
                </Link>
              </Button>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {canComplete && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  onClick={() => setCompleteDialogOpen(true)}
                  disabled={isCompleting}
                >
                  <CheckCircle2 className="size-3.5" />
                  {'Hoàn tất đơn'}
                </Button>
              )}

              {canCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={isCancelling}
                >
                  <XCircle className="size-3.5" />
                  {'Hủy đơn hàng'}
                </Button>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Customer & Address Information */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <User className="size-3.5 text-primary" />
                <span>{'Thông tin người nhận'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">{'Tên người nhận'}: </span>
                  <span className="font-semibold text-foreground">
                    {order.shippingAddress?.recipientName || 'Không có'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{'Số điện thoại'}: </span>
                  <span className="font-mono font-medium">
                    {order.shippingAddress?.phoneNumber || '—'}
                  </span>
                </div>
              </div>

              {order.shippingAddress && (
                <div className="pt-2 border-t border-border/50 text-xs flex items-start gap-1.5">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-foreground">
                      {[
                        order.shippingAddress.streetAddress,
                        order.shippingAddress.ward,
                        order.shippingAddress.district,
                        order.shippingAddress.province,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                    {order.shippingAddress.shippingNotes && (
                      <p className="text-[11px] text-muted-foreground mt-1 italic">
                        {'Ghi chú giao hàng'}: {order.shippingAddress.shippingNotes}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Package className="size-3.5 text-primary" />
                <span>{'Danh sách sản phẩm'}</span>
              </div>
              <div className="divide-y divide-border/60">
                {(order.items || []).map(item => (
                  <div
                    key={item.id}
                    className="py-2 flex items-center justify-between text-xs gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{item.productName}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{item.variantName}</span>
                        {item.sku && (
                          <code className="bg-muted px-1 rounded text-[10px] font-mono">
                            {item.sku}
                          </code>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-medium">
                        {formatVND(Number(item.unitPrice))} x {item.quantity}
                      </div>
                      <div className="font-mono text-xs font-semibold text-primary">
                        {formatVND(Number(item.totalPrice))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CreditCard className="size-3.5 text-primary" />
                <span>{'Thông tin thanh toán'}</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>{'Tạm tính:'}</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatVND(Number(order.subtotal || 0))}
                  </span>
                </div>
                {Number(order.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>
                      {'Chiết khấu:'} {order.discountReason ? `(${order.discountReason})` : ''}
                    </span>
                    <span className="font-mono font-medium">
                      -{formatVND(Number(order.discountAmount))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{'Phí vận chuyển:'}</span>
                  <span className="font-mono font-medium text-foreground">
                    {formatVND(Number(order.shippingFee || 0))}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-sm pt-1.5 border-t border-border/60">
                  <span>{'Tổng thanh toán:'}</span>
                  <span className="font-mono text-primary">{formatVND(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px] pt-1 border-t border-dashed border-border/60">
                  <span>{'Đã cọc/thanh toán'}:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    {formatVND(paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-xs text-orange-600 dark:text-orange-400">
                  <span>{'Còn phải thu (COD)'}:</span>
                  <span className="font-mono">{formatVND(codDue)}</span>
                </div>
              </div>
            </div>

            {/* Payment Transactions */}
            <div className="rounded-lg border bg-card p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground">{'Lịch sử giao dịch'}</div>
              {order.paymentTransactions && order.paymentTransactions.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {order.paymentTransactions.map(tx => (
                    <div key={tx.id} className="py-1.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium">{tx.paymentMethod}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">
                          ({tx.gateway})
                        </span>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDateTime(tx.createdAt)}
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-emerald-600">
                        +{formatVND(Number(tx.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground italic py-1">
                  {'Chưa có giao dịch thanh toán nào được ghi nhận'}
                </div>
              )}
            </div>

            {/* Notes */}
            {(order.customerNotes || order.internalNotes) && (
              <div className="rounded-lg border bg-card p-3 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <FileText className="size-3.5 text-primary" />
                  <span>{'Ghi chú đơn hàng'}</span>
                </div>
                {order.customerNotes && (
                  <div>
                    <span className="text-muted-foreground">{'Ghi chú của khách'}: </span>
                    <span>{order.customerNotes}</span>
                  </div>
                )}
                {order.internalNotes && (
                  <div>
                    <span className="text-muted-foreground">{'Ghi chú nội bộ'}: </span>
                    <span className="italic">{order.internalNotes}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Complete Order Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{'Hoàn tất đơn hàng'}</DialogTitle>
            <DialogDescription>
              {
                'Đơn hàng sẽ được chuyển sang Hoàn thành. Nếu là đơn COD chưa thanh toán, hệ thống sẽ tự động ghi nhận thanh toán.'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
              disabled={isCompleting}
            >
              {'Hủy'}
            </Button>
            <Button
              type="button"
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmComplete}
              disabled={isCompleting}
            >
              {isCompleting ? 'Đang lưu...' : 'Xác nhận hoàn tất'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">{'Xác nhận hủy đơn hàng'}</DialogTitle>
            <DialogDescription>
              {
                'Thao tác này sẽ hủy đơn hàng và hoàn trả tồn kho tương ứng. Vui lòng nhập lý do hủy.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              {'Lý do hủy đơn'} <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder={'Ví dụ: Khách đổi ý, sai địa chỉ...'}
              rows={3}
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isCancelling}
            >
              {'Hủy'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling || cancelReason.trim().length < 3}
            >
              {isCancelling ? 'Đang lưu...' : 'Xác nhận hủy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Thermal Print Dialog */}
      <ThermalPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        workspaceId={workspaceId}
        orderId={order.id}
        defaultFormat={printFormat}
      />
    </>
  );
}
