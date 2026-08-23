import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { InboxesModule } from '../../modules/inboxes';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { FacebookAdapter } from './facebook.adapter';
import { FacebookLifecycleService } from './facebook.lifecycle';

@Module({
  imports: [DatabaseModule, InboxesModule],
  providers: [FacebookAdapter, FacebookLifecycleService],
  exports: [FacebookAdapter, FacebookLifecycleService],
})
export class FacebookModule implements OnModuleInit {
  constructor(
    private readonly adapter: FacebookAdapter,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this.adapter);
  }
}
