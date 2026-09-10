import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { Request } from 'express';
import { PLATFORM_ROLES_KEY } from '../decorators/platform-roles.decorator';

@Injectable()
export class PlatformRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PlatformRole[]>(PLATFORM_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no specific platform roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Only HTTP requests are supported for platform admin
    if (context.getType() !== 'http') {
      throw new ForbiddenException({
        code: 'UNSUPPORTED_CONTEXT',
        message: 'Platform admin operations only support HTTP context',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        code: 'PLATFORM_AUTH_REQUIRED',
        message: 'Platform authentication required to access this resource',
      });
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PLATFORM_PERMISSIONS',
        message: 'Super administrator privileges required to access this resource',
      });
    }

    return true;
  }
}
