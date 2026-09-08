import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { POS_RECONCILIATION_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { InboxesModule } from '../../inboxes/inboxes.module';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentWebhooksGuard } from './payment-webhooks.guard';

@Module({
  imports: [
    DatabaseModule,
    InboxesModule,
    BullModule.registerQueue({
      name: POS_RECONCILIATION_QUEUE,
    }),
  ],
  controllers: [PaymentWebhooksController],
  providers: [PaymentWebhooksGuard],
  exports: [BullModule, PaymentWebhooksGuard],
})
export class PaymentWebhooksModule {}
