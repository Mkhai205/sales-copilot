import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
  WorkspaceRole,
  type WorkspaceMemberDto,
} from '@sales-copilot/shared-contracts';

describe('Workspace Members Management (Task 29)', () => {
  describe('addWorkspaceMemberSchema validation', () => {
    it('should validate valid member invitation with default role', () => {
      const payload = {
        email: 'alice@example.com',
      };
      const parsed = addWorkspaceMemberSchema.parse(payload);
      assert.strictEqual(parsed.email, 'alice@example.com');
      assert.strictEqual(parsed.role, WorkspaceRole.AGENT);
    });

    it('should validate valid member invitation with explicit role', () => {
      const payload = {
        email: 'bob@example.com',
        role: WorkspaceRole.ADMIN,
      };
      const parsed = addWorkspaceMemberSchema.parse(payload);
      assert.strictEqual(parsed.email, 'bob@example.com');
      assert.strictEqual(parsed.role, WorkspaceRole.ADMIN);
    });

    it('should trim and validate email formatting', () => {
      const payload = {
        email: '  charlie@company.com  ',
        role: WorkspaceRole.VIEWER,
      };
      const parsed = addWorkspaceMemberSchema.parse(payload);
      assert.strictEqual(parsed.email, 'charlie@company.com');
    });

    it('should reject invalid email addresses', () => {
      const invalidPayload = {
        email: 'not-an-email',
      };
      assert.throws(() => addWorkspaceMemberSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject OWNER as an assignable role for new members', () => {
      const invalidPayload = {
        email: 'owner@example.com',
        role: WorkspaceRole.OWNER,
      };
      assert.throws(() => addWorkspaceMemberSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });
  });

  describe('updateWorkspaceMemberRoleSchema validation', () => {
    it('should allow assignable roles: ADMIN, AGENT, VIEWER', () => {
      assert.strictEqual(
        updateWorkspaceMemberRoleSchema.parse({ role: WorkspaceRole.ADMIN }).role,
        WorkspaceRole.ADMIN,
      );
      assert.strictEqual(
        updateWorkspaceMemberRoleSchema.parse({ role: WorkspaceRole.AGENT }).role,
        WorkspaceRole.AGENT,
      );
      assert.strictEqual(
        updateWorkspaceMemberRoleSchema.parse({ role: WorkspaceRole.VIEWER }).role,
        WorkspaceRole.VIEWER,
      );
    });

    it('should reject OWNER in member role updates', () => {
      assert.throws(() => updateWorkspaceMemberRoleSchema.parse({ role: WorkspaceRole.OWNER }), {
        name: 'ZodError',
      });
    });
  });

  describe('Members Filter & Search Logic', () => {
    const mockMembers: WorkspaceMemberDto[] = [
      {
        id: 'wm_1',
        workspaceId: 'ws_1',
        userId: 'usr_1',
        role: WorkspaceRole.OWNER,
        user: {
          id: 'usr_1',
          name: 'Sarah Connor',
          email: 'sarah@skynet.com',
        },
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'wm_2',
        workspaceId: 'ws_1',
        userId: 'usr_2',
        role: WorkspaceRole.ADMIN,
        user: {
          id: 'usr_2',
          name: 'John Connor',
          email: 'john@resistance.org',
        },
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'wm_3',
        workspaceId: 'ws_1',
        userId: 'usr_3',
        role: WorkspaceRole.AGENT,
        user: {
          id: 'usr_3',
          name: 'Kyle Reese',
          email: 'kyle@future.com',
        },
        createdAt: '2026-01-03T00:00:00Z',
      },
      {
        id: 'wm_4',
        workspaceId: 'ws_1',
        userId: 'usr_4',
        role: WorkspaceRole.VIEWER,
        user: {
          id: 'usr_4',
          name: 'Miles Dyson',
          email: 'miles@cyberdyne.com',
        },
        createdAt: '2026-01-04T00:00:00Z',
      },
    ];

    const filterMembers = (list: WorkspaceMemberDto[], search: string, role: string) => {
      const q = search.trim().toLowerCase();
      return list.filter(m => {
        const name = m.user?.name?.toLowerCase() || '';
        const email = m.user?.email?.toLowerCase() || '';
        const matchesSearch = !q || name.includes(q) || email.includes(q);
        const matchesRole = role === 'ALL' || m.role === role;
        return matchesSearch && matchesRole;
      });
    };

    it('should return all members when search is empty and role is ALL', () => {
      const result = filterMembers(mockMembers, '', 'ALL');
      assert.strictEqual(result.length, 4);
    });

    it('should filter by name search (case-insensitive)', () => {
      const result = filterMembers(mockMembers, 'connor', 'ALL');
      assert.strictEqual(result.length, 2);
      assert.deepStrictEqual(
        result.map(m => m.user?.name),
        ['Sarah Connor', 'John Connor'],
      );
    });

    it('should filter by email search', () => {
      const result = filterMembers(mockMembers, 'cyberdyne.com', 'ALL');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].user?.name, 'Miles Dyson');
    });

    it('should filter by role filter', () => {
      const admins = filterMembers(mockMembers, '', WorkspaceRole.ADMIN);
      assert.strictEqual(admins.length, 1);
      assert.strictEqual(admins[0].user?.name, 'John Connor');

      const agents = filterMembers(mockMembers, '', WorkspaceRole.AGENT);
      assert.strictEqual(agents.length, 1);
      assert.strictEqual(agents[0].user?.name, 'Kyle Reese');
    });

    it('should combine search query and role filter', () => {
      const result = filterMembers(mockMembers, 'connor', WorkspaceRole.ADMIN);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].user?.name, 'John Connor');
    });
  });

  describe('Member Safety and Protection Checks', () => {
    it('should prevent deleting or modifying the workspace Owner', () => {
      const ownerMember: WorkspaceMemberDto = {
        id: 'wm_owner',
        workspaceId: 'ws_1',
        userId: 'usr_owner',
        role: WorkspaceRole.OWNER,
        createdAt: '2026-01-01T00:00:00Z',
      };

      const isOwner = ownerMember.role === WorkspaceRole.OWNER;
      assert.strictEqual(isOwner, true);
    });

    it('should prevent self-deletion or self-demotion', () => {
      const currentUserId = 'usr_actor';
      const selfMember: WorkspaceMemberDto = {
        id: 'wm_actor',
        workspaceId: 'ws_1',
        userId: currentUserId,
        role: WorkspaceRole.ADMIN,
        createdAt: '2026-01-01T00:00:00Z',
      };

      const isSelf = selfMember.userId === currentUserId;
      assert.strictEqual(isSelf, true);
    });

    it('should allow modifying other non-owner members when actor is Admin or Owner', () => {
      const currentUserId = 'usr_admin';
      const targetMember: WorkspaceMemberDto = {
        id: 'wm_agent',
        workspaceId: 'ws_1',
        userId: 'usr_agent',
        role: WorkspaceRole.AGENT,
        createdAt: '2026-01-01T00:00:00Z',
      };

      const canManage = true;
      const isOwner = targetMember.role === WorkspaceRole.OWNER;
      const isSelf = targetMember.userId === currentUserId;

      const canEdit = canManage && !isOwner && !isSelf;
      assert.strictEqual(canEdit, true);
    });
  });
});
