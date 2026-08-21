import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TokenService } from '../token.service';
import { JwtUserPayload } from '../types/jwt-payload.type';

declare module 'express' {
  interface Request {
    user?: JwtUserPayload;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'No authorization token provided in Authorization header or cookie',
      });
    }

    const payload = await this.tokenService.verifyAccessToken(token);

    request.user = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    return true;
  }

  private extractTokenFromRequest(request: Request): string | null {
    const authHeader = request.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    // Cookie fallback
    if (request.cookies && request.cookies['access_token']) {
      return request.cookies['access_token'];
    }

    return null;
  }
}
