'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DiscountType,
  PaymentMethod,
  OrderStatus,
  normalizeVietnamesePhone,
  type OrderResponseDto,
  type CreateOrderItemDto,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import { ShoppingBag, CheckCircle2, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommerceOrders } from '../hooks/use-commerce-orders';
import { useCommerceCollision } from '../hooks/use-commerce-collision';
import { AgentCollisionBanner } from './agent-collision-banner';
import { ProductPickerCommand } from '@/features/commerce/products/components/product-picker-command';
import type { FlatProductVariant } from '@/features/commerce/products/hooks/use-commerce-products';
import { LineItemsTable } from './line-items-table';
import { RecipientInfoForm } from './recipient-info-form';
import { OrderFinancialSummary } from './order-financial-summary';
import { ordersApi } from '../api/orders';

const lineItemSchema = z.object({
  productId: z.string().min(1, 'Product ID không hợp lệ'),
  variantId: z.string().min(1, 'Variant ID không hợp lệ'),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string(),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1),
  discountAmount: z.number().min(0),
  availableStock: z.number().optional(),
});

const shippingAddressFormSchema = z.object({
  recipientName: z.string().optional(),
  phoneNumber: z.string().optional(),
  streetAddress: z.string().optional(),
  ward: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  shippingNotes: z.string().optional(),
});

const orderFormSchema = z.object({
  items: z.array(lineItemSchema).min(1, 'Vui lòng thêm ít nhất 1 sản phẩm vào đơn hàng'),
  shippingAddress: shippingAddressFormSchema,
  discountAmount: z.number().min(0, 'Chiết khấu không được âm'),
  discountType: z.nativeEnum(DiscountType),
  discountReason: z.string().optional(),
  shippingFee: z.number().min(0, 'Phí vận chuyển không được âm'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  customerNotes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

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
  const { createOrder, updateOrder, confirmOrder, isCreating, isUpdating, isConfirming } =
    useCommerceOrders(workspaceId);
  const { isLocked, lockedBy, remainingTtlSeconds, takeover } = useCommerceCollision({
    workspaceId,
    conversationId,
    isOpen: true,
  });

  const defaultValues = React.useMemo<OrderFormValues>(() => {
    if (initialOrder) {
      const initDiscount =
        initialOrder.discountType === DiscountType.PERCENTAGE && Number(initialOrder.subtotal) > 0
          ? Math.round(
              (Number(initialOrder.discountAmount || 0) * 100) / Number(initialOrder.subtotal),
            )
          : Number(initialOrder.discountAmount || 0);

      return {
        items: (initialOrder.items || []).map(it => ({
          productId: it.productId,
          variantId: it.variantId,
          productName: it.productName,
          variantName: it.variantName,
          sku: it.sku,
          unitPrice: Number(it.unitPrice),
          quantity: Number(it.quantity),
          discountAmount: Number(it.discountAmount || 0),
        })),
        shippingAddress: initialOrder.shippingAddress
          ? {
              recipientName: initialOrder.shippingAddress.recipientName,
              phoneNumber: initialOrder.shippingAddress.phoneNumber,
              streetAddress: initialOrder.shippingAddress.streetAddress,
              ward: initialOrder.shippingAddress.ward,
              district: initialOrder.shippingAddress.district,
              province: initialOrder.shippingAddress.province,
              shippingNotes: initialOrder.shippingAddress.shippingNotes || undefined,
            }
          : {
              recipientName: contactName || '',
              phoneNumber: contactPhone || '',
            },
        discountAmount: initDiscount,
        discountType: initialOrder.discountType || DiscountType.FIXED_AMOUNT,
        discountReason: initialOrder.discountReason || '',
        shippingFee: Number(initialOrder.shippingFee || 0),
        paymentMethod: (initialOrder.metadata as any)?.paymentMethod || PaymentMethod.COD,
        customerNotes: initialOrder.customerNotes || '',
      };
    }

    return {
      items: [],
      shippingAddress: {
        recipientName: contactName || '',
        phoneNumber: contactPhone || '',
      },
      discountAmount: 0,
      discountType: DiscountType.FIXED_AMOUNT,
      discountReason: '',
      shippingFee: 0,
      paymentMethod: PaymentMethod.COD,
      customerNotes: '',
    };
  }, [initialOrder, contactName, contactPhone]);

  const { watch, setValue, handleSubmit } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    values: defaultValues,
    resetOptions: {
      keepDirtyValues: true,
    },
    mode: 'onChange',
  });

  const items = watch('items') || [];
  const shippingAddress = watch('shippingAddress') || {};
  const discountAmount = watch('discountAmount') || 0;
  const discountType = watch('discountType') || DiscountType.FIXED_AMOUNT;
  const discountReason = watch('discountReason') || '';
  const shippingFee = watch('shippingFee') || 0;
  const paymentMethod = watch('paymentMethod') || PaymentMethod.COD;

  // Handle adding variant from command palette
  const handleSelectVariant = (variant: FlatProductVariant) => {
    const existingIdx = items.findIndex(i => i.variantId === variant.variantId);
    if (existingIdx !== -1) {
      const updated = [...items];
      const existing = updated[existingIdx];
      const maxStock = variant.availableStock ?? 9999;
      const currentQty = existing?.quantity || 1;
      if (currentQty >= maxStock) {
        toast.warning('Đã đạt số lượng tồn kho khả dụng tối đa');
        return;
      }
      const newQty = currentQty + 1;
      updated[existingIdx] = {
        ...existing!,
        quantity: newQty,
        availableStock: variant.availableStock,
      };
      setValue('items', updated, { shouldValidate: true, shouldDirty: true });
      return;
    }

    const updated = [
      ...items,
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
    setValue('items', updated, { shouldValidate: true, shouldDirty: true });
  };

  const subtotal = React.useMemo(() => {
    return items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  }, [items]);

  // Form submission: Create or Update Order (with immediate confirmation option)
  const handleSaveOrder = (confirmImmediately = false) => {
    return handleSubmit(
      async (formValues: OrderFormValues) => {
        if (!contactId) {
          toast.error('Không tìm thấy thông tin khách hàng cho cuộc hội thoại này');
          return;
        }

        const formattedItems: CreateOrderItemDto[] = formValues.items.map(it => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountAmount: it.discountAmount || 0,
        }));

        const addr = formValues.shippingAddress || {};
        const validAddress =
          addr.recipientName && addr.phoneNumber
            ? {
                recipientName: addr.recipientName,
                phoneNumber: normalizeVietnamesePhone(addr.phoneNumber),
                streetAddress: addr.streetAddress || 'Chưa cập nhật',
                ward: addr.ward || 'Chưa cập nhật',
                district: addr.district || 'Chưa cập nhật',
                province: addr.province || 'Chưa cập nhật',
                shippingNotes: addr.shippingNotes || undefined,
              }
            : undefined;

        try {
          let savedOrder: OrderResponseDto | null = null;
          if (initialOrder && initialOrder.status === OrderStatus.DRAFT) {
            savedOrder = await updateOrder({
              orderId: initialOrder.id,
              dto: {
                items: formattedItems,
                discountAmount: formValues.discountAmount,
                discountType: formValues.discountType,
                discountReason: formValues.discountReason || null,
                shippingFee: formValues.shippingFee,
                customerNotes: formValues.customerNotes || null,
                shippingAddress: validAddress,
                metadata: {
                  ...(initialOrder.metadata || {}),
                  paymentMethod: formValues.paymentMethod,
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
                discountAmount: formValues.discountAmount,
                discountType: formValues.discountType,
                discountReason: formValues.discountReason || null,
                shippingFee: formValues.shippingFee,
                customerNotes: formValues.customerNotes || null,
                shippingAddress: validAddress,
                metadata: {
                  ...(initialOrder.metadata || {}),
                  paymentMethod: formValues.paymentMethod,
                },
              },
            });
          } else {
            savedOrder = await createOrder({
              contactId,
              conversationId: conversationId || null,
              items: formattedItems,
              confirmImmediately,
              discountAmount: formValues.discountAmount,
              discountType: formValues.discountType,
              discountReason: formValues.discountReason || null,
              shippingFee: formValues.shippingFee,
              customerNotes: formValues.customerNotes || null,
              shippingAddress: validAddress,
              status: OrderStatus.DRAFT,
              metadata: {
                paymentMethod: formValues.paymentMethod,
              },
            });

            if (formValues.paymentMethod === PaymentMethod.VIETQR && savedOrder?.id) {
              try {
                await ordersApi.generateVietQr(workspaceId, savedOrder.id, { sendToChat: true });
                toast.success(
                  `Đã sinh mã VietQR cho đơn #${savedOrder.displayId} và gửi vào chat!`,
                );
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
      },
      errors => {
        const errorEntries = Object.values(errors);
        if (errorEntries.length > 0 && errorEntries[0]?.message) {
          toast.error(String(errorEntries[0].message));
        } else {
          toast.error('Vui lòng kiểm tra lại thông tin đơn hàng');
        }
      },
    )();
  };

  const handleSaveOrderRef = React.useRef(handleSaveOrder);
  handleSaveOrderRef.current = handleSaveOrder;

  // Keyboard shortcut Ctrl+Enter to save (or confirm), Esc to cancel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLocked) {
          handleSaveOrderRef.current(true);
        }
      } else if (e.key === 'Escape' && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, onCancel]);

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
              onClick={() => setValue('items', [], { shouldValidate: true, shouldDirty: true })}
              disabled={isLocked || isSaving}
            >
              <RotateCcw className="size-2.5" />
              {'Xóa hết'}
            </Button>
          )}
        </div>
        <LineItemsTable
          items={items}
          onChangeItems={newItems =>
            setValue('items', newItems, { shouldValidate: true, shouldDirty: true })
          }
          disabled={isLocked || isSaving}
        />
      </div>

      {/* Recipient & Address Form */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
          {'Người nhận & Địa chỉ giao hàng'}
        </label>
        <RecipientInfoForm
          value={shippingAddress}
          onChange={newAddr =>
            setValue(
              'shippingAddress',
              {
                recipientName: newAddr.recipientName || '',
                phoneNumber: newAddr.phoneNumber || '',
                streetAddress: newAddr.streetAddress || '',
                ward: newAddr.ward || '',
                district: newAddr.district || '',
                province: newAddr.province || '',
                shippingNotes: newAddr.shippingNotes || '',
              },
              { shouldValidate: true, shouldDirty: true },
            )
          }
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
          if (updates.discountAmount !== undefined)
            setValue('discountAmount', updates.discountAmount, { shouldDirty: true });
          if (updates.discountType !== undefined)
            setValue('discountType', updates.discountType, { shouldDirty: true });
          if (updates.discountReason !== undefined)
            setValue('discountReason', updates.discountReason, { shouldDirty: true });
          if (updates.shippingFee !== undefined)
            setValue('shippingFee', updates.shippingFee, { shouldDirty: true });
          if (updates.paymentMethod !== undefined)
            setValue('paymentMethod', updates.paymentMethod, { shouldDirty: true });
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
