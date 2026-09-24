import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { SUPPORTED_CHANNELS } from '../constants/inbox-channels';
import { inboxesApi } from '../api/inboxes';

describe('Inboxes & Channels Management (Task 33)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_inbox_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('SUPPORTED_CHANNELS Constants', () => {
    it('should contain all 5 channels: WEB_CHAT, FACEBOOK, TELEGRAM, EMAIL, ZALO', () => {
      assert.strictEqual(SUPPORTED_CHANNELS.length, 5);
      const types = SUPPORTED_CHANNELS.map(c => c.type);
      assert.ok(types.includes(ChannelType.WEB_CHAT));
      assert.ok(types.includes(ChannelType.FACEBOOK_MESSENGER));
      assert.ok(types.includes(ChannelType.TELEGRAM));
      assert.ok(types.includes(ChannelType.EMAIL));
      assert.ok(types.includes(ChannelType.ZALO));
    });

    it('each supported channel should have a non-empty title and description', () => {
      for (const channel of SUPPORTED_CHANNELS) {
        assert.ok(channel.title.length > 0);
        assert.ok(channel.description.length > 0);
      }
    });
  });

  describe('inboxesApi Client Methods', () => {
    it('list() should perform GET to /inboxes with workspaceId header', async () => {
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
                id: 'inbox_1',
                workspaceId,
                name: 'Website Support',
                channelType: ChannelType.WEB_CHAT,
              },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.list(workspaceId);
      assert.ok(requestedUrl.includes('/inboxes'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].name, 'Website Support');
    });

    it('getById() should perform GET to /inboxes/:id with workspaceId header', async () => {
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
              id: 'inbox_123',
              workspaceId,
              name: 'Live Chat',
              channelType: ChannelType.WEB_CHAT,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.getById(workspaceId, 'inbox_123');
      assert.ok(requestedUrl.includes('/inboxes/inbox_123'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.id, 'inbox_123');
    });

    it('create() should perform POST with JSON body to /inboxes', async () => {
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
              id: 'inbox_new',
              workspaceId,
              ...JSON.parse(requestedBody),
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const payload = {
        name: 'New Telegram Inbox',
        channelType: ChannelType.TELEGRAM,
      };

      const res = await inboxesApi.create(workspaceId, payload);
      assert.ok(requestedUrl.includes('/inboxes'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.name, 'New Telegram Inbox');
    });

    it('update() should perform PATCH to /inboxes/:id with body', async () => {
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
              id: 'inbox_123',
              workspaceId,
              name: JSON.parse(requestedBody).name,
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.update(workspaceId, 'inbox_123', { name: 'Renamed Inbox' });
      assert.ok(requestedUrl.includes('/inboxes/inbox_123'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.name, 'Renamed Inbox');
    });

    it('delete() should perform DELETE to /inboxes/:id', async () => {
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
            data: { success: true, message: 'Deleted' },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.delete(workspaceId, 'inbox_123');
      assert.ok(requestedUrl.includes('/inboxes/inbox_123'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });

    it('listMembers() should perform GET to /inboxes/:id/members', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'mem_1', inboxId: 'inbox_123', userId: 'user_1' }],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.listMembers(workspaceId, 'inbox_123');
      assert.ok(requestedUrl.includes('/inboxes/inbox_123/members'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
    });

    it('addMember() should perform POST to /inboxes/:id/members with userId in body', async () => {
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
            data: { id: 'mem_new', inboxId: 'inbox_123', userId: 'user_456' },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.addMember(workspaceId, 'inbox_123', 'user_456');
      assert.ok(requestedUrl.includes('/inboxes/inbox_123/members'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(JSON.parse(requestedBody).userId, 'user_456');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.userId, 'user_456');
    });

    it('removeMember() should perform DELETE to /inboxes/:id/members/:userId', async () => {
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
            data: { success: true, message: 'Removed' },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await inboxesApi.removeMember(workspaceId, 'inbox_123', 'user_456');
      assert.ok(requestedUrl.includes('/inboxes/inbox_123/members/user_456'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });
  });
});
