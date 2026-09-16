import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { AuthModule } from '../../identity/auth';
import { InboxesModule } from '../../omnichannel/inboxes/inboxes.module';
import { WorkspacesModule } from '../../identity/workspaces';
import { CustomCarrierAdapter } from './adapters/custom.adapter';
import { GhnCarrierAdapter } from './adapters/ghn.adapter';
import { GhtkCarrierAdapter } from './adapters/ghtk.adapter';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule, InboxesModule],
  controllers: [ShippingController],
  providers: [CustomCarrierAdapter, GhtkCarrierAdapter, GhnCarrierAdapter, ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
