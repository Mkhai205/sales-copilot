import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createKnowledgeArticleSchema,
  updateKnowledgeArticleSchema,
  testSearchKnowledgeSchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import {
  SETTINGS_NAV_ITEMS,
  getPermittedSettingsNavItems,
  isSettingsSectionAllowed,
} from '../constants/settings-nav-items';

describe('Knowledge Base Management (Epic 4.3)', () => {
  describe('createKnowledgeArticleSchema validation', () => {
    it('should validate valid article payload', () => {
      const payload = {
        title: 'Chính sách đổi trả trong 7 ngày',
        content: 'Khách hàng được đổi sản phẩm trong 7 ngày nếu còn nguyên tem.',
        category: 'policy',
        isActive: true,
      };
      const parsed = createKnowledgeArticleSchema.parse(payload);
      assert.strictEqual(parsed.title, 'Chính sách đổi trả trong 7 ngày');
      assert.strictEqual(parsed.category, 'policy');
      assert.strictEqual(parsed.isActive, true);
    });

    it('should reject empty title', () => {
      const payload = {
        title: '   ',
        content: 'Valid content',
      };
      assert.throws(() => createKnowledgeArticleSchema.parse(payload));
    });

    it('should reject title exceeding 255 characters', () => {
      const payload = {
        title: 'a'.repeat(256),
        content: 'Valid content',
      };
      assert.throws(() => createKnowledgeArticleSchema.parse(payload));
    });

    it('should reject empty content', () => {
      const payload = {
        title: 'Valid title',
        content: '',
      };
      assert.throws(() => createKnowledgeArticleSchema.parse(payload));
    });

    it('should reject content exceeding 10,000 characters', () => {
      const payload = {
        title: 'Valid title',
        content: 'c'.repeat(10001),
      };
      assert.throws(() => createKnowledgeArticleSchema.parse(payload));
    });

    it('should default isActive to true if omitted', () => {
      const payload = {
        title: 'FAQ bảo hành',
        content: 'Bảo hành 12 tháng chính hãng.',
      };
      const parsed = createKnowledgeArticleSchema.parse(payload);
      assert.strictEqual(parsed.isActive, true);
    });
  });

  describe('updateKnowledgeArticleSchema validation', () => {
    it('should allow partial update of only title', () => {
      const payload = { title: 'Tiêu đề cập nhật' };
      const parsed = updateKnowledgeArticleSchema.parse(payload);
      assert.strictEqual(parsed.title, 'Tiêu đề cập nhật');
      assert.strictEqual(parsed.content, undefined);
    });

    it('should allow partial update of only isActive', () => {
      const payload = { isActive: false };
      const parsed = updateKnowledgeArticleSchema.parse(payload);
      assert.strictEqual(parsed.isActive, false);
    });

    it('should reject empty title when provided in update', () => {
      const payload = { title: '  ' };
      assert.throws(() => updateKnowledgeArticleSchema.parse(payload));
    });
  });

  describe('testSearchKnowledgeSchema validation', () => {
    it('should validate query and supply default parameters', () => {
      const payload = { query: 'Shop có đổi hàng không?' };
      const parsed = testSearchKnowledgeSchema.parse(payload);
      assert.strictEqual(parsed.query, 'Shop có đổi hàng không?');
      assert.strictEqual(parsed.minSimilarity, 0.65);
      assert.strictEqual(parsed.limit, 3);
    });

    it('should reject empty search query', () => {
      const payload = { query: '   ' };
      assert.throws(() => testSearchKnowledgeSchema.parse(payload));
    });
  });

  describe('Navigation & RBAC for Knowledge Base', () => {
    it('should have knowledge navigation item configured in operations category', () => {
      const item = SETTINGS_NAV_ITEMS.find(nav => nav.segment === 'knowledge');
      assert.ok(item, 'knowledge nav item must exist');
      assert.strictEqual(item?.title, 'Kiến thức AI');
      assert.strictEqual(item?.category, 'operations');
      assert.deepStrictEqual(item?.allowedRoles, [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]);
    });

    it('should allow OWNER and ADMIN to access knowledge section but forbid AGENT', () => {
      assert.strictEqual(isSettingsSectionAllowed('knowledge', WorkspaceRole.OWNER), true);
      assert.strictEqual(isSettingsSectionAllowed('knowledge', WorkspaceRole.ADMIN), true);
      assert.strictEqual(isSettingsSectionAllowed('knowledge', WorkspaceRole.AGENT), false);
    });

    it('should include knowledge in permitted items for ADMIN', () => {
      const adminItems = getPermittedSettingsNavItems(WorkspaceRole.ADMIN);
      const hasKnowledge = adminItems.some(nav => nav.segment === 'knowledge');
      assert.strictEqual(hasKnowledge, true);
    });
  });
});
