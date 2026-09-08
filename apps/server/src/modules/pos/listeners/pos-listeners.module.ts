import { Module } from '@nestjs/common';
import { MessagesModule } from '../../messages/messages.module';
import { OpportunitiesModule } from '../../opportunities/opportunities.module';
import { PosEventListener } from './pos-event.listener';

@Module({
  imports: [MessagesModule, OpportunitiesModule],
  providers: [PosEventListener],
  exports: [PosEventListener],
})
export class PosListenersModule {}
