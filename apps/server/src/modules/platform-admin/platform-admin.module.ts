import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { PlatformWorkspacesController } from './controllers/platform-workspaces.controller';
import { SystemSettingsController } from './controllers/system-settings.controller';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { PlatformWorkspacesService } from './services/platform-workspaces.service';
import { SystemSettingsService } from './services/system-settings.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [SystemSettingsController, PlatformWorkspacesController],
  providers: [PlatformRolesGuard, SystemSettingsService, PlatformWorkspacesService],
  exports: [PlatformRolesGuard, SystemSettingsService, PlatformWorkspacesService],
})
export class PlatformAdminModule {}
