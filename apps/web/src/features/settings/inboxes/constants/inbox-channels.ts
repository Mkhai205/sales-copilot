import { ChannelType } from '@sales-copilot/shared-contracts';

export interface ChannelTypeMeta {
  type: ChannelType;
  key: string;
  title: string;
  description: string;
  badge?: string;
  logoSrc: string;
  disabled?: boolean;
}

export const CHANNEL_METADATA: ChannelTypeMeta[] = [
  {
    type: ChannelType.WEB_CHAT,
    key: 'web_chat',
    title: 'Website Live Chat',
    description: 'Nhúng widget chat trực tiếp tương tác trên website hoặc gian hàng của bạn.',
    logoSrc: '/channels/website.png',
  },
  {
    type: ChannelType.FACEBOOK_MESSENGER,
    key: 'facebook',
    title: 'Facebook Messenger',
    description: 'Kết nối Fanpage qua OAuth 1-click để tiếp nhận và trả lời tin nhắn khách hàng.',
    badge: 'Phổ biến',
    logoSrc: '/channels/messenger.png',
  },
  {
    type: ChannelType.TELEGRAM,
    key: 'telegram',
    title: 'Telegram Bot',
    description: 'Kết nối Telegram Bot Token để xử lý tin nhắn khách hàng trực tiếp từ Telegram.',
    logoSrc: '/channels/telegram.png',
  },
];
