import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformAuditAction, PlatformAuditTargetType } from '@sales-copilot/shared-contracts';
import {
  CreatePlatformAuditLogParams,
  PlatformAuditLogsService,
} from '../services/platform-audit-logs.service';

describe('PlatformAuditLogsService (Super Admin Security Tracing)', () => {
  let service: PlatformAuditLogsService;
  let mockPrisma: any;
  let logsStore: any[];

  beforeEach(() => {
    logsStore = [
      {
        id: 'log_1',
        actorId: 'admin_1',
        actorEmail: 'admin@platform.com',
        action: PlatformAuditAction.WORKSPACE_SUSPENDED,
        targetType: PlatformAuditTargetType.WORKSPACE,
        targetId: 'ws_alpha',
        metadata: { reason: 'Terms violation' },
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2026-03-01T10:00:00Z'),
      },
      {
        id: 'log_2',
        actorId: 'admin_2',
        actorEmail: 'security@platform.com',
        action: PlatformAuditAction.PLAN_CHANGED,
        targetType: PlatformAuditTargetType.WORKSPACE,
        targetId: 'ws_beta',
        metadata: { oldPlan: 'FREE', newPlan: 'STANDARD' },
        ipAddress: '5.6.7.8',
        userAgent: 'Chrome/128.0',
        createdAt: new Date('2026-03-05T14:30:00Z'),
      },
      {
        id: 'log_3',
        actorId: 'admin_1',
        actorEmail: 'admin@platform.com',
        action: PlatformAuditAction.SYSTEM_SETTING_UPDATED,
        targetType: PlatformAuditTargetType.SYSTEM_SETTING,
        targetId: 'feature.pos_vietqr_enabled',
        metadata: { key: 'feature.pos_vietqr_enabled', oldValue: false, newValue: true },
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date('2026-03-10T08:00:00Z'),
      },
    ];

    mockPrisma = {
      getClient: () => ({
        platformAuditLog: {
          count: async ({ where }: any) => {
            return filterLogs(logsStore, where).length;
          },
          findMany: async ({ where, skip, take, orderBy }: any) => {
            const result = filterLogs(logsStore, where);
            if (orderBy?.createdAt === 'desc') {
              result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            }
            return result.slice(skip || 0, (skip || 0) + (take || 20));
          },
          findUnique: async ({ where }: any) => {
            return logsStore.find(l => l.id === where.id) || null;
          },
          create: async ({ data }: any) => {
            const newLog = {
              id: `log_${Date.now()}`,
              ...data,
              createdAt: new Date(),
            };
            logsStore.push(newLog);
            return newLog;
          },
        },
      }),
      client: {
        platformAuditLog: {
          create: async ({ data }: any) => {
            const newLog = {
              id: `log_standalone_${Date.now()}`,
              ...data,
              createdAt: new Date(),
            };
            logsStore.push(newLog);
            return newLog;
          },
        },
      },
    };

    service = new PlatformAuditLogsService(mockPrisma);
  });

  function filterLogs(logs: any[], where?: any) {
    if (!where) return [...logs];
    return logs.filter(item => {
      if (where.action && item.action !== where.action) return false;
      if (where.targetType && item.targetType !== where.targetType) return false;
      if (where.targetId && item.targetId !== where.targetId) return false;
      if (where.actorEmail?.contains) {
        const query = where.actorEmail.contains.toLowerCase();
        if (!item.actorEmail.toLowerCase().includes(query)) return false;
      }
      if (where.createdAt) {
        if (where.createdAt.gte && item.createdAt.getTime() < where.createdAt.gte.getTime()) {
          return false;
        }
        if (where.createdAt.lte && item.createdAt.getTime() > where.createdAt.lte.getTime()) {
          return false;
        }
      }
      return true;
    });
  }

  describe('getAuditLogs', () => {
    it('should return paginated audit logs ordered descending by createdAt', async () => {
      const res = await service.getAuditLogs({});
      assert.strictEqual(res.items.length, 3);
      assert.strictEqual(res.meta.total, 3);
      assert.strictEqual(res.meta.page, 1);
      assert.strictEqual(res.meta.limit, 20);
      assert.strictEqual(res.meta.totalPages, 1);
      // Descending order: log_3 (March 10), log_2 (March 5), log_1 (March 1)
      assert.strictEqual(res.items[0].id, 'log_3');
      assert.strictEqual(res.items[1].id, 'log_2');
      assert.strictEqual(res.items[2].id, 'log_1');
    });

    it('should paginate correctly with custom page and limit', async () => {
      const res = await service.getAuditLogs({ page: 2, limit: 1 });
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'log_2');
      assert.strictEqual(res.meta.page, 2);
      assert.strictEqual(res.meta.limit, 1);
      assert.strictEqual(res.meta.total, 3);
      assert.strictEqual(res.meta.totalPages, 3);
    });

    it('should clamp invalid pagination inputs safely', async () => {
      const res = await service.getAuditLogs({ page: -5, limit: 500 });
      assert.strictEqual(res.meta.page, 1);
      assert.strictEqual(res.meta.limit, 100);
    });

    it('should filter logs by action', async () => {
      const res = await service.getAuditLogs({ action: PlatformAuditAction.WORKSPACE_SUSPENDED });
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'log_1');
      assert.strictEqual(res.items[0].action, PlatformAuditAction.WORKSPACE_SUSPENDED);
    });

    it('should filter logs by targetType and targetId', async () => {
      const res = await service.getAuditLogs({
        targetType: PlatformAuditTargetType.WORKSPACE,
        targetId: 'ws_beta',
      });
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'log_2');
      assert.strictEqual(res.items[0].targetId, 'ws_beta');
    });

    it('should filter logs by actorEmail (case-insensitive substring)', async () => {
      const res = await service.getAuditLogs({ actorEmail: 'SECURITY' });
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'log_2');
      assert.strictEqual(res.items[0].actorEmail, 'security@platform.com');
    });

    it('should filter logs by date range (startDate and endDate)', async () => {
      const res = await service.getAuditLogs({
        startDate: '2026-03-02T00:00:00Z',
        endDate: '2026-03-06T23:59:59Z',
      });
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'log_2');
    });

    it('should expand plain YYYY-MM-DD endDate to end of day and capture events created on endDate', async () => {
      // log_2 was created at 2026-03-05T14:30:00Z.
      // Plain YYYY-MM-DD endDate "2026-03-05" should be expanded to 23:59:59.999Z and include log_2.
      const res = await service.getAuditLogs({
        startDate: '2026-03-05',
        endDate: '2026-03-05',
      });
      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].id, 'log_2');
    });
  });

  describe('getAuditLogById', () => {
    it('should return log entry when found', async () => {
      const log = await service.getAuditLogById('log_1');
      assert.strictEqual(log.id, 'log_1');
      assert.strictEqual(log.actorEmail, 'admin@platform.com');
      assert.strictEqual(log.action, PlatformAuditAction.WORKSPACE_SUSPENDED);
      assert.deepStrictEqual(log.metadata, { reason: 'Terms violation' });
    });

    it('should throw NotFoundException when log entry is not found', async () => {
      await assert.rejects(
        async () => {
          await service.getAuditLogById('non_existent_id');
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          const response = err.getResponse() as Record<string, unknown>;
          assert.strictEqual(response?.code, 'AUDIT_LOG_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when id is empty or whitespace', async () => {
      await assert.rejects(
        async () => {
          await service.getAuditLogById('   ');
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          const response = err.getResponse() as Record<string, unknown>;
          assert.strictEqual(response?.code, 'AUDIT_LOG_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('logAction', () => {
    it('should create audit log entry using standalone prisma client', async () => {
      const entry: CreatePlatformAuditLogParams = {
        actorId: 'admin_3',
        actorEmail: 'superadmin@salescopilot.io',
        action: PlatformAuditAction.QUOTA_UPDATED,
        targetType: PlatformAuditTargetType.WORKSPACE,
        targetId: 'ws_gamma',
        metadata: { maxAgents: 10 },
        ipAddress: '127.0.0.1',
        userAgent: 'Node/20',
      };

      const created = await service.logAction(entry);
      assert.ok(created.id);
      assert.strictEqual(created.actorEmail, 'superadmin@salescopilot.io');
      assert.strictEqual(created.action, PlatformAuditAction.QUOTA_UPDATED);
      assert.strictEqual(created.targetId, 'ws_gamma');
      assert.deepStrictEqual(created.metadata, { maxAgents: 10 });
    });

    it('should create audit log entry inside explicit transaction client', async () => {
      const txLogs: any[] = [];
      const mockTx: any = {
        platformAuditLog: {
          create: async ({ data }: any) => {
            const item = { id: `log_tx_1`, ...data, createdAt: new Date() };
            txLogs.push(item);
            return item;
          },
        },
      };

      const entry: CreatePlatformAuditLogParams = {
        actorId: 'admin_tx',
        actorEmail: 'tx_admin@platform.com',
        action: PlatformAuditAction.WORKSPACE_ACTIVATED,
        targetType: PlatformAuditTargetType.WORKSPACE,
        targetId: 'ws_delta',
        metadata: { unbannedAt: new Date().toISOString() },
      };

      const created = await service.logAction(entry, mockTx);
      assert.strictEqual(created.id, 'log_tx_1');
      assert.strictEqual(txLogs.length, 1);
      assert.strictEqual(txLogs[0].targetId, 'ws_delta');
    });

    it('should throw BadRequestException when mandatory fields are missing', async () => {
      await assert.rejects(
        async () => {
          await service.logAction({
            actorId: '',
            actorEmail: 'admin@platform.com',
            action: PlatformAuditAction.QUOTA_UPDATED,
            targetType: PlatformAuditTargetType.WORKSPACE,
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          const response = err.getResponse() as Record<string, unknown>;
          assert.strictEqual(response?.code, 'INVALID_AUDIT_LOG_ENTRY');
          return true;
        },
      );
    });
  });
});
