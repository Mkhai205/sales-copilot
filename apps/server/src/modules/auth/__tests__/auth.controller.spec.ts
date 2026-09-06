import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

describe('AuthController (Presentation Layer Endpoints)', () => {
  let controller: AuthController;
  let mockAuthService: Partial<AuthService>;

  const mockUserDto = {
    id: 'usr_100',
    email: 'agent@salescopilot.io',
    name: 'Agent User',
    role: PlatformRole.USER,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const mockTokens = {
    accessToken: 'access.token.jwt',
    refreshToken: 'refresh.token.uuid',
    expiresIn: 900,
  };

  beforeEach(() => {
    mockAuthService = {
      login: async _dto => ({
        user: mockUserDto,
        tokens: mockTokens,
      }),
      refreshToken: async _dto => mockTokens,
      logout: async (_userId, _refreshToken) => ({ loggedOut: true }),
      getProfile: async _userId => mockUserDto,
    };

    controller = new AuthController(mockAuthService as AuthService);
  });

  it('should handle login request and return LoginResponseDto', async () => {
    const result = await controller.login({
      email: 'agent@salescopilot.io',
      password: 'Password123!',
    });

    assert.deepStrictEqual(result.user, mockUserDto);
    assert.deepStrictEqual(result.tokens, mockTokens);
  });

  it('should handle refresh token request and return new AuthTokensDto', async () => {
    const result = await controller.refresh({
      refreshToken: 'old.refresh.token',
    });

    assert.deepStrictEqual(result, mockTokens);
  });

  it('should handle logout request and return loggedOut: true', async () => {
    const userPayload = {
      userId: 'usr_100',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    };

    const result = await controller.logout(userPayload, { refreshToken: 'optional.refresh.token' });
    assert.deepStrictEqual(result, { loggedOut: true });
  });

  it('should handle logout without refreshToken and revoke all sessions', async () => {
    const userPayload = {
      userId: 'usr_100',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    };

    const result = await controller.logout(userPayload, {});
    assert.deepStrictEqual(result, { loggedOut: true });
  });

  it('should handle logout with only refreshToken and return loggedOut: true', async () => {
    const result = await controller.logout(undefined, { refreshToken: 'valid.refresh.token' });
    assert.deepStrictEqual(result, { loggedOut: true });
  });

  it('should throw UnauthorizedException when neither user nor refreshToken is provided on logout', async () => {
    await assert.rejects(
      async () => {
        await controller.logout(undefined, {});
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'UNAUTHORIZED');
        return true;
      },
    );
  });

  it('should handle me request and return current user profile', async () => {
    const userPayload = {
      userId: 'usr_100',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    };

    const result = await controller.me(userPayload);
    assert.deepStrictEqual(result, mockUserDto);
  });

  it('should handle updateProfile request and return updated user profile', async () => {
    const userPayload = {
      userId: 'usr_100',
      email: 'agent@salescopilot.io',
      role: PlatformRole.USER,
    };

    mockAuthService.updateProfile = async (_userId, dto) => ({
      ...mockUserDto,
      ...dto,
    });

    const result = await controller.updateProfile(userPayload, {
      name: 'Updated Name',
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    assert.strictEqual(result.name, 'Updated Name');
    assert.strictEqual(result.avatarUrl, 'https://example.com/avatar.jpg');
  });
});
