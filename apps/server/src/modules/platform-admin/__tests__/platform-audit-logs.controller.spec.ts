import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import {
  PlatformAuditAction,
  PlatformAuditTargetType,
  QueryPlatformAuditLogsDto,
} from '@sales-copilot/shared-contracts';
import { PlatformAuditLogsController } from '../controllers/platform-audit-logs.controller';

describe('PlatformAuditLogsController (REST Endpoints)', () => {
  let controller: PlatformAuditLogsController;
  let mockService: any;
  let serviceCalls: {
    getAuditLogs: Array<Partial<QueryPlatformAuditLogsDto> | undefined>;
    getAuditLogById: string[];
  };

  beforeEach(() => {
    serviceCalls = {
      getAuditLogs: [],
      getAuditLogById: [],
    };

    mockService = {
      getAuditLogs: async (query?: Partial<QueryPlatformAuditLogsDto>) => {
        serviceCalls.getAuditLogs.push(query);
        return {
          items: [
            {
              id: 'log_mock_1',
              actorId: 'admin_1',
              actorEmail: 'admin@platform.com',
              action: PlatformAuditAction.WORKSPACE_SUSPENDED,
              targetType: PlatformAuditTargetType.WORKSPACE,
              targetId: 'ws_123',
              metadata: { reason: 'Test' },
              ipAddress: '127.0.0.1',
              userAgent: 'TestBrowser',
              createdAt: new Date(),
            },
          ],
          meta: {
            page: query?.page || 1,
            limit: query?.limit || 20,
            total: 1,
            totalPages: 1,
          },
        };
      },
      getAuditLogById: async (id: string) => {
        serviceCalls.getAuditLogById.push(id);
        return {
          id,
          actorId: 'admin_1',
          actorEmail: 'admin@platform.com',
          action: PlatformAuditAction.PLAN_CHANGED,
          targetType: PlatformAuditTargetType.WORKSPACE,
          targetId: 'ws_456',
          metadata: { oldPlan: 'FREE', newPlan: 'STANDARD' },
          ipAddress: '127.0.0.1',
          userAgent: 'TestBrowser',
          createdAt: new Date(),
        };
      },
    };

    controller = new PlatformAuditLogsController(mockService);
  });

  it('should delegate list request with query filters to service', async () => {
    const query: Partial<QueryPlatformAuditLogsDto> = {
      page: 2,
      limit: 10,
      action: PlatformAuditAction.WORKSPACE_SUSPENDED,
      actorEmail: 'admin@platform.com',
    };

    const res = await controller.list(query);

    assert.strictEqual(serviceCalls.getAuditLogs.length, 1);
    assert.deepStrictEqual(serviceCalls.getAuditLogs[0], query);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].id, 'log_mock_1');
    assert.strictEqual(res.meta.page, 2);
    assert.strictEqual(res.meta.limit, 10);
  });

  it('should fallback to empty object when query is undefined', async () => {
    const res = await controller.list(undefined);

    assert.strictEqual(serviceCalls.getAuditLogs.length, 1);
    assert.deepStrictEqual(serviceCalls.getAuditLogs[0], {});
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.meta.page, 1);
  });

  it('should delegate getDetail request with ID to service', async () => {
    const res = await controller.getDetail('log_mock_999');

    assert.strictEqual(serviceCalls.getAuditLogById.length, 1);
    assert.strictEqual(serviceCalls.getAuditLogById[0], 'log_mock_999');
    assert.strictEqual(res.id, 'log_mock_999');
    assert.strictEqual(res.action, PlatformAuditAction.PLAN_CHANGED);
  });

  it('should propagate NotFoundException when service throws', async () => {
    mockService.getAuditLogById = async () => {
      throw new NotFoundException({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: 'Platform audit log not found',
      });
    };

    await assert.rejects(
      async () => {
        await controller.getDetail('non_existent');
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundException);
        return true;
      },
    );
  });
});
