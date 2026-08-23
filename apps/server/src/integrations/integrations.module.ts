import { Global, Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database';
import { InboxesModule } from '../modules/inboxes';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';
import { TelegramAdapter, TelegramLifecycleService } from './telegram';

@Global()
@Module({
  imports: [DatabaseModule, InboxesModule],
  providers: [
    ChannelAdapterRegistry,
    OutboundMessageListener,
    TelegramAdapter,
    TelegramLifecycleService,
  ],
  exports: [
    ChannelAdapterRegistry,
    OutboundMessageListener,
    TelegramAdapter,
    TelegramLifecycleService,
  ],
})
export class IntegrationsModule implements OnModuleInit {
  constructor(
    private readonly registry: ChannelAdapterRegistry,
    private readonly telegramAdapter: TelegramAdapter,
  ) {}

  onModuleInit() {
    this.registry.register(this.telegramAdapter);
  }
}
