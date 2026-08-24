import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../auth';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventDispatcher } from './realtime-event.dispatcher';
import { PresenceService } from './presence.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [RealtimeGateway, RealtimeEventDispatcher, PresenceService],
  exports: [RealtimeGateway, RealtimeEventDispatcher, PresenceService],
})
export class RealtimeModule {}
