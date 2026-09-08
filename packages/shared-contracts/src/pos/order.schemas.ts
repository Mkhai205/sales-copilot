import { z } from 'zod';
import {
  DiscountType,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './pos-enums';
import { shippingAddressInputSchema, type ShippingAddressResponseDto } from './shipping.schemas';

// ============================================================================
// Order Item Schemas
// ============================================================================

export const createOrderItemSchema = z.object({
  productId: z.string().uuid('Product ID không hợp lệ'),
  variantId: z.string().uuid('Variant ID không hợp lệ'),
  quantity: z.coerce.number().int('Số lượng phải là số nguyên').positive('Số lượng phải lớn hơn 0'),
  unitPrice: z.coerce.number().positive('Đơn giá phải lớn hơn 0'),
  discountAmount: z.coerce.number().min(0, 'Chiết khấu không được âm').default(0),
  metadata: z.record(z.any()).default({}),
});

export type CreateOrderItemDto = z.input<typeof createOrderItemSchema>;

export interface OrderItemResponseDto {
  id: string;
  workspaceId: string;
  orderId: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number | string;
  costPrice: number | string;
  quantity: number;
  discountAmount: number | string;
  totalPrice: number | string;
  metadata: Record<string, any>;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// Order Schemas
// ============================================================================

export const createOrderSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid('Contact ID không hợp lệ'),
  leadId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  // Status defaults strictly to DRAFT. Advanced statuses cannot be injected by client
  status: z.literal(OrderStatus.DRAFT).default(OrderStatus.DRAFT),
  discountAmount: z.coerce.number().min(0, 'Chiết khấu không được âm').default(0),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.FIXED_AMOUNT),
  discountReason: z.string().optional().nullable(),
  shippingFee: z.coerce.number().min(0, 'Phí vận chuyển không được âm').default(0),
  customerNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  items: z.array(createOrderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  shippingAddress: shippingAddressInputSchema.optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export type CreateOrderDto = z.input<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  discountAmount: z.coerce.number().min(0).optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountReason: z.string().optional().nullable(),
  shippingFee: z.coerce.number().min(0).optional(),
  customerNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  items: z.array(createOrderItemSchema).min(1).optional(),
  shippingAddress: shippingAddressInputSchema.optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateOrderDto = z.input<typeof updateOrderSchema>;

export const cancelOrderSchema = z.object({
  cancelReason: z.string().trim().min(3, 'Lý do hủy đơn bắt buộc tối thiểu 3 ký tự'),
});

export type CancelOrderDto = z.input<typeof cancelOrderSchema>;

export const manualPayOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  amount: z.coerce.number().positive('Số tiền thanh toán phải lớn hơn 0'),
  transactionCode: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ManualPayOrderDto = z.input<typeof manualPayOrderSchema>;

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  conversationId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  fulfillmentStatus: z.nativeEnum(FulfillmentStatus).optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount', 'displayId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListOrdersQueryDto = z.input<typeof listOrdersQuerySchema>;
export type ListOrdersQueryOutput = z.infer<typeof listOrdersQuerySchema>;

export interface OrderResponseDto {
  id: string;
  displayId: number;
  orderNumber: string;
  workspaceId: string;
  conversationId: string | null;
  contactId: string;
  leadId: string | null;
  opportunityId: string | null;
  createdById: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number | string;
  discountAmount: number | string;
  discountType: DiscountType;
  discountReason: string | null;
  shippingFee: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paidAmount: number | string;
  currency: string;
  customerNotes: string | null;
  internalNotes: string | null;
  cancelReason: string | null;
  confirmedAt: Date | string | null;
  paidAt: Date | string | null;
  shippedAt: Date | string | null;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
  metadata: Record<string, any>;
  items?: OrderItemResponseDto[];
  shippingAddress?: ShippingAddressResponseDto | null;
  paymentTransactions?: any[];
  inventoryTransactions?: any[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
