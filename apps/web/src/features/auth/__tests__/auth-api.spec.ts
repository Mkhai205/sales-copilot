import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { authApi } from '../api/auth';
import type {
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  UpdateUserProfileDto,
  ChangePasswordDto,
} from '@sales-copilot/shared-contracts';

describe('Auth API Client (Phase 1)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('authApi Client Methods', () => {
    it('login() should perform POST to /auth/login with credentials in body', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              user: { id: 'usr_1', email: 'test@example.com', name: 'Tester' },
              tokens: {
                accessToken: 'acc_token_123',
                refreshToken: 'ref_token_123',
                expiresIn: 3600,
              },
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const dto: LoginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const res = await authApi.login(dto);

      assert.ok(requestedUrl.includes('/auth/login'));
      assert.strictEqual(requestedMethod, 'POST');
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.email, 'test@example.com');
      assert.strictEqual(body.password, 'Password123!');
      assert.strictEqual(res.data.user.email, 'test@example.com');
      assert.strictEqual(res.data.tokens.accessToken, 'acc_token_123');
    });

    it('refresh() should perform POST to /auth/refresh with refreshToken in body', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              accessToken: 'new_acc_token',
              refreshToken: 'new_ref_token',
              expiresIn: 3600,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const dto: RefreshTokenDto = {
        refreshToken: 'old_ref_token',
      };

      const res = await authApi.refresh(dto);

      assert.ok(requestedUrl.includes('/auth/refresh'));
      assert.strictEqual(requestedMethod, 'POST');
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.refreshToken, 'old_ref_token');
      assert.strictEqual(res.data.accessToken, 'new_acc_token');
    });

    it('logout() should perform POST to /auth/logout with payload', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { loggedOut: true },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const dto: LogoutDto = {
        refreshToken: 'some_token',
      };

      const res = await authApi.logout(dto);

      assert.ok(requestedUrl.includes('/auth/logout'));
      assert.strictEqual(requestedMethod, 'POST');
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.refreshToken, 'some_token');
      assert.strictEqual(res.data.loggedOut, true);
    });

    it('me() should perform GET to /auth/me', async () => {
      let requestedUrl = '';
      let requestedMethod = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 'usr_me', email: 'me@example.com', name: 'My Profile' },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await authApi.me();

      assert.ok(requestedUrl.includes('/auth/me'));
      assert.strictEqual(requestedMethod, 'GET');
      assert.strictEqual(res.data.id, 'usr_me');
    });

    it('updateProfile() should perform PATCH to /auth/me with update fields', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { id: 'usr_me', email: 'me@example.com', name: 'Updated Name' },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const dto: UpdateUserProfileDto = {
        name: 'Updated Name',
      };

      const res = await authApi.updateProfile(dto);

      assert.ok(requestedUrl.includes('/auth/me'));
      assert.strictEqual(requestedMethod, 'PATCH');
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.name, 'Updated Name');
      assert.strictEqual(res.data.name, 'Updated Name');
    });

    it('changePassword() should perform POST to /auth/change-password with passwords', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || 'GET';
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { success: true, message: 'Password changed successfully' },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const dto: ChangePasswordDto = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      };

      const res = await authApi.changePassword(dto);

      assert.ok(requestedUrl.includes('/auth/change-password'));
      assert.strictEqual(requestedMethod, 'POST');
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.currentPassword, 'OldPassword123!');
      assert.strictEqual(body.newPassword, 'NewPassword123!');
      assert.strictEqual(res.data.success, true);
    });
  });
});
