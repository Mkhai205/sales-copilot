import { Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as jwt from 'jsonwebtoken';

/**
 * Payload encoded in widget contact authentication JWT.
 */
export interface WidgetTokenPayload {
  contactId: string;
  workspaceId: string;
  channelId: string;
  inboxId: string;
  externalContactId: string;
  widgetToken: string;
  identifier?: string | null;
  [key: string]: unknown;
}

/**
 * Service for issuing and verifying JWT tokens for Web Chat visitors.
 * Defaults to 180 days token lifetime (aligned with Chatwoot specification).
 */
@Injectable()
export class WidgetTokenService {
  private readonly logger = new Logger(WidgetTokenService.name);
  private readonly jwtSecret: string;
  private readonly defaultExpiresInSeconds: number;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly jwtService?: JwtService,
  ) {
    this.jwtSecret =
      this.configService?.get<string>('WIDGET_TOKEN_SECRET') ||
      this.configService?.get<string>('JWT_ACCESS_TOKEN_SECRET') ||
      'widget_default_secret_key_change_in_production_12345';

    const expiryDays = this.configService?.get<number>('WIDGET_TOKEN_EXPIRY_DAYS', 180) ?? 180;
    this.defaultExpiresInSeconds = expiryDays * 24 * 60 * 60; // 180 days = 15,552,000s
  }

  /**
   * Generates a signed Contact JWT for an authenticated/anonymous widget visitor.
   */
  generateToken(payload: WidgetTokenPayload, expiresInSeconds?: number): string {
    const expiry = expiresInSeconds ?? this.defaultExpiresInSeconds;

    if (this.jwtService) {
      return this.jwtService.sign(payload, {
        secret: this.jwtSecret,
        expiresIn: expiry,
      });
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: expiry,
    });
  }

  /**
   * Decodes and validates a widget Contact JWT token.
   * Throws UnauthorizedException if token is missing, invalid, or expired.
   */
  verifyToken(token?: string): WidgetTokenPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException({
        code: 'WIDGET_TOKEN_MISSING',
        message: 'Widget authorization token is required',
      });
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

    try {
      if (this.jwtService) {
        return this.jwtService.verify<WidgetTokenPayload>(cleanToken, {
          secret: this.jwtSecret,
        });
      }

      return jwt.verify(cleanToken, this.jwtSecret) as WidgetTokenPayload;
    } catch (err) {
      const errorMessage = (err as Error).message || 'Invalid widget token';
      this.logger.warn(`Failed to verify widget contact token: ${errorMessage}`);
      throw new UnauthorizedException({
        code: 'INVALID_WIDGET_AUTH_TOKEN',
        message: 'Widget authorization token is invalid or expired',
      });
    }
  }

  /**
   * Extracts token from HTTP request headers or query parameters.
   */
  extractToken(
    headers?: Record<string, string | string[] | undefined>,
    query?: Record<string, string | string[] | undefined>,
  ): string | undefined {
    // 1. Authorization header (Bearer ...)
    if (headers) {
      const authHeader = headers['authorization'] || headers['Authorization'];
      if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
      }

      const xAuthToken = headers['x-auth-token'] || headers['X-Auth-Token'];
      if (typeof xAuthToken === 'string' && xAuthToken.trim() !== '') {
        return xAuthToken.trim();
      }
    }

    // 2. Query parameter
    if (query) {
      const candidate =
        query.token ||
        query.auth_token ||
        query.contact_token ||
        query.cw_conversation ||
        query.widget_token;

      if (Array.isArray(candidate)) {
        return candidate[0];
      }
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        return candidate.trim();
      }
    }

    return undefined;
  }
}
