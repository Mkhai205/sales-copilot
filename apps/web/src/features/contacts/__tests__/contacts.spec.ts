import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { contactsApi } from '../api/contacts';

describe('Contacts Feature API Client (Phase 4)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-contacts-test-123';

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

  describe('contactsApi HTTP Client Methods', () => {
    it('list: should build correct URL with query parameters and X-Workspace-Id header', async () => {
      await contactsApi.list(workspaceId, { limit: 25, q: 'Nguyen' });
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes('/contacts?'));
      assert.ok(call.url.includes('limit=25'));
      assert.ok(call.url.includes('q=Nguyen'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('search: should call /contacts/search with query string and X-Workspace-Id header', async () => {
      await contactsApi.search(workspaceId, { q: '0901234567' });
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes('/contacts/search?q=0901234567'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('get: should call /contacts/:id with X-Workspace-Id header', async () => {
      await contactsApi.get(workspaceId, 'contact-999');
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-999'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('create: should POST to /contacts with JSON payload and X-Workspace-Id header', async () => {
      const payload = {
        name: 'Nguyen Van A',
        email: 'vana@example.com',
        phoneNumber: '+84901234567',
        tags: ['vip', 'wholesale'],
      };
      await contactsApi.create(workspaceId, payload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts'));
      assert.strictEqual(call.options?.method, 'POST');
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('update: should PATCH to /contacts/:id with partial payload and X-Workspace-Id header', async () => {
      const payload = { name: 'Nguyen Van B', tags: ['vip'] };
      await contactsApi.update(workspaceId, 'contact-999', payload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-999'));
      assert.strictEqual(call.options?.method, 'PATCH');
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('delete: should DELETE to /contacts/:id with X-Workspace-Id header', async () => {
      await contactsApi.delete(workspaceId, 'contact-999');
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-999'));
      assert.strictEqual(call.options?.method, 'DELETE');
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('merge: should POST to /contacts/merge with target/source IDs and X-Workspace-Id header', async () => {
      const payload = {
        baseContactId: '123e4567-e89b-12d3-a456-426614174000',
        mergeeContactId: '123e4567-e89b-12d3-a456-426614174001',
      };
      await contactsApi.merge(workspaceId, payload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/merge'));
      assert.strictEqual(call.options?.method, 'POST');
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('listIdentities: should GET /contacts/:id/identities with X-Workspace-Id header', async () => {
      await contactsApi.listIdentities(workspaceId, 'contact-100');
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-100/identities'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('linkIdentity: should POST to /contacts/:id/identities with payload and X-Workspace-Id header', async () => {
      const linkPayload = {
        channelId: '123e4567-e89b-12d3-a456-426614174000',
        externalContactId: 'fb-user-12345',
      };
      await contactsApi.linkIdentity(workspaceId, 'contact-100', linkPayload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-100/identities'));
      assert.strictEqual(call.options?.method, 'POST');
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), linkPayload);
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('unlinkIdentity: should DELETE to /contacts/:id/identities/:identityId with X-Workspace-Id header', async () => {
      await contactsApi.unlinkIdentity(workspaceId, 'contact-100', 'identity-555');
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-100/identities/identity-555'));
      assert.strictEqual(call.options?.method, 'DELETE');
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });
  });
});
