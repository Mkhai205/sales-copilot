import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../../infrastructure/database';
import { CHANNEL_INGESTION_QUEUE } from '../../../infrastructure/queue';
import { InboxesModule } from '../inboxes';
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { OutboundMessageListener } from './outbound-message.listener';
import { TelegramModule } from './telegram';
import { FacebookModule } from './facebook';
import { WebChatModule } from './web-chat';
import { WebhooksController, WebhooksService } from './channel-webhooks';

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
