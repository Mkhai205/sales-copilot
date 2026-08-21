import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BillingPlanType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { WorkspacesService } from '../workspaces.service';
import { PrismaService } from '../../../infrastructure/database';

describe('WorkspacesService (Provisioning, Tenant Queries & Member RBAC)', () => {
  let service: WorkspacesService;
  let mockPrismaService: any;
  let workspacesDb: Map<string, any>;
  let membersDb: Map<string, any>;
  let usersDb: Map<string, any>;

  beforeEach(() => {
    workspacesDb = new Map();
    membersDb = new Map();
    usersDb = new Map();

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

    const userOwner = {
      id: 'usr_owner_1',
      email: 'owner@alphacorp.com',
      name: 'Owner User',
      avatarUrl: 'https://avatar.com/owner.png',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    usersDb.set(userOwner.id, userOwner);
    usersDb.set(`email:${userOwner.email.toLowerCase()}`, userOwner);

    const userAdmin = {
      id: 'usr_admin_1',
      email: 'admin@alphacorp.com',
      name: 'Admin User',
      avatarUrl: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    usersDb.set(userAdmin.id, userAdmin);
    usersDb.set(`email:${userAdmin.email.toLowerCase()}`, userAdmin);

    const userAgent = {
      id: 'usr_agent_1',
      email: 'agent@alphacorp.com',
      name: 'Agent User',
      avatarUrl: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    usersDb.set(userAgent.id, userAgent);
    usersDb.set(`email:${userAgent.email.toLowerCase()}`, userAgent);

    const userInactive = {
      id: 'usr_inactive_1',
      email: 'inactive@alphacorp.com',
      name: 'Inactive User',
      avatarUrl: null,
      isActive: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    usersDb.set(userInactive.id, userInactive);
    usersDb.set(`email:${userInactive.email.toLowerCase()}`, userInactive);

    const sampleMember = {
      id: 'wm_test_1',
      workspaceId: sampleWorkspace.id,
      userId: userOwner.id,
      role: WorkspaceRole.OWNER,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      workspace: sampleWorkspace,
      user: userOwner,
    };
    membersDb.set(sampleMember.id, sampleMember);
    membersDb.set(`${sampleWorkspace.id}:${sampleMember.userId}`, sampleMember);

    const clientMock = {
      workspace: {
        findUnique: async ({ where }: { where: { id?: string; slug?: string } }) => {
          if (where.id) return workspacesDb.get(where.id) || null;
          if (where.slug) return workspacesDb.get(`slug:${where.slug}`) || null;
          return null;
        },
        create: async ({ data }: { data: any }) => {
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
      user: {
        findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id) return usersDb.get(where.id) || null;
          if (where.email) return usersDb.get(`email:${where.email.toLowerCase()}`) || null;
          return null;
        },
      },
      workspaceMember: {
        findUnique: async ({
          where,
        }: {
          where: { id?: string; workspaceId_userId?: { workspaceId: string; userId: string } };
        }) => {
          if (where.id) {
            return membersDb.get(where.id) || null;
          }
          if (where.workspaceId_userId) {
            const key = `${where.workspaceId_userId.workspaceId}:${where.workspaceId_userId.userId}`;
            return membersDb.get(key) || null;
          }
          return null;
        },
        findFirst: async ({ where }: { where: { id?: string; workspaceId?: string } }) => {
          for (const member of membersDb.values()) {
            if (
              member.id &&
              (!where.id || member.id === where.id) &&
              (!where.workspaceId || member.workspaceId === where.workspaceId)
            ) {
              return member;
            }
          }
          return null;
        },
        findMany: async ({ where }: { where: { userId?: string; workspaceId?: string } }) => {
          const results: any[] = [];
          const seen = new Set<string>();
          for (const member of membersDb.values()) {
            if (!member.id || seen.has(member.id)) continue;
            if (where.userId && member.userId !== where.userId) continue;
            if (where.workspaceId && member.workspaceId !== where.workspaceId) continue;
            seen.add(member.id);
            results.push(member);
          }
          return results;
        },
        count: async ({ where }: { where: { workspaceId: string; role?: string } }) => {
          let count = 0;
          const seen = new Set<string>();
          for (const member of membersDb.values()) {
            if (!member.id || seen.has(member.id)) continue;
            if (
              member.workspaceId === where.workspaceId &&
              (!where.role || member.role === where.role)
            ) {
              seen.add(member.id);
              count++;
            }
          }
          return count;
        },
        create: async ({ data }: { data: any }) => {
          const user = usersDb.get(data.userId);
          const created = {
            id: `wm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            workspace: workspacesDb.get(data.workspaceId),
            user: user || null,
          };
          membersDb.set(created.id, created);
          membersDb.set(`${data.workspaceId}:${data.userId}`, created);
          return created;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = membersDb.get(where.id);
          if (!existing) return null;
          const updated = { ...existing, ...data, updatedAt: new Date() };
          membersDb.set(where.id, updated);
          membersDb.set(`${existing.workspaceId}:${existing.userId}`, updated);
          return updated;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = membersDb.get(where.id);
          if (existing) {
            membersDb.delete(where.id);
            membersDb.delete(`${existing.workspaceId}:${existing.userId}`);
          }
          return existing;
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (fn: (tx: any) => Promise<any>) => fn(clientMock),
      txManager: {
        runInTransaction: async (fn: (tx: any) => Promise<any>) => fn(clientMock),
      },
    };

    service = new WorkspacesService(mockPrismaService as PrismaService);
  });

  describe('Workspace Provisioning & Basic Operations', () => {
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

      const member = await service.findMember(result.id, 'usr_new_creator');
      assert.ok(member);
      assert.strictEqual(member.role, WorkspaceRole.OWNER);
    });

    it('should resolve slug collision when creating workspace with existing slug', async () => {
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

  describe('Workspace Members Management (Feature F-1.1.3)', () => {
    it('should list all members of a workspace with their user profile info', async () => {
      const members = await service.findMembersByWorkspaceId('ws_test_1');

      assert.strictEqual(members.length, 1);
      assert.strictEqual(members[0].id, 'wm_test_1');
      assert.strictEqual(members[0].userId, 'usr_owner_1');
      assert.strictEqual(members[0].role, WorkspaceRole.OWNER);
      assert.ok(members[0].user);
      assert.strictEqual(members[0].user?.email, 'owner@alphacorp.com');
      assert.strictEqual(members[0].user?.name, 'Owner User');
      assert.strictEqual(members[0].user?.avatarUrl, 'https://avatar.com/owner.png');
    });

    it('should add an existing user by email as AGENT successfully', async () => {
      const member = await service.addMemberByEmail(
        'ws_test_1',
        'usr_owner_1',
        WorkspaceRole.OWNER,
        {
          email: 'agent@alphacorp.com',
          role: WorkspaceRole.AGENT,
        },
      );

      assert.ok(member.id);
      assert.strictEqual(member.workspaceId, 'ws_test_1');
      assert.strictEqual(member.userId, 'usr_agent_1');
      assert.strictEqual(member.role, WorkspaceRole.AGENT);
      assert.strictEqual(member.user?.email, 'agent@alphacorp.com');
      assert.strictEqual(member.user?.name, 'Agent User');
    });

    it('should throw NotFoundException (USER_NOT_FOUND) when adding non-existent user email', async () => {
      await assert.rejects(
        async () => {
          await service.addMemberByEmail('ws_test_1', 'usr_owner_1', WorkspaceRole.OWNER, {
            email: 'unknown@external.com',
            role: WorkspaceRole.AGENT,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'USER_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException (USER_INACTIVE) when adding deactivated user', async () => {
      await assert.rejects(
        async () => {
          await service.addMemberByEmail('ws_test_1', 'usr_owner_1', WorkspaceRole.OWNER, {
            email: 'inactive@alphacorp.com',
            role: WorkspaceRole.AGENT,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'USER_INACTIVE');
          return true;
        },
      );
    });

    it('should throw ConflictException (MEMBER_ALREADY_EXISTS) when user is already a member', async () => {
      await assert.rejects(
        async () => {
          await service.addMemberByEmail('ws_test_1', 'usr_owner_1', WorkspaceRole.OWNER, {
            email: 'owner@alphacorp.com',
            role: WorkspaceRole.ADMIN,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'MEMBER_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should update member role successfully', async () => {
      // First add agent
      const agentMember = await service.addMemberByEmail(
        'ws_test_1',
        'usr_owner_1',
        WorkspaceRole.OWNER,
        {
          email: 'agent@alphacorp.com',
          role: WorkspaceRole.AGENT,
        },
      );

      // Now update agent to ADMIN
      const updated = await service.updateMemberRole(
        'ws_test_1',
        agentMember.id,
        'usr_owner_1',
        WorkspaceRole.OWNER,
        {
          role: WorkspaceRole.ADMIN,
        },
      );

      assert.strictEqual(updated.id, agentMember.id);
      assert.strictEqual(updated.role, WorkspaceRole.ADMIN);
    });

    it('should throw NotFoundException (MEMBER_NOT_FOUND) when updating non-existent member', async () => {
      await assert.rejects(
        async () => {
          await service.updateMemberRole(
            'ws_test_1',
            'wm_non_existent',
            'usr_owner_1',
            WorkspaceRole.OWNER,
            {
              role: WorkspaceRole.ADMIN,
            },
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'MEMBER_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException (CANNOT_DEMOTE_LAST_OWNER) when attempting to demote the only OWNER', async () => {
      await assert.rejects(
        async () => {
          await service.updateMemberRole(
            'ws_test_1',
            'wm_test_1', // only owner
            'usr_owner_1',
            WorkspaceRole.OWNER,
            {
              role: WorkspaceRole.ADMIN,
            },
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CANNOT_DEMOTE_LAST_OWNER');
          return true;
        },
      );
    });

    it('should throw ForbiddenException (CANNOT_MODIFY_OWNER) when ADMIN attempts to modify OWNER', async () => {
      await assert.rejects(
        async () => {
          await service.updateMemberRole(
            'ws_test_1',
            'wm_test_1', // target is owner
            'usr_admin_1',
            WorkspaceRole.ADMIN, // actor is admin
            {
              role: WorkspaceRole.AGENT,
            },
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CANNOT_MODIFY_OWNER');
          return true;
        },
      );
    });

    it('should remove a member successfully', async () => {
      const agentMember = await service.addMemberByEmail(
        'ws_test_1',
        'usr_owner_1',
        WorkspaceRole.OWNER,
        {
          email: 'agent@alphacorp.com',
          role: WorkspaceRole.AGENT,
        },
      );

      const result = await service.removeMember(
        'ws_test_1',
        agentMember.id,
        'usr_owner_1',
        WorkspaceRole.OWNER,
      );

      assert.deepStrictEqual(result, { success: true });

      const members = await service.findMembersByWorkspaceId('ws_test_1');
      assert.strictEqual(members.length, 1); // Only owner left
    });

    it('should throw NotFoundException (MEMBER_NOT_FOUND) when removing non-existent member', async () => {
      await assert.rejects(
        async () => {
          await service.removeMember(
            'ws_test_1',
            'wm_non_existent',
            'usr_owner_1',
            WorkspaceRole.OWNER,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'MEMBER_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException (CANNOT_REMOVE_LAST_OWNER) when attempting to remove the only OWNER', async () => {
      await assert.rejects(
        async () => {
          await service.removeMember(
            'ws_test_1',
            'wm_test_1', // only owner
            'usr_owner_1',
            WorkspaceRole.OWNER,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CANNOT_REMOVE_LAST_OWNER');
          return true;
        },
      );
    });

    it('should throw ForbiddenException (CANNOT_REMOVE_OWNER) when ADMIN attempts to remove OWNER', async () => {
      await assert.rejects(
        async () => {
          await service.removeMember(
            'ws_test_1',
            'wm_test_1', // target is owner
            'usr_admin_1',
            WorkspaceRole.ADMIN, // actor is admin
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CANNOT_REMOVE_OWNER');
          return true;
        },
      );
    });

    it('should enforce tenant isolation (cannot access/modify members of another workspace)', async () => {
      await assert.rejects(
        async () => {
          await service.updateMemberRole(
            'ws_other_workspace',
            'wm_test_1',
            'usr_owner_1',
            WorkspaceRole.OWNER,
            {
              role: WorkspaceRole.ADMIN,
            },
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'MEMBER_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
