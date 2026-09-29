export const ChannelType = {
  FACEBOOK_MESSENGER: 'FACEBOOK_MESSENGER',
  ZALO: 'ZALO',
  TELEGRAM: 'TELEGRAM',
  EMAIL: 'EMAIL',
  WEB_CHAT: 'WEB_CHAT',
} as const;

export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];
