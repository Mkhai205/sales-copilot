import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  BillingPlanType,
  PlatformAuditAction,
  PlatformAuditTargetType,
} from '@sales-copilot/shared-contracts';
import { PlatformWorkspacesService } from '../services/platform-workspaces.service';

describe('PlatformWorkspacesService (Super Admin Workspace Management)', () => {
  let service: PlatformWorkspacesService;
  let mockPrisma: any;
  let mockSystemSettings: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let dbWorkspaces: Map<string, any>;
  let dbAuditLogs: any[];
  let settingsStore: Map<string, any>;

  const actor = {
    userId: 'admin_usr_1',
    email: 'admin@platform.com',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 TestBrowser',
  };

  beforeEach(() => {
    dbWorkspaces = new Map();
    dbAuditLogs = [];
    settingsStore = new Map();
    emittedEvents = [];

    // Seed sample workspaces
    dbWorkspaces.set('ws_1', {
      id: 'ws_1',
      name: 'Alpha Fashion',
      slug: 'alpha-fashion',
      billingPlan: BillingPlanType.FREE,
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {
        quotas: { maxAgents: 5 },
        usage: { storageUsedMb: 120, aiUsedTokens: 15000 },
      },
      isSuspended: false,
      suspendedReason: null,
      suspendedAt: null,
      createdAt: new Date('2026-01-10T08:00:00Z'),
      updatedAt: new Date('2026-01-10T08:00:00Z'),
      members: [
        {
          id: 'wm_1',
          userId: 'usr_owner_1',
          role: 'OWNER',
          createdAt: new Date('2026-01-10T08:00:00Z'),
          user: {
            id: 'usr_owner_1',
            email: 'owner@alpha.com',
            name: 'Alpha Owner',
          },
        },
        {
          id: 'wm_2',
          userId: 'usr_agent_1',
          role: 'AGENT',
          createdAt: new Date('2026-01-11T08:00:00Z'),
          user: {
            id: 'usr_agent_1',
            email: 'agent@alpha.com',
            name: 'Alpha Agent',
          },
        },
      ],
      channels: [{ id: 'ch_1' }, { id: 'ch_2' }],
    });

    dbWorkspaces.set('ws_2', {
      id: 'ws_2',
      name: 'Beta Shoes',
      slug: 'beta-shoes',
      billingPlan: BillingPlanType.STANDARD,
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {},
      isSuspended: true,
      suspendedReason: 'Policy violation',
      suspendedAt: new Date('2026-02-01T10:00:00Z'),
      createdAt: new Date('2026-01-15T09:00:00Z'),
      updatedAt: new Date('2026-02-01T10:00:00Z'),
      members: [
        {
          id: 'wm_3',
          userId: 'usr_owner_2',
          role: 'OWNER',
          createdAt: new Date('2026-01-15T09:00:00Z'),
          user: {
            id: 'usr_owner_2',
            email: 'owner@beta.com',
            name: 'Beta Owner',
          },
        },
      ],
      channels: [],
    });

    mockSystemSettings = {
      getSetting: async (key: string, defaultValue: any) => {
        return settingsStore.has(key) ? settingsStore.get(key) : defaultValue;
      },
    };

    const filterWorkspaces = (where: any) => {
      let list = Array.from(dbWorkspaces.values());
      if (where?.billingPlan) {
        list = list.filter(w => w.billingPlan === where.billingPlan);
      }
      if (where?.isSuspended !== undefined) {
        list = list.filter(w => w.isSuspended === where.isSuspended);
      }
      if (where?.OR) {
        list = list.filter(w => {
          return where.OR.some((clause: any) => {
            if (clause.name?.contains) {
              return w.name.toLowerCase().includes(clause.name.contains.toLowerCase());
            }
            if (clause.slug?.contains) {
              return w.slug.toLowerCase().includes(clause.slug.contains.toLowerCase());
            }
            if (clause.members?.some?.user?.OR) {
              return w.members.some((m: any) =>
                clause.members.some.user.OR.some(
                  (subClause: any) =>
                    (subClause.email?.contains &&
                      m.user.email
                        .toLowerCase()
                        .includes(subClause.email.contains.toLowerCase())) ||
                    (subClause.name?.contains &&
                      m.user.name.toLowerCase().includes(subClause.name.contains.toLowerCase())),
                ),
              );
            }
            if (clause.members?.some?.user?.email?.contains) {
              return w.members.some((m: any) =>
                m.user.email
                  .toLowerCase()
                  .includes(clause.members.some.user.email.contains.toLowerCase()),
              );
            }
            return false;
          });
        });
      }
      return list;
    };

    const prismaClientMock = {
      workspace: {
        count: async ({ where }: any) => {
          return filterWorkspaces(where).length;
        },
        findMany: async ({ where, skip, take, orderBy }: any) => {
          const list = filterWorkspaces(where);
          if (orderBy) {
            const field = Object.keys(orderBy)[0];
            const dir = orderBy[field];
            list.sort((a, b) => {
              if (a[field] < b[field]) return dir === 'asc' ? -1 : 1;
              if (a[field] > b[field]) return dir === 'asc' ? 1 : -1;
              return 0;
            });
          }

          const paginated = list.slice(skip || 0, (skip || 0) + (take || 20));
          return paginated.map(w => ({
            ...w,
            _count: {
              members: w.members.length,
              channels: w.channels.length,
            },
            members: w.members.filter((m: any) => m.role === 'OWNER').slice(0, 1),
          }));
        },
        findUnique: async ({ where, include: _include }: any) => {
          const found = dbWorkspaces.get(where.id);
          if (!found) return null;
          return {
            ...found,
            _count: {
              members: found.members.length,
              channels: found.channels.length,
            },
            members: found.members,
          };
        },
        update: async ({ where, data }: any) => {
          const existing = dbWorkspaces.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            settings: data.settings
              ? { ...existing.settings, ...data.settings }
              : existing.settings,
            updatedAt: new Date(),
          };
          dbWorkspaces.set(where.id, updated);
          return updated;
        },
      },
      platformAuditLog: {
        create: async ({ data }: any) => {
          const log = { id: `log_${Date.now()}`, ...data, createdAt: new Date() };
          dbAuditLogs.push(log);
          return log;
        },
      },
    };

    mockPrisma = {
      client: prismaClientMock,
      getClient: () => prismaClientMock,
      runInTransaction: async (cb: (ctx: any) => Promise<any>) => {
        return cb({ tx: prismaClientMock });
      },
    };

    const mockEventEmitter: any = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    service = new PlatformWorkspacesService(mockPrisma, mockSystemSettings, mockEventEmitter);
  });

  describe('getDefaultQuotas', () => {
    it('should return system settings dynamic quotas when available', async () => {
      settingsStore.set('quotas.free.max_agents', 4);
      settingsStore.set('quotas.free.max_channels', 3);
      settingsStore.set('quotas.free.storage_mb', 1000);
      settingsStore.set('quotas.free.ai_monthly_tokens', 80000);

      const quotas = await service.getDefaultQuotas(BillingPlanType.FREE);
      assert.strictEqual(quotas.maxAgents, 4);
      assert.strictEqual(quotas.maxChannels, 3);
      assert.strictEqual(quotas.storageLimitMb, 1000);
      assert.strictEqual(quotas.aiMonthlyTokens, 80000);
    });

    it('should return fallback defaults when system settings are unset', async () => {
      const freeQuotas = await service.getDefaultQuotas(BillingPlanType.FREE);
      assert.strictEqual(freeQuotas.maxAgents, 2);
      assert.strictEqual(freeQuotas.maxChannels, 2);
      assert.strictEqual(freeQuotas.storageLimitMb, 500);
      assert.strictEqual(freeQuotas.aiMonthlyTokens, 50000);

      const standardQuotas = await service.getDefaultQuotas(BillingPlanType.STANDARD);
      assert.strictEqual(standardQuotas.maxAgents, 10);
      assert.strictEqual(standardQuotas.maxChannels, 5);

      const enterpriseQuotas = await service.getDefaultQuotas(BillingPlanType.ENTERPRISE);
      assert.strictEqual(enterpriseQuotas.maxAgents, 100);
      assert.strictEqual(enterpriseQuotas.maxChannels, 20);
    });
  });

  describe('getWorkspaces', () => {
    it('should return paginated workspaces with meta', async () => {
      const result = await service.getWorkspaces({ page: 1, limit: 10 });
      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.total, 2);
      assert.strictEqual(result.meta.page, 1);
      assert.strictEqual(result.meta.limit, 10);
      assert.strictEqual(result.items[0].name, 'Beta Shoes'); // default desc by createdAt
    });

    it('should filter workspaces by search keyword on name, slug, or owner email', async () => {
      const byName = await service.getWorkspaces({ search: 'Alpha' });
      assert.strictEqual(byName.items.length, 1);
      assert.strictEqual(byName.items[0].id, 'ws_1');

      const bySlug = await service.getWorkspaces({ search: 'beta-shoes' });
      assert.strictEqual(bySlug.items.length, 1);
      assert.strictEqual(bySlug.items[0].id, 'ws_2');

      const byEmail = await service.getWorkspaces({ search: 'owner@alpha.com' });
      assert.strictEqual(byEmail.items.length, 1);
      assert.strictEqual(byEmail.items[0].id, 'ws_1');

      const byOwnerName = await service.getWorkspaces({ search: 'Alpha Owner' });
      assert.strictEqual(byOwnerName.items.length, 1);
      assert.strictEqual(byOwnerName.items[0].id, 'ws_1');
    });

    it('should filter workspaces by plan and suspension status', async () => {
      const activeFree = await service.getWorkspaces({
        plan: BillingPlanType.FREE,
        status: 'ACTIVE',
      });
      assert.strictEqual(activeFree.items.length, 1);
      assert.strictEqual(activeFree.items[0].id, 'ws_1');

      const suspended = await service.getWorkspaces({ status: 'SUSPENDED' });
      assert.strictEqual(suspended.items.length, 1);
      assert.strictEqual(suspended.items[0].id, 'ws_2');
    });
  });

  describe('getWorkspaceDetail', () => {
    it('should throw NotFoundException if workspace does not exist', async () => {
      await assert.rejects(
        async () => {
          await service.getWorkspaceDetail('ws_non_existent');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'WORKSPACE_NOT_FOUND');
          return true;
        },
      );
    });

    it('should return full workspace detail with effectiveQuotas and usage calculations', async () => {
      const detail = await service.getWorkspaceDetail('ws_1');
      assert.strictEqual(detail.id, 'ws_1');
      assert.strictEqual(detail.name, 'Alpha Fashion');
      // effectiveQuotas: custom maxAgents (5) overrides free default (2)
      assert.strictEqual(detail.quotas.maxAgents, 5);
      assert.strictEqual(detail.quotas.maxChannels, 2); // default
      // usage
      assert.strictEqual(detail.usage.currentAgents, 2);
      assert.strictEqual(detail.usage.currentChannels, 2);
      assert.strictEqual(detail.usage.storageUsedMb, 120);
      assert.strictEqual(detail.usage.aiUsedTokens, 15000);
      // members
      assert.strictEqual(detail.members.length, 2);
      assert.strictEqual(detail.members[0].email, 'owner@alpha.com');
      assert.strictEqual(detail.members[0].role, 'OWNER');
    });
  });

  describe('updateWorkspacePlan', () => {
    it('should update billingPlan and write PLAN_CHANGED audit log', async () => {
      const updated = await service.updateWorkspacePlan(
        'ws_1',
        { billingPlan: BillingPlanType.ENTERPRISE },
        actor,
      );

      assert.strictEqual(updated.billingPlan, BillingPlanType.ENTERPRISE);
      assert.strictEqual(dbAuditLogs.length, 1);
      assert.strictEqual(dbAuditLogs[0].action, PlatformAuditAction.PLAN_CHANGED);
      assert.strictEqual(dbAuditLogs[0].targetType, PlatformAuditTargetType.WORKSPACE);
      assert.strictEqual(dbAuditLogs[0].targetId, 'ws_1');
      assert.strictEqual(dbAuditLogs[0].metadata.oldPlan, BillingPlanType.FREE);
      assert.strictEqual(dbAuditLogs[0].metadata.newPlan, BillingPlanType.ENTERPRISE);

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'workspace.plan_updated');
    });

    it('should update custom quotas and write QUOTA_UPDATED audit log', async () => {
      const updated = await service.updateWorkspacePlan(
        'ws_1',
        { quotas: { maxAgents: 15, storageLimitMb: 2000 } },
        actor,
      );

      assert.strictEqual(updated.quotas.maxAgents, 15);
      assert.strictEqual(updated.quotas.storageLimitMb, 2000);

      const quotaLog = dbAuditLogs.find(l => l.action === PlatformAuditAction.QUOTA_UPDATED);
      assert.ok(quotaLog);
      assert.strictEqual(quotaLog.metadata.newQuotas.maxAgents, 15);
      assert.strictEqual(quotaLog.metadata.newQuotas.storageLimitMb, 2000);
    });

    it('should remove custom quota override when set to null and revert to default', async () => {
      // ws_1 starts with custom maxAgents = 5. FREE default is 2.
      const updated = await service.updateWorkspacePlan(
        'ws_1',
        { quotas: { maxAgents: null } },
        actor,
      );

      assert.strictEqual(updated.quotas.maxAgents, 2); // reverted to free default
      const quotaLog = dbAuditLogs.find(l => l.action === PlatformAuditAction.QUOTA_UPDATED);
      assert.ok(quotaLog);
      assert.strictEqual(quotaLog.metadata.newQuotas.maxAgents, undefined);
    });

    it('should not perform database update or write audit logs if plan and quotas are unchanged', async () => {
      dbAuditLogs = [];
      const updated = await service.updateWorkspacePlan(
        'ws_1',
        { billingPlan: BillingPlanType.FREE, quotas: { maxAgents: 5 } },
        actor,
      );

      assert.strictEqual(updated.billingPlan, BillingPlanType.FREE);
      assert.strictEqual(updated.quotas.maxAgents, 5);
      assert.strictEqual(dbAuditLogs.length, 0); // No audit log for no-op update
    });

    it('should write both PLAN_CHANGED and QUOTA_UPDATED audit logs when both are changed', async () => {
      await service.updateWorkspacePlan(
        'ws_1',
        {
          billingPlan: BillingPlanType.STANDARD,
          quotas: { maxAgents: 25 },
        },
        actor,
      );

      const planLog = dbAuditLogs.find(l => l.action === PlatformAuditAction.PLAN_CHANGED);
      const quotaLog = dbAuditLogs.find(l => l.action === PlatformAuditAction.QUOTA_UPDATED);
      assert.ok(planLog);
      assert.ok(quotaLog);
    });
  });

  describe('toggleWorkspaceSuspension', () => {
    it('should throw BadRequestException if trying to suspend an already suspended workspace', async () => {
      await assert.rejects(
        async () => {
          await service.toggleWorkspaceSuspension(
            'ws_2', // already suspended
            { isSuspended: true, reason: 'Already suspended' },
            actor,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'WORKSPACE_ALREADY_SUSPENDED');
          return true;
        },
      );
    });

    it('should throw BadRequestException if trying to activate an already active workspace', async () => {
      await assert.rejects(
        async () => {
          await service.toggleWorkspaceSuspension(
            'ws_1', // already active
            { isSuspended: false },
            actor,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'WORKSPACE_ALREADY_ACTIVE');
          return true;
        },
      );
    });

    it('should suspend an active workspace, write audit log, and emit workspace.suspended', async () => {
      const res = await service.toggleWorkspaceSuspension(
        'ws_1',
        { isSuspended: true, reason: 'Payment overdue' },
        actor,
      );

      assert.strictEqual(res.isSuspended, true);
      assert.strictEqual(res.suspendedReason, 'Payment overdue');
      assert.ok(res.suspendedAt);

      const suspendLog = dbAuditLogs.find(
        l => l.action === PlatformAuditAction.WORKSPACE_SUSPENDED,
      );
      assert.ok(suspendLog);
      assert.strictEqual(suspendLog.metadata.reason, 'Payment overdue');

      const suspendEvent = emittedEvents.find(e => e.event === 'workspace.suspended');
      assert.ok(suspendEvent);
      assert.strictEqual(suspendEvent.payload.workspaceId, 'ws_1');
      assert.strictEqual(suspendEvent.payload.reason, 'Payment overdue');
    });

    it('should activate a suspended workspace, write audit log, and emit workspace.activated', async () => {
      const res = await service.toggleWorkspaceSuspension('ws_2', { isSuspended: false }, actor);

      assert.strictEqual(res.isSuspended, false);
      assert.strictEqual(res.suspendedReason, null);
      assert.strictEqual(res.suspendedAt, null);

      const activateLog = dbAuditLogs.find(
        l => l.action === PlatformAuditAction.WORKSPACE_ACTIVATED,
      );
      assert.ok(activateLog);

      const activateEvent = emittedEvents.find(e => e.event === 'workspace.activated');
      assert.ok(activateEvent);
      assert.strictEqual(activateEvent.payload.workspaceId, 'ws_2');
    });
  });
});
