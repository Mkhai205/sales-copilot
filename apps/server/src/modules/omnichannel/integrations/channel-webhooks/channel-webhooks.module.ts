import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../../infrastructure/database/database.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Hosts the unified channel webhook ingestion REST surface. FacebookModule
 * imports it (FacebookController delegates to WebhooksService), which is why
 * it lives outside IntegrationsModule — hosting WebhooksService there would
 * force a module cycle IntegrationsModule -> FacebookModule -> IntegrationsModule.
 * ChannelAdapterRegistry arrives from @Global IntegrationsModule.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class ChannelWebhooksModule {}
