import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createContactSchema,
  updateContactSchema,
  mergeContactsSchema,
  createChannelIdentitySchema,
} from '@sales-copilot/shared-contracts';
import * as contactsModule from '../index';
import { contactsApi } from '../api/contacts';

describe('Contacts Module & API Client Tests (R1.2)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];

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

  describe('Public Barrel Exports', () => {
    it('should export all public API, components and hooks through index.ts', () => {
      assert.ok(contactsModule.contactsApi, 'contactsApi should be exported');
      assert.ok(contactsModule.useContactIdentities, 'useContactIdentities should be exported');
      assert.ok(contactsModule.useContacts, 'useContacts should be exported');
      assert.ok(contactsModule.useContact, 'useContact should be exported');
      assert.ok(contactsModule.useUpdateContact, 'useUpdateContact should be exported');
      assert.ok(contactsModule.useCreateContact, 'useCreateContact should be exported');
      assert.ok(contactsModule.useMergeContacts, 'useMergeContacts should be exported');
      assert.ok(contactsModule.ContactInfo, 'ContactInfo should be exported');
      assert.ok(contactsModule.ContactIdentities, 'ContactIdentities should be exported');
      assert.ok(contactsModule.ContactsView, 'ContactsView should be exported');
      assert.ok(contactsModule.ContactsTable, 'ContactsTable should be exported');
      assert.ok(contactsModule.ContactDetailSheet, 'ContactDetailSheet should be exported');
      assert.ok(contactsModule.ContactDetailDialog, 'ContactDetailDialog should be exported');
      assert.ok(contactsModule.CreateContactDialog, 'CreateContactDialog should be exported');
      assert.ok(contactsModule.MergeContactsDialog, 'MergeContactsDialog should be exported');
      assert.ok(contactsModule.usePaginatedContacts, 'usePaginatedContacts should be exported');
      assert.ok(contactsModule.useDeleteContact, 'useDeleteContact should be exported');
      assert.ok(contactsModule.useLinkContactIdentity, 'useLinkContactIdentity should be exported');
      assert.ok(
        contactsModule.useUnlinkContactIdentity,
        'useUnlinkContactIdentity should be exported',
      );
    });
  });

  describe('contactsApi HTTP Client Methods', () => {
    const workspaceId = 'ws-test-123';

    it('list: should build correct URL with query parameters and workspace header', async () => {
      await contactsApi.list(workspaceId, { limit: 25, q: 'Nguyen' });
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes('/contacts?'));
      assert.ok(call.url.includes('limit=25'));
      assert.ok(call.url.includes('q=Nguyen'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('search: should call /contacts/search with query string', async () => {
      await contactsApi.search(workspaceId, { q: '0901234567' });
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes('/contacts/search?q=0901234567'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('get: should call /contacts/:id', async () => {
      await contactsApi.get(workspaceId, 'contact-999');
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-999'));
    });

    it('create: should POST to /contacts with JSON payload', async () => {
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
    });

    it('update: should PATCH to /contacts/:id with partial payload', async () => {
      const payload = { name: 'Nguyen Van B', tags: ['vip'] };
      await contactsApi.update(workspaceId, 'contact-999', payload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-999'));
      assert.strictEqual(call.options?.method, 'PATCH');
      assert.deepStrictEqual(JSON.parse(call.options?.body as string), payload);
    });

    it('delete: should DELETE to /contacts/:id', async () => {
      await contactsApi.delete(workspaceId, 'contact-999');
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.endsWith('/contacts/contact-999'));
      assert.strictEqual(call.options?.method, 'DELETE');
    });

    it('merge: should POST to /contacts/merge with target and source IDs', async () => {
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
    });

    it('identities: list, link, and unlink should target sub-routes correctly', async () => {
      await contactsApi.listIdentities(workspaceId, 'contact-100');
      assert.ok(fetchCalls[0].url.endsWith('/contacts/contact-100/identities'));

      const linkPayload = {
        channelId: '123e4567-e89b-12d3-a456-426614174000',
        externalContactId: 'fb-user-12345',
      };
      await contactsApi.linkIdentity(workspaceId, 'contact-100', linkPayload);
      assert.strictEqual(fetchCalls[1].options?.method, 'POST');
      assert.ok(fetchCalls[1].url.endsWith('/contacts/contact-100/identities'));

      await contactsApi.unlinkIdentity(workspaceId, 'contact-100', 'identity-555');
      assert.strictEqual(fetchCalls[2].options?.method, 'DELETE');
      assert.ok(fetchCalls[2].url.endsWith('/contacts/contact-100/identities/identity-555'));
    });
  });

  describe('Contract Schema Validations', () => {
    it('should validate valid contact creation schema', () => {
      const valid = {
        name: 'Tran Thi B',
        email: 'tranthib@gmail.com',
        phoneNumber: '+84987654321',
        tags: ['lead'],
      };
      const parsed = createContactSchema.parse(valid);
      assert.strictEqual(parsed.name, 'Tran Thi B');
      assert.strictEqual(parsed.email, 'tranthib@gmail.com');
    });

    it('should validate contact update schema with partial fields', () => {
      const valid = {
        email: 'newemail@gmail.com',
      };
      const parsed = updateContactSchema.parse(valid);
      assert.strictEqual(parsed.email, 'newemail@gmail.com');
    });

    it('should validate contact merge schema', () => {
      const valid = {
        baseContactId: '123e4567-e89b-12d3-a456-426614174000',
        mergeeContactId: '123e4567-e89b-12d3-a456-426614174001',
      };
      const parsed = mergeContactsSchema.parse(valid);
      assert.strictEqual(parsed.baseContactId, valid.baseContactId);
      assert.strictEqual(parsed.mergeeContactId, valid.mergeeContactId);
    });

    it('should validate channel identity linking schema', () => {
      const valid = {
        channelId: '123e4567-e89b-12d3-a456-426614174000',
        externalContactId: 'tg-987654321',
      };
      const parsed = createChannelIdentitySchema.parse(valid);
      assert.strictEqual(parsed.channelId, '123e4567-e89b-12d3-a456-426614174000');
      assert.strictEqual(parsed.externalContactId, 'tg-987654321');
    });
  });
});
