import { expectReject } from '../../../../../test/test-assertions';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { TokenService } from '../token.service';
import { RedisService } from '../../../../infrastructure/redis';

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

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.expiresIn).toBe(900);

    // Verify Identity-Only JWT payload
    const decoded = await tokenService.verifyAccessToken(tokens.accessToken);
    expect(decoded.sub).toBe(user.id);
    expect(decoded.email).toBe(user.email);
    expect(decoded.role).toBe(user.role);

    // Check refresh token in storage
    const [tokenId] = tokens.refreshToken.split('.');
    expect(mockRedisStorage.has(`auth:refresh_token:${tokenId}`)).toBeTruthy();
  });

  it('should verify valid access token correctly', async () => {
    const user = {
      id: 'usr_456',
      email: 'admin@salescopilot.io',
      role: PlatformRole.SUPER_ADMIN,
    };

    const tokens = await tokenService.generateTokens(user);
    const payload = await tokenService.verifyAccessToken(tokens.accessToken);

    expect(payload.sub).toBe('usr_456');
    expect(payload.email).toBe('admin@salescopilot.io');
    expect(payload.role).toBe('SUPER_ADMIN');
  });

  it('should reject invalid or tampered access token', async () => {
    await expectReject(
      async () => {
        await tokenService.verifyAccessToken('invalid.jwt.token');
      },
      (err: any) => {
        expect(err.response?.code).toBe('UNAUTHORIZED');
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

    expect(rotated.tokens.accessToken).toBeTruthy();
    expect(rotated.tokens.refreshToken).toBeTruthy();
    expect(rotated.tokens.refreshToken).not.toBe(initialTokens.refreshToken);
    expect(rotated.userId).toBe(user.id);

    // Old token should be deleted (GETDEL) and a revoked marker should exist
    expect(mockRedisStorage.has(`auth:refresh_token:${oldTokenId}`)).toBe(false);
    expect(mockRedisStorage.has(`auth:refresh_token:${oldTokenId}:revoked`)).toBeTruthy();
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
    expect(rotation1.tokens.refreshToken).toBeTruthy();

    // Attacker tries to use the old (already rotated) initial refresh token
    await expectReject(
      async () => {
        await tokenService.rotateRefreshToken(initialTokens.refreshToken);
      },
      (err: any) => {
        expect(err.response?.code).toBe('REFRESH_TOKEN_REUSED');
        return true;
      },
    );

    // Valid rotated token should now also be revoked due to family revocation
    await expectReject(
      async () => {
        await tokenService.rotateRefreshToken(rotation1.tokens.refreshToken);
      },
      (err: any) => {
        expect(err.response?.code).toBe('INVALID_REFRESH_TOKEN');
        return true;
      },
    );
  });

  it('should reject non-existent or malformed refresh token', async () => {
    await expectReject(
      async () => {
        await tokenService.rotateRefreshToken('');
      },
      (err: any) => {
        expect(err.response?.code).toBe('INVALID_REFRESH_TOKEN');
        return true;
      },
    );

    await expectReject(
      async () => {
        await tokenService.rotateRefreshToken('non_existent_token_id.secret');
      },
      (err: any) => {
        expect(err.response?.code).toBe('INVALID_REFRESH_TOKEN');
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

    expect(mockRedisStorage.has(`auth:refresh_token:${tokenId}`)).toBeTruthy();

    await tokenService.revokeRefreshToken(tokens.refreshToken);
    expect(mockRedisStorage.has(`auth:refresh_token:${tokenId}`)).toBe(false);
  });
});
