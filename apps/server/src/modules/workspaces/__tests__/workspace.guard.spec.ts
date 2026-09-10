import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ExecutionContext } from '@nestjs/common';
import { BillingPlanType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { WorkspacesService } from '../workspaces.service';

describe('WorkspaceGuard (Tenant Isolation & Context Injection)', () => {
  let guard: WorkspaceGuard;
  let mockWorkspacesService: Partial<WorkspacesService>;

  const mockWorkspace = {
    id: 'ws_tenant_123',
    name: 'Acme Corp',
    slug: 'acme-corp',
    billingPlan: BillingPlanType.FREE,
    timezone: 'Asia/Ho_Chi_Minh',
    defaultLanguage: 'vi',
    settings: {},
    isSuspended: false,
    suspendedReason: null,
    suspendedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockWorkspacesService = {
      findMember: async (workspaceId: string, userId: string) => {
        if (workspaceId === 'ws_tenant_123' && userId === 'usr_valid_123') {
          return {
            id: 'wm_123',
            role: WorkspaceRole.OWNER,
            workspace: mockWorkspace,
          };
        }
        return null;
      },
    };

    guard = new WorkspaceGuard(mockWorkspacesService as WorkspacesService);
  });

  function createMockExecutionContext(
    headers: Record<string, string | string[]> = {},
    user: any = undefined,
    type = 'http',
    params: Record<string, string> = {},
  ): {
    context: ExecutionContext;
    request: any;
  } {
    const request = {
      headers,
      user,
      params,
      workspace: undefined,
    };

    const context = {
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  it('should allow access and attach workspace context when user is an active workspace member', async () => {
    const { context, request } = createMockExecutionContext(
      { 'x-workspace-id': 'ws_tenant_123' },
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
    );

    const result = await guard.canActivate(context);

    assert.strictEqual(result, true);
    assert.ok(request.workspace);
    assert.strictEqual(request.workspace.workspaceId, 'ws_tenant_123');
    assert.strictEqual(request.workspace.role, WorkspaceRole.OWNER);
    assert.strictEqual(request.workspace.workspace.name, 'Acme Corp');
  });

  it('should throw BadRequestException when X-Workspace-Id header is missing', async () => {
    const { context } = createMockExecutionContext(
      {},
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_ID_REQUIRED');
        return true;
      },
    );
  });

  it('should throw BadRequestException when X-Workspace-Id header is empty string', async () => {
    const { context } = createMockExecutionContext(
      { 'x-workspace-id': '   ' },
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_ID_REQUIRED');
        return true;
      },
    );
  });

  it('should throw UnauthorizedException when user is not authenticated', async () => {
    const { context } = createMockExecutionContext(
      { 'x-workspace-id': 'ws_tenant_123' },
      undefined,
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'UNAUTHORIZED');
        return true;
      },
    );
  });

  it('should throw ForbiddenException when user is not a member of the workspace (Cross-Tenant Access Denial)', async () => {
    const { context } = createMockExecutionContext(
      { 'x-workspace-id': 'ws_tenant_123' },
      { userId: 'usr_stranger_999', email: 'stranger@other.com', role: 'USER' },
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_ACCESS_DENIED');
        return true;
      },
    );
  });

  it('should allow access when workspaceId is provided via route params instead of header', async () => {
    const { context, request } = createMockExecutionContext(
      {},
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
      'http',
      { workspaceId: 'ws_tenant_123' },
    );

    const result = await guard.canActivate(context);
    assert.strictEqual(result, true);
    assert.strictEqual(request.workspace?.workspaceId, 'ws_tenant_123');
  });

  it('should throw BadRequestException with WORKSPACE_ID_MISMATCH when header and param differ', async () => {
    const { context } = createMockExecutionContext(
      { 'x-workspace-id': 'ws_tenant_123' },
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
      'http',
      { workspaceId: 'ws_other_456' },
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_ID_MISMATCH');
        return true;
      },
    );
  });

  it('should throw ForbiddenException with WORKSPACE_SUSPENDED when workspace is suspended', async () => {
    const suspendedDate = new Date('2026-03-01T12:00:00Z');
    mockWorkspacesService.findMember = async () => ({
      id: 'wm_123',
      role: WorkspaceRole.OWNER,
      workspace: {
        ...mockWorkspace,
        isSuspended: true,
        suspendedReason: 'Payment overdue',
        suspendedAt: suspendedDate,
      },
    });

    const { context } = createMockExecutionContext(
      { 'x-workspace-id': 'ws_tenant_123' },
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_SUSPENDED');
        assert.strictEqual(err.response?.message, 'Payment overdue');
        assert.strictEqual(err.response?.details?.suspendedReason, 'Payment overdue');
        assert.strictEqual(err.response?.details?.suspendedAt, suspendedDate);
        return true;
      },
    );
  });

  it('should use fallback message when workspace is suspended without specific reason', async () => {
    mockWorkspacesService.findMember = async () => ({
      id: 'wm_123',
      role: WorkspaceRole.OWNER,
      workspace: {
        ...mockWorkspace,
        isSuspended: true,
        suspendedReason: null,
        suspendedAt: null,
      },
    });

    const { context } = createMockExecutionContext(
      { 'x-workspace-id': 'ws_tenant_123' },
      { userId: 'usr_valid_123', email: 'owner@acme.com', role: 'USER' },
    );

    await assert.rejects(
      async () => {
        await guard.canActivate(context);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_SUSPENDED');
        assert.strictEqual(
          err.response?.message,
          'Workspace has been suspended by platform administrator',
        );
        return true;
      },
    );
  });
});
