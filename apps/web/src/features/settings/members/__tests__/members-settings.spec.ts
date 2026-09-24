import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { membersApi } from '../api/members';

describe('Workspace Members Management (Task 29)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_members_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('membersApi Client Methods', () => {
    it('list() should include X-Workspace-Id header', async () => {
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
                id: 'wm_1',
                workspaceId,
                userId: 'usr_1',
                role: WorkspaceRole.OWNER,
                user: { id: 'usr_1', name: 'Alice', email: 'alice@example.com' },
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await membersApi.list(workspaceId);
      assert.ok(requestedUrl.includes('/workspaces/current/members'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].user?.name, 'Alice');
    });

    it('add() should make POST request with serialized body and X-Workspace-Id header', async () => {
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
              id: 'wm_new',
              workspaceId,
              userId: 'usr_new',
              role: WorkspaceRole.AGENT,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await membersApi.add(workspaceId, {
        email: 'bob@example.com',
        role: WorkspaceRole.AGENT,
      });

      assert.ok(requestedUrl.includes('/workspaces/current/members'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.email, 'bob@example.com');
      assert.strictEqual(body.role, WorkspaceRole.AGENT);
      assert.strictEqual(res.data.id, 'wm_new');
    });

    it('updateRole() should make PATCH request with role body to member endpoint', async () => {
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
              id: 'wm_123',
              workspaceId,
              role: WorkspaceRole.ADMIN,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await membersApi.updateRole(workspaceId, 'wm_123', {
        role: WorkspaceRole.ADMIN,
      });

      assert.ok(requestedUrl.includes('/workspaces/current/members/wm_123'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      const body = JSON.parse(requestedBody);
      assert.strictEqual(body.role, WorkspaceRole.ADMIN);
      assert.strictEqual(res.data.role, WorkspaceRole.ADMIN);
    });

    it('remove() should make DELETE request to member endpoint with X-Workspace-Id header', async () => {
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

      const res = await membersApi.remove(workspaceId, 'wm_123');
      assert.ok(requestedUrl.includes('/workspaces/current/members/wm_123'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });
  });
});
