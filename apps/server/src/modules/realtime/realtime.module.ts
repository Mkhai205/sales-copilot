import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { AuthModule } from '../auth';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventDispatcher } from './realtime-event.dispatcher';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

@Module({
  imports: [AuthModule, DatabaseModule, RedisModule],
  controllers: [PresenceController],
  providers: [RealtimeGateway, RealtimeEventDispatcher, PresenceService],
  exports: [RealtimeGateway, RealtimeEventDispatcher, PresenceService],
})
export class RealtimeModule {}
