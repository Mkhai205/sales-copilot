import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { WorkspacesService } from '../workspaces.service';
import { WorkspaceContext } from '../types/workspace-context.type';

declare module 'express' {
  interface Request {
    workspace?: WorkspaceContext;
  }
}

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WorkspaceGuard only supports HTTP context. WebSocket tenant isolation is
    // handled separately in the WS gateway (Phase 1 implementation).
    if (context.getType() !== 'http') {
      throw new ForbiddenException({
        code: 'UNSUPPORTED_CONTEXT',
        message:
          'WorkspaceGuard only supports HTTP requests. WebSocket access is handled separately.',
      });
    }

    const request = context.switchToHttp().getRequest<Request>();
    const workspaceIdHeader = request.headers['x-workspace-id'];
    const headerWorkspaceId = Array.isArray(workspaceIdHeader)
      ? workspaceIdHeader[0]
      : workspaceIdHeader;
    const paramWorkspaceId = request.params?.workspaceId;

    if (
      headerWorkspaceId &&
      paramWorkspaceId &&
      typeof headerWorkspaceId === 'string' &&
      typeof paramWorkspaceId === 'string' &&
      headerWorkspaceId.trim() !== paramWorkspaceId.trim()
    ) {
      throw new BadRequestException({
        code: 'WORKSPACE_ID_MISMATCH',
        message: 'Workspace ID in path parameter does not match X-Workspace-Id header',
      });
    }

    const workspaceId = (paramWorkspaceId || headerWorkspaceId) as string | undefined;

    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
      throw new BadRequestException({
        code: 'WORKSPACE_ID_REQUIRED',
        message: 'Workspace ID is required (via route param or X-Workspace-Id header)',
      });
    }

    const user = request.user;
    if (!user || !user.userId) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentication is required before accessing workspace resources',
      });
    }

    const member = await this.workspacesService.findMember(workspaceId.trim(), user.userId);
    if (!member) {
      throw new ForbiddenException({
        code: 'WORKSPACE_ACCESS_DENIED',
        message: 'You do not have access to this workspace',
      });
    }

    if (member.workspace.isSuspended) {
      throw new ForbiddenException({
        code: 'WORKSPACE_SUSPENDED',
        message:
          member.workspace.suspendedReason ||
          'Workspace has been suspended by platform administrator',
        details: {
          suspendedReason: member.workspace.suspendedReason,
          suspendedAt: member.workspace.suspendedAt,
        },
      });
    }

    request.workspace = {
      workspaceId: member.workspace.id,
      role: member.role,
      workspace: {
        id: member.workspace.id,
        name: member.workspace.name,
        slug: member.workspace.slug,
        billingPlan: member.workspace.billingPlan,
        timezone: member.workspace.timezone,
        defaultLanguage: member.workspace.defaultLanguage,
        settings: member.workspace.settings as Record<string, unknown> | null,
        createdAt: member.workspace.createdAt,
        updatedAt: member.workspace.updatedAt,
      },
    };

    return true;
  }
}
