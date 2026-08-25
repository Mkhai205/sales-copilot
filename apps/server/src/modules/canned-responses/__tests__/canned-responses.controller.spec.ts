import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { CannedResponsesController } from '../canned-responses.controller';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('CannedResponsesController (Presentation Layer Endpoints)', () => {
  let controller: CannedResponsesController;
  let mockCannedResponsesService: any;
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

    mockCannedResponsesService = {
      list: async (workspaceId: string, _query: any) => [
        {
          id: 'cr_1',
          workspaceId,
          shortCode: 'chao',
          content: 'Xin chào',
          createdAt: '2026-08-25T00:00:00Z',
          updatedAt: '2026-08-25T00:00:00Z',
        },
      ],
      create: async (workspaceId: string, dto: any) => ({
        id: 'cr_new',
        workspaceId,
        shortCode: dto.shortCode,
        content: dto.content,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      getById: async (workspaceId: string, id: string) => ({
        id,
        workspaceId,
        shortCode: 'chao',
        content: 'Xin chào',
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      update: async (workspaceId: string, id: string, dto: any) => ({
        id,
        workspaceId,
        shortCode: dto.shortCode ?? 'chao',
        content: dto.content ?? 'Xin chào',
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      delete: async (_workspaceId: string, _id: string) => ({ success: true }),
    };

    controller = new CannedResponsesController(mockCannedResponsesService as any);
  });

  it('should list canned responses passing workspaceId from context', async () => {
    const result = await controller.list(context, { search: 'chao' });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].shortCode, 'chao');
    assert.strictEqual(result[0].workspaceId, 'ws_test_123');
  });

  it('should create canned response delegating to service', async () => {
    const result = await controller.create(context, {
      shortCode: '/baogia',
      content: 'Báo giá chi tiết',
    });
    assert.strictEqual(result.shortCode, '/baogia');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should get canned response by ID delegating to service', async () => {
    const result = await controller.getById(context, 'cr_1');
    assert.strictEqual(result.id, 'cr_1');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should update canned response delegating to service', async () => {
    const result = await controller.update(context, 'cr_1', {
      content: 'Updated content',
    });
    assert.strictEqual(result.content, 'Updated content');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should delete canned response delegating to service', async () => {
    const result = await controller.delete(context, 'cr_1');
    assert.deepStrictEqual(result, { success: true });
  });
});
