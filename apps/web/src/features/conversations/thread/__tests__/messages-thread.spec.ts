import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { messagesApi } from '../../api/messages';
import {
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';

describe('Messages Thread Feature Test Suite (Phase 6)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-messages-test-01';
  const conversationId = 'conv-test-999';
  const messageId = 'msg-test-888';

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

  describe('messagesApi Client Methods', () => {
    it('list: should query messages for conversation with pagination and X-Workspace-Id header', async () => {
      await messagesApi.list(workspaceId, conversationId, {
        limit: 30,
        beforeId: 'msg-cursor-1',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/conversations/${conversationId}/messages`));
      assert.ok(call.url.includes('limit=30'));
      assert.ok(call.url.includes('beforeId=msg-cursor-1'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('create: should POST message with JSON payload and X-Workspace-Id header', async () => {
      const payload = {
        type: MessageType.OUTGOING,
        senderType: SenderType.USER,
        contentType: MessageContentType.TEXT,
        content: 'Xin chao quy khach!',
      };

      await messagesApi.create(workspaceId, conversationId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/conversations/${conversationId}/messages`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('create: should POST message with FormData (attachment upload) and X-Workspace-Id header', async () => {
      const formData = new FormData();
      formData.append('type', MessageType.OUTGOING);
      formData.append('senderType', SenderType.USER);
      formData.append('contentType', MessageContentType.IMAGE);
      formData.append('content', 'Hinh anh san pham');

      await messagesApi.create(workspaceId, conversationId, formData);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/conversations/${conversationId}/messages`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.strictEqual(call.options?.body, formData);
    });

    it('updateDeliveryStatus: should PATCH to /messages/:id/delivery-status with X-Workspace-Id header', async () => {
      const payload = {
        deliveryStatus: DeliveryStatus.READ,
      };

      await messagesApi.updateDeliveryStatus(workspaceId, messageId, payload);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'PATCH');
      assert.ok(call.url.includes(`/messages/${messageId}/delivery-status`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('delete: should DELETE to /messages/:id with X-Workspace-Id header', async () => {
      await messagesApi.delete(workspaceId, messageId);

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'DELETE');
      assert.ok(call.url.includes(`/messages/${messageId}`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });
  });
});
