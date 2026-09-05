import { ChannelType } from '@sales-copilot/shared-contracts';

export interface ChannelMeta {
  type: ChannelType;
  label: string;
  iconSrc: string;
  color: string;
  badgeBg: string;
  description: string;
}

export const CHANNEL_META_MAP: Record<ChannelType, ChannelMeta> = {
  [ChannelType.WEB_CHAT]: {
    type: ChannelType.WEB_CHAT,
    label: 'Live Chat',
    iconSrc: '/channels/website.png',
    color: 'text-emerald-500',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    description: 'Embed a customizable live chat widget on your website to chat with visitors.',
  },
  [ChannelType.FACEBOOK_MESSENGER]: {
    type: ChannelType.FACEBOOK_MESSENGER,
    label: 'Facebook Messenger',
    iconSrc: '/channels/messenger.png',
    color: 'text-blue-500',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
    description: 'Connect your Facebook Business Page to reply to direct customer messages.',
  },
  [ChannelType.TELEGRAM]: {
    type: ChannelType.TELEGRAM,
    label: 'Telegram Bot',
    iconSrc: '/channels/telegram.png',
    color: 'text-sky-500',
    badgeBg: 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400',
    description: 'Connect a Telegram Bot token to receive and respond to chats via Telegram.',
  },
  [ChannelType.EMAIL]: {
    type: ChannelType.EMAIL,
    label: 'Email Support',
    iconSrc: '/channels/email.png',
    color: 'text-amber-500',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    description:
      'Connect via SMTP/IMAP to convert incoming customer emails into conversation tickets.',
  },
  [ChannelType.ZALO]: {
    type: ChannelType.ZALO,
    label: 'Zalo OA',
    iconSrc: '/channels/zalo.png',
    color: 'text-blue-600',
    badgeBg: 'bg-blue-600/10 border-blue-600/20 text-blue-700 dark:text-blue-300',
    description: 'Integrate your Zalo Official Account to chat with customers in Vietnam.',
  },
};

export function getChannelMeta(channelType?: ChannelType | string | null): ChannelMeta {
  if (channelType && channelType in CHANNEL_META_MAP) {
    return CHANNEL_META_MAP[channelType as ChannelType];
  }
  return CHANNEL_META_MAP[ChannelType.WEB_CHAT];
}
