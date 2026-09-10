import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BillingPlanType, PlatformRole } from '@sales-copilot/shared-contracts';
import { PlatformWorkspacesController } from '../controllers/platform-workspaces.controller';

describe('PlatformWorkspacesController (REST API Endpoints)', () => {
  let controller: PlatformWorkspacesController;
  let mockService: any;
  let serviceCalls: {
    getWorkspaces: any[];
    getWorkspaceDetail: string[];
    updateWorkspacePlan: any[];
    toggleWorkspaceSuspension: any[];
  };

  beforeEach(() => {
    serviceCalls = {
      getWorkspaces: [],
      getWorkspaceDetail: [],
      updateWorkspacePlan: [],
      toggleWorkspaceSuspension: [],
    };

    mockService = {
      getWorkspaces: async (query: any) => {
        serviceCalls.getWorkspaces.push(query);
        return {
          items: [
            {
              id: 'ws_1',
              name: 'Shop 1',
              slug: 'shop-1',
              billingPlan: BillingPlanType.FREE,
              isSuspended: false,
              memberCount: 2,
              channelCount: 1,
              createdAt: new Date(),
            },
          ],
          meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
        };
      },
      getWorkspaceDetail: async (id: string) => {
        serviceCalls.getWorkspaceDetail.push(id);
        return {
          id,
          name: 'Shop 1',
          slug: 'shop-1',
          billingPlan: BillingPlanType.FREE,
          isSuspended: false,
          timezone: 'Asia/Ho_Chi_Minh',
          defaultLanguage: 'vi',
          quotas: { maxAgents: 2, maxChannels: 2, storageLimitMb: 500, aiMonthlyTokens: 50000 },
          usage: { currentAgents: 1, currentChannels: 1, storageUsedMb: 50, aiUsedTokens: 1000 },
          members: [],
          createdAt: new Date(),
        };
      },
      updateWorkspacePlan: async (id: string, dto: any, actor: any) => {
        serviceCalls.updateWorkspacePlan.push({ id, dto, actor });
        return {
          id,
          name: 'Shop 1',
          slug: 'shop-1',
          billingPlan: dto.billingPlan ?? BillingPlanType.FREE,
          isSuspended: false,
          timezone: 'Asia/Ho_Chi_Minh',
          defaultLanguage: 'vi',
          quotas: { maxAgents: 10, maxChannels: 5, storageLimitMb: 5000, aiMonthlyTokens: 500000 },
          usage: { currentAgents: 1, currentChannels: 1, storageUsedMb: 50, aiUsedTokens: 1000 },
          members: [],
          createdAt: new Date(),
        };
      },
      toggleWorkspaceSuspension: async (id: string, dto: any, actor: any) => {
        serviceCalls.toggleWorkspaceSuspension.push({ id, dto, actor });
        return {
          id,
          name: 'Shop 1',
          slug: 'shop-1',
          billingPlan: BillingPlanType.FREE,
          isSuspended: dto.isSuspended,
          suspendedReason: dto.reason ?? null,
          timezone: 'Asia/Ho_Chi_Minh',
          defaultLanguage: 'vi',
          quotas: { maxAgents: 2, maxChannels: 2, storageLimitMb: 500, aiMonthlyTokens: 50000 },
          usage: { currentAgents: 1, currentChannels: 1, storageUsedMb: 50, aiUsedTokens: 1000 },
          members: [],
          createdAt: new Date(),
        };
      },
    };

    controller = new PlatformWorkspacesController(mockService);
  });

  it('should list workspaces with query filters and fallback to default query', async () => {
    const res = await controller.list({ search: 'Shop', plan: BillingPlanType.FREE });
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(serviceCalls.getWorkspaces.length, 1);
    assert.strictEqual(serviceCalls.getWorkspaces[0].search, 'Shop');

    const resEmpty = await controller.list(undefined);
    assert.strictEqual(resEmpty.items.length, 1);
    assert.deepStrictEqual(serviceCalls.getWorkspaces[1], {});
  });

  it('should get workspace technical detail by id', async () => {
    const res = await controller.getDetail('ws_1');
    assert.strictEqual(res.id, 'ws_1');
    assert.strictEqual(serviceCalls.getWorkspaceDetail.length, 1);
    assert.strictEqual(serviceCalls.getWorkspaceDetail[0], 'ws_1');
  });

  it('should update workspace plan and forward actor context', async () => {
    const user = {
      userId: 'admin_usr_1',
      email: 'admin@platform.com',
      role: PlatformRole.SUPER_ADMIN,
    };
    const req = {
      ip: '10.0.0.1',
      headers: {
        'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        'user-agent': 'Chrome/125.0',
      },
    } as any;

    const res = await controller.updatePlan(
      'ws_1',
      { billingPlan: BillingPlanType.STANDARD },
      user,
      req,
    );

    assert.strictEqual(res.billingPlan, BillingPlanType.STANDARD);
    assert.strictEqual(serviceCalls.updateWorkspacePlan.length, 1);
    const call = serviceCalls.updateWorkspacePlan[0];
    assert.strictEqual(call.id, 'ws_1');
    assert.strictEqual(call.actor.userId, 'admin_usr_1');
    assert.strictEqual(call.actor.email, 'admin@platform.com');
    assert.strictEqual(call.actor.ipAddress, '198.51.100.1');
    assert.strictEqual(call.actor.userAgent, 'Chrome/125.0');
  });

  it('should toggle workspace suspension and forward actor context with fallback ip', async () => {
    const user = {
      userId: 'admin_usr_2',
      email: 'admin2@platform.com',
      role: PlatformRole.SUPER_ADMIN,
    };
    const req = {
      ip: '172.16.0.1',
      headers: {},
    } as any;

    const res = await controller.toggleStatus(
      'ws_1',
      { isSuspended: true, reason: 'Suspicious activity' },
      user,
      req,
    );

    assert.strictEqual(res.isSuspended, true);
    assert.strictEqual(serviceCalls.toggleWorkspaceSuspension.length, 1);
    const call = serviceCalls.toggleWorkspaceSuspension[0];
    assert.strictEqual(call.id, 'ws_1');
    assert.strictEqual(call.dto.isSuspended, true);
    assert.strictEqual(call.dto.reason, 'Suspicious activity');
    assert.strictEqual(call.actor.ipAddress, '172.16.0.1');
  });
});
