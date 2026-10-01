import { z } from 'zod';

export const connectZaloOaSchema = z.object({
  /** OAuth session id returned to the frontend after the Zalo callback redirect. */
  sessionId: z.string().trim().min(1, 'Phiên ủy quyền Zalo không hợp lệ'),
  /**
   * OA Secret Key copied from the OA Console webhook settings — required for the
   * `X-ZEvent-Signature` MAC verification. Optional on reauthorize (reuses the stored one).
   */
  oaSecretKey: z.string().trim().min(1, 'Vui lòng nhập OA Secret Key').optional(),
  memberUserIds: z.array(z.string()).optional(),
  assignAllMembers: z.boolean().optional(),
});

export type ConnectZaloOaDto = z.infer<typeof connectZaloOaSchema>;
