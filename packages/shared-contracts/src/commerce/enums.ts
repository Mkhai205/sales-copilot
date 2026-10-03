import { z } from 'zod';

export const OrderStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PAID: 'PAID',
  SHIPPING: 'SHIPPING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const FulfillmentStatus = {
  UNFULFILLED: 'UNFULFILLED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURNED',
  CANCELLED: 'CANCELLED',
} as const;

export type FulfillmentStatus = (typeof FulfillmentStatus)[keyof typeof FulfillmentStatus];

export const DiscountType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED_AMOUNT: 'FIXED_AMOUNT',
} as const;

export type DiscountType = (typeof DiscountType)[keyof typeof DiscountType];

export const PaymentMethod = {
  VIETQR: 'VIETQR',
  BANK_TRANSFER: 'BANK_TRANSFER',
  COD: 'COD',
  CASH: 'CASH',
  CREDIT_CARD: 'CREDIT_CARD',
  OTHER: 'OTHER',
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentGateway = {
  SEPAY: 'SEPAY',
  CASSO: 'CASSO',
  MANUAL: 'MANUAL',
} as const;

export type PaymentGateway = (typeof PaymentGateway)[keyof typeof PaymentGateway];

export const PaymentTransactionStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type PaymentTransactionStatus =
  (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

export const InventoryTransactionType = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  RESERVATION: 'RESERVATION',
  RELEASE_RESERVATION: 'RELEASE_RESERVATION',
  COMMIT_SALE: 'COMMIT_SALE',
  RETURN_RESTOCK: 'RETURN_RESTOCK',
  INVENTORY_AUDIT: 'INVENTORY_AUDIT',
} as const;

export type InventoryTransactionType =
  (typeof InventoryTransactionType)[keyof typeof InventoryTransactionType];

export const orderStatusSchema = z.nativeEnum(OrderStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export const fulfillmentStatusSchema = z.nativeEnum(FulfillmentStatus);
export const discountTypeSchema = z.nativeEnum(DiscountType);
export const paymentMethodSchema = z.nativeEnum(PaymentMethod);
export const paymentGatewaySchema = z.nativeEnum(PaymentGateway);
export const paymentTransactionStatusSchema = z.nativeEnum(PaymentTransactionStatus);
export const inventoryTransactionTypeSchema = z.nativeEnum(InventoryTransactionType);

/**
 * Payment gateway route param accepted by the bank webhook endpoint,
 * mirroring the {@link PaymentGateway} enum values (lowercase wire format).
 */
export type ImplementedPaymentGateway = 'sepay' | 'casso' | 'manual';
