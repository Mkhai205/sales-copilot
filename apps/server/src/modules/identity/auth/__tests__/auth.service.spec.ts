import { expectReject } from '../../../../../test/test-assertions';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { AuthService } from '../auth.service';
import { PasswordService } from '../password.service';
import { TokenService } from '../token.service';
import { PrismaService } from '../../../../infrastructure/database';

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
      hash: async (plain: string) => `$argon2id$mockhash_${plain}`,
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
      runInTransaction: async (cb: any) => cb(),
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
          create: async ({ data }: any) => ({
            id: 'usr_new_999',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          update: async ({ where, data }: { where: { id: string }; data: any }) => {
            if (where.id === mockActiveUser.id) {
              return { ...mockActiveUser, ...data, updatedAt: new Date() };
            }
            return null;
          },
        },
        workspace: {
          findUnique: async () => null,
          create: async ({ data }: any) => ({
            id: 'ws_new_999',
            ...data,
            settings: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        workspaceMember: {
          create: async ({ data }: any) => ({
            id: 'wm_new_999',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        inbox: {
          create: async ({ data }: any) => ({
            id: 'inb_new_999',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        inboxMember: {
          create: async ({ data }: any) => ({
            id: 'im_new_999',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
      },
    };

    authService = new AuthService(
      mockPrismaService as PrismaService,
      mockPasswordService as PasswordService,
      mockTokenService as TokenService,
    );
  });

  describe('register (TASK-3A-05 Atomic Registration)', () => {
    it('should atomically register a new user and provision default workspace with inbox', async () => {
      const result = await authService.register({
        email: 'founder@newshop.com',
        password: 'SecurePassword123!',
        name: 'Shop Founder',
        workspaceName: 'New Brand Shop',
      });

      expect(result.user.email).toBe('founder@newshop.com');
      expect(result.user.name).toBe('Shop Founder');
      expect(result.workspace.name).toBe('New Brand Shop');
      expect(result.workspace.slug).toBe('new-brand-shop');
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it('should throw ConflictException if user email already exists', async () => {
      await expectReject(
        async () => {
          await authService.register({
            email: 'agent@salescopilot.io',
            password: 'SecurePassword123!',
            name: 'Existing User',
          });
        },
        (err: any) => {
          expect(err.response?.code).toBe('EMAIL_ALREADY_EXISTS');
          return true;
        },
      );
    });
  });

  it('should authenticate user and return tokens on valid credentials', async () => {
    const result = await authService.login({
      email: 'agent@salescopilot.io',
      password: 'CorrectPassword123!',
    });

    expect(result.tokens).toBeTruthy();
    expect(result.user.id).toBe(mockActiveUser.id);
    expect(result.user.email).toBe(mockActiveUser.email);
    expect(result.user.name).toBe(mockActiveUser.name);
    expect(result.user.role).toBe(PlatformRole.USER);
    expect(result.user.isActive).toBe(true);
    expect((result.user as any).passwordHash).toBe(undefined);
  });

  it('should throw UnauthorizedException on non-existent email', async () => {
    await expectReject(
      async () => {
        await authService.login({
          email: 'unknown@example.com',
          password: 'CorrectPassword123!',
        });
      },
      (err: any) => {
        expect(err.response?.code).toBe('INVALID_CREDENTIALS');
        return true;
      },
    );
  });

  it('should throw UnauthorizedException on incorrect password', async () => {
    await expectReject(
      async () => {
        await authService.login({
          email: 'agent@salescopilot.io',
          password: 'WrongPassword!',
        });
      },
      (err: any) => {
        expect(err.response?.code).toBe('INVALID_CREDENTIALS');
        return true;
      },
    );
  });

  it('should throw ForbiddenException when user account is deactivated', async () => {
    await expectReject(
      async () => {
        await authService.login({
          email: 'inactive@salescopilot.io',
          password: 'CorrectPassword123!',
        });
      },
      (err: any) => {
        expect(err.response?.code).toBe('ACCOUNT_DEACTIVATED');
        return true;
      },
    );
  });

  it('should rotate tokens successfully when refresh token is valid', async () => {
    const tokens = await authService.refreshToken({
      refreshToken: 'valid.refresh.token',
    });

    expect(tokens.accessToken).toBe('mock.new.access.token');
    expect(tokens.refreshToken).toBe('mock.new.refresh.token');
  });

  it('should reject refresh token if user account was deactivated', async () => {
    await expectReject(
      async () => {
        await authService.refreshToken({
          refreshToken: 'inactive.refresh.token',
        });
      },
      (err: any) => {
        expect(err.response?.code).toBe('ACCOUNT_DEACTIVATED');
        return true;
      },
    );
  });

  it('should return user profile for active user', async () => {
    const profile = await authService.getProfile(mockActiveUser.id);
    expect(profile.id).toBe(mockActiveUser.id);
    expect(profile.email).toBe(mockActiveUser.email);
    expect(profile.role).toBe(PlatformRole.USER);
    expect((profile as any).platformRole).toBe(undefined);
  });

  it('should throw NotFoundException if user profile not found', async () => {
    await expectReject(
      async () => {
        await authService.getProfile('non_existent_user_id');
      },
      (err: any) => {
        expect(err.response?.code).toBe('USER_NOT_FOUND');
        return true;
      },
    );
  });

  it('should throw ForbiddenException on getProfile when user is deactivated', async () => {
    await expectReject(
      async () => {
        await authService.getProfile(mockInactiveUser.id);
      },
      (err: any) => {
        expect(err.response?.code).toBe('ACCOUNT_DEACTIVATED');
        return true;
      },
    );
  });

  it('should logout by revoking specific refreshToken when provided', async () => {
    const result = await authService.logout(mockActiveUser.id, 'some.refresh.token');
    expect(result).toEqual({ loggedOut: true });
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
    expect(result).toEqual({ loggedOut: true });
    expect(revokeAllCalled).toBe(true);
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const updated = await authService.updateProfile(mockActiveUser.id, {
        name: 'New Agent Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      expect(updated.name).toBe('New Agent Name');
      expect(updated.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should throw NotFoundException when user does not exist', async () => {
      await expectReject(
        async () => {
          await authService.updateProfile('unknown_user_id', { name: 'Name' });
        },
        (err: any) => {
          expect(err.response?.code).toBe('USER_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw ForbiddenException when user is inactive', async () => {
      await expectReject(
        async () => {
          await authService.updateProfile(mockInactiveUser.id, { name: 'Name' });
        },
        (err: any) => {
          expect(err.response?.code).toBe('ACCOUNT_DEACTIVATED');
          return true;
        },
      );
    });
  });
});
