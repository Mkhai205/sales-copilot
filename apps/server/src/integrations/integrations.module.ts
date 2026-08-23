import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database';
import { InboxesModule } from '../modules/inboxes';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';

@Global()
@Module({
  imports: [DatabaseModule, InboxesModule],
  providers: [ChannelAdapterRegistry, OutboundMessageListener],
  exports: [ChannelAdapterRegistry, OutboundMessageListener],
})
export class IntegrationsModule {}
