import { Module } from '@nestjs/common';
import { PlatformRolesGuard } from './guards/platform-roles.guard';

@Module({
  providers: [PlatformRolesGuard],
  exports: [PlatformRolesGuard],
})
export class PlatformAdminModule {}
