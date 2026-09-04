import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { AuthModule } from '../auth';
import { RealtimeModule } from '../realtime/realtime.module';
import { WorkspacesModule } from '../workspaces';
import { ConversationsController } from './conversations.controller';
import { LinkPreviewController } from './link-preview.controller';
import { ConversationsService } from './conversations.service';
import { AutoAssignmentService } from './auto-assignment.service';
import { AutoAssignmentListener } from './auto-assignment.listener';
import { LinkPreviewService } from './link-preview.service';

@Module({
  imports: [DatabaseModule, RedisModule, RealtimeModule, AuthModule, WorkspacesModule],
  controllers: [LinkPreviewController, ConversationsController],
  providers: [
    ConversationsService,
    AutoAssignmentService,
    AutoAssignmentListener,
    LinkPreviewService,
  ],
  exports: [ConversationsService, AutoAssignmentService, LinkPreviewService],
})
export class ConversationsModule {}
