import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { TeamsService } from '../teams.service';
import { PrismaService } from '../../../infrastructure/database';

describe('TeamsService (Team Management & Member Assignment)', () => {
  let service: TeamsService;
  let mockPrismaService: any;

  let workspacesDb: Map<string, any>;
  let usersDb: Map<string, any>;
  let workspaceMembersDb: Map<string, any>;
  let teamsDb: Map<string, any>;
  let teamMembersDb: Map<string, any>;

  beforeEach(() => {
    workspacesDb = new Map();
    usersDb = new Map();
    workspaceMembersDb = new Map();
    teamsDb = new Map();
    teamMembersDb = new Map();

    const sampleWorkspace = {
      id: 'ws_test_1',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
    };
    workspacesDb.set(sampleWorkspace.id, sampleWorkspace);

    const user1 = {
      id: 'usr_1',
      email: 'agent1@alphacorp.com',
      name: 'Agent One',
      avatarUrl: null,
      isActive: true,
    };
    const user2 = {
      id: 'usr_2',
      email: 'agent2@alphacorp.com',
      name: 'Agent Two',
      avatarUrl: 'https://avatar.com/agent2.png',
      isActive: true,
    };
    const userExternal = {
      id: 'usr_external_99',
      email: 'external@other.com',
      name: 'External User',
      avatarUrl: null,
      isActive: true,
    };

    usersDb.set(user1.id, user1);
    usersDb.set(user2.id, user2);
    usersDb.set(userExternal.id, userExternal);

    // user1 and user2 are members of ws_test_1. userExternal is NOT.
    workspaceMembersDb.set(`${sampleWorkspace.id}:${user1.id}`, {
      id: 'wm_1',
      workspaceId: sampleWorkspace.id,
      userId: user1.id,
    });
    workspaceMembersDb.set(`${sampleWorkspace.id}:${user2.id}`, {
      id: 'wm_2',
      workspaceId: sampleWorkspace.id,
      userId: user2.id,
    });

    const clientMock = {
      team: {
        findMany: async ({ where }: { where: { workspaceId: string } }) => {
          const results: any[] = [];
          for (const team of teamsDb.values()) {
            if (team.workspaceId === where.workspaceId) {
              const members = Array.from(teamMembersDb.values()).filter(
                tm => tm.teamId === team.id,
              );
              results.push({
                ...team,
                _count: { members: members.length },
              });
            }
          }
          return results;
        },
        findFirst: async ({ where }: { where: { id: string; workspaceId?: string } }) => {
          const team = teamsDb.get(where.id);
          if (!team) return null;
          if (where.workspaceId && team.workspaceId !== where.workspaceId) return null;

          const members = Array.from(teamMembersDb.values())
            .filter(tm => tm.teamId === team.id)
            .map(tm => ({
              ...tm,
              user: usersDb.get(tm.userId),
            }));

          return {
            ...team,
            _count: { members: members.length },
            members,
          };
        },
        findUnique: async ({
          where,
        }: {
          where: { id?: string; workspaceId_name?: { workspaceId: string; name: string } };
        }) => {
          if (where.id) return teamsDb.get(where.id) || null;
          if (where.workspaceId_name) {
            const key = `${where.workspaceId_name.workspaceId}:${where.workspaceId_name.name.toLowerCase()}`;
            for (const team of teamsDb.values()) {
              if (
                team.workspaceId === where.workspaceId_name.workspaceId &&
                team.name.toLowerCase() === where.workspaceId_name.name.toLowerCase()
              ) {
                return team;
              }
            }
          }
          return null;
        },
        create: async ({ data }: { data: any }) => {
          const key = `${data.workspaceId}:${data.name.toLowerCase()}`;
          for (const existing of teamsDb.values()) {
            if (
              existing.workspaceId === data.workspaceId &&
              existing.name.toLowerCase() === data.name.toLowerCase()
            ) {
              const err: any = new Error('Unique constraint failed on (workspaceId, name)');
              err.code = 'P2002';
              throw err;
            }
          }
          const created = {
            id: `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          teamsDb.set(created.id, created);
          return created;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = teamsDb.get(where.id);
          if (!existing) return null;
          const updated = { ...existing, ...data, updatedAt: new Date() };
          teamsDb.set(where.id, updated);
          const members = Array.from(teamMembersDb.values()).filter(tm => tm.teamId === where.id);
          return {
            ...updated,
            _count: { members: members.length },
          };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = teamsDb.get(where.id);
          if (existing) {
            teamsDb.delete(where.id);
            // Cascade delete team members
            for (const [key, tm] of teamMembersDb.entries()) {
              if (tm.teamId === where.id) {
                teamMembersDb.delete(key);
              }
            }
          }
          return existing;
        },
      },
      workspaceMember: {
        findMany: async ({
          where,
        }: {
          where: { workspaceId: string; userId: { in: string[] } };
        }) => {
          const results: any[] = [];
          for (const wm of workspaceMembersDb.values()) {
            if (wm.workspaceId === where.workspaceId && where.userId.in.includes(wm.userId)) {
              results.push(wm);
            }
          }
          return results;
        },
      },
      teamMember: {
        findMany: async ({ where }: { where: { teamId: string } }) => {
          const results: any[] = [];
          for (const tm of teamMembersDb.values()) {
            if (tm.teamId === where.teamId) {
              results.push({
                ...tm,
                user: usersDb.get(tm.userId),
              });
            }
          }
          return results;
        },
        create: async ({ data }: { data: { teamId: string; userId: string } }) => {
          const key = `${data.teamId}:${data.userId}`;
          if (teamMembersDb.has(key)) {
            const err: any = new Error('Unique constraint failed on (teamId, userId)');
            err.code = 'P2002';
            throw err;
          }
          const created = {
            id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            user: usersDb.get(data.userId),
          };
          teamMembersDb.set(key, created);
          return created;
        },
        deleteMany: async ({ where }: { where: { teamId: string; userId: { in: string[] } } }) => {
          for (const userId of where.userId.in) {
            teamMembersDb.delete(`${where.teamId}:${userId}`);
          }
          return { count: where.userId.in.length };
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (fn: (tx: any) => Promise<any>) => fn(clientMock),
    };

    service = new TeamsService(mockPrismaService as PrismaService);
  });

  describe('Team CRUD Operations', () => {
    it('should create a team successfully', async () => {
      const result = await service.createTeam('ws_test_1', {
        name: 'Sales Inbound',
        description: 'Handles incoming sales inquiries',
      });

      assert.ok(result.id);
      assert.strictEqual(result.name, 'Sales Inbound');
      assert.strictEqual(result.description, 'Handles incoming sales inquiries');
      assert.strictEqual(result.memberCount, 0);
    });

    it('should throw ConflictException (TEAM_NAME_ALREADY_EXISTS) when creating team with duplicate name in same workspace', async () => {
      await service.createTeam('ws_test_1', {
        name: 'Support Team',
      });

      await assert.rejects(
        async () => {
          await service.createTeam('ws_test_1', {
            name: 'Support Team',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'TEAM_NAME_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow creating team with same name in a different workspace', async () => {
      await service.createTeam('ws_test_1', {
        name: 'Support Team',
      });

      const result = await service.createTeam('ws_other_workspace', {
        name: 'Support Team',
      });

      assert.ok(result.id);
      assert.strictEqual(result.workspaceId, 'ws_other_workspace');
      assert.strictEqual(result.name, 'Support Team');
    });

    it('should list all teams in the workspace', async () => {
      await service.createTeam('ws_test_1', { name: 'Alpha Support' });
      await service.createTeam('ws_test_1', { name: 'Beta Sales' });

      const teams = await service.listTeams('ws_test_1');
      assert.strictEqual(teams.length, 2);
    });

    it('should get a team by id with members and counts', async () => {
      const created = await service.createTeam('ws_test_1', { name: 'Enterprise Success' });
      await service.addTeamMembers('ws_test_1', created.id, ['usr_1']);

      const team = await service.getTeamById('ws_test_1', created.id);
      assert.strictEqual(team.id, created.id);
      assert.strictEqual(team.memberCount, 1);
      assert.strictEqual(team.members?.length, 1);
      assert.strictEqual(team.members?.[0].user?.email, 'agent1@alphacorp.com');
    });

    it('should throw NotFoundException (TEAM_NOT_FOUND) when getting non-existent team', async () => {
      await assert.rejects(
        async () => {
          await service.getTeamById('ws_test_1', 'team_non_existent');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'TEAM_NOT_FOUND');
          return true;
        },
      );
    });

    it('should update team details successfully', async () => {
      const created = await service.createTeam('ws_test_1', { name: 'Tier 1' });
      const updated = await service.updateTeam('ws_test_1', created.id, {
        name: 'Tier 1 Support',
        description: 'First response level',
      });

      assert.strictEqual(updated.name, 'Tier 1 Support');
      assert.strictEqual(updated.description, 'First response level');
    });

    it('should throw ConflictException (TEAM_NAME_ALREADY_EXISTS) when updating to existing team name', async () => {
      await service.createTeam('ws_test_1', { name: 'Team A' });
      const teamB = await service.createTeam('ws_test_1', { name: 'Team B' });

      await assert.rejects(
        async () => {
          await service.updateTeam('ws_test_1', teamB.id, {
            name: 'Team A',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'TEAM_NAME_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should delete team and cascade team members', async () => {
      const created = await service.createTeam('ws_test_1', { name: 'Temporary Team' });
      await service.addTeamMembers('ws_test_1', created.id, ['usr_1']);

      const deleteResult = await service.deleteTeam('ws_test_1', created.id);
      assert.deepStrictEqual(deleteResult, { success: true });

      // Verify team no longer exists
      await assert.rejects(async () => {
        await service.getTeamById('ws_test_1', created.id);
      });

      // Verify user was NOT deleted
      assert.ok(usersDb.has('usr_1'));
    });

    it('should throw NotFoundException (TEAM_NOT_FOUND) when deleting non-existent team', async () => {
      await assert.rejects(
        async () => {
          await service.deleteTeam('ws_test_1', 'team_non_existent');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'TEAM_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('Team Member Assignment & Invariants', () => {
    it('should add valid workspace members to team', async () => {
      const team = await service.createTeam('ws_test_1', { name: 'VIP Support' });
      const members = await service.addTeamMembers('ws_test_1', team.id, ['usr_1', 'usr_2']);

      assert.strictEqual(members.length, 2);
      assert.ok(members.some(m => m.userId === 'usr_1' && m.user?.name === 'Agent One'));
      assert.ok(members.some(m => m.userId === 'usr_2' && m.user?.name === 'Agent Two'));
    });

    it('should throw BadRequestException (INVALID_TEAM_MEMBERS) when adding user who is NOT a workspace member', async () => {
      const team = await service.createTeam('ws_test_1', { name: 'VIP Support' });

      await assert.rejects(
        async () => {
          await service.addTeamMembers('ws_test_1', team.id, ['usr_1', 'usr_external_99']);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'INVALID_TEAM_MEMBERS');
          assert.deepStrictEqual(err.response?.details?.invalidUserIds, ['usr_external_99']);
          return true;
        },
      );
    });

    it('should remove team members successfully', async () => {
      const team = await service.createTeam('ws_test_1', { name: 'VIP Support' });
      await service.addTeamMembers('ws_test_1', team.id, ['usr_1', 'usr_2']);

      const removeResult = await service.removeTeamMembers('ws_test_1', team.id, ['usr_1']);
      assert.deepStrictEqual(removeResult, { success: true });

      const remaining = await service.listTeamMembers('ws_test_1', team.id);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].userId, 'usr_2');
    });

    it('should enforce tenant isolation (cannot query/modify team in another workspace)', async () => {
      const team = await service.createTeam('ws_test_1', { name: 'Private Team' });

      await assert.rejects(
        async () => {
          await service.getTeamById('ws_other_workspace', team.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'TEAM_NOT_FOUND');
          return true;
        },
      );

      await assert.rejects(
        async () => {
          await service.addTeamMembers('ws_other_workspace', team.id, ['usr_1']);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'TEAM_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
