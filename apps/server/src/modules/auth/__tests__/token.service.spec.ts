import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { TokenService } from '../token.service';
import { RedisService } from '../../../infrastructure/redis';

describe('TokenService (JWT & Refresh Token Rotation)', () => {
  let tokenService: TokenService;
  let jwtService: JwtService;
  let mockRedisStorage: Map<string, string>;
  let mockRedisSets: Map<string, Set<string>>;

  beforeEach(() => {
    mockRedisStorage = new Map();
    mockRedisSets = new Map();

    const mockConfigService = {
      get: (key: string, defaultValue?: any) => {
        if (key === 'JWT_ACCESS_TOKEN_SECRET') return 'test-secret-key-32-characters-min!!';
        if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS') return 900;
        if (key === 'REFRESH_TOKEN_EXPIRES_IN_SECONDS') return 604800;
        return defaultValue;
      },
      getOrThrow: (key: string) => {
        if (key === 'JWT_ACCESS_TOKEN_SECRET') return 'test-secret-key-32-characters-min!!';
        throw new Error(`Missing required config: ${key}`);
      },
    } as unknown as ConfigService;

    jwtService = new JwtService({
      secret: 'test-secret-key-32-characters-min!!',
    });

    const mockRedisClient = {
      sadd: async (key: string, value: string) => {
        if (!mockRedisSets.has(key)) mockRedisSets.set(key, new Set());
        mockRedisSets.get(key)!.add(value);
        return 1;
      },
      expire: async () => 1,
      smembers: async (key: string) => {
        return Array.from(mockRedisSets.get(key) || []);
      },
      getdel: async (key: string) => {
        const value = mockRedisStorage.get(key) || null;
        mockRedisStorage.delete(key);
        return value;
      },
    };

    const mockRedisService = {
      getClient: () => mockRedisClient,
      get: async (key: string) => mockRedisStorage.get(key) || null,
      set: async (key: string, value: string) => {
        mockRedisStorage.set(key, value);
      },
      exists: async (key: string) => mockRedisStorage.has(key),
      del: async (keyOrKeys: string | string[]) => {
        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        let count = 0;
        for (const k of keys) {
          if (mockRedisStorage.delete(k)) count++;
          if (mockRedisSets.delete(k)) count++;
        }
        return count;
      },
    } as unknown as RedisService;

    tokenService = new TokenService(mockConfigService, jwtService, mockRedisService);
  });

  it('should generate Identity-Only JWT access token and store refresh token', async () => {
    const user = {
      id: 'usr_123',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    };

    const tokens = await tokenService.generateTokens(user);

    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);
    assert.strictEqual(tokens.expiresIn, 900);

    // Verify Identity-Only JWT payload
    const decoded = await tokenService.verifyAccessToken(tokens.accessToken);
    assert.strictEqual(decoded.sub, user.id);
    assert.strictEqual(decoded.email, user.email);
    assert.strictEqual(decoded.role, user.role);

    // Check refresh token in storage
    const [tokenId] = tokens.refreshToken.split('.');
    assert.ok(mockRedisStorage.has(`auth:refresh_token:${tokenId}`));
  });

  it('should verify valid access token correctly', async () => {
    const user = {
      id: 'usr_456',
      email: 'admin@salescopilot.io',
      role: PlatformRole.SUPER_ADMIN,
    };

    const tokens = await tokenService.generateTokens(user);
    const payload = await tokenService.verifyAccessToken(tokens.accessToken);

    assert.strictEqual(payload.sub, 'usr_456');
    assert.strictEqual(payload.email, 'admin@salescopilot.io');
    assert.strictEqual(payload.role, 'SUPER_ADMIN');
  });

  it('should reject invalid or tampered access token', async () => {
    await assert.rejects(
      async () => {
        await tokenService.verifyAccessToken('invalid.jwt.token');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'UNAUTHORIZED');
        return true;
      },
    );
  });

  it('should rotate refresh token successfully on valid request', async () => {
    const user = {
      id: 'usr_789',
      email: 'test@example.com',
      role: PlatformRole.USER,
    };

    const initialTokens = await tokenService.generateTokens(user);
    const [oldTokenId] = initialTokens.refreshToken.split('.');

    // Perform rotation
    const rotated = await tokenService.rotateRefreshToken(initialTokens.refreshToken);

    assert.ok(rotated.tokens.accessToken);
    assert.ok(rotated.tokens.refreshToken);
    assert.notStrictEqual(rotated.tokens.refreshToken, initialTokens.refreshToken);
    assert.strictEqual(rotated.userId, user.id);

    // Old token should be deleted (GETDEL) and a revoked marker should exist
    assert.strictEqual(
      mockRedisStorage.has(`auth:refresh_token:${oldTokenId}`),
      false,
      'Old token must be deleted after rotation',
    );
    assert.ok(
      mockRedisStorage.has(`auth:refresh_token:${oldTokenId}:revoked`),
      'Revoked marker must exist to catch replay',
    );
  });

  it('should detect token reuse (Replay Attack) and revoke entire token family', async () => {
    const user = {
      id: 'usr_replay',
      email: 'victim@example.com',
      role: PlatformRole.USER,
    };

    const initialTokens = await tokenService.generateTokens(user);

    // Legitimate rotation 1
    const rotation1 = await tokenService.rotateRefreshToken(initialTokens.refreshToken);
    assert.ok(rotation1.tokens.refreshToken);

    // Attacker tries to use the old (already rotated) initial refresh token
    await assert.rejects(
      async () => {
        await tokenService.rotateRefreshToken(initialTokens.refreshToken);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'REFRESH_TOKEN_REUSED');
        return true;
      },
    );

    // Valid rotated token should now also be revoked due to family revocation
    await assert.rejects(
      async () => {
        await tokenService.rotateRefreshToken(rotation1.tokens.refreshToken);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INVALID_REFRESH_TOKEN');
        return true;
      },
    );
  });

  it('should reject non-existent or malformed refresh token', async () => {
    await assert.rejects(
      async () => {
        await tokenService.rotateRefreshToken('');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INVALID_REFRESH_TOKEN');
        return true;
      },
    );

    await assert.rejects(
      async () => {
        await tokenService.rotateRefreshToken('non_existent_token_id.secret');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INVALID_REFRESH_TOKEN');
        return true;
      },
    );
  });

  it('should revoke a specific refresh token', async () => {
    const user = {
      id: 'usr_rev',
      email: 'rev@example.com',
      role: PlatformRole.USER,
    };

    const tokens = await tokenService.generateTokens(user);
    const [tokenId] = tokens.refreshToken.split('.');

    assert.ok(mockRedisStorage.has(`auth:refresh_token:${tokenId}`));

    await tokenService.revokeRefreshToken(tokens.refreshToken);
    assert.strictEqual(mockRedisStorage.has(`auth:refresh_token:${tokenId}`), false);
  });
});
