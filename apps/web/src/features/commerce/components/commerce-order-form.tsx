'use client';

import * as React from 'react';
import {
  DiscountType,
  PaymentMethod,
  OrderStatus,
  normalizeVietnamesePhone,
  type OrderResponseDto,
  type ShippingAddressInputDto,
  type CreateOrderItemDto,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { ShoppingBag, CheckCircle2, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommerceOrders } from '../hooks/use-commerce-orders';
import { useCommerceCollision } from '../hooks/use-commerce-collision';
import { AgentCollisionBanner } from './agent-collision-banner';
import { ProductPickerCommand } from './product-picker-command';
import type { FlatProductVariant } from '../hooks/use-commerce-products';
import { LineItemsTable, type PosLineItem } from './line-items-table';
import { RecipientInfoForm } from './recipient-info-form';
import { OrderFinancialSummary } from './order-financial-summary';
import { commerceApi } from '../api/commerce-client';

export interface CommerceOrderFormProps {
  workspaceId: string;
  conversationId?: string;
  contactId?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  initialOrder?: OrderResponseDto | null;
  onCancel?: () => void;
  onSuccess?: (order: OrderResponseDto) => void;
}
export type PosOrderFormProps = CommerceOrderFormProps;

export function CommerceOrderForm({
  workspaceId,
  conversationId,
  contactId,
  contactName,
  contactPhone,
  initialOrder,
  onCancel,
  onSuccess,
}: PosOrderFormProps) {
  const [items, setItems] = React.useState<PosLineItem[]>([]);
  const [shippingAddress, setShippingAddress] = React.useState<Partial<ShippingAddressInputDto>>(
    {},
  );
  const [discountAmount, setDiscountAmount] = React.useState<number>(0);
  const [discountType, setDiscountType] = React.useState<DiscountType>(DiscountType.FIXED_AMOUNT);
  const [discountReason, setDiscountReason] = React.useState<string>('');
  const [shippingFee, setShippingFee] = React.useState<number>(0);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(PaymentMethod.COD);
  const [customerNotes, setCustomerNotes] = React.useState<string>('');

  const { createOrder, updateOrder, confirmOrder, isCreating, isUpdating, isConfirming } =
    useCommerceOrders(workspaceId);
  const { isLocked, lockedBy, remainingTtlSeconds, takeover } = useCommerceCollision({
    workspaceId,
    conversationId,
    isOpen: true,
  });

  // Populate form state when initialOrder or contact details change
  React.useEffect(() => {
    if (initialOrder) {
      setItems(
        (initialOrder.items || []).map(it => ({
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          variantName: it.variantName,
          sku: it.sku,
          unitPrice: Number(it.unitPrice),
          quantity: Number(it.quantity),
          discountAmount: Number(it.discountAmount || 0),
        })),
      );

      if (initialOrder.shippingAddress) {
        setShippingAddress({
          recipientName: initialOrder.shippingAddress.recipientName,
          phoneNumber: initialOrder.shippingAddress.phoneNumber,
          streetAddress: initialOrder.shippingAddress.streetAddress,
          ward: initialOrder.shippingAddress.ward,
          district: initialOrder.shippingAddress.district,
          province: initialOrder.shippingAddress.province,
          shippingNotes: initialOrder.shippingAddress.shippingNotes || undefined,
        });
      } else {
        setShippingAddress({
          recipientName: contactName || '',
          phoneNumber: contactPhone || '',
        });
      }

      const initDiscount =
        initialOrder.discountType === DiscountType.PERCENTAGE && Number(initialOrder.subtotal) > 0
          ? Math.round(
              (Number(initialOrder.discountAmount || 0) * 100) / Number(initialOrder.subtotal),
            )
          : Number(initialOrder.discountAmount || 0);
      setDiscountAmount(initDiscount);
      setDiscountType(initialOrder.discountType || DiscountType.FIXED_AMOUNT);
      setDiscountReason(initialOrder.discountReason || '');
      setShippingFee(Number(initialOrder.shippingFee || 0));
      setCustomerNotes(initialOrder.customerNotes || '');
    } else {
      // Clean slate for new draft order
      setItems([]);
      setShippingAddress({
        recipientName: contactName || '',
        phoneNumber: contactPhone || '',
      });
      setDiscountAmount(0);
      setDiscountType(DiscountType.FIXED_AMOUNT);
      setDiscountReason('');
      setShippingFee(0);
      setPaymentMethod(PaymentMethod.COD);
      setCustomerNotes('');
    }
  }, [initialOrder, contactName, contactPhone]);

  // Handle adding variant from command palette
  const handleSelectVariant = (variant: FlatProductVariant) => {
    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.variantId === variant.variantId);
      if (existingIdx !== -1) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const maxStock = variant.availableStock ?? 9999;
        const currentQty = existing?.quantity || 1;
        if (currentQty >= maxStock) {
          toast.warning('Đã đạt số lượng tồn kho khả dụng tối đa');
          return updated;
        }
        const newQty = currentQty + 1;
        updated[existingIdx] = {
          ...existing!,
          quantity: newQty,
          availableStock: variant.availableStock,
        };
        return updated;
      }

      return [
        ...prev,
        {
          productId: variant.productId,
          variantId: variant.variantId,
          productName: variant.productName,
          variantName: variant.variantName,
          sku: variant.sku,
          unitPrice: variant.price,
          quantity: 1,
          discountAmount: 0,
          availableStock: variant.availableStock,
        },
      ];
    });
  };

  const subtotal = React.useMemo(() => {
    return items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  }, [items]);

  // Form submission: Create or Update Order (with immediate confirmation option)
  const handleSaveOrder = async (confirmImmediately = false) => {
    if (!contactId) {
      toast.error('Không tìm thấy thông tin khách hàng cho cuộc hội thoại này');
      return;
    }

    if (items.length === 0) {
      toast.error('Vui lòng thêm ít nhất 1 sản phẩm vào đơn hàng');
      return;
    }

    const formattedItems: CreateOrderItemDto[] = items.map(it => ({
      productId: it.productId,
      variantId: it.variantId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountAmount: it.discountAmount || 0,
    }));

    const validAddress =
      shippingAddress.recipientName && shippingAddress.phoneNumber
        ? {
            recipientName: shippingAddress.recipientName,
            phoneNumber: normalizeVietnamesePhone(shippingAddress.phoneNumber),
            streetAddress: shippingAddress.streetAddress || 'Chưa cập nhật',
            ward: shippingAddress.ward || 'Chưa cập nhật',
            district: shippingAddress.district || 'Chưa cập nhật',
            province: shippingAddress.province || 'Chưa cập nhật',
            shippingNotes: shippingAddress.shippingNotes,
          }
        : undefined;

    try {
      let savedOrder: OrderResponseDto | null = null;
      if (initialOrder && initialOrder.status === OrderStatus.DRAFT) {
        savedOrder = await updateOrder({
          orderId: initialOrder.id,
          dto: {
            items: formattedItems,
            discountAmount,
            discountType,
            discountReason: discountReason || null,
            shippingFee,
            customerNotes: customerNotes || null,
            shippingAddress: validAddress,
            metadata: {
              ...(initialOrder.metadata || {}),
              paymentMethod,
            },
          },
        });

        if (confirmImmediately && savedOrder?.id) {
          savedOrder = await confirmOrder(savedOrder.id);
        }
      } else if (initialOrder && initialOrder.status !== OrderStatus.DRAFT) {
        savedOrder = await updateOrder({
          orderId: initialOrder.id,
          dto: {
            discountAmount,
            discountType,
            discountReason: discountReason || null,
            shippingFee,
            customerNotes: customerNotes || null,
            shippingAddress: validAddress,
            metadata: {
              ...(initialOrder.metadata || {}),
              paymentMethod,
            },
          },
        });
      } else {
        savedOrder = await createOrder({
          contactId,
          conversationId: conversationId || null,
          items: formattedItems,
          confirmImmediately,
          discountAmount,
          discountType,
          discountReason: discountReason || null,
          shippingFee,
          customerNotes: customerNotes || null,
          shippingAddress: validAddress,
          status: OrderStatus.DRAFT,
          metadata: {
            paymentMethod,
          },
        });

        if (paymentMethod === PaymentMethod.VIETQR && savedOrder?.id) {
          try {
            await commerceApi.generateVietQr(workspaceId, savedOrder.id, { sendToChat: true });
            toast.success(`Đã sinh mã VietQR cho đơn #${savedOrder.displayId} và gửi vào chat!`);
          } catch (qrErr: any) {
            toast.warning(
              `Đã tạo đơn #${savedOrder.displayId}, nhưng chưa thể gửi VietQR: ${qrErr.message}`,
            );
          }
        }
      }

      if (savedOrder && onSuccess) {
        onSuccess(savedOrder);
      }
    } catch {
      // Error handled in hook toast
    }
  };

  // Keyboard shortcut Ctrl+Enter to save (or confirm), Esc to cancel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLocked) {
          handleSaveOrder(true);
        }
      } else if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const isSaving = isCreating || isUpdating || isConfirming;

  return (
    <div className="flex flex-col gap-4">
      {/* Inline Form Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/70">
        <div className="flex items-center gap-1.5 min-w-0">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
              title={'Quay lại danh sách đơn'}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          )}
          <h4 className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
            <ShoppingBag className="size-3.5 text-primary shrink-0" />
            <span>
              {initialOrder ? `Sửa đơn #${initialOrder.displayId}` : 'Lập đơn hàng nhanh'}
            </span>
          </h4>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <kbd className="hidden sm:inline-flex items-center font-mono text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
            {'Ctrl+↵ lưu'}
          </kbd>
        </div>
      </div>

      {/* Multi-Agent Collision Banner */}
      <AgentCollisionBanner
        isLocked={isLocked}
        lockedBy={lockedBy}
        remainingTtlSeconds={remainingTtlSeconds}
        onTakeover={takeover}
        disabled={isSaving}
      />

      {/* Product Command Search */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
          {'Tìm kiếm sản phẩm'}
        </label>
        <ProductPickerCommand
          workspaceId={workspaceId}
          onSelectVariant={handleSelectVariant}
          disabled={isLocked || isSaving}
        />
      </div>

      {/* Line Items Table */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
            {`Sản phẩm đã chọn (${items.length})`}
          </label>
          {items.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive cursor-pointer gap-1"
              onClick={() => setItems([])}
              disabled={isLocked || isSaving}
            >
              <RotateCcw className="size-2.5" />
              {'Xóa hết'}
            </Button>
          )}
        </div>
        <LineItemsTable items={items} onChangeItems={setItems} disabled={isLocked || isSaving} />
      </div>

      {/* Recipient & Address Form */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
          {'Người nhận & Địa chỉ giao hàng'}
        </label>
        <RecipientInfoForm
          value={shippingAddress}
          onChange={setShippingAddress}
          disabled={isLocked || isSaving}
        />
      </div>

      {/* Financial Summary */}
      <OrderFinancialSummary
        subtotal={subtotal}
        discountAmount={discountAmount}
        discountType={discountType}
        discountReason={discountReason}
        shippingFee={shippingFee}
        paymentMethod={paymentMethod}
        onChange={updates => {
          if (updates.discountAmount !== undefined) setDiscountAmount(updates.discountAmount);
          if (updates.discountType !== undefined) setDiscountType(updates.discountType);
          if (updates.discountReason !== undefined) setDiscountReason(updates.discountReason);
          if (updates.shippingFee !== undefined) setShippingFee(updates.shippingFee);
          if (updates.paymentMethod !== undefined) setPaymentMethod(updates.paymentMethod);
        }}
        disabled={isLocked || isSaving}
      />

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/70 sticky bottom-0 bg-background/95 backdrop-blur-xs py-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
            className="text-xs h-8 cursor-pointer"
          >
            {'Quay lại (Esc)'}
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          {initialOrder && initialOrder.status !== OrderStatus.DRAFT ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => handleSaveOrder(false)}
              disabled={isLocked || isSaving || items.length === 0}
              className="text-xs h-8 font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              {isSaving ? (
                'Đang lưu...'
              ) : (
                <>
                  <CheckCircle2 className="size-3.5" />
                  {'Lưu cập nhật'}
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSaveOrder(false)}
                disabled={isLocked || isSaving || items.length === 0}
                className="text-xs h-8 cursor-pointer"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu nháp'}
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleSaveOrder(true)}
                disabled={isLocked || isSaving || items.length === 0}
                className="text-xs h-8 font-semibold gap-1.5 shadow-xs cursor-pointer"
              >
                {isSaving ? (
                  'Đang chốt đơn...'
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    {paymentMethod === PaymentMethod.VIETQR
                      ? '⚡ Tạo đơn & Gửi VietQR'
                      : 'Chốt đơn & Giữ kho'}
                    <span className="text-[9px] opacity-75 font-normal ml-0.5">(Ctrl+↵)</span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const PosOrderForm = CommerceOrderForm;
