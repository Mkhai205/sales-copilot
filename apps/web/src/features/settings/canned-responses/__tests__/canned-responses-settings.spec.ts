import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cannedResponsesApi } from '../api/canned-responses';

describe('Canned Responses Management (Task 32)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_canned_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('cannedResponsesApi Client Methods', () => {
    it('list() should perform GET with workspaceId header and query params', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'cr_1',
                workspaceId,
                shortCode: 'greeting',
                content: 'Xin chao!',
                createdAt: '2026-01-01T00:00:00Z',
                updatedAt: '2026-01-01T00:00:00Z',
              },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await cannedResponsesApi.list(workspaceId, { search: 'greet' });
      assert.ok(requestedUrl.includes('/canned-responses'));
      assert.ok(requestedUrl.includes('search=greet'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].shortCode, 'greeting');
    });

    it('getById() should perform GET to /canned-responses/:id', async () => {
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
              id: 'cr_123',
              workspaceId,
              shortCode: 'help',
              content: 'Can I help you?',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await cannedResponsesApi.getById(workspaceId, 'cr_123');
      assert.ok(requestedUrl.includes('/canned-responses/cr_123'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.id, 'cr_123');
      assert.strictEqual(res.data.shortCode, 'help');
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
              id: 'cr_created_1',
              workspaceId,
              ...JSON.parse(requestedBody),
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const payload = {
        shortCode: 'pricing',
        content: 'Bảng giá dịch vụ tháng này.',
      };

      const res = await cannedResponsesApi.create(workspaceId, payload);
      assert.ok(requestedUrl.includes('/canned-responses'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.shortCode, 'pricing');
      assert.strictEqual(res.data.content, 'Bảng giá dịch vụ tháng này.');
    });

    it('update() should perform PATCH to /canned-responses/:id with body', async () => {
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
            data: {
              id: 'cr_123',
              workspaceId,
              shortCode: 'pricing',
              ...JSON.parse(requestedBody),
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-02T00:00:00Z',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const updatePayload = { content: 'Nội dung cập nhật mới' };
      const res = await cannedResponsesApi.update(workspaceId, 'cr_123', updatePayload);

      assert.ok(requestedUrl.includes('/canned-responses/cr_123'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.content, 'Nội dung cập nhật mới');
    });

    it('delete() should perform DELETE to /canned-responses/:id', async () => {
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

      const res = await cannedResponsesApi.delete(workspaceId, 'cr_123');
      assert.ok(requestedUrl.includes('/canned-responses/cr_123'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });
  });
});
