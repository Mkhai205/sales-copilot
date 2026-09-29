import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';

export const ROLES_KEY = 'roles';

/**
 * Decorator to declare required WorkspaceRole(s) for a route or controller.
 * Used in conjunction with RolesGuard and WorkspaceGuard.
 *
 * @example
 * @UseGuards(WorkspaceGuard, RolesGuard)
 * @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
 * @Post('members')
 */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
