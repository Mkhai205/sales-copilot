import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  facebookApi,
  type FacebookPageInfo,
  type ConnectFacebookPagesBatchDto,
} from '../api/facebook';

describe('Facebook OAuth 1-Click Connection Flow', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_fb_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('facebookApi Client Methods', () => {
    it('getAuthUrl() should make GET request with workspaceId header', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { authUrl: 'https://www.facebook.com/v26.0/dialog/oauth?client_id=123' },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const res = await facebookApi.getAuthUrl(workspaceId);

      assert.strictEqual(res.success, true);
      assert.ok(requestedUrl.includes('/integrations/facebook/auth-url'));
      assert.strictEqual(requestedHeaders['X-Workspace-Id'], workspaceId);
      assert.ok(res.data.authUrl.includes('www.facebook.com'));
    });

    it('discoverPages() should make GET request with sessionId query param', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      const mockPages: FacebookPageInfo[] = [
        {
          pageId: 'page_101',
          pageName: 'Fashion Brand Store',
          avatarUrl: 'https://example.com/p101.jpg',
          category: 'Clothing Store',
          isAlreadyConnected: false,
        },
        {
          pageId: 'page_102',
          pageName: 'Tech Support Hub',
          category: 'IT Services',
          isAlreadyConnected: true,
        },
      ];

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: mockPages,
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const res = await facebookApi.discoverPages(workspaceId, 'session_xyz_789');

      assert.strictEqual(res.success, true);
      assert.ok(requestedUrl.includes('/integrations/facebook/pages?sessionId=session_xyz_789'));
      assert.strictEqual(requestedHeaders['X-Workspace-Id'], workspaceId);
      assert.strictEqual(res.data.length, 2);
      assert.strictEqual(res.data[0].pageId, 'page_101');
      assert.strictEqual(res.data[0].isAlreadyConnected, false);
      assert.strictEqual(res.data[1].pageId, 'page_102');
      assert.strictEqual(res.data[1].isAlreadyConnected, true);
    });

    it('connectPagesBatch() should make POST request with JSON body and workspaceId header', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';

      const dto: ConnectFacebookPagesBatchDto = {
        sessionId: 'session_xyz_789',
        pageIds: ['page_101', 'page_102'],
        assignAllMembers: true,
      };

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              inboxes: [
                { inboxId: 'inbox_1', channelId: 'chan_1', pageId: 'page_101', pageName: 'Page 1' },
                { inboxId: 'inbox_2', channelId: 'chan_2', pageId: 'page_102', pageName: 'Page 2' },
              ],
            },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const res = await facebookApi.connectPagesBatch(workspaceId, dto);

      assert.strictEqual(res.success, true);
      assert.strictEqual(requestedMethod, 'POST');
      assert.ok(requestedUrl.includes('/integrations/facebook/connect-batch'));

      const parsedBody = JSON.parse(requestedBody);
      assert.strictEqual(parsedBody.sessionId, 'session_xyz_789');
      assert.deepStrictEqual(parsedBody.pageIds, ['page_101', 'page_102']);
      assert.strictEqual(parsedBody.assignAllMembers, true);
      assert.strictEqual(res.data.inboxes.length, 2);
    });

    it('connectPagesBatch() should send specific memberUserIds when selected in Step 3', async () => {
      let requestedBody = '';

      const dto: ConnectFacebookPagesBatchDto = {
        sessionId: 'session_xyz_789',
        pageIds: ['page_101'],
        assignAllMembers: false,
        memberUserIds: ['user_abc', 'user_def'],
      };

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        requestedBody = (init?.body as string) || '';
        return {
          ok: true,
          status: 201,
          json: async () => ({
            success: true,
            data: {
              inboxes: [
                { inboxId: 'inbox_1', channelId: 'chan_1', pageId: 'page_101', pageName: 'Page 1' },
              ],
            },
          }),
        } as unknown as Response;
      }) as typeof globalThis.fetch;

      const res = await facebookApi.connectPagesBatch(workspaceId, dto);

      assert.strictEqual(res.success, true);
      const parsedBody = JSON.parse(requestedBody);
      assert.strictEqual(parsedBody.assignAllMembers, false);
      assert.deepStrictEqual(parsedBody.memberUserIds, ['user_abc', 'user_def']);
    });
  });
});
