import { Module } from '@nestjs/common';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { CommercePresenceService } from './commerce-presence.service';

@Module({
  imports: [RedisModule],
  providers: [CommercePresenceService],
  exports: [CommercePresenceService],
})
export class CommercePresenceModule {}
