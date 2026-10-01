import { Module, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../../../infrastructure/database/database.module';
import { InboxesModule } from '../../inboxes/inboxes.module';
import { WorkspacesModule } from '../../../identity/workspaces/workspaces.module';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { ZaloOaAdapter } from './zalo.adapter';
import { ZaloOaTokenService } from './zalo-oa-token.service';
import { ZaloOaService } from './zalo-oa.service';
import { ZaloOaController } from './zalo-oa.controller';
import { ZaloLifecycleService } from './zalo.lifecycle';

@Module({
  imports: [DatabaseModule, InboxesModule, WorkspacesModule],
  controllers: [ZaloOaController],
  providers: [ZaloOaAdapter, ZaloOaTokenService, ZaloOaService, ZaloLifecycleService],
  exports: [ZaloOaAdapter, ZaloOaTokenService, ZaloOaService, ZaloLifecycleService],
})
export class ZaloModule implements OnModuleInit {
  constructor(
    private readonly adapter: ZaloOaAdapter,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  onModuleInit() {
    this.registry.register(this.adapter);
  }
}
