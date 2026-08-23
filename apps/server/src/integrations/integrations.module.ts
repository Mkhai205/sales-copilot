import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database';
import { InboxesModule } from '../modules/inboxes';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';
import { TelegramModule } from './telegram';
import { FacebookModule } from './facebook';
import { WebChatModule } from './web-chat';

@Global()
@Module({
  imports: [DatabaseModule, InboxesModule, TelegramModule, FacebookModule, WebChatModule],
  providers: [ChannelAdapterRegistry, OutboundMessageListener],
  exports: [
    ChannelAdapterRegistry,
    OutboundMessageListener,
    TelegramModule,
    FacebookModule,
    WebChatModule,
  ],
})
export class IntegrationsModule {}
