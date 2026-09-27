import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import {
  SETTINGS_NAV_ITEMS,
  getPermittedSettingsNavItems,
  isSettingsSectionAllowed,
} from '../../rbac/settings-nav-items';
import { knowledgeApi } from '../api/knowledge';

describe('Knowledge Base Management (Epic 4.3)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_knowledge_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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

  describe('knowledgeApi Client Methods', () => {
    it('list() should perform GET with query params and workspaceId header', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              items: [
                {
                  id: 'ka_1',
                  workspaceId,
                  title: 'Chính sách bảo hành',
                  content: 'Bảo hành 12 tháng.',
                  category: 'policy',
                  isActive: true,
                  createdAt: '2026-01-01T00:00:00Z',
                  updatedAt: '2026-01-01T00:00:00Z',
                },
              ],
              total: 1,
              page: 1,
              limit: 20,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await knowledgeApi.list(workspaceId, { search: 'bảo hành' });
      assert.ok(requestedUrl.includes('/knowledge-articles'));
      assert.ok(requestedUrl.includes('search='));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.items.length, 1);
      assert.strictEqual(res.data.items[0].title, 'Chính sách bảo hành');
    });

    it('getById() should perform GET to /knowledge-articles/:id with workspaceId header', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: 'ka_123',
              workspaceId,
              title: 'Quy trình đổi hàng',
              content: 'Đổi hàng trong 7 ngày.',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await knowledgeApi.getById(workspaceId, 'ka_123');
      assert.ok(requestedUrl.includes('/knowledge-articles/ka_123'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.id, 'ka_123');
    });

    it('create() should perform POST with JSON body and workspaceId header', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedBody = (init?.body as string) || '';
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              id: 'ka_new',
              workspaceId,
              ...JSON.parse(requestedBody),
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const payload = {
        title: 'Hướng dẫn bảo quản',
        content: 'Bảo quản nơi khô ráo, thoáng mát.',
        category: 'guide',
        isActive: true,
      };

      const res = await knowledgeApi.create(workspaceId, payload);
      assert.ok(requestedUrl.includes('/knowledge-articles'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.title, 'Hướng dẫn bảo quản');
    });

    it('update() should perform PATCH to /knowledge-articles/:id with body', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              id: 'ka_123',
              workspaceId,
              title: 'Cập nhật tiêu đề',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await knowledgeApi.update(workspaceId, 'ka_123', { title: 'Cập nhật tiêu đề' });
      assert.ok(requestedUrl.includes('/knowledge-articles/ka_123'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.title, 'Cập nhật tiêu đề');
    });

    it('delete() should perform DELETE to /knowledge-articles/:id', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { success: true } }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await knowledgeApi.delete(workspaceId, 'ka_123');
      assert.ok(requestedUrl.includes('/knowledge-articles/ka_123'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });

    it('testSearch() should perform POST to /knowledge-articles/test-search with query', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedBody = (init?.body as string) || '';
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'ka_1',
                title: 'Chính sách bảo hành',
                content: 'Bảo hành 12 tháng.',
                category: 'policy',
                similarity: 0.88,
              },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const searchPayload = { query: 'Bảo hành thế nào?', minSimilarity: 0.7, limit: 3 };
      const res = await knowledgeApi.testSearch(workspaceId, searchPayload);

      assert.ok(requestedUrl.includes('/knowledge-articles/test-search'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].similarity, 0.88);
      assert.deepStrictEqual(JSON.parse(requestedBody), searchPayload);
    });
  });
});
