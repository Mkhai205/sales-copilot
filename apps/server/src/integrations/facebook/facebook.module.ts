import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { InboxesModule } from '../../modules/inboxes';
import { WorkspacesModule } from '../../modules/workspaces';
import { WebhooksModule } from '../../modules/webhooks/webhooks.module';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { FacebookAdapter } from './facebook.adapter';
import { FacebookController } from './facebook.controller';
import { FacebookLifecycleService } from './facebook.lifecycle';
import { FacebookService } from './facebook.service';

@Module({
  imports: [DatabaseModule, InboxesModule, WorkspacesModule, forwardRef(() => WebhooksModule)],
  controllers: [FacebookController],
  providers: [FacebookAdapter, FacebookLifecycleService, FacebookService],
  exports: [FacebookAdapter, FacebookLifecycleService, FacebookService],
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
