import { z } from 'zod';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  PAID = 'PAID',
  SHIPPING = 'SHIPPING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum FulfillmentStatus {
  UNFULFILLED = 'UNFULFILLED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
}

export enum PaymentMethod {
  VIETQR = 'VIETQR',
  BANK_TRANSFER = 'BANK_TRANSFER',
  COD = 'COD',
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  OTHER = 'OTHER',
}

export enum PaymentGateway {
  SEPAY = 'SEPAY',
  CASSO = 'CASSO',
  MANUAL = 'MANUAL',
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
}

export enum PaymentTransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum CarrierProvider {
  GHTK = 'GHTK',
  GHN = 'GHN',
  VIETTEL_POST = 'VIETTEL_POST',
  AHAMOVE = 'AHAMOVE',
  CUSTOM = 'CUSTOM',
}

export enum CarrierNetwork {
  VIETTEL = 'VIETTEL',
  VINAPHONE = 'VINAPHONE',
  MOBIFONE = 'MOBIFONE',
  VIETNAMOBILE = 'VIETNAMOBILE',
  GMOBILE = 'GMOBILE',
  ITEL = 'ITEL',
  WINTEL = 'WINTEL',
  OTHER = 'OTHER',
}

export enum InventoryTransactionType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  RESERVATION = 'RESERVATION',
  RELEASE_RESERVATION = 'RELEASE_RESERVATION',
  COMMIT_SALE = 'COMMIT_SALE',
  RETURN_RESTOCK = 'RETURN_RESTOCK',
  INVENTORY_AUDIT = 'INVENTORY_AUDIT',
}

export const orderStatusSchema = z.nativeEnum(OrderStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export const fulfillmentStatusSchema = z.nativeEnum(FulfillmentStatus);
export const discountTypeSchema = z.nativeEnum(DiscountType);
export const paymentMethodSchema = z.nativeEnum(PaymentMethod);
export const paymentGatewaySchema = z.nativeEnum(PaymentGateway);
export const paymentTransactionStatusSchema = z.nativeEnum(PaymentTransactionStatus);
export const carrierProviderSchema = z.nativeEnum(CarrierProvider);
export const carrierNetworkSchema = z.nativeEnum(CarrierNetwork);
export const inventoryTransactionTypeSchema = z.nativeEnum(InventoryTransactionType);
