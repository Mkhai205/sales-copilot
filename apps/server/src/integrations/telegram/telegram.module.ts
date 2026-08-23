import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { InboxesModule } from '../../modules/inboxes';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { TelegramAdapter } from './telegram.adapter';
import { TelegramLifecycleService } from './telegram.lifecycle';

@Module({
  imports: [DatabaseModule, InboxesModule],
  providers: [TelegramAdapter, TelegramLifecycleService],
  exports: [TelegramAdapter, TelegramLifecycleService],
})
export class TelegramModule implements OnModuleInit {
  constructor(
    private readonly adapter: TelegramAdapter,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this.adapter);
  }
}
