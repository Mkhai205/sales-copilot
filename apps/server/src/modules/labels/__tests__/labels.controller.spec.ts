import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { LabelsController } from '../labels.controller';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('LabelsController (Presentation Layer Endpoints)', () => {
  let controller: LabelsController;
  let mockLabelsService: any;
  let context: WorkspaceContext;

  beforeEach(() => {
    context = {
      workspaceId: 'ws_test_123',
      role: WorkspaceRole.ADMIN,
      workspace: {
        id: 'ws_test_123',
        name: 'Acme Corp',
        slug: 'acme-corp',
        billingPlan: 'FREE',
        timezone: 'Asia/Ho_Chi_Minh',
        defaultLanguage: 'vi',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    mockLabelsService = {
      list: async (workspaceId: string, query: any) => [
        {
          id: 'lbl_1',
          workspaceId,
          title: 'VIP',
          color: '#FF0000',
          showOnSidebar: true,
          createdAt: '2026-08-23T00:00:00Z',
          updatedAt: '2026-08-23T00:00:00Z',
        },
      ],
      create: async (workspaceId: string, dto: any) => ({
        id: 'lbl_new',
        workspaceId,
        title: dto.title,
        description: dto.description ?? null,
        color: dto.color ?? '#2563eb',
        showOnSidebar: dto.showOnSidebar ?? true,
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      getById: async (workspaceId: string, id: string) => ({
        id,
        workspaceId,
        title: 'VIP',
        color: '#FF0000',
        showOnSidebar: true,
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      update: async (workspaceId: string, id: string, dto: any) => ({
        id,
        workspaceId,
        title: dto.title ?? 'VIP',
        color: dto.color ?? '#FF0000',
        showOnSidebar: true,
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      delete: async (workspaceId: string, id: string) => ({ success: true }),
    };

    controller = new LabelsController(mockLabelsService as any);
  });

  it('should list labels passing workspaceId from context', async () => {
    const result = await controller.list(context);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].title, 'VIP');
    assert.strictEqual(result[0].workspaceId, 'ws_test_123');
  });

  it('should create label delegating to service', async () => {
    const result = await controller.create(context, {
      title: 'Urgent',
      color: '#FF0000',
    });
    assert.strictEqual(result.title, 'Urgent');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should get label by ID delegating to service', async () => {
    const result = await controller.getById(context, 'lbl_1');
    assert.strictEqual(result.id, 'lbl_1');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should update label delegating to service', async () => {
    const result = await controller.update(context, 'lbl_1', {
      title: 'Updated VIP',
    });
    assert.strictEqual(result.title, 'Updated VIP');
    assert.strictEqual(result.id, 'lbl_1');
  });

  it('should delete label delegating to service', async () => {
    const result = await controller.delete(context, 'lbl_1');
    assert.deepStrictEqual(result, { success: true });
  });
});
