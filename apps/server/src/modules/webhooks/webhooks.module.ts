import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../infrastructure/database';
import { InboxesModule } from '../inboxes';
import {
  CHANNEL_INGESTION_QUEUE,
  WEBHOOK_DELIVERY_QUEUE,
  WebhookDeliveryProcessor,
} from '../../infrastructure/queue';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';
import { WebhookDispatcherListener } from './webhook-dispatcher.listener';

@Module({
  imports: [
    DatabaseModule,
    InboxesModule,
    BullModule.registerQueue(
      {
        name: CHANNEL_INGESTION_QUEUE,
      },
      {
        name: WEBHOOK_DELIVERY_QUEUE,
      },
    ),
  ],
  controllers: [WebhooksController, WebhookSubscriptionsController],
  providers: [
    WebhooksService,
    WebhookSubscriptionsService,
    WebhookDispatcherListener,
    WebhookDeliveryProcessor,
  ],
  exports: [
    WebhooksService,
    WebhookSubscriptionsService,
    WebhookDispatcherListener,
    WebhookDeliveryProcessor,
  ],
})
export class WebhooksModule {}
