'use client';

import * as React from 'react';
import {
  DiscountType,
  PaymentMethod,
  OrderStatus,
  detectCarrierNetwork,
  normalizeVietnamesePhone,
  type OrderResponseDto,
  type ShippingAddressInputDto,
  type CreateOrderItemDto,
  type PosDraftSuggestedEventPayload,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { ShoppingBag, CheckCircle2, ArrowLeft, Printer, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosOrders } from '../hooks/use-pos-orders';
import { usePosCollision } from '../hooks/use-pos-collision';
import { AgentCollisionBanner } from './agent-collision-banner';
import { AiAutofillBanner } from './ai-autofill-banner';
import { ProductPickerCommand } from './product-picker-command';
import { LineItemsTable, type PosLineItem } from './line-items-table';
import { RecipientInfoForm } from './recipient-info-form';
import { OrderFinancialSummary } from './order-financial-summary';
import { ThermalPrintDialog } from './thermal-print-dialog';
import type { FlatProductVariant } from '../hooks/use-pos-products';
import { posApi } from '../api/pos-client';

export interface PosOrderFormProps {
  workspaceId: string;
  conversationId?: string;
  contactId?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  initialOrder?: OrderResponseDto | null;
  draftSuggestion?: PosDraftSuggestedEventPayload | null;
  onDismissSuggestion?: () => void;
  onCancel?: () => void;
  onSuccess?: (order: OrderResponseDto) => void;
}

export function PosOrderForm({
  workspaceId,
  conversationId,
  contactId,
  contactName,
  contactPhone,
  initialOrder,
  draftSuggestion,
  onDismissSuggestion,
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
  const [printDialogOpen, setPrintDialogOpen] = React.useState<boolean>(false);

  const { createOrder, updateOrder, isCreating, isUpdating } = usePosOrders(workspaceId);
  const { isLocked, lockedBy, remainingTtlSeconds, takeover } = usePosCollision({
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

  // Handle applying AI extracted draft suggestion
  const handleApplySuggestion = React.useCallback(
    (suggestion: PosDraftSuggestedEventPayload) => {
      const cust = suggestion.suggestedCustomer;
      setShippingAddress(prev => ({
        ...prev,
        recipientName: cust?.recipientName || prev.recipientName,
        phoneNumber: cust?.phoneNumber || prev.phoneNumber,
        streetAddress: cust?.streetAddress || prev.streetAddress,
        ward: cust?.ward || prev.ward,
        district: cust?.district || prev.district,
        province: cust?.province || prev.province,
      }));

      if (suggestion.suggestedItems && suggestion.suggestedItems.length > 0) {
        setItems(prev => {
          const newItems = [...prev];
          for (const sItem of suggestion.suggestedItems || []) {
            const existingIdx = sItem.variantId
              ? newItems.findIndex(i => i.variantId === sItem.variantId)
              : newItems.findIndex(i => i.productName === sItem.productName);

            if (existingIdx !== -1) {
              newItems[existingIdx] = {
                ...newItems[existingIdx]!,
                quantity: newItems[existingIdx]!.quantity + sItem.quantity,
              };
            } else {
              newItems.push({
                productId: sItem.productId || `ai-prod-${Date.now()}`,
                variantId: sItem.variantId || `ai-var-${Date.now()}`,
                productName: sItem.productName,
                variantName: sItem.variantName || 'Tiêu chuẩn',
                sku: sItem.sku || 'SKU-AI',
                unitPrice: sItem.unitPrice || 0,
                quantity: sItem.quantity,
                discountAmount: 0,
              });
            }
          }
          return newItems;
        });
      }

      toast.success('Đã áp dụng thông tin khách hàng và sản phẩm từ AI gợi ý!');
      if (onDismissSuggestion) {
        onDismissSuggestion();
      }
    },
    [onDismissSuggestion],
  );

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

  // Form submission: Create or Update Order
  const handleSaveOrder = async () => {
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
            carrierNetwork: detectCarrierNetwork(shippingAddress.phoneNumber),
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
      } else {
        savedOrder = await createOrder({
          contactId,
          conversationId: conversationId || null,
          items: formattedItems,
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
            await posApi.generateVietQr(workspaceId, savedOrder.id, { sendToChat: true });
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

  // Keyboard shortcut Ctrl+Enter to save, Esc to cancel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLocked) {
          handleSaveOrder();
        }
      } else if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const isSaving = isCreating || isUpdating;

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
              title="Quay lại danh sách đơn"
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
          {initialOrder && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-1.5 text-[11px] gap-1 cursor-pointer"
              onClick={() => setPrintDialogOpen(true)}
            >
              <Printer className="size-3" />
              In
            </Button>
          )}
          <kbd className="hidden sm:inline-flex items-center font-mono text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
            Ctrl+↵ lưu
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

      {/* AI Autofill Banner inside POS form */}
      {draftSuggestion && draftSuggestion.confidenceScore >= 80 && (
        <AiAutofillBanner
          suggestion={draftSuggestion}
          onApply={handleApplySuggestion}
          onDismiss={onDismissSuggestion || (() => {})}
        />
      )}

      {/* Product Command Search */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
          Tìm kiếm sản phẩm
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
            Sản phẩm đã chọn ({items.length})
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
              Xóa hết
            </Button>
          )}
        </div>
        <LineItemsTable items={items} onChangeItems={setItems} disabled={isLocked || isSaving} />
      </div>

      {/* Recipient & Address Form */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
          Người nhận & Địa chỉ giao hàng
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
            Quay lại (Esc)
          </Button>
        ) : (
          <div />
        )}

        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleSaveOrder}
          disabled={isLocked || isSaving || items.length === 0}
          className="text-xs h-8 font-semibold gap-1.5 shadow-xs cursor-pointer ml-auto"
        >
          {isSaving ? (
            'Đang lưu...'
          ) : (
            <>
              <CheckCircle2 className="size-3.5" />
              {initialOrder
                ? 'Lưu cập nhật'
                : paymentMethod === PaymentMethod.VIETQR
                  ? '⚡ Tạo đơn & Gửi VietQR'
                  : 'Tạo đơn hàng'}
              <span className="text-[9px] opacity-75 font-normal ml-0.5">(Ctrl+↵)</span>
            </>
          )}
        </Button>
      </div>

      {initialOrder && (
        <ThermalPrintDialog
          open={printDialogOpen}
          onOpenChange={setPrintDialogOpen}
          workspaceId={workspaceId}
          orderId={initialOrder.id}
        />
      )}
    </div>
  );
}
