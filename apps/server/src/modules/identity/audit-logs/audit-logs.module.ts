import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogService } from './audit-logs.service';

@Module({
  imports: [AuthModule, WorkspacesModule],
  controllers: [AuditLogsController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogsModule {}
