export const ChannelType = {
  FACEBOOK_MESSENGER: 'FACEBOOK_MESSENGER',
  ZALO: 'ZALO',
  ZALO_PERSONAL: 'ZALO_PERSONAL',
  TELEGRAM: 'TELEGRAM',
  EMAIL: 'EMAIL',
  WEB_CHAT: 'WEB_CHAT',
} as const;

export type ChannelType = (typeof ChannelType)[keyof typeof ChannelType];
