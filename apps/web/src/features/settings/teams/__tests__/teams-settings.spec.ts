import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { teamsApi } from '../api/teams';

describe('Teams Management (Task 30)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_teams_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('teamsApi Client Methods', () => {
    it('list() should perform GET to /teams with workspaceId header', async () => {
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
                id: 'team_1',
                workspaceId,
                name: 'Support Team',
                description: 'Customer inquiries',
                memberCount: 2,
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await teamsApi.list(workspaceId);
      assert.ok(requestedUrl.includes('/teams'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].name, 'Support Team');
    });

    it('get() should perform GET to /teams/:id with workspaceId header', async () => {
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
              id: 'team_123',
              workspaceId,
              name: 'Sales Team',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await teamsApi.get(workspaceId, 'team_123');
      assert.ok(requestedUrl.includes('/teams/team_123'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.id, 'team_123');
      assert.strictEqual(res.data.name, 'Sales Team');
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
              id: 'team_new',
              workspaceId,
              ...JSON.parse(requestedBody),
              createdAt: '2026-01-01T00:00:00Z',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const payload = {
        name: 'Technical Support',
        description: 'Level 2 technical troubleshooting',
      };

      const res = await teamsApi.create(workspaceId, payload);
      assert.ok(requestedUrl.includes('/teams'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.name, 'Technical Support');
    });

    it('update() should perform PATCH to /teams/:id with body', async () => {
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
              id: 'team_123',
              workspaceId,
              name: JSON.parse(requestedBody).name,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await teamsApi.update(workspaceId, 'team_123', { name: 'VIP Operations' });
      assert.ok(requestedUrl.includes('/teams/team_123'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.name, 'VIP Operations');
    });

    it('delete() should perform DELETE to /teams/:id', async () => {
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

      const res = await teamsApi.delete(workspaceId, 'team_123');
      assert.ok(requestedUrl.includes('/teams/team_123'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });

    it('listMembers() should perform GET to /teams/:id/members', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'tm_1', teamId: 'team_123', userId: 'user_1' }],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await teamsApi.listMembers(workspaceId, 'team_123');
      assert.ok(requestedUrl.includes('/teams/team_123/members'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
    });

    it('addMembers() should perform POST to /teams/:id/members with userIds array', async () => {
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
            data: [
              { id: 'tm_1', teamId: 'team_123', userId: 'user_1' },
              { id: 'tm_2', teamId: 'team_123', userId: 'user_2' },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await teamsApi.addMembers(workspaceId, 'team_123', ['user_1', 'user_2']);
      assert.ok(requestedUrl.includes('/teams/team_123/members'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.deepStrictEqual(JSON.parse(requestedBody).userIds, ['user_1', 'user_2']);
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 2);
    });

    it('removeMember() should perform DELETE to /teams/:id/members/:userId', async () => {
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

      const res = await teamsApi.removeMember(workspaceId, 'team_123', 'user_1');
      assert.ok(requestedUrl.includes('/teams/team_123/members/user_1'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });

    it('removeMembers() should perform DELETE to /teams/:id/members with userIds body', async () => {
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
          json: async () => ({ data: { success: true } }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await teamsApi.removeMembers(workspaceId, 'team_123', ['user_1', 'user_2']);
      assert.ok(requestedUrl.includes('/teams/team_123/members'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.deepStrictEqual(JSON.parse(requestedBody).userIds, ['user_1', 'user_2']);
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });
  });
});
