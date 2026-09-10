import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { SystemSettingsController } from './controllers/system-settings.controller';
import { PlatformRolesGuard } from './guards/platform-roles.guard';
import { SystemSettingsService } from './services/system-settings.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [SystemSettingsController],
  providers: [PlatformRolesGuard, SystemSettingsService],
  exports: [PlatformRolesGuard, SystemSettingsService],
})
export class PlatformAdminModule {}
