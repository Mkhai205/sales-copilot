import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { InboxesModule } from '../../omnichannel/inboxes/inboxes.module';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentWebhooksGuard } from './payment-webhooks.guard';

@Module({
  imports: [DatabaseModule, InboxesModule],
  controllers: [PaymentWebhooksController],
  providers: [PaymentWebhooksGuard],
  exports: [PaymentWebhooksGuard],
})
export class PaymentWebhooksModule {}
