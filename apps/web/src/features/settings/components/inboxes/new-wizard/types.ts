import { ChannelType } from '@sales-copilot/shared-contracts';

export interface CreatedResult {
  id: string;
  name: string;
  channelType: ChannelType;
  providerAccountId?: string | null;
  count?: number;
}

export interface ChannelCardItem {
  type: ChannelType;
  key: string;
  title: string;
  description: string;
  badge?: string;
  logoSrc: string;
}

export const CHANNEL_CARDS: ChannelCardItem[] = [
  {
    type: ChannelType.FACEBOOK_MESSENGER,
    key: 'facebook',
    title: 'Facebook Messenger',
    description: 'Kết nối Fanpage qua OAuth 1-click để tiếp nhận và trả lời tin nhắn khách hàng.',
    badge: 'Phổ biến tại VN',
    logoSrc: '/channels/messenger.png',
  },
  {
    type: ChannelType.ZALO,
    key: 'zalo',
    title: 'Zalo Official Account',
    description: 'Tiếp cận khách hàng Việt Nam qua tích hợp Zalo OA bằng OA ID và Secret Key.',
    badge: 'Phổ biến tại VN',
    logoSrc: '/channels/zalo.png',
  },
  {
    type: ChannelType.WEB_CHAT,
    key: 'web_chat',
    title: 'Website Live Chat',
    description: 'Nhúng widget chat trực tiếp tương tác trên website hoặc gian hàng của bạn.',
    logoSrc: '/channels/website.png',
  },
  {
    type: ChannelType.TELEGRAM,
    key: 'telegram',
    title: 'Telegram Bot',
    description: 'Kết nối Telegram Bot Token để xử lý tin nhắn khách hàng trực tiếp từ Telegram.',
    logoSrc: '/channels/telegram.png',
  },
  {
    type: ChannelType.EMAIL,
    key: 'email',
    title: 'Hỗ trợ qua Email',
    description: 'Kết nối hòm thư dùng chung qua SMTP / IMAP để xử lý email dưới dạng hội thoại.',
    logoSrc: '/channels/email.png',
  },
];
