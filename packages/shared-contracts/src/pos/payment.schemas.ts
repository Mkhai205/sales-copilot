import { z } from 'zod';
import { PaymentGateway, PaymentMethod, PaymentTransactionStatus } from './pos-enums';

export const createPaymentTransactionSchema = z.object({
  orderId: z.string().uuid('Order ID không hợp lệ'),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.VIETQR),
  gateway: z.nativeEnum(PaymentGateway).default(PaymentGateway.MANUAL),
  amount: z.coerce.number().positive('Số tiền phải lớn hơn 0'),
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

export interface PaymentTransactionResponseDto {
  id: string;
  workspaceId: string;
  orderId: string;
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
}
