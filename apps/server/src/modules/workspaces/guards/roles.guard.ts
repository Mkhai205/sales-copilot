import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no specific roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Only HTTP requests are supported by RolesGuard
    if (context.getType() !== 'http') {
      throw new ForbiddenException({
        code: 'UNSUPPORTED_CONTEXT',
        message: 'RolesGuard only supports HTTP requests.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const workspaceContext = request.workspace;

    if (!workspaceContext || !workspaceContext.role) {
      throw new ForbiddenException({
        code: 'WORKSPACE_CONTEXT_REQUIRED',
        message: 'Workspace context with valid role is required for role verification',
      });
    }

    const hasRole = requiredRoles.includes(workspaceContext.role);
    if (!hasRole) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Role '${workspaceContext.role}' does not have sufficient permissions for this resource`,
      });
    }

    return true;
  }
}
