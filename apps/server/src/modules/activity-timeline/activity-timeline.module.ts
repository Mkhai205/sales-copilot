import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { ActivityTimelineController } from './activity-timeline.controller';
import { ActivityTimelineService } from './activity-timeline.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [ActivityTimelineController],
  providers: [ActivityTimelineService],
  exports: [ActivityTimelineService],
})
export class ActivityTimelineModule {}
