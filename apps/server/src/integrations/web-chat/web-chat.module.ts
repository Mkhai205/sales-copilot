import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { InboxesModule } from '../../modules/inboxes';
import { ContactsModule } from '../../modules/contacts';
import { MessagesModule } from '../../modules/messages';
import { ConversationsModule } from '../../modules/conversations';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { WebChatAdapter } from './web-chat.adapter';
import { WebChatGateway } from './web-chat.gateway';
import { WidgetTokenService } from './widget-token.service';
import { WebChatController } from './web-chat.controller';

/**
 * Module providing Web Chat channel integration, visitor REST endpoints,
 * and real-time Socket.IO gateway on namespace /widget.
 */
@Module({
  imports: [
    DatabaseModule,
    InboxesModule,
    forwardRef(() => ContactsModule),
    forwardRef(() => MessagesModule),
    forwardRef(() => ConversationsModule),
  ],
  controllers: [WebChatController],
  providers: [WebChatAdapter, WebChatGateway, WidgetTokenService],
  exports: [WebChatAdapter, WebChatGateway, WidgetTokenService],
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
