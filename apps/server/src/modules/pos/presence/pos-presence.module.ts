import { Module } from '@nestjs/common';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { PosPresenceService } from './pos-presence.service';

@Module({
  imports: [RedisModule],
  providers: [PosPresenceService],
  exports: [PosPresenceService],
})
export class PosPresenceModule {}
