import { z } from 'zod';

// ─── Connect Pages Batch ──────────────────────────────────────────────────────

export const connectFacebookPagesBatchSchema = z.object({
  pageIds: z.array(z.string().min(1)).min(1, 'At least one page must be selected'),
  sessionId: z.string().min(1, 'OAuth session ID is required'),
  memberUserIds: z.array(z.string()).optional(),
  assignAllMembers: z.boolean().optional().default(true),
});

export type ConnectFacebookPagesBatchDto = z.infer<typeof connectFacebookPagesBatchSchema>;

// ─── Facebook Page Info (Response type) ────────────────────────────────────────

export interface FacebookPageInfo {
  pageId: string;
  pageName: string;
  avatarUrl?: string;
  category?: string;
  isAlreadyConnected: boolean;
}
