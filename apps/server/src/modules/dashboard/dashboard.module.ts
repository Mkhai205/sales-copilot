import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { AuthModule } from '../identity/auth';
import { WorkspacesModule } from '../identity/workspaces';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DatabaseModule, AuthModule, WorkspacesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
