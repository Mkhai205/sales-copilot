import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { SystemSettingsService } from './system-settings.service';

/**
 * Cross-cutting system settings (feature flags, quotas) backed by Postgres
 * with a two-tier cache (memory + Redis). Global: consumed by omnichannel,
 * intelligence and platform-admin without importing any of their modules.
 */
@Global()
@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
