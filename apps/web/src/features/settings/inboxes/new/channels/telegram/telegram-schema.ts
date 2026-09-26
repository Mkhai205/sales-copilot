import { z } from 'zod';

export const telegramChannelSchema = z.object({
  name: z.string().trim().max(100, 'Tên hộp thư không được vượt quá 100 ký tự').optional(),
  avatarUrl: z.string().trim().optional(),
  botToken: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập Telegram Bot Token')
    .regex(
      /^\d+:[A-Za-z0-9_-]+$/,
      'Định dạng Telegram Bot Token không hợp lệ (ví dụ: 123456:ABC-DEF...)',
    ),
});

export type TelegramFormValues = z.infer<typeof telegramChannelSchema>;
