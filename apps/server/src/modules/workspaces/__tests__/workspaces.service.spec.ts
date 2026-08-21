import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BillingPlanType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { WorkspacesService } from '../workspaces.service';
import { PrismaService } from '../../../infrastructure/database';

describe('WorkspacesService (Provisioning, Tenant Queries & Updates)', () => {
  let service: WorkspacesService;
  let mockPrismaService: any;
  let workspacesDb: Map<string, any>;
  let membersDb: Map<string, any>;

  beforeEach(() => {
    workspacesDb = new Map();
    membersDb = new Map();

    const sampleWorkspace = {
      id: 'ws_test_1',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      billingPlan: BillingPlanType.FREE,
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {},
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
    workspacesDb.set(sampleWorkspace.id, sampleWorkspace);
    workspacesDb.set(`slug:${sampleWorkspace.slug}`, sampleWorkspace);

    const sampleMember = {
      id: 'wm_test_1',
      workspaceId: sampleWorkspace.id,
      userId: 'usr_owner_1',
      role: WorkspaceRole.OWNER,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      workspace: sampleWorkspace,
    };
    membersDb.set(`${sampleWorkspace.id}:${sampleMember.userId}`, sampleMember);

    const clientMock = {
      workspace: {
        findUnique: async ({ where }: { where: { id?: string; slug?: string } }) => {
          if (where.id) return workspacesDb.get(where.id) || null;
          if (where.slug) return workspacesDb.get(`slug:${where.slug}`) || null;
          return null;
        },
        create: async ({ data }: { data: any }) => {
          // Simulate Prisma P2002 unique constraint error if slug already exists
          if (workspacesDb.has(`slug:${data.slug}`)) {
            const err: any = new Error('Unique constraint failed on the fields: (`slug`)');
            err.code = 'P2002';
            err.meta = { target: ['slug'] };
            throw err;
          }
          const created = {
            id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          workspacesDb.set(created.id, created);
          workspacesDb.set(`slug:${created.slug}`, created);
          return created;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = workspacesDb.get(where.id);
          if (!existing) return null;
          const updated = { ...existing, ...data, updatedAt: new Date() };
          workspacesDb.set(where.id, updated);
          return updated;
        },
      },
      workspaceMember: {
        findUnique: async ({
          where,
        }: {
          where: { workspaceId_userId?: { workspaceId: string; userId: string } };
        }) => {
          if (where.workspaceId_userId) {
            const key = `${where.workspaceId_userId.workspaceId}:${where.workspaceId_userId.userId}`;
            return membersDb.get(key) || null;
          }
          return null;
        },
        findMany: async ({ where }: { where: { userId: string } }) => {
          const results: any[] = [];
          for (const member of membersDb.values()) {
            if (member.userId === where.userId) {
              results.push(member);
            }
          }
          return results;
        },
        create: async ({ data }: { data: any }) => {
          const created = {
            id: `wm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            workspace: workspacesDb.get(data.workspaceId),
          };
          membersDb.set(`${data.workspaceId}:${data.userId}`, created);
          return created;
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      txManager: {
        runInTransaction: async (fn: (tx: any) => Promise<any>) => fn(clientMock),
      },
    };

    service = new WorkspacesService(mockPrismaService as PrismaService);
  });

  it('should provision a new workspace with generated slug and set user as OWNER', async () => {
    const result = await service.createWorkspace('usr_new_creator', {
      name: 'Beta Global Tech',
    });

    assert.ok(result.id);
    assert.strictEqual(result.name, 'Beta Global Tech');
    assert.strictEqual(result.slug, 'beta-global-tech');
    assert.strictEqual(result.billingPlan, BillingPlanType.FREE);
    assert.strictEqual(result.timezone, 'Asia/Ho_Chi_Minh');
    assert.strictEqual(result.defaultLanguage, 'vi');

    // Verify membership record was created with OWNER role
    const member = await service.findMember(result.id, 'usr_new_creator');
    assert.ok(member);
    assert.strictEqual(member.role, WorkspaceRole.OWNER);
  });

  it('should resolve slug collision when creating workspace with existing slug', async () => {
    // Attempt to create workspace with slug 'alpha-corp' which already exists
    const result = await service.createWorkspace('usr_new_creator', {
      name: 'Alpha Corp',
    });

    assert.ok(result.id);
    assert.strictEqual(result.slug, 'alpha-corp-2');
  });

  it('should list all workspaces user belongs to with their roles', async () => {
    const workspaces = await service.findWorkspacesByUserId('usr_owner_1');

    assert.strictEqual(workspaces.length, 1);
    assert.strictEqual(workspaces[0].id, 'ws_test_1');
    assert.strictEqual(workspaces[0].name, 'Alpha Corp');
    assert.strictEqual(workspaces[0].role, WorkspaceRole.OWNER);
  });

  it('should return empty list for user with no workspaces', async () => {
    const workspaces = await service.findWorkspacesByUserId('usr_without_workspaces');
    assert.deepStrictEqual(workspaces, []);
  });

  it('should get workspace by id successfully (via context accessor)', async () => {
    const ws = await service.getWorkspaceForContext('ws_test_1');
    assert.strictEqual(ws.id, 'ws_test_1');
    assert.strictEqual(ws.name, 'Alpha Corp');
    assert.strictEqual(ws.slug, 'alpha-corp');
  });

  it('should throw NotFoundException when getting non-existent workspace', async () => {
    await assert.rejects(
      async () => {
        await service.getWorkspaceForContext('ws_non_existent');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_NOT_FOUND');
        return true;
      },
    );
  });

  it('should update workspace settings successfully', async () => {
    const updated = await service.updateWorkspace('ws_test_1', {
      name: 'Alpha Corp Renamed',
      timezone: 'UTC',
      defaultLanguage: 'en',
    });

    assert.strictEqual(updated.name, 'Alpha Corp Renamed');
    assert.strictEqual(updated.timezone, 'UTC');
    assert.strictEqual(updated.defaultLanguage, 'en');
  });

  it('should throw NotFoundException when updating non-existent workspace', async () => {
    await assert.rejects(
      async () => {
        await service.updateWorkspace('ws_non_existent', {
          name: 'Does Not Exist',
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'WORKSPACE_NOT_FOUND');
        return true;
      },
    );
  });
});
