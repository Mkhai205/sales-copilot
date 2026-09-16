import { z } from 'zod';

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
});

export type VietQrResponseDto = z.infer<typeof vietQrResponseSchema>;

export const vietQrPayloadResponseSchema = vietQrResponseSchema;
export type VietQrPayloadResponseDto = VietQrResponseDto;
