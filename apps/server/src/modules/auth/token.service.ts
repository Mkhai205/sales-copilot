import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PlatformRole, AuthTokensDto } from '@sales-copilot/shared-contracts';
import * as crypto from 'node:crypto';
import { RedisService } from '../../infrastructure/redis';
import { JwtPayload, StoredRefreshToken } from './types/jwt-payload.type';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  private readonly accessTokenSecret: string;
  private readonly accessTokenExpiresInSeconds: number;
  private readonly refreshTokenExpiresInSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    this.accessTokenSecret = this.configService.getOrThrow<string>('JWT_ACCESS_TOKEN_SECRET');

    this.accessTokenExpiresInSeconds = this.configService.get<number>(
      'JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS',
      900, // 15 minutes
    );

    this.refreshTokenExpiresInSeconds = this.configService.get<number>(
      'REFRESH_TOKEN_EXPIRES_IN_SECONDS',
      604800, // 7 days
    );
  }

  /**
   * Generates a pair of Identity-Only Access Token and Refresh Token.
   */
  async generateTokens(
    user: { id: string; email: string; role: PlatformRole },
    existingFamilyId?: string,
  ): Promise<AuthTokensDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessTokenSecret,
      expiresIn: this.accessTokenExpiresInSeconds,
    });

    const tokenId = crypto.randomUUID();
    const tokenSecret = crypto.randomBytes(32).toString('hex');
    const familyId = existingFamilyId || crypto.randomUUID();
    const rawRefreshToken = `${tokenId}.${tokenSecret}`;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.refreshTokenExpiresInSeconds;

    const storedToken: StoredRefreshToken = {
      tokenId,
      userId: user.id,
      familyId,
      email: user.email,
      role: user.role,
      isRevoked: false,
      createdAt: now,
      expiresAt,
    };

    const tokenKey = `auth:refresh_token:${tokenId}`;
    const familyKey = `auth:family:${familyId}`;
    const userTokensKey = `auth:user_tokens:${user.id}`;

    await this.redisService.set(
      tokenKey,
      JSON.stringify(storedToken),
      this.refreshTokenExpiresInSeconds,
    );

    // Track token in family and user tokens set
    const redisClient = this.redisService.getClient();
    if (redisClient) {
      try {
        await redisClient.sadd(familyKey, tokenId);
        await redisClient.expire(familyKey, this.refreshTokenExpiresInSeconds);
        await redisClient.sadd(userTokensKey, tokenId);
        await redisClient.expire(userTokensKey, this.refreshTokenExpiresInSeconds);
      } catch (err) {
        this.logger.warn(`Failed to update family/user token sets: ${(err as Error)?.message}`);
      }
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.accessTokenExpiresInSeconds,
    };
  }

  /**
   * Verifies an Identity-Only JWT Access Token.
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    if (!token) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'No authorization token provided',
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.accessTokenSecret,
      });

      if (!payload || !payload.sub || !payload.email || !payload.role) {
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Invalid token payload structure',
        });
      }

      return payload;
    } catch (err) {
      this.logger.debug(`JWT verification failed: ${(err as Error)?.message}`);
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Access token is invalid or expired',
      });
    }
  }

  /**
   * Rotates a Refresh Token, revoking the old one and returning a new token pair.
   * Uses atomic GETDEL to prevent race conditions from concurrent refresh requests.
   * Detects reuse via short-lived revoked marker and revokes token families upon potential replay attacks.
   */
  async rotateRefreshToken(rawRefreshToken: string): Promise<{
    tokens: AuthTokensDto;
    userId: string;
    email: string;
    role: PlatformRole;
  }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

    const [tokenId] = rawRefreshToken.split('.');
    if (!tokenId) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Malformed refresh token',
      });
    }

    const tokenKey = `auth:refresh_token:${tokenId}`;
    const revokedKey = `auth:refresh_token:${tokenId}:revoked`;

    // Check if this token was already consumed (concurrent replay attempt)
    const isRevoked = await this.redisService.exists(revokedKey);
    if (isRevoked) {
      // Attempt to read familyId from revoked marker for family revocation
      const revokedData = await this.redisService.get(revokedKey);
      if (revokedData) {
        try {
          const parsed = JSON.parse(revokedData) as { familyId: string; userId: string };
          this.logger.warn(
            `🚨 Refresh token reuse detected for userId: ${parsed.userId}, familyId: ${parsed.familyId}. Revoking family.`,
          );
          await this.revokeTokenFamily(parsed.familyId);
        } catch {
          // ignore parse errors
        }
      }
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Refresh token reuse detected. All related sessions have been revoked.',
      });
    }

    // Atomic GETDEL: retrieve and delete in a single Redis operation.
    // This prevents two concurrent requests from both passing the "not revoked" check.
    const redisClient = this.redisService.getClient();
    // eslint-disable-next-line no-useless-assignment
    let tokenData: string | null = null;
    if (redisClient) {
      tokenData = await redisClient.getdel(tokenKey);
    } else {
      tokenData = await this.redisService.get(tokenKey);
      if (tokenData) await this.redisService.del(tokenKey);
    }

    if (!tokenData) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is expired, revoked, or does not exist',
      });
    }

    let storedToken: StoredRefreshToken;
    try {
      storedToken = JSON.parse(tokenData) as StoredRefreshToken;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Corrupted refresh token record',
      });
    }

    // Leave a short-lived revoked marker to catch concurrent replay attempts
    // that may have read the token before GETDEL completed
    await this.redisService.set(
      revokedKey,
      JSON.stringify({ familyId: storedToken.familyId, userId: storedToken.userId }),
      60,
    );

    // Issue new token pair under the same familyId
    const newTokens = await this.generateTokens(
      {
        id: storedToken.userId,
        email: storedToken.email,
        role: storedToken.role,
      },
      storedToken.familyId,
    );

    return {
      tokens: newTokens,
      userId: storedToken.userId,
      email: storedToken.email,
      role: storedToken.role,
    };
  }

  /**
   * Revokes a specific refresh token.
   */
  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const [tokenId] = rawRefreshToken.split('.');
    if (tokenId) {
      await this.redisService.del(`auth:refresh_token:${tokenId}`);
    }
  }

  /**
   * Revokes an entire token family.
   */
  async revokeTokenFamily(familyId: string): Promise<void> {
    const familyKey = `auth:family:${familyId}`;
    const redisClient = this.redisService.getClient();

    if (redisClient) {
      try {
        const tokenIds = await redisClient.smembers(familyKey);
        if (tokenIds.length > 0) {
          const keysToDelete = tokenIds.map(id => `auth:refresh_token:${id}`);
          await this.redisService.del(keysToDelete);
        }
        await this.redisService.del(familyKey);
      } catch (err) {
        this.logger.error(`Error revoking token family ${familyId}:`, err);
      }
    }
  }

  /**
   * Revokes all active sessions / refresh tokens for a user.
   * Also cleans up associated family keys to prevent Redis memory leak.
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const userTokensKey = `auth:user_tokens:${userId}`;
    const redisClient = this.redisService.getClient();

    if (redisClient) {
      try {
        const tokenIds = await redisClient.smembers(userTokensKey);
        if (tokenIds.length > 0) {
          // Collect familyIds from stored token records to also delete family sets
          const familyIds = new Set<string>();
          const tokenKeys = tokenIds.map(id => `auth:refresh_token:${id}`);

          for (const tokenId of tokenIds) {
            const tokenData = await this.redisService.get(`auth:refresh_token:${tokenId}`);
            if (tokenData) {
              try {
                const stored = JSON.parse(tokenData) as StoredRefreshToken;
                if (stored.familyId) familyIds.add(stored.familyId);
              } catch {
                // ignore parse errors for individual tokens
              }
            }
          }

          // Delete all token keys
          await this.redisService.del(tokenKeys);

          // Delete all associated family keys
          if (familyIds.size > 0) {
            const familyKeys = Array.from(familyIds).map(id => `auth:family:${id}`);
            await this.redisService.del(familyKeys);
          }
        }
        await this.redisService.del(userTokensKey);
      } catch (err) {
        this.logger.error(`Error revoking all tokens for user ${userId}:`, err);
      }
    }
  }
}
