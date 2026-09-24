import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { conversationsApi } from '../../api/conversations';
import { ConversationStatus } from '@sales-copilot/shared-contracts';

describe('Conversations List Feature Test Suite (Phase 6)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-conversations-list-01';

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), options: init });
      return new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('conversationsApi List and Count Methods', () => {
    it('list: should query conversations with status, inboxId, and X-Workspace-Id header', async () => {
      await conversationsApi.list(workspaceId, {
        status: ConversationStatus.OPEN,
        inboxId: '123e4567-e89b-12d3-a456-426614174000',
        limit: 20,
        q: 'khach hang',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes('/conversations?'));
      assert.ok(call.url.includes('status=OPEN'));
      assert.ok(call.url.includes('inboxId=123e4567-e89b-12d3-a456-426614174000'));
      assert.ok(call.url.includes('limit=20'));
      assert.ok(call.url.includes('q=khach+hang') || call.url.includes('q=khach%20hang'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getCounts: should fetch summary counts with X-Workspace-Id header', async () => {
      await conversationsApi.getCounts(workspaceId, ConversationStatus.OPEN);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes('/conversations/counts?status=OPEN'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getCounts: should fetch total counts without status query when omitted', async () => {
      await conversationsApi.getCounts(workspaceId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/conversations/counts'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });
  });
});
