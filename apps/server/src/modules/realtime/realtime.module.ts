import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { AuthModule } from '../identity/auth';
import { WorkspacesModule } from '../identity/workspaces/workspaces.module';
import { CommercePresenceModule } from '../commerce/presence/commerce-presence.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEventDispatcher } from './realtime-event.dispatcher';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

@Module({
  imports: [AuthModule, DatabaseModule, RedisModule, WorkspacesModule, CommercePresenceModule],

  controllers: [PresenceController],
  providers: [RealtimeGateway, RealtimeEventDispatcher, PresenceService],
  exports: [RealtimeGateway, RealtimeEventDispatcher, PresenceService],
})
export class RealtimeModule {}
