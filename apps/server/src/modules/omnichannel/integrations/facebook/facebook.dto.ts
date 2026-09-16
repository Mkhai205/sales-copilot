import { z } from 'zod';

// ─── OAuth Callback ────────────────────────────────────────────────────────────

export const facebookCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'CSRF state token is required'),
});

export type FacebookCallbackQuery = z.infer<typeof facebookCallbackQuerySchema>;

export const connectFacebookPageSchema = z.object({
  pageId: z.string().min(1, 'Page ID is required'),
  pageName: z.string().min(1, 'Page name is required'),
  pageAccessToken: z.string().min(1, 'Page Access Token is required').optional(),
  userAccessToken: z.string().min(1, 'User Access Token is required').optional(),
  inboxName: z.string().min(1).max(100).optional(),
  memberUserIds: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
});

export type ConnectFacebookPageDto = z.infer<typeof connectFacebookPageSchema>;

// ─── Connect Pages Batch ──────────────────────────────────────────────────────

export const connectFacebookPagesBatchSchema = z.object({
  pageIds: z.array(z.string().min(1)).min(1, 'At least one page must be selected'),
  sessionId: z.string().min(1, 'OAuth session ID is required'),
  memberUserIds: z.array(z.string()).optional(),
  assignAllMembers: z.boolean().optional().default(true),
});

export type ConnectFacebookPagesBatchDto = z.infer<typeof connectFacebookPagesBatchSchema>;

// ─── Disconnect Page ───────────────────────────────────────────────────────────

export const disconnectFacebookPageSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
});

export type DisconnectFacebookPageDto = z.infer<typeof disconnectFacebookPageSchema>;

// ─── Reauthorize ───────────────────────────────────────────────────────────────

export const reauthorizeFacebookSchema = z.object({
  channelId: z.string().uuid('Invalid channel ID'),
  omniAuthToken: z.string().min(1, 'OAuth token is required'),
});

export type ReauthorizeFacebookDto = z.infer<typeof reauthorizeFacebookSchema>;

// ─── Facebook Page Info (Response type) ────────────────────────────────────────

export interface FacebookPageInfo {
  pageId: string;
  pageName: string;
  avatarUrl?: string;
  category?: string;
  isAlreadyConnected: boolean;
}
