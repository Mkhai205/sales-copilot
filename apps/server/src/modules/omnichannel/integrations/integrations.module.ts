import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { CHANNEL_INGESTION_QUEUE } from '../../../infrastructure/queue/queue.module';
import { InboxesModule } from '../inboxes/inboxes.module';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';
import { TelegramModule } from './telegram/telegram.module';
import { FacebookModule } from './facebook/facebook.module';
import { WebChatModule } from './web-chat/web-chat.module';
import { WebhooksController } from './channel-webhooks/webhooks.controller';
import { WebhooksService } from './channel-webhooks/webhooks.service';

@Global()
@Module({
  imports: [
    DatabaseModule,
    InboxesModule,
    TelegramModule,
    FacebookModule,
    WebChatModule,
    BullModule.registerQueue({
      name: CHANNEL_INGESTION_QUEUE,
    }),
  ],
  controllers: [WebhooksController],
  providers: [ChannelAdapterRegistry, OutboundMessageListener, WebhooksService],
  exports: [
    ChannelAdapterRegistry,
    OutboundMessageListener,
    TelegramModule,
    FacebookModule,
    WebChatModule,
    WebhooksService,
  ],
})
export class IntegrationsModule {}
