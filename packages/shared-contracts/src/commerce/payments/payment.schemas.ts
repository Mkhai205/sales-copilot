import { z } from 'zod';
import { PaymentGateway, PaymentMethod, PaymentTransactionStatus } from '../enums';

export const createPaymentTransactionSchema = z.object({
  orderId: z.string().uuid('Order ID không hợp lệ').optional().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.VIETQR),
  gateway: z.nativeEnum(PaymentGateway).default(PaymentGateway.MANUAL),
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  currency: z.string().default('VND'),
  status: z.nativeEnum(PaymentTransactionStatus).default(PaymentTransactionStatus.PENDING),
  transactionCode: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  bankCode: z.string().trim().optional().nullable(),
  transferContent: z.string().trim().optional().nullable(),
  qrUrl: z.string().optional().nullable(),
  rawWebhookPayload: z.record(z.any()).optional().nullable(),
  idempotencyKey: z.string().min(1, 'Idempotency key bắt buộc'),
  paidAt: z.string().datetime().optional().nullable(),
});

export type CreatePaymentTransactionDto = z.input<typeof createPaymentTransactionSchema>;

export interface MatchedOrderSummaryDto {
  id: string;
  displayId: number;
  orderNumber: string;
  totalAmount: number | string;
  paidAmount: number | string;
  status: string;
  paymentStatus: string;
  contact?: {
    fullName?: string | null;
    phone?: string | null;
  } | null;
}

export interface PaymentTransactionResponseDto {
  id: string;
  workspaceId: string;
  orderId: string | null;
  paymentMethod: PaymentMethod;
  gateway: PaymentGateway;
  amount: number | string;
  currency: string;
  status: PaymentTransactionStatus;
  transactionCode: string | null;
  accountNumber: string | null;
  bankCode: string | null;
  transferContent: string | null;
  qrUrl: string | null;
  rawWebhookPayload?: Record<string, any> | null;
  idempotencyKey: string;
  paidAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  order?: MatchedOrderSummaryDto | null;
}

export const listReconciliationTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.union([z.nativeEnum(PaymentTransactionStatus), z.literal('ALL')]).optional(),
  search: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type ListReconciliationTransactionsQueryDto = z.input<
  typeof listReconciliationTransactionsQuerySchema
>;
export type ListReconciliationTransactionsQueryOutput = z.output<
  typeof listReconciliationTransactionsQuerySchema
>;

export const reconciliationStatsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
export type ReconciliationStatsQueryDto = z.input<typeof reconciliationStatsQuerySchema>;
export type ReconciliationStatsQueryOutput = z.output<typeof reconciliationStatsQuerySchema>;

export const manualMatchTransactionSchema = z.object({
  orderId: z.string().uuid('Order ID không hợp lệ'),
});
export type ManualMatchTransactionDto = z.infer<typeof manualMatchTransactionSchema>;

export interface ReconciliationStatusStat {
  count: number;
  totalAmount: number;
}

export interface ReconciliationStatsResponseDto {
  reconciled: ReconciliationStatusStat;
  pending: ReconciliationStatusStat;
  failed: ReconciliationStatusStat;
}
