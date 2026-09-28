import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../../../../infrastructure/database/database.module';
import { InboxesModule } from '../../inboxes/inboxes.module';
import { ContactsModule } from '../../contacts/contacts.module';
import { MessagesModule } from '../../messages/messages.module';
import { ConversationsModule } from '../../conversations/conversations.module';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { WebChatAdapter } from './web-chat.adapter';
import { WebChatGateway } from './web-chat.gateway';
import { WidgetTokenService } from './widget-token.service';
import { WebChatController } from './web-chat.controller';
import { WebChatService } from './web-chat.service';

/**
 * Module providing Web Chat channel integration, visitor REST endpoints,
 * and real-time Socket.IO gateway on namespace /widget.
 */
@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({}),
    InboxesModule,
    forwardRef(() => ContactsModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => ConversationsModule),
  ],
  controllers: [WebChatController],
  providers: [WebChatAdapter, WebChatGateway, WidgetTokenService, WebChatService],
  exports: [WebChatAdapter, WebChatGateway, WidgetTokenService, WebChatService],
})
export class WebChatModule implements OnModuleInit {
  constructor(
    private readonly adapter: WebChatAdapter,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this.adapter);
  }
}
