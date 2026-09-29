import { z } from 'zod';
import {
  DiscountType,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../enums';
import { VIETNAMESE_PHONE_REGEX } from '../../common/phone';

// ============================================================================
// Recipient & Shipping Schemas
// ============================================================================

export const shippingAddressInputSchema = z.object({
  recipientName: z.string().trim().min(2, 'Tên người nhận tối thiểu 2 ký tự'),
  phoneNumber: z
    .string()
    .trim()
    .regex(VIETNAMESE_PHONE_REGEX, 'Số điện thoại không hợp lệ')
    .optional()
    .nullable(),
  streetAddress: z.string().trim().optional().nullable(),
  ward: z.string().trim().optional().nullable(),
  district: z.string().trim().optional().nullable(),
  province: z.string().trim().optional().nullable(),
  shippingNotes: z.string().optional().nullable(),
});

export type ShippingAddressInputDto = z.input<typeof shippingAddressInputSchema>;

export interface ShippingAddressResponseDto {
  recipientName: string;
  phoneNumber: string;
  streetAddress: string;
  ward: string;
  district: string;
  province: string;
  shippingNotes?: string | null;
}

export const createOrderItemSchema = z.object({
  productId: z.string().uuid('Product ID không hợp lệ'),
  variantId: z.string().uuid('Variant ID không hợp lệ'),
  quantity: z.number().int('Số lượng phải là số nguyên').positive('Số lượng phải lớn hơn 0'),
  unitPrice: z.number().positive('Đơn giá phải lớn hơn 0'),
  discountAmount: z.number().min(0, 'Chiết khấu không được âm').default(0),
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
  // Status defaults strictly to DRAFT. Advanced statuses cannot be injected by client
  status: z.literal(OrderStatus.DRAFT).default(OrderStatus.DRAFT),
  confirmImmediately: z.boolean().optional().default(false),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.COD),
  discountAmount: z.number().min(0, 'Chiết khấu không được âm').default(0),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.FIXED_AMOUNT),
  discountReason: z.string().optional().nullable(),
  shippingFee: z.number().min(0, 'Phí vận chuyển không được âm').default(0),
  customerNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  items: z.array(createOrderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  recipientName: z.string().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  recipientAddress: z.string().optional().nullable(),
  recipientWard: z.string().optional().nullable(),
  recipientDistrict: z.string().optional().nullable(),
  recipientProvince: z.string().optional().nullable(),
  shippingNotes: z.string().optional().nullable(),
  shippingAddress: shippingAddressInputSchema.optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export type CreateOrderDto = z.input<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  discountAmount: z.number().min(0).optional(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountReason: z.string().optional().nullable(),
  shippingFee: z.number().min(0).optional(),
  customerNotes: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  items: z.array(createOrderItemSchema).min(1).optional(),
  recipientName: z.string().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  recipientAddress: z.string().optional().nullable(),
  recipientWard: z.string().optional().nullable(),
  recipientDistrict: z.string().optional().nullable(),
  recipientProvince: z.string().optional().nullable(),
  shippingNotes: z.string().optional().nullable(),
  shippingAddress: shippingAddressInputSchema.optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateOrderDto = z.input<typeof updateOrderSchema>;

export const cancelOrderSchema = z.object({
  cancelReason: z.string().trim().min(3, 'Lý do hủy đơn bắt buộc tối thiểu 3 ký tự'),
});

export type CancelOrderDto = z.input<typeof cancelOrderSchema>;

export const completeOrderSchema = z
  .object({
    notes: z.string().optional().nullable(),
  })
  .nullish()
  .default({});

export type CompleteOrderDto = z.input<typeof completeOrderSchema>;

export const manualPayOrderSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  amount: z.number().positive('Số tiền thanh toán phải lớn hơn 0'),
  transactionCode: z.string().trim().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ManualPayOrderDto = z.input<typeof manualPayOrderSchema>;

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  conversationId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
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
  createdById: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
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
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientAddress?: string | null;
  recipientWard?: string | null;
  recipientDistrict?: string | null;
  recipientProvince?: string | null;
  shippingNotes?: string | null;
  items?: OrderItemResponseDto[];
  shippingAddress?: ShippingAddressResponseDto | null;
  paymentTransactions?: any[];
  inventoryTransactions?: any[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
