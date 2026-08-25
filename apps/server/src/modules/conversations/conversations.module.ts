import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AutoAssignmentService } from './auto-assignment.service';
import { AutoAssignmentListener } from './auto-assignment.listener';

@Module({
  imports: [DatabaseModule, RedisModule, RealtimeModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, AutoAssignmentService, AutoAssignmentListener],
  exports: [ConversationsService, AutoAssignmentService],
})
export class ConversationsModule {}
