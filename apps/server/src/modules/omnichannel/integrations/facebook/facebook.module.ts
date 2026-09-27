import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../../../infrastructure/database/database.module';
import { InboxesModule } from '../../inboxes/inboxes.module';
import { WorkspacesModule } from '../../../identity/workspaces/workspaces.module';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { FacebookAdapter } from './facebook.adapter';
import { FacebookController } from './facebook.controller';
import { FacebookLifecycleService } from './facebook.lifecycle';
import { FacebookService } from './facebook.service';

@Module({
  imports: [DatabaseModule, InboxesModule, WorkspacesModule],
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
