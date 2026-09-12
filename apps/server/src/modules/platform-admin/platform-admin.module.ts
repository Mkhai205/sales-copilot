import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { PlatformAuditLogsController } from './controllers/platform-audit-logs.controller';
import { PlatformMetricsController } from './controllers/platform-metrics.controller';
import { PlatformWorkspacesController } from './controllers/platform-workspaces.controller';
import { SystemSettingsController } from './controllers/system-settings.controller';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformAuditLogsService } from './services/platform-audit-logs.service';
import { PlatformMetricsService } from './services/platform-metrics.service';
import { PlatformWorkspacesService } from './services/platform-workspaces.service';
import { SystemSettingsService } from './services/system-settings.service';

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
    SystemSettingsService,
    PlatformWorkspacesService,
    PlatformAuditLogsService,
    PlatformMetricsService,
  ],
  exports: [
    PlatformRolesGuard,
    SystemSettingsService,
    PlatformWorkspacesService,
    PlatformAuditLogsService,
    PlatformMetricsService,
  ],
})
export class PlatformAdminModule {}
