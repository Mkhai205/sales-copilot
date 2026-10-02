import { z } from 'zod';

export const connectZaloPersonalSchema = z.object({
  /** QR connect session id — the session must be in `connected` state. */
  sessionId: z.string().trim().min(1, 'Phiên quét mã QR không hợp lệ'),
  name: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
  memberUserIds: z.array(z.string()).optional(),
  assignAllMembers: z.boolean().optional(),
});

export type ConnectZaloPersonalDto = z.infer<typeof connectZaloPersonalSchema>;

export const completeZaloPersonalReauthorizeSchema = z.object({
  sessionId: z.string().trim().min(1, 'Phiên quét mã QR không hợp lệ'),
});

export type CompleteZaloPersonalReauthorizeDto = z.infer<
  typeof completeZaloPersonalReauthorizeSchema
>;
