import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { LABEL_PRESET_COLORS, isValidHexColor } from '../constants/label-colors';
import { labelsApi } from '../api/labels';

describe('Labels Management (Task 31)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_labels_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Color Helpers & Presets', () => {
    it('should validate 6-digit hex format correctly with isValidHexColor', () => {
      assert.strictEqual(isValidHexColor('#2563eb'), true);
      assert.strictEqual(isValidHexColor('#FFFFFF'), true);
      assert.strictEqual(isValidHexColor('#000000'), true);
      assert.strictEqual(isValidHexColor('#ef4444'), true);

      assert.strictEqual(isValidHexColor(''), false);
      assert.strictEqual(isValidHexColor(null), false);
      assert.strictEqual(isValidHexColor(undefined), false);
      assert.strictEqual(isValidHexColor('#123'), false);
      assert.strictEqual(isValidHexColor('blue'), false);
      assert.strictEqual(isValidHexColor('#1234567'), false);
    });

    it('should define 12 preset colors with valid hex codes', () => {
      assert.strictEqual(LABEL_PRESET_COLORS.length, 12);
      for (const preset of LABEL_PRESET_COLORS) {
        assert.ok(preset.name.length > 0);
        assert.strictEqual(isValidHexColor(preset.hex), true);
      }
    });
  });

  describe('labelsApi Client Methods', () => {
    it('list() should perform GET to /labels with workspaceId header', async () => {
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
                id: 'lbl_1',
                workspaceId,
                title: 'VIP',
                color: '#2563eb',
                showOnSidebar: true,
                createdAt: '2026-01-01T00:00:00Z',
              },
            ],
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await labelsApi.list(workspaceId);
      assert.ok(requestedUrl.includes('/labels'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.length, 1);
      assert.strictEqual(res.data[0].title, 'VIP');
    });

    it('get() should perform GET to /labels/:id with workspaceId header', async () => {
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
              id: 'lbl_123',
              workspaceId,
              title: 'Bug',
              color: '#ef4444',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await labelsApi.get(workspaceId, 'lbl_123');
      assert.ok(requestedUrl.includes('/labels/lbl_123'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.id, 'lbl_123');
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
              id: 'lbl_new',
              workspaceId,
              ...JSON.parse(requestedBody),
              createdAt: '2026-01-01T00:00:00Z',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const payload = {
        title: 'Urgent',
        color: '#f59e0b',
        showOnSidebar: true,
      };

      const res = await labelsApi.create(workspaceId, payload);
      assert.ok(requestedUrl.includes('/labels'));
      assert.strictEqual(requestedMethod, 'POST');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.title, 'Urgent');
      assert.strictEqual(res.data.color, '#f59e0b');
    });

    it('update() should perform PATCH to /labels/:id with body', async () => {
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
              id: 'lbl_123',
              workspaceId,
              title: 'Updated Label',
              color: '#10b981',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await labelsApi.update(workspaceId, 'lbl_123', { color: '#10b981' });
      assert.ok(requestedUrl.includes('/labels/lbl_123'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.color, '#10b981');
      assert.deepStrictEqual(JSON.parse(requestedBody), { color: '#10b981' });
    });

    it('delete() should perform DELETE to /labels/:id', async () => {
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

      const res = await labelsApi.delete(workspaceId, 'lbl_123');
      assert.ok(requestedUrl.includes('/labels/lbl_123'));
      assert.strictEqual(requestedMethod, 'DELETE');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.success, true);
    });
  });
});
