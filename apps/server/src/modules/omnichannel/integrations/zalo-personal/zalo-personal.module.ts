import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../../../infrastructure/database/database.module';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { ChannelWebhooksModule } from '../channel-webhooks/channel-webhooks.module';
import { MessagesModule } from '../../messages/messages.module';
import { WorkspacesModule } from '../../../identity/workspaces/workspaces.module';
import { ZaloPersonalAdapter } from './zalo-personal.adapter';
import { ZaloPersonalClientProvider } from './zalo-personal-client.provider';
import { ZaloPersonalConnectionService } from './zalo-personal-connection.service';
import { ZaloPersonalController } from './zalo-personal.controller';
import { ZaloPersonalRateLimiterService } from './zalo-personal-rate-limiter.service';

@Module({
  imports: [DatabaseModule, ChannelWebhooksModule, MessagesModule, WorkspacesModule],
  controllers: [ZaloPersonalController],
  providers: [
    ZaloPersonalAdapter,
    ZaloPersonalClientProvider,
    ZaloPersonalConnectionService,
    ZaloPersonalRateLimiterService,
  ],
  exports: [ZaloPersonalAdapter, ZaloPersonalConnectionService],
})
export class ZaloPersonalModule implements OnModuleInit {
  constructor(
    private readonly adapter: ZaloPersonalAdapter,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this.adapter);
  }
}
