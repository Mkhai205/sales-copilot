import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { AuditLogsController } from '../audit-logs.controller';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('AuditLogsController (Presentation Layer Endpoints)', () => {
  let controller: AuditLogsController;
  let mockAuditLogService: any;
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

    mockAuditLogService = {
      list: async (workspaceId: string, query: any) => ({
        items: [
          {
            id: 'aud_1',
            workspaceId,
            userId: 'usr_admin',
            action: 'MEMBER_ADDED',
            resourceType: 'WORKSPACE_MEMBER',
            resourceId: 'wm_1',
            payload: { email: 'test@example.com' },
            ipAddress: '127.0.0.1',
            createdAt: '2026-08-25T00:00:00Z',
            user: {
              id: 'usr_admin',
              email: 'admin@acme.com',
              name: 'Admin',
              avatarUrl: null,
            },
          },
        ],
        meta: {
          page: query?.page ?? 1,
          limit: query?.limit ?? 20,
          total: 1,
          hasMore: false,
        },
      }),
    };

    controller = new AuditLogsController(mockAuditLogService as any);
  });

  it('should list audit logs delegating to service with workspaceId from context', async () => {
    const result = await controller.list(context, { action: 'MEMBER_ADDED', page: 1, limit: 10 });
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].workspaceId, 'ws_test_123');
    assert.strictEqual(result.items[0].action, 'MEMBER_ADDED');
    assert.strictEqual(result.meta.page, 1);
    assert.strictEqual(result.meta.limit, 10);
    assert.strictEqual(result.meta.total, 1);
  });
});
