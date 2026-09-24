import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIMEZONE_OPTIONS,
  getTimezoneLabel,
  getLanguageLabel,
} from '../constants/workspace-options';
import { workspacesApi } from '../api/workspace';

describe('General Workspace Settings (Task 28)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_general_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Timezone and Language Options Helper', () => {
    it('should contain predefined timezone groups and options', () => {
      assert.strictEqual(TIMEZONE_OPTIONS.length, 3);

      const groupNames = TIMEZONE_OPTIONS.map(g => g.group);
      assert.deepStrictEqual(groupNames, ['Asia & Pacific', 'Europe & Africa', 'Americas']);

      const allTzValues = TIMEZONE_OPTIONS.flatMap(g => g.options.map(o => o.value));
      assert.strictEqual(allTzValues.includes('Asia/Ho_Chi_Minh'), true);
      assert.strictEqual(allTzValues.includes('UTC'), true);
      assert.strictEqual(allTzValues.includes('America/New_York'), true);
    });

    it('should resolve human-readable timezone labels', () => {
      assert.strictEqual(getTimezoneLabel('Asia/Ho_Chi_Minh'), 'Asia/Ho_Chi_Minh (UTC+07:00)');
      assert.strictEqual(getTimezoneLabel('UTC'), 'UTC (UTC+00:00)');
      assert.strictEqual(
        getTimezoneLabel('America/New_York'),
        'America/New_York (UTC-05:00 / Eastern)',
      );
      // Fallback for custom/unlisted timezone
      assert.strictEqual(getTimezoneLabel('Custom/Timezone'), 'Custom/Timezone');
      assert.strictEqual(getTimezoneLabel(null), 'UTC (UTC+00:00)');
    });

    it('should resolve human-readable language labels', () => {
      assert.strictEqual(getLanguageLabel('en'), 'English (US)');
      assert.strictEqual(getLanguageLabel('vi'), 'Tiếng Việt (Vietnamese)');
      assert.strictEqual(getLanguageLabel('ja'), '日本語 (Japanese)');
      // Fallback
      assert.strictEqual(getLanguageLabel('custom-lang'), 'custom-lang');
      assert.strictEqual(getLanguageLabel(null), 'English (US)');
    });
  });

  describe('workspacesApi Client Methods', () => {
    it('getCurrent() should perform GET to /workspaces/current with workspaceId header', async () => {
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
              id: workspaceId,
              name: 'My Workspace',
              slug: 'my-workspace',
              timezone: 'Asia/Ho_Chi_Minh',
              defaultLanguage: 'vi',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await workspacesApi.getCurrent(workspaceId);
      assert.ok(requestedUrl.includes('/workspaces/current'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.name, 'My Workspace');
    });

    it('updateCurrent() should perform PATCH with body to /workspaces/current and workspaceId header', async () => {
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
              id: workspaceId,
              ...JSON.parse(requestedBody),
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const updatePayload = {
        name: 'Updated Workspace Name',
        timezone: 'America/New_York',
        defaultLanguage: 'en',
      };

      const res = await workspacesApi.updateCurrent(workspaceId, updatePayload);
      assert.ok(requestedUrl.includes('/workspaces/current'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.name, 'Updated Workspace Name');
      assert.strictEqual(res.data.timezone, 'America/New_York');
    });
  });
});
