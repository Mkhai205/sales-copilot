import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { InboxesModule } from '../inboxes/inboxes.module';
import { MessagesModule } from '../messages/messages.module';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';
import { OutboundDeliveryProcessor } from './outbound-delivery.processor';
import { ChannelIngestionProcessor } from './channel-ingestion.processor';
import { ChannelWebhooksModule } from './channel-webhooks/channel-webhooks.module';
import { TelegramModule } from './telegram/telegram.module';
import { FacebookModule } from './facebook/facebook.module';
import { ZaloModule } from './zalo/zalo.module';
import { ZaloPersonalModule } from './zalo-personal/zalo-personal.module';
import { WebChatModule } from './web-chat/web-chat.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    ContactsModule,
    ConversationsModule,
    InboxesModule,
    MessagesModule,
    ChannelWebhooksModule,
    TelegramModule,
    FacebookModule,
    ZaloModule,
    ZaloPersonalModule,
    WebChatModule,
  ],
  providers: [
    ChannelAdapterRegistry,
    OutboundMessageListener,
    OutboundDeliveryProcessor,
    ChannelIngestionProcessor,
  ],
  exports: [
    ChannelAdapterRegistry,
    OutboundMessageListener,
    ChannelWebhooksModule,
    TelegramModule,
    FacebookModule,
    ZaloModule,
    ZaloPersonalModule,
    WebChatModule,
  ],
})
export class IntegrationsModule {}
