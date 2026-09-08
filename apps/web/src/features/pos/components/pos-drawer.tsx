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
import { ShoppingBag, CheckCircle2, Printer } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
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

interface PosDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  conversationId?: string;
  contactId?: string;
  initialOrder?: OrderResponseDto | null;
  contactName?: string | null;
  contactPhone?: string | null;
  draftSuggestion?: PosDraftSuggestedEventPayload | null;
  onDismissSuggestion?: () => void;
}

export function PosDrawer({
  isOpen,
  onOpenChange,
  workspaceId,
  conversationId,
  contactId,
  initialOrder,
  contactName,
  contactPhone,
  draftSuggestion,
  onDismissSuggestion,
}: PosDrawerProps) {
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
    isOpen,
  });

  // Populate form state when drawer opens or initialOrder changes
  React.useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, initialOrder, contactName, contactPhone]);

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
                ...newItems[existingIdx],
                quantity: newItems[existingIdx].quantity + sItem.quantity,
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
      if (initialOrder && initialOrder.status === OrderStatus.DRAFT) {
        // Update existing draft order
        await updateOrder({
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
        // Create new order draft
        const createdOrder = await createOrder({
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

        if (paymentMethod === PaymentMethod.VIETQR && createdOrder?.id) {
          try {
            await posApi.generateVietQr(workspaceId, createdOrder.id, { sendToChat: true });
            toast.success(`Đã sinh mã VietQR cho đơn #${createdOrder.displayId} và gửi vào chat!`);
          } catch (qrErr: any) {
            toast.warning(
              `Đã tạo đơn #${createdOrder.displayId}, nhưng chưa thể gửi VietQR: ${qrErr.message}`,
            );
          }
        }
      }

      onOpenChange(false);
    } catch {
      // Error handled in hook toast
    }
  };

  // Keyboard shortcut Ctrl+Enter to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLocked) {
          handleSaveOrder();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const isSaving = isCreating || isUpdating;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col gap-0 border-l border-border bg-background"
      >
        {/* Header */}
        <SheetHeader className="p-4 border-b border-border/80 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold flex items-center gap-2">
              <ShoppingBag className="size-5 text-primary" />
              {initialOrder
                ? `Chỉnh sửa đơn #${initialOrder.displayId}`
                : 'Tạo đơn hàng nhanh (POS)'}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {initialOrder && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs px-2 gap-1"
                  onClick={() => setPrintDialogOpen(true)}
                >
                  <Printer className="size-3.5" />
                  In phiếu
                </Button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border">
                F4 đóng/mở
              </kbd>
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground mt-0.5">
            Tìm sản phẩm, phân tích địa chỉ khách hàng và lập đơn ngay trong phiên chat
          </SheetDescription>
        </SheetHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Multi-Agent Collision Banner */}
          <AgentCollisionBanner
            isLocked={isLocked}
            lockedBy={lockedBy}
            remainingTtlSeconds={remainingTtlSeconds}
            onTakeover={takeover}
            disabled={isSaving}
          />

          {/* AI Autofill Banner inside POS Drawer */}
          {draftSuggestion && draftSuggestion.confidenceScore >= 80 && (
            <AiAutofillBanner
              suggestion={draftSuggestion}
              onApply={handleApplySuggestion}
              onDismiss={onDismissSuggestion || (() => {})}
            />
          )}

          {/* Product Command Search */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
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
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
                Danh sách sản phẩm ({items.length})
              </label>
            </div>
            <LineItemsTable
              items={items}
              onChangeItems={setItems}
              disabled={isLocked || isSaving}
            />
          </div>

          {/* Recipient & Address Form */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              Thông tin người nhận & Địa chỉ giao hàng
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
        </div>

        {/* Sticky Footer Actions */}
        <SheetFooter className="p-3 border-t border-border bg-muted/30 shrink-0 flex flex-row items-center justify-between sm:justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="text-xs h-9"
          >
            Đóng (Esc)
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSaveOrder}
              disabled={isLocked || isSaving || items.length === 0}
              className="text-xs h-9 font-semibold gap-1.5 shadow-sm"
            >
              {isSaving ? (
                'Đang lưu...'
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  {initialOrder
                    ? 'Lưu cập nhật'
                    : paymentMethod === PaymentMethod.VIETQR
                      ? '⚡ Tạo đơn & Gửi VietQR'
                      : 'Tạo đơn hàng'}
                  <span className="text-[10px] opacity-75 font-normal ml-1">(Ctrl+Enter)</span>
                </>
              )}
            </Button>
          </div>
        </SheetFooter>

        {initialOrder && (
          <ThermalPrintDialog
            open={printDialogOpen}
            onOpenChange={setPrintDialogOpen}
            workspaceId={workspaceId}
            orderId={initialOrder.id}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
