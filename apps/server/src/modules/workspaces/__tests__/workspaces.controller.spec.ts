import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BillingPlanType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { WorkspacesController } from '../workspaces.controller';
import { WorkspacesService } from '../workspaces.service';
import type { WorkspaceContext } from '../types/workspace-context.type';

describe('WorkspacesController (Presentation Layer Endpoints)', () => {
  let controller: WorkspacesController;
  let mockWorkspacesService: Partial<WorkspacesService>;

  const mockWorkspace = {
    id: 'ws_sample_1',
    name: 'Sample Workspace',
    slug: 'sample-workspace',
    billingPlan: BillingPlanType.FREE,
    timezone: 'Asia/Ho_Chi_Minh',
    defaultLanguage: 'vi',
    settings: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockWorkspacesService = {
      findWorkspacesByUserId: async (_userId: string) => [
        {
          ...mockWorkspace,
          role: WorkspaceRole.OWNER,
        },
      ],
      createWorkspace: async (_userId: string, dto: any) => ({
        ...mockWorkspace,
        name: dto.name,
        slug: dto.slug || 'sample-workspace',
      }),
      getWorkspaceForContext: async (_workspaceId: string) => mockWorkspace,
      updateWorkspace: async (_workspaceId: string, dto: any) => ({
        ...mockWorkspace,
        ...dto,
      }),
    };

    controller = new WorkspacesController(mockWorkspacesService as WorkspacesService);
  });

  it('should return workspaces list for current user', async () => {
    const result = await controller.getMyWorkspaces({
      userId: 'usr_1',
      email: 'user@example.com',
      role: 'USER',
    });

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'ws_sample_1');
    assert.strictEqual(result[0].role, WorkspaceRole.OWNER);
  });

  it('should handle workspace creation request', async () => {
    const result = await controller.createWorkspace(
      { userId: 'usr_1', email: 'user@example.com', role: 'USER' },
      { name: 'New Company', slug: 'new-company' },
    );

    assert.strictEqual(result.name, 'New Company');
    assert.strictEqual(result.slug, 'new-company');
  });

  it('should handle get current workspace request', async () => {
    const context: WorkspaceContext = {
      workspaceId: 'ws_sample_1',
      role: WorkspaceRole.ADMIN,
      workspace: mockWorkspace,
    };

    const result = await controller.getCurrentWorkspace(context);
    assert.strictEqual(result.id, 'ws_sample_1');
    assert.strictEqual(result.name, 'Sample Workspace');
  });

  it('should delegate updateCurrentWorkspace to service', async () => {
    const context: WorkspaceContext = {
      workspaceId: 'ws_sample_1',
      role: WorkspaceRole.OWNER,
      workspace: mockWorkspace,
    };

    const result = await controller.updateCurrentWorkspace(context, {
      name: 'Updated Name',
      timezone: 'UTC',
    });

    assert.strictEqual(result.name, 'Updated Name');
    assert.strictEqual(result.timezone, 'UTC');
  });
});
