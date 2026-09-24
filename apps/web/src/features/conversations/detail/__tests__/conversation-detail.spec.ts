import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { conversationsApi } from '../../api/conversations';
import { ConversationStatus } from '@sales-copilot/shared-contracts';

describe('Conversation Detail Feature Test Suite (Phase 6)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-conversation-detail-01';
  const conversationId = 'conv-detail-123';

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), options: init });
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('conversationsApi Detail & Action Methods', () => {
    it('get: should perform GET to /conversations/:id with X-Workspace-Id header', async () => {
      await conversationsApi.get(workspaceId, conversationId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith(`/conversations/${conversationId}`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('updateStatus: should perform PATCH to /conversations/:id/status with X-Workspace-Id header', async () => {
      const payload = { status: ConversationStatus.RESOLVED };
      await conversationsApi.updateStatus(workspaceId, conversationId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'PATCH');
      assert.ok(call.url.endsWith(`/conversations/${conversationId}/status`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('assign: should perform PATCH to /conversations/:id/assign with X-Workspace-Id header', async () => {
      const payload = { assigneeId: 'usr-agent-456' };
      await conversationsApi.assign(workspaceId, conversationId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'PATCH');
      assert.ok(call.url.endsWith(`/conversations/${conversationId}/assign`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('takeover: should perform POST to /conversations/:id/takeover with X-Workspace-Id header', async () => {
      await conversationsApi.takeover(workspaceId, conversationId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.endsWith(`/conversations/${conversationId}/takeover`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('assignLabels: should perform POST to /conversations/:id/labels with labelIds array', async () => {
      const payload = { labelIds: ['lbl-vip', 'lbl-support'] };
      await conversationsApi.assignLabels(workspaceId, conversationId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.endsWith(`/conversations/${conversationId}/labels`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('removeLabel: should perform DELETE to /conversations/:id/labels/:labelId', async () => {
      await conversationsApi.removeLabel(workspaceId, conversationId, 'lbl-support');

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'DELETE');
      assert.ok(call.url.endsWith(`/conversations/${conversationId}/labels/lbl-support`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });
  });
});
