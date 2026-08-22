import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../infrastructure/database';
import { InboxesModule } from '../inboxes';
import { CHANNEL_INGESTION_QUEUE } from '../../infrastructure/queue';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [
    DatabaseModule,
    InboxesModule,
    BullModule.registerQueue({
      name: CHANNEL_INGESTION_QUEUE,
    }),
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
