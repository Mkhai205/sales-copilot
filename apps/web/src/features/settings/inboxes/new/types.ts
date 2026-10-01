import type { ChannelType } from '@sales-copilot/shared-contracts';

export type NewInboxStage = 'select_channel' | 'channel_flow' | 'collaborators' | 'success';

export type SupportedChannelKey = 'web_chat' | 'facebook' | 'telegram' | 'zalo' | 'zalo_personal';

export interface DraftChannelConfig {
  name: string;
  avatarUrl?: string;
  credentials: Record<string, unknown>;
  providerAccountId?: string;
  channelType: ChannelType;
}

export interface CreatedInboxItem {
  id: string;
  name: string;
  pageId?: string;
}

export interface CreatedInboxSummary {
  id: string;
  name: string;
  channelType: ChannelType;
  providerAccountId?: string | null;
  count?: number;
  avatarUrl?: string;
  connectedItems?: CreatedInboxItem[];
}
