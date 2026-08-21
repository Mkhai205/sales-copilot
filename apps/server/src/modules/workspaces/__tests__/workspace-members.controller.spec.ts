import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { WorkspaceMembersController } from '../workspace-members.controller';
import { WorkspacesService } from '../workspaces.service';

describe('WorkspaceMembersController (Presentation Layer Endpoints)', () => {
  let controller: WorkspaceMembersController;
  let mockWorkspacesService: Partial<WorkspacesService>;

  const mockContext = {
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

  const mockUser = {
    userId: 'usr_actor_1',
    email: 'actor@alphacorp.com',
    role: 'USER' as const,
  };

  beforeEach(() => {
    mockWorkspacesService = {
      findMembersByWorkspaceId: async (workspaceId: string) => [
        {
          id: 'wm_1',
          workspaceId,
          userId: 'usr_actor_1',
          role: WorkspaceRole.OWNER,
          user: {
            id: 'usr_actor_1',
            email: 'actor@alphacorp.com',
            name: 'Actor User',
            avatarUrl: null,
            isActive: true,
          },
          createdAt: new Date(),
        },
      ],
      addMemberByEmail: async (workspaceId, actorUserId, actorRole, dto) => ({
        id: 'wm_new',
        workspaceId,
        userId: 'usr_target_2',
        role: dto.role,
        user: {
          id: 'usr_target_2',
          email: dto.email,
          name: 'Target User',
          avatarUrl: null,
          isActive: true,
        },
        createdAt: new Date(),
      }),
      updateMemberRole: async (workspaceId, memberId, actorUserId, actorRole, dto) => ({
        id: memberId,
        workspaceId,
        userId: 'usr_target_2',
        role: dto.role,
        createdAt: new Date(),
      }),
      removeMember: async (workspaceId, memberId, actorUserId, actorRole) => ({
        success: true,
      }),
    };

    controller = new WorkspaceMembersController(mockWorkspacesService as WorkspacesService);
  });

  it('should list all members of the current workspace', async () => {
    const result = await controller.listMembers(mockContext as any);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'wm_1');
    assert.strictEqual(result[0].user?.email, 'actor@alphacorp.com');
  });

  it('should add a member by email', async () => {
    const result = await controller.addMember(mockContext as any, mockUser, {
      email: 'newagent@alphacorp.com',
      role: WorkspaceRole.AGENT,
    });
    assert.strictEqual(result.id, 'wm_new');
    assert.strictEqual(result.role, WorkspaceRole.AGENT);
    assert.strictEqual(result.user?.email, 'newagent@alphacorp.com');
  });

  it('should update member role', async () => {
    const result = await controller.updateMemberRole(mockContext as any, mockUser, 'wm_2', {
      role: WorkspaceRole.ADMIN,
    });
    assert.strictEqual(result.id, 'wm_2');
    assert.strictEqual(result.role, WorkspaceRole.ADMIN);
  });

  it('should remove member from workspace', async () => {
    const result = await controller.removeMember(mockContext as any, mockUser, 'wm_2');
    assert.deepStrictEqual(result, { success: true });
  });
});
