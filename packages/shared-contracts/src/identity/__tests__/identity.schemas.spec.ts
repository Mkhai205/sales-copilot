import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addWorkspaceMemberSchema,
  updateWorkspaceMemberRoleSchema,
  createTeamSchema,
  addTeamMembersSchema,
  removeTeamMembersSchema,
  updateUserProfileSchema,
  auditLogListQuerySchema,
  WorkspaceRole,
} from '../index';

describe('Shared Contracts — Identity Context Schemas', () => {
  describe('Auth Schemas', () => {
    it('should validate valid login payload', () => {
      const valid = { email: 'agent@salescopilot.vn', password: 'securePassword123' };
      const parsed = loginSchema.parse(valid);
      assert.strictEqual(parsed.email, 'agent@salescopilot.vn');
      assert.strictEqual(parsed.password, 'securePassword123');
    });

    it('should reject invalid email format or short password', () => {
      assert.throws(() => {
        loginSchema.parse({ email: 'invalid-email', password: '123456' });
      });

      assert.throws(() => {
        loginSchema.parse({ email: 'valid@example.com', password: '123' });
      });
    });

    it('should validate refreshTokenSchema and reject empty string', () => {
      const parsed = refreshTokenSchema.parse({ refreshToken: 'jwt.token.string' });
      assert.strictEqual(parsed.refreshToken, 'jwt.token.string');

      assert.throws(() => {
        refreshTokenSchema.parse({ refreshToken: '' });
      });
    });

    it('should validate logoutSchema with optional refreshToken', () => {
      assert.strictEqual(logoutSchema.parse({}).refreshToken, undefined);
      assert.strictEqual(logoutSchema.parse({ refreshToken: 'token123' }).refreshToken, 'token123');
    });
  });

  describe('Workspace Schemas', () => {
    it('should validate createWorkspaceSchema and trim inputs', () => {
      const parsed = createWorkspaceSchema.parse({
        name: '  Sales Copilot VN  ',
        slug: 'sales-copilot-vn',
        timezone: 'Asia/Ho_Chi_Minh',
        defaultLanguage: 'vi',
      });
      assert.strictEqual(parsed.name, 'Sales Copilot VN');
      assert.strictEqual(parsed.slug, 'sales-copilot-vn');
      assert.strictEqual(parsed.timezone, 'Asia/Ho_Chi_Minh');
      assert.strictEqual(parsed.defaultLanguage, 'vi');
    });

    it('should validate createWorkspaceSchema with slug regex', () => {
      // Valid slug: lowercase alphanumeric and hyphens
      assert.strictEqual(
        createWorkspaceSchema.parse({ name: 'Shop A', slug: 'shop-a-1' }).slug,
        'shop-a-1',
      );

      // Invalid slug: uppercase, spaces, special symbols
      assert.throws(() => {
        createWorkspaceSchema.parse({ name: 'Shop A', slug: 'Shop_A' });
      });
      assert.throws(() => {
        createWorkspaceSchema.parse({ name: 'Shop A', slug: 'shop a' });
      });
      assert.throws(() => {
        createWorkspaceSchema.parse({ name: 'Shop A', slug: 'shop@123' });
      });
    });

    it('should reject workspace name < 2 characters or > 100 characters', () => {
      assert.throws(() => {
        createWorkspaceSchema.parse({ name: 'A' });
      });
      assert.throws(() => {
        createWorkspaceSchema.parse({ name: 'A'.repeat(101) });
      });
    });

    it('should allow partial updates in updateWorkspaceSchema', () => {
      const parsed = updateWorkspaceSchema.parse({
        name: 'New Name',
        settings: { allowAiAutoPilot: true },
      });
      assert.strictEqual(parsed.name, 'New Name');
      assert.deepStrictEqual(parsed.settings, { allowAiAutoPilot: true });
    });

    it('should validate addWorkspaceMemberSchema with default AGENT role', () => {
      const parsed = addWorkspaceMemberSchema.parse({ email: '  agent@company.com  ' });
      assert.strictEqual(parsed.email, 'agent@company.com');
      assert.strictEqual(parsed.role, WorkspaceRole.AGENT);
    });

    it('should allow valid roles in updateWorkspaceMemberRoleSchema and reject invalid roles', () => {
      assert.strictEqual(
        updateWorkspaceMemberRoleSchema.parse({ role: WorkspaceRole.ADMIN }).role,
        WorkspaceRole.ADMIN,
      );
      assert.throws(() => {
        updateWorkspaceMemberRoleSchema.parse({ role: 'SUPERUSER' });
      });
    });
  });

  describe('Team Schemas', () => {
    const validUuid1 = '11111111-1111-1111-1111-111111111111';
    const validUuid2 = '22222222-2222-2222-2222-222222222222';

    it('should validate createTeamSchema with trim', () => {
      const parsed = createTeamSchema.parse({
        name: '  Sales Team North  ',
        description: 'Handles northern region leads',
      });
      assert.strictEqual(parsed.name, 'Sales Team North');
      assert.strictEqual(parsed.description, 'Handles northern region leads');
    });

    it('should reject empty team name', () => {
      assert.throws(() => {
        createTeamSchema.parse({ name: '   ' });
      });
    });

    it('should validate addTeamMembersSchema with array of UUIDs and reject empty array', () => {
      const parsed = addTeamMembersSchema.parse({ userIds: [validUuid1, validUuid2] });
      assert.deepStrictEqual(parsed.userIds, [validUuid1, validUuid2]);

      assert.throws(() => {
        addTeamMembersSchema.parse({ userIds: [] });
      });
      assert.throws(() => {
        addTeamMembersSchema.parse({ userIds: ['not-a-uuid'] });
      });
    });

    it('should validate removeTeamMembersSchema', () => {
      const parsed = removeTeamMembersSchema.parse({ userIds: [validUuid1] });
      assert.deepStrictEqual(parsed.userIds, [validUuid1]);
    });
  });

  describe('User Schemas', () => {
    it('should validate updateUserProfileSchema with url avatar', () => {
      const parsed = updateUserProfileSchema.parse({
        name: 'Nguyen Van A',
        avatarUrl: 'https://cdn.example.com/avatar.jpg',
      });
      assert.strictEqual(parsed.name, 'Nguyen Van A');
      assert.strictEqual(parsed.avatarUrl, 'https://cdn.example.com/avatar.jpg');
    });

    it('should reject invalid avatar URL', () => {
      assert.throws(() => {
        updateUserProfileSchema.parse({ avatarUrl: 'not-a-url' });
      });
    });
  });

  describe('Audit Log Query Schemas', () => {
    it('should parse auditLogListQuerySchema with defaults and coercion', () => {
      const parsed = auditLogListQuerySchema.parse({
        page: '2',
        limit: '50',
        action: 'order.created',
      });
      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.limit, 50);
      assert.strictEqual(parsed.action, 'order.created');
    });

    it('should reject invalid datetime for startDate or endDate', () => {
      assert.throws(() => {
        auditLogListQuerySchema.parse({ startDate: 'not-a-date' });
      });
    });
  });
});
