import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { TeamsModule } from './teams/teams.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [AuthModule, WorkspacesModule, TeamsModule, AuditLogsModule],
  exports: [AuthModule, WorkspacesModule, TeamsModule, AuditLogsModule],
})
export class IdentityModule {}
