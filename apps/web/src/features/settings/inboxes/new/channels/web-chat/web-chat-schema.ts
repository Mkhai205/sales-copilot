import { z } from 'zod';

export const webChatChannelSchema = z.object({
  name: z.string().trim().max(100, 'Tên hộp thư không được vượt quá 100 ký tự').optional(),
  avatarUrl: z.string().trim().optional(),
  websiteUrl: z
    .string()
    .trim()
    .refine(
      val =>
        !val ||
        /^https?:\/\/.+/i.test(val) ||
        /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?/i.test(val) ||
        /^localhost(:\d+)?$/i.test(val),
      { message: 'Vui lòng nhập định dạng website hoặc URL hợp lệ (ví dụ: https://myshop.vn)' },
    )
    .optional(),
});

export type WebChatFormValues = z.infer<typeof webChatChannelSchema>;
