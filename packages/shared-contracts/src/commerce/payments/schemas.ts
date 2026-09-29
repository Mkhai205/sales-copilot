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

export interface WorkspacePaymentSettings {
  bankBin: string; // NAPAS BIN code (e.g. "970422" for MBBank)
  bankCode?: string; // Bank short code (e.g. "MB", "VCB")
  bankName?: string; // Bank display name (e.g. "MBBank")
  accountNumber: string; // Beneficiary account number
  accountName: string; // Beneficiary name (unaccented, uppercase)
  webhookSecret?: string; // AES-256-GCM encrypted webhook secret
}

export const workspacePaymentSettingsSchema = z.object({
  bankBin: z.string().min(1, 'Mã ngân hàng (BIN) không được để trống'),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().min(1, 'Số tài khoản không được để trống'),
  accountName: z.string().min(1, 'Tên chủ tài khoản không được để trống'),
  webhookSecret: z.string().optional(),
});

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

export const generateVietQrSchema = z.object({
  bankBin: z.string().trim().optional(),
  bankCode: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  accountName: z.string().trim().optional(),
  memo: z.string().trim().optional(),
  sendToChat: z.boolean().optional().default(true),
});

export type GenerateVietQrDto = z.input<typeof generateVietQrSchema>;

export const vietQrResponseSchema = z.object({
  qrPayload: z.string(),
  qrUrl: z.string(),
  bankBin: z.string(),
  bankCode: z.string().optional(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountName: z.string(),
  amount: z.number(),
  memo: z.string(),
  displayId: z.number(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  transferContent: z.string().optional(),
  conversationId: z.string().nullish(),
});

export type VietQrResponseDto = z.infer<typeof vietQrResponseSchema>;
