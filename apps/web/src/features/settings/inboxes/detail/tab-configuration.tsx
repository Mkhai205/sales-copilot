'use client';

import * as React from 'react';
import { ChannelType, type InboxDetailDto } from '@sales-copilot/shared-contracts';
import { WebChatConfig } from './channels/web-chat/web-chat-config';
import { FacebookConfig } from './channels/facebook/facebook-config';
import { TelegramConfig } from './channels/telegram/telegram-config';
import { ZaloConfig } from './channels/zalo/zalo-config';
import { UnsupportedChannelPlaceholder } from './channels/unsupported-channel-placeholder';

interface TabConfigurationProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug?: string;
}

export function TabConfiguration({ inbox, workspaceId, workspaceSlug }: TabConfigurationProps) {
  switch (inbox.channelType) {
    case ChannelType.WEB_CHAT:
      return (
        <WebChatConfig inbox={inbox} workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
      );

    case ChannelType.FACEBOOK_MESSENGER:
      return (
        <FacebookConfig inbox={inbox} workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
      );

    case ChannelType.TELEGRAM:
      return <TelegramConfig inbox={inbox} workspaceId={workspaceId} />;

    case ChannelType.ZALO:
      return <ZaloConfig inbox={inbox} workspaceId={workspaceId} />;

    default:
      return <UnsupportedChannelPlaceholder channelType={inbox.channelType} />;
  }
}
