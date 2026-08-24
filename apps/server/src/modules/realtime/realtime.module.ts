import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../auth';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [AuthModule, DatabaseModule],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
