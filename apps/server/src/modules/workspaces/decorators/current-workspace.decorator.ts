import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { WorkspaceContext } from '../types/workspace-context.type';

export const CurrentWorkspace = createParamDecorator(
  (
    data: keyof WorkspaceContext | undefined,
    ctx: ExecutionContext,
  ): WorkspaceContext | WorkspaceContext[keyof WorkspaceContext] | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const workspace = request.workspace;

    if (!workspace) {
      return undefined;
    }

    return data ? workspace[data] : workspace;
  },
);
