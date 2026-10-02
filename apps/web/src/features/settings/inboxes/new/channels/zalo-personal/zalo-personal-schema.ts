import { z } from 'zod';

/**
 * No secrets are entered by hand — the session id comes from the server-side QR
 * login flow. The form exists to gate the "Tiếp tục" action until the QR is scanned.
 */
export const zaloPersonalChannelSchema = z.object({
  name: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
  connectSessionId: z
    .string()
    .trim()
    .min(1, 'Vui lòng quét mã QR để đăng nhập tài khoản Zalo trước khi tiếp tục'),
});

export type ZaloPersonalFormValues = z.infer<typeof zaloPersonalChannelSchema>;
