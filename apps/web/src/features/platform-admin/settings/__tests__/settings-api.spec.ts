import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { systemSettingsApi } from '../api/settings';
import { SystemSettingCategory } from '@sales-copilot/shared-contracts';

describe('Platform Admin System Settings API Client', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getSettings() should perform GET to /platform-admin/settings with optional category', async () => {
    let requestedUrl = '';
    let requestedMethod = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = url.toString();
      requestedMethod = init?.method || 'GET';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              key: 'ai.default_model',
              value: 'gemini-1.5-flash',
              category: SystemSettingCategory.AI,
              isSecret: false,
            },
          ],
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const res = await systemSettingsApi.getSettings(SystemSettingCategory.AI);

    assert.ok(requestedUrl.includes('/platform-admin/settings'));
    assert.ok(requestedUrl.includes(`category=${SystemSettingCategory.AI}`));
    assert.strictEqual(requestedMethod, 'GET');
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].key, 'ai.default_model');
  });

  it('updateSetting() should perform PUT to /platform-admin/settings/:key with payload', async () => {
    let requestedUrl = '';
    let requestedMethod = '';
    let requestedBody = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      requestedUrl = url.toString();
      requestedMethod = init?.method || 'GET';
      requestedBody = (init?.body as string) || '';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            key: 'ai.default_model',
            value: 'gemini-2.5-flash',
            category: SystemSettingCategory.AI,
            isSecret: false,
          },
        }),
      } as Response;
    }) as typeof globalThis.fetch;

    const payload = { value: 'gemini-2.5-flash' };
    const res = await systemSettingsApi.updateSetting('ai.default_model', payload);

    assert.ok(requestedUrl.includes('/platform-admin/settings/ai.default_model'));
    assert.strictEqual(requestedMethod, 'PUT');
    const parsed = JSON.parse(requestedBody);
    assert.strictEqual(parsed.value, 'gemini-2.5-flash');
    assert.strictEqual(res.data.value, 'gemini-2.5-flash');
  });
});
