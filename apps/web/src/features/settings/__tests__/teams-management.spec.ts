import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamSchema,
  updateTeamSchema,
  addTeamMembersSchema,
  removeTeamMembersSchema,
  type TeamDto,
} from '@sales-copilot/shared-contracts';

describe('Teams Management (Task 30)', () => {
  describe('createTeamSchema validation', () => {
    it('should validate valid team creation with name only', () => {
      const payload = {
        name: 'VIP Customer Support',
      };
      const parsed = createTeamSchema.parse(payload);
      assert.strictEqual(parsed.name, 'VIP Customer Support');
      assert.strictEqual(parsed.description, undefined);
    });

    it('should validate valid team with name and description', () => {
      const payload = {
        name: 'Technical Escalations',
        description: 'Dedicated team handling complex infrastructure and bug tickets.',
      };
      const parsed = createTeamSchema.parse(payload);
      assert.strictEqual(parsed.name, 'Technical Escalations');
      assert.strictEqual(
        parsed.description,
        'Dedicated team handling complex infrastructure and bug tickets.',
      );
    });

    it('should trim team name whitespace', () => {
      const payload = {
        name: '   APAC Retail Sales   ',
      };
      const parsed = createTeamSchema.parse(payload);
      assert.strictEqual(parsed.name, 'APAC Retail Sales');
    });

    it('should reject empty team names', () => {
      const invalidPayload = {
        name: '   ',
      };
      assert.throws(() => createTeamSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject names longer than 100 characters', () => {
      const invalidPayload = {
        name: 'T'.repeat(101),
      };
      assert.throws(() => createTeamSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject descriptions longer than 500 characters', () => {
      const invalidPayload = {
        name: 'Valid Name',
        description: 'D'.repeat(501),
      };
      assert.throws(() => createTeamSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });
  });

  describe('updateTeamSchema validation', () => {
    it('should allow updating only name', () => {
      const payload = {
        name: 'Updated Tier 1 Support',
      };
      const parsed = updateTeamSchema.parse(payload);
      assert.strictEqual(parsed.name, 'Updated Tier 1 Support');
      assert.strictEqual(parsed.description, undefined);
    });

    it('should allow updating only description', () => {
      const payload = {
        description: 'New team mission statement',
      };
      const parsed = updateTeamSchema.parse(payload);
      assert.strictEqual(parsed.description, 'New team mission statement');
      assert.strictEqual(parsed.name, undefined);
    });
  });

  describe('addTeamMembersSchema & removeTeamMembersSchema validation', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should validate array of user UUIDs for adding members', () => {
      const payload = {
        userIds: [validUuid],
      };
      const parsed = addTeamMembersSchema.parse(payload);
      assert.deepStrictEqual(parsed.userIds, [validUuid]);
    });

    it('should reject empty userIds array', () => {
      const invalidPayload = {
        userIds: [],
      };
      assert.throws(() => addTeamMembersSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidPayload = {
        userIds: ['not-a-uuid'],
      };
      assert.throws(() => addTeamMembersSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });
  });

  describe('Teams Search & Filter Logic', () => {
    const mockTeams: TeamDto[] = [
      {
        id: 'team_1',
        workspaceId: 'ws_1',
        name: 'Tier 1 Support',
        description: 'First response and general inquiries triage.',
        memberCount: 5,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'team_2',
        workspaceId: 'ws_1',
        name: 'Enterprise Sales',
        description: 'Inbound high-value prospect demos and contract discussions.',
        memberCount: 3,
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'team_3',
        workspaceId: 'ws_1',
        name: 'Customer Success',
        description: 'Onboarding and retention for active SaaS customers.',
        memberCount: 2,
        createdAt: '2026-01-03T00:00:00Z',
      },
    ];

    const filterTeams = (list: TeamDto[], query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return list;
      return list.filter(t => {
        const name = t.name.toLowerCase();
        const desc = t.description?.toLowerCase() || '';
        return name.includes(q) || desc.includes(q);
      });
    };

    it('should return all teams when query is empty', () => {
      const result = filterTeams(mockTeams, '');
      assert.strictEqual(result.length, 3);
    });

    it('should filter teams by name (case-insensitive)', () => {
      const result = filterTeams(mockTeams, 'sales');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Enterprise Sales');
    });

    it('should filter teams by description keyword', () => {
      const result = filterTeams(mockTeams, 'triage');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Tier 1 Support');
    });

    it('should return empty list when no teams match', () => {
      const result = filterTeams(mockTeams, 'non-existent query');
      assert.strictEqual(result.length, 0);
    });
  });

  describe('Team Member Sync Diffing Logic', () => {
    it('should correctly calculate members to add and remove', () => {
      const currentMemberUserIds = ['usr_1', 'usr_2', 'usr_3'];
      const newSelectedUserIds = ['usr_2', 'usr_3', 'usr_4', 'usr_5'];

      const toAdd = newSelectedUserIds.filter(id => !currentMemberUserIds.includes(id));
      const toRemove = currentMemberUserIds.filter(id => !newSelectedUserIds.includes(id));

      assert.deepStrictEqual(toAdd, ['usr_4', 'usr_5']);
      assert.deepStrictEqual(toRemove, ['usr_1']);
    });
  });
});
