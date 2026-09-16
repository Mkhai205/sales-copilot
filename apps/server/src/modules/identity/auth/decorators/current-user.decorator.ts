import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtUserPayload } from '../types/jwt-payload.type';

export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtUserPayload | undefined,
    ctx: ExecutionContext,
  ): JwtUserPayload | string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
