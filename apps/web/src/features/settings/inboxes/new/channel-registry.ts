import { ChannelType } from '@sales-copilot/shared-contracts';
import type { SupportedChannelKey } from './types';

export interface ChannelDefinition {
  key: SupportedChannelKey;
  type: ChannelType;
  title: string;
  description: string;
  badge?: string;
  logoSrc: string;
}

const CHANNEL_DEFINITIONS: Record<SupportedChannelKey, ChannelDefinition> = {
  web_chat: {
    key: 'web_chat',
    type: ChannelType.WEB_CHAT,
    title: 'Website Live Chat',
    description: 'Nhúng widget chat trực tiếp tương tác trên website hoặc gian hàng của bạn.',
    logoSrc: '/channels/website.png',
  },
  facebook: {
    key: 'facebook',
    type: ChannelType.FACEBOOK_MESSENGER,
    title: 'Facebook Messenger',
    description: 'Kết nối Fanpage qua OAuth 1-click để tiếp nhận và trả lời tin nhắn khách hàng.',
    badge: 'Phổ biến',
    logoSrc: '/channels/messenger.png',
  },
  telegram: {
    key: 'telegram',
    type: ChannelType.TELEGRAM,
    title: 'Telegram Bot',
    description: 'Kết nối Telegram Bot Token để xử lý tin nhắn khách hàng trực tiếp từ Telegram.',
    logoSrc: '/channels/telegram.png',
  },
  zalo: {
    key: 'zalo',
    type: ChannelType.ZALO,
    title: 'Zalo Official Account',
    description: 'Kết nối Zalo OA qua OAuth để tiếp nhận và trả lời tin nhắn khách hàng trên Zalo.',
    badge: 'Mới',
    logoSrc: '/channels/zalo.png',
  },
};

export const SUPPORTED_CHANNELS: ChannelDefinition[] = [
  CHANNEL_DEFINITIONS.web_chat,
  CHANNEL_DEFINITIONS.facebook,
  CHANNEL_DEFINITIONS.telegram,
  CHANNEL_DEFINITIONS.zalo,
];

export function getChannelDefinition(
  key: string | null | undefined,
): ChannelDefinition | undefined {
  if (!key) return undefined;
  return CHANNEL_DEFINITIONS[key as SupportedChannelKey];
}

export function isSupportedChannelKey(key: string | null | undefined): key is SupportedChannelKey {
  return Boolean(key && Object.prototype.hasOwnProperty.call(CHANNEL_DEFINITIONS, key));
}
