import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { PlatformAuditLogsController } from './audit-logs/platform-audit-logs.controller';
import { PlatformMetricsController } from './metrics/platform-metrics.controller';
import { PlatformWorkspacesController } from './workspaces/platform-workspaces.controller';
import { SystemSettingsController } from './settings/system-settings.controller';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformAuditLogsService } from './audit-logs/platform-audit-logs.service';
import { PlatformMetricsService } from './metrics/platform-metrics.service';
import { PlatformWorkspacesService } from './workspaces/platform-workspaces.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [
    SystemSettingsController,
    PlatformWorkspacesController,
    PlatformAuditLogsController,
    PlatformMetricsController,
  ],
  providers: [
    PlatformRolesGuard,
    PlatformWorkspacesService,
    PlatformAuditLogsService,
    PlatformMetricsService,
  ],
  exports: [
    PlatformRolesGuard,
    PlatformWorkspacesService,
    PlatformAuditLogsService,
    PlatformMetricsService,
  ],
})
export class PlatformAdminModule {}
