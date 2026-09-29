import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../../../infrastructure/database/database.module';
import { ContactsModule } from '../../contacts/contacts.module';
import { ConversationsModule } from '../../conversations/conversations.module';
import { InboxesModule } from '../../inboxes/inboxes.module';
import { MessagesModule } from '../../messages/messages.module';
import { WorkspacesModule } from '../../../identity/workspaces/workspaces.module';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { ChannelWebhooksModule } from '../channel-webhooks/channel-webhooks.module';
import { FacebookAdapter } from './facebook.adapter';
import { FacebookController } from './facebook.controller';
import { FacebookLifecycleService } from './facebook.lifecycle';
import { FacebookService } from './facebook.service';
import { CommentGuardProcessor } from './comment-guard.processor';

@Module({
  imports: [
    DatabaseModule,
    ContactsModule,
    ConversationsModule,
    InboxesModule,
    MessagesModule,
    WorkspacesModule,
    ChannelWebhooksModule,
  ],
  controllers: [FacebookController],
  providers: [FacebookAdapter, FacebookLifecycleService, FacebookService, CommentGuardProcessor],
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
