import { z } from 'zod';

export const zaloChannelSchema = z.object({
  oaSecretKey: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập OA Secret Key')
    .min(16, 'OA Secret Key không hợp lệ (tối thiểu 16 ký tự)'),
});

export type ZaloFormValues = z.infer<typeof zaloChannelSchema>;
