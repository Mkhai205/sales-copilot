import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { RolesGuard } from '../guards/roles.guard';

describe('RolesGuard (RBAC Permission Control)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockExecutionContext(
    workspaceRole?: WorkspaceRole,
    type = 'http',
  ): ExecutionContext {
    const request = {
      workspace: workspaceRole
        ? {
            workspaceId: 'ws_test_123',
            role: workspaceRole,
          }
        : undefined,
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

  it('should allow access when no roles are required on the endpoint', () => {
    const context = createMockExecutionContext(WorkspaceRole.AGENT);
    reflector.getAllAndOverride = () => undefined;

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should allow access when empty roles array is provided', () => {
    const context = createMockExecutionContext(WorkspaceRole.VIEWER);
    reflector.getAllAndOverride = () => [];

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should allow access when user role matches one of the required roles (OWNER in [OWNER, ADMIN])', () => {
    const context = createMockExecutionContext(WorkspaceRole.OWNER);
    reflector.getAllAndOverride = () => [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should allow access when user is ADMIN and ADMIN is in required roles', () => {
    const context = createMockExecutionContext(WorkspaceRole.ADMIN);
    reflector.getAllAndOverride = () => [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];

    const result = guard.canActivate(context);
    assert.strictEqual(result, true);
  });

  it('should throw ForbiddenException (INSUFFICIENT_PERMISSIONS) when user role is not in required roles', () => {
    const context = createMockExecutionContext(WorkspaceRole.AGENT);
    reflector.getAllAndOverride = () => [WorkspaceRole.OWNER, WorkspaceRole.ADMIN];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INSUFFICIENT_PERMISSIONS');
        return true;
      },
    );
  });

  it('should throw ForbiddenException (INSUFFICIENT_PERMISSIONS) when VIEWER attempts to access AGENT/ADMIN/OWNER endpoint', () => {
    const context = createMockExecutionContext(WorkspaceRole.VIEWER);
    reflector.getAllAndOverride = () => [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.AGENT,
    ];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'INSUFFICIENT_PERMISSIONS');
        return true;
      },
    );
  });

  it('should throw ForbiddenException (WORKSPACE_CONTEXT_REQUIRED) when workspace context is missing', () => {
    const context = createMockExecutionContext(undefined);
    reflector.getAllAndOverride = () => [WorkspaceRole.OWNER];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_CONTEXT_REQUIRED');
        return true;
      },
    );
  });

  it('should throw ForbiddenException for non-http contexts', () => {
    const context = createMockExecutionContext(WorkspaceRole.OWNER, 'ws');
    reflector.getAllAndOverride = () => [WorkspaceRole.OWNER];

    assert.throws(
      () => {
        guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'UNSUPPORTED_CONTEXT');
        return true;
      },
    );
  });
});
