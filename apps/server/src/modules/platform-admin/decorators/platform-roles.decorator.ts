import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from '@sales-copilot/shared-contracts';

export const PLATFORM_ROLES_KEY = 'platform_roles';

/**
 * Decorator to declare required PlatformRole(s) for a platform admin route or controller.
 * Used in conjunction with PlatformRolesGuard.
 *
 * @example
 * @UseGuards(PlatformRolesGuard)
 * @PlatformRoles(PlatformRole.SUPER_ADMIN)
 * @Get('workspaces')
 */
export const PlatformRoles = (...roles: PlatformRole[]) => SetMetadata(PLATFORM_ROLES_KEY, roles);
