import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database';
import { InboxesModule } from '../modules/inboxes';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';
import { TelegramModule } from './telegram';

@Global()
@Module({
  imports: [DatabaseModule, InboxesModule, TelegramModule],
  providers: [ChannelAdapterRegistry, OutboundMessageListener],
  exports: [ChannelAdapterRegistry, OutboundMessageListener, TelegramModule],
})
export class IntegrationsModule {}
