import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../auth';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventDispatcher } from './realtime-event.dispatcher';

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [RealtimeGateway, RealtimeEventDispatcher],
  exports: [RealtimeGateway, RealtimeEventDispatcher],
})
export class RealtimeModule {}
