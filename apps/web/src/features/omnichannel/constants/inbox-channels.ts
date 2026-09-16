import { ChannelType } from '@sales-copilot/shared-contracts';

export interface ChannelTypeMeta {
  type: ChannelType;
  title: string;
  description: string;
}

export const SUPPORTED_CHANNELS: ChannelTypeMeta[] = [
  {
    type: ChannelType.WEB_CHAT,
    title: 'Website Live Chat',
    description: 'Embed a customizable live chat widget on your website to chat with visitors.',
  },
  {
    type: ChannelType.FACEBOOK_MESSENGER,
    title: 'Facebook Messenger',
    description: 'Connect your Facebook Business Page to reply to direct customer messages.',
  },
  {
    type: ChannelType.TELEGRAM,
    title: 'Telegram Bot',
    description: 'Connect a Telegram Bot token to receive and respond to chats via Telegram.',
  },
  {
    type: ChannelType.EMAIL,
    title: 'Email Support',
    description:
      'Connect via SMTP/IMAP to convert incoming customer emails into conversation tickets.',
  },
  {
    type: ChannelType.ZALO,
    title: 'Zalo OA',
    description: 'Integrate your Zalo Official Account to chat with customers in Vietnam.',
  },
];
