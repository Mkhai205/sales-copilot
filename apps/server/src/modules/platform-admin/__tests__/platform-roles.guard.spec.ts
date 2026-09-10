import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { PlatformRolesGuard } from '../guards/platform-roles.guard';

describe('PlatformRolesGuard (Super Admin Platform Security)', () => {
  let guard: PlatformRolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PlatformRolesGuard(reflector);
  });

  function createMockExecutionContext(
    user?: { userId?: string; email?: string; role?: PlatformRole } | null,
    type = 'http',
  ): ExecutionContext {
    const request = {
      user: user ?? undefined,
    };

    return {
      getType: () => type,
      getClass: () => ({}),
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no platform roles are required on the endpoint', () => {
    const context = createMockExecutionContext({
      userId: 'u-1',
      email: 'user@test.com',
      role: PlatformRole.USER,
    });
    reflector.getAllAndOverride = () => undefined;

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should allow access when empty roles array is configured', () => {
    const context = createMockExecutionContext({
      userId: 'u-1',
      email: 'user@test.com',
      role: PlatformRole.USER,
    });
    reflector.getAllAndOverride = () => [];

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should allow access when user role matches required role (SUPER_ADMIN)', () => {
    const context = createMockExecutionContext({
      userId: 'u-admin',
      email: 'superadmin@salescopilot.io',
      role: PlatformRole.SUPER_ADMIN,
    });
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN];

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should throw ForbiddenException (INSUFFICIENT_PLATFORM_PERMISSIONS) when user has role USER', () => {
    const context = createMockExecutionContext({
      userId: 'u-regular',
      email: 'regular@test.com',
      role: PlatformRole.USER,
    });
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INSUFFICIENT_PLATFORM_PERMISSIONS');
        assert.match(err.response?.message, /Super administrator privileges required/i);
        return true;
      },
    );
  });

  it('should throw ForbiddenException (PLATFORM_AUTH_REQUIRED) when request user is undefined', () => {
    const context = createMockExecutionContext(null);
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'PLATFORM_AUTH_REQUIRED');
        assert.match(err.response?.message, /Platform authentication required/i);
        return true;
      },
    );
  });

  it('should throw ForbiddenException (PLATFORM_AUTH_REQUIRED) when request user has no role property', () => {
    const context = createMockExecutionContext({
      userId: 'u-norole',
      email: 'norole@test.com',
    });
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'PLATFORM_AUTH_REQUIRED');
        return true;
      },
    );
  });

  it('should throw ForbiddenException (UNSUPPORTED_CONTEXT) for non-http contexts', () => {
    const context = createMockExecutionContext(
      {
        userId: 'u-admin',
        email: 'superadmin@salescopilot.io',
        role: PlatformRole.SUPER_ADMIN,
      },
      'ws',
    );
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'UNSUPPORTED_CONTEXT');
        assert.match(err.response?.message, /HTTP context/i);
        return true;
      },
    );
  });

  it('should allow access when multiple roles are configured and user has one of them', () => {
    const context = createMockExecutionContext({
      userId: 'u-user',
      email: 'user@test.com',
      role: PlatformRole.USER,
    });
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN, PlatformRole.USER];

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should throw ForbiddenException when user has workspace role ADMIN instead of SUPER_ADMIN', () => {
    const context = createMockExecutionContext({
      userId: 'u-workspace-admin',
      email: 'admin@test.com',
      role: 'ADMIN' as any,
    });
    reflector.getAllAndOverride = () => [PlatformRole.SUPER_ADMIN];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INSUFFICIENT_PLATFORM_PERMISSIONS');
        return true;
      },
    );
  });
});
