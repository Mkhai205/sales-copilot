import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { AuthService } from '../auth.service';
import { PasswordService } from '../password.service';
import { TokenService } from '../token.service';
import { PrismaService } from '../../../infrastructure/database';

describe('AuthService (Login, Refresh & Session Use Cases)', () => {
  let authService: AuthService;
  let mockPasswordService: Partial<PasswordService>;
  let mockTokenService: Partial<TokenService>;
  let mockPrismaService: any;

  const mockActiveUser = {
    id: 'usr_active_123',
    email: 'agent@salescopilot.io',
    name: 'Sales Agent',
    passwordHash: '$argon2id$mockhash',
    role: PlatformRole.USER,
    isActive: true,
    avatarUrl: 'https://avatar.example.com/1.png',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockInactiveUser = {
    ...mockActiveUser,
    id: 'usr_inactive_456',
    email: 'inactive@salescopilot.io',
    isActive: false,
  };

  beforeEach(() => {
    mockPasswordService = {
      verify: async (hash: string, plain: string) => {
        return plain === 'CorrectPassword123!';
      },
    };

    mockTokenService = {
      generateTokens: async (user: any) => ({
        accessToken: `mock.access.token.${user.id}`,
        refreshToken: `mock.refresh.token.${user.id}`,
        expiresIn: 900,
      }),
      rotateRefreshToken: async (refreshToken: string) => {
        if (refreshToken === 'valid.refresh.token') {
          return {
            tokens: {
              accessToken: 'mock.new.access.token',
              refreshToken: 'mock.new.refresh.token',
              expiresIn: 900,
            },
            userId: mockActiveUser.id,
            email: mockActiveUser.email,
            role: mockActiveUser.role,
          };
        }
        if (refreshToken === 'inactive.refresh.token') {
          return {
            tokens: {
              accessToken: 'mock.new.access.token',
              refreshToken: 'mock.new.refresh.token',
              expiresIn: 900,
            },
            userId: mockInactiveUser.id,
            email: mockInactiveUser.email,
            role: mockInactiveUser.role,
          };
        }
        throw new Error('INVALID_REFRESH_TOKEN');
      },
      revokeRefreshToken: async () => {},
      revokeAllUserTokens: async () => {},
    };

    mockPrismaService = {
      client: {
        user: {
          findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
            if (where.email === 'agent@salescopilot.io' || where.id === mockActiveUser.id) {
              return mockActiveUser;
            }
            if (where.email === 'inactive@salescopilot.io' || where.id === mockInactiveUser.id) {
              return mockInactiveUser;
            }
            return null;
          },
        },
      },
    };

    authService = new AuthService(
      mockPrismaService as PrismaService,
      mockPasswordService as PasswordService,
      mockTokenService as TokenService,
    );
  });

  it('should authenticate user and return tokens on valid credentials', async () => {
    const result = await authService.login({
      email: 'agent@salescopilot.io',
      password: 'CorrectPassword123!',
    });

    assert.ok(result.tokens);
    assert.strictEqual(result.user.id, mockActiveUser.id);
    assert.strictEqual(result.user.email, mockActiveUser.email);
    assert.strictEqual(result.user.name, mockActiveUser.name);
    assert.strictEqual(result.user.role, PlatformRole.USER);
    assert.strictEqual(result.user.isActive, true);
    assert.strictEqual(
      (result.user as any).passwordHash,
      undefined,
      'Password hash must never be returned',
    );
  });

  it('should throw UnauthorizedException on non-existent email', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'unknown@example.com',
          password: 'CorrectPassword123!',
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INVALID_CREDENTIALS');
        return true;
      },
    );
  });

  it('should throw UnauthorizedException on incorrect password', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'agent@salescopilot.io',
          password: 'WrongPassword!',
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INVALID_CREDENTIALS');
        return true;
      },
    );
  });

  it('should throw ForbiddenException when user account is deactivated', async () => {
    await assert.rejects(
      async () => {
        await authService.login({
          email: 'inactive@salescopilot.io',
          password: 'CorrectPassword123!',
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'ACCOUNT_DEACTIVATED');
        return true;
      },
    );
  });

  it('should rotate tokens successfully when refresh token is valid', async () => {
    const tokens = await authService.refreshToken({
      refreshToken: 'valid.refresh.token',
    });

    assert.strictEqual(tokens.accessToken, 'mock.new.access.token');
    assert.strictEqual(tokens.refreshToken, 'mock.new.refresh.token');
  });

  it('should reject refresh token if user account was deactivated', async () => {
    await assert.rejects(
      async () => {
        await authService.refreshToken({
          refreshToken: 'inactive.refresh.token',
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'ACCOUNT_DEACTIVATED');
        return true;
      },
    );
  });

  it('should return user profile for active user', async () => {
    const profile = await authService.getProfile(mockActiveUser.id);
    assert.strictEqual(profile.id, mockActiveUser.id);
    assert.strictEqual(profile.email, mockActiveUser.email);
    assert.strictEqual(profile.role, PlatformRole.USER);
    assert.strictEqual(
      (profile as any).platformRole,
      undefined,
      'platformRole must not exist in response',
    );
  });

  it('should throw NotFoundException if user profile not found', async () => {
    await assert.rejects(
      async () => {
        await authService.getProfile('non_existent_user_id');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'USER_NOT_FOUND');
        return true;
      },
    );
  });

  it('should throw ForbiddenException on getProfile when user is deactivated', async () => {
    await assert.rejects(
      async () => {
        await authService.getProfile(mockInactiveUser.id);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'ACCOUNT_DEACTIVATED');
        return true;
      },
    );
  });

  it('should logout by revoking specific refreshToken when provided', async () => {
    const result = await authService.logout(mockActiveUser.id, 'some.refresh.token');
    assert.deepStrictEqual(result, { loggedOut: true });
  });

  it('should logout by revoking all user tokens when no refreshToken provided', async () => {
    let revokeAllCalled = false;
    mockTokenService.revokeAllUserTokens = async () => {
      revokeAllCalled = true;
    };
    authService = new AuthService(
      mockPrismaService as PrismaService,
      mockPasswordService as PasswordService,
      mockTokenService as TokenService,
    );

    const result = await authService.logout(mockActiveUser.id, undefined);
    assert.deepStrictEqual(result, { loggedOut: true });
    assert.strictEqual(revokeAllCalled, true);
  });
});
