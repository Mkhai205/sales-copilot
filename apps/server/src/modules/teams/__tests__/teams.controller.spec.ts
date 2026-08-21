import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { TeamsController } from '../teams.controller';
import { TeamsService } from '../teams.service';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('TeamsController (Presentation Layer Endpoints)', () => {
  let controller: TeamsController;
  let mockTeamsService: Partial<TeamsService>;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws_test_1',
    role: WorkspaceRole.OWNER,
    workspace: {
      id: 'ws_test_1',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      billingPlan: 'FREE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const sampleTeam = {
    id: 'team_1',
    workspaceId: 'ws_test_1',
    name: 'Sales Support',
    description: 'Inbound sales',
    memberCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockTeamsService = {
      listTeams: async (workspaceId: string) => [sampleTeam],
      createTeam: async (workspaceId: string, dto: any) => ({
        ...sampleTeam,
        name: dto.name,
        description: dto.description,
      }),
      getTeamById: async (workspaceId: string, teamId: string) => sampleTeam,
      updateTeam: async (workspaceId: string, teamId: string, dto: any) => ({
        ...sampleTeam,
        ...dto,
      }),
      deleteTeam: async (workspaceId: string, teamId: string) => ({ success: true }),
      listTeamMembers: async (workspaceId: string, teamId: string) => [
        {
          id: 'tm_1',
          teamId,
          userId: 'usr_1',
          user: {
            id: 'usr_1',
            email: 'agent1@alphacorp.com',
            name: 'Agent 1',
            avatarUrl: null,
          },
          createdAt: new Date(),
        },
      ],
      addTeamMembers: async (workspaceId: string, teamId: string, userIds: string[]) => [
        {
          id: 'tm_1',
          teamId,
          userId: userIds[0],
          createdAt: new Date(),
        },
      ],
      removeTeamMembers: async (workspaceId: string, teamId: string, userIds: string[]) => ({
        success: true,
      }),
    };

    controller = new TeamsController(mockTeamsService as TeamsService);
  });

  it('should list all teams', async () => {
    const result = await controller.listTeams(mockContext);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Sales Support');
  });

  it('should create a new team', async () => {
    const result = await controller.createTeam(mockContext, {
      name: 'Tier 2 Support',
      description: 'Advanced technical support',
    });
    assert.strictEqual(result.name, 'Tier 2 Support');
    assert.strictEqual(result.description, 'Advanced technical support');
  });

  it('should get team details by id', async () => {
    const result = await controller.getTeam(mockContext, 'team_1');
    assert.strictEqual(result.id, 'team_1');
    assert.strictEqual(result.name, 'Sales Support');
  });

  it('should update team details', async () => {
    const result = await controller.updateTeam(mockContext, 'team_1', {
      name: 'Renamed Support',
    });
    assert.strictEqual(result.name, 'Renamed Support');
  });

  it('should delete team', async () => {
    const result = await controller.deleteTeam(mockContext, 'team_1');
    assert.deepStrictEqual(result, { success: true });
  });

  it('should list team members', async () => {
    const result = await controller.listTeamMembers(mockContext, 'team_1');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].user?.email, 'agent1@alphacorp.com');
  });

  it('should add members to team', async () => {
    const result = await controller.addTeamMembers(mockContext, 'team_1', {
      userIds: ['usr_2'],
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].userId, 'usr_2');
  });

  it('should remove multiple members from team', async () => {
    const result = await controller.removeTeamMembers(mockContext, 'team_1', {
      userIds: ['usr_1'],
    });
    assert.deepStrictEqual(result, { success: true });
  });

  it('should remove single member from team', async () => {
    const result = await controller.removeSingleTeamMember(mockContext, 'team_1', 'usr_1');
    assert.deepStrictEqual(result, { success: true });
  });
});
