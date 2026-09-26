'use client';

import * as React from 'react';
import { useNewInbox } from '../context/new-inbox-context';
import { WebChatFlow } from './web-chat/web-chat-flow';
import { FacebookFlow } from './facebook/facebook-flow';
import { TelegramFlow } from './telegram/telegram-flow';

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
    default:
      return null;
  }
}
