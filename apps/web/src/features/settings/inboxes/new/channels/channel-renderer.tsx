'use client';

import * as React from 'react';
import { useNewInbox } from '../context/new-inbox-context';
import { WebChatFlow } from './web-chat/web-chat-flow';
import { FacebookFlow } from './facebook/facebook-flow';
import { TelegramFlow } from './telegram/telegram-flow';
import { ZaloFlow } from './zalo/zalo-flow';
import { ZaloPersonalFlow } from './zalo-personal/zalo-personal-flow';

export function ChannelRenderer() {
  const { selectedChannelKey, selectedChannel } = useNewInbox();

  if (!selectedChannelKey || !selectedChannel) {
    return null;
  }

  switch (selectedChannelKey) {
    case 'web_chat':
      return <WebChatFlow channel={selectedChannel} />;
    case 'facebook':
      return <FacebookFlow channel={selectedChannel} />;
    case 'telegram':
      return <TelegramFlow channel={selectedChannel} />;
    case 'zalo':
      return <ZaloFlow channel={selectedChannel} />;
    case 'zalo_personal':
      return <ZaloPersonalFlow channel={selectedChannel} />;
    default:
      return null;
  }
}
