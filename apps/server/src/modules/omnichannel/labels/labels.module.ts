import { Module } from '@nestjs/common';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
