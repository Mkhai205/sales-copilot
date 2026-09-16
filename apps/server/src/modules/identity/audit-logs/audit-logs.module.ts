import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WorkspacesModule } from '../workspaces';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogService } from './audit-logs.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [AuditLogsController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
