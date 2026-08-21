import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ContactMergeService } from '../contact-merge.service';
import { PrismaService } from '../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ContactMergeService (Atomic Contact Merge Engine)', () => {
  let service: ContactMergeService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let auditLogsDb: Array<any>;
  let clientMock: any;

  beforeEach(() => {
    contactsDb = new Map();
    identitiesDb = new Map();
    conversationsDb = new Map();
    messagesDb = new Map();
    auditLogsDb = [];
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    // Seed base contact (has name, email, customAttributes)
    contactsDb.set('cnt_base', {
      id: 'cnt_base',
      workspaceId: 'ws_alpha',
      name: 'Base Contact',
      email: 'base@test.com',
      phoneNumber: null,
      avatarUrl: 'https://avatar.com/base.jpg',
      identifier: 'base_identifier_123',
      customAttributes: { vip: true, plan: 'enterprise' },
      additionalAttributes: { country: 'VN' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    // Seed mergee contact (has phone, different attributes)
    contactsDb.set('cnt_mergee', {
      id: 'cnt_mergee',
      workspaceId: 'ws_alpha',
      name: 'Mergee Contact',
      email: 'mergee_secondary@test.com',
      phoneNumber: '+84988888888',
      avatarUrl: null,
      identifier: null,
      customAttributes: { plan: 'free', source: 'facebook' },
      additionalAttributes: { city: 'Hanoi' },
      createdAt: new Date('2026-02-01T00:00:00Z'),
      updatedAt: new Date('2026-02-01T00:00:00Z'),
    });

    // Seed channel identities for mergee
    identitiesDb.set('ident_mergee_fb', {
      id: 'ident_mergee_fb',
      contactId: 'cnt_mergee',
      workspaceId: 'ws_alpha',
      channelId: 'chn_fb_1',
      externalContactId: 'fb_mergee_psid',
      username: 'FB Mergee',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed conversations for mergee
    conversationsDb.set('conv_mergee_1', {
      id: 'conv_mergee_1',
      workspaceId: 'ws_alpha',
      contactId: 'cnt_mergee',
      inboxId: 'ib_1',
      status: 'OPEN',
    });

    // Seed messages for mergee
    messagesDb.set('msg_mergee_1', {
      id: 'msg_mergee_1',
      workspaceId: 'ws_alpha',
      conversationId: 'conv_mergee_1',
      senderType: 'CONTACT',
      senderId: 'cnt_mergee',
      content: 'Hello from mergee',
    });

    clientMock = {
      contact: {
        findUnique: async ({ where }: { where: any }) => {
          for (const cnt of contactsDb.values()) {
            if (where.id && cnt.id !== where.id) continue;
            return {
              ...cnt,
              identities: Array.from(identitiesDb.values()).filter(i => i.contactId === cnt.id),
            };
          }
          return null;
        },
        findFirst: async ({ where }: { where: any }) => {
          for (const cnt of contactsDb.values()) {
            if (where.id && cnt.id !== where.id) continue;
            if (where.workspaceId && cnt.workspaceId !== where.workspaceId) continue;
            return {
              ...cnt,
              identities: Array.from(identitiesDb.values()).filter(i => i.contactId === cnt.id),
            };
          }
          return null;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = contactsDb.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          contactsDb.set(where.id, updated);
          return {
            ...updated,
            identities: Array.from(identitiesDb.values()).filter(i => i.contactId === where.id),
          };
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = contactsDb.get(where.id);
          if (existing) {
            contactsDb.delete(where.id);
          }
          return existing;
        },
      },

      channelIdentity: {
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const [id, ident] of identitiesDb.entries()) {
            if (where.contactId && ident.contactId !== where.contactId) continue;
            if (where.workspaceId && ident.workspaceId !== where.workspaceId) continue;
            identitiesDb.set(id, { ...ident, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },

      conversation: {
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const [id, conv] of conversationsDb.entries()) {
            if (where.contactId && conv.contactId !== where.contactId) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            conversationsDb.set(id, { ...conv, ...data });
            count++;
          }
          return { count };
        },
      },

      message: {
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const [id, msg] of messagesDb.entries()) {
            if (where.workspaceId && msg.workspaceId !== where.workspaceId) continue;
            if (where.senderType && msg.senderType !== where.senderType) continue;
            if (where.senderId && msg.senderId !== where.senderId) continue;
            messagesDb.set(id, { ...msg, ...data });
            count++;
          }
          return { count };
        },
      },

      auditLog: {
        create: async ({ data }: { data: any }) => {
          const created = { id: `audit_${Date.now()}`, ...data, createdAt: new Date() };
          auditLogsDb.push(created);
          return created;
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (fn: (ctx: any) => Promise<any>) =>
        fn({ tx: clientMock, txClient: clientMock }),
    };

    service = new ContactMergeService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );
  });

  it('should successfully merge mergee contact into base contact', async () => {
    const result = await service.merge('ws_alpha', 'cnt_base', 'cnt_mergee', {
      performedByUserId: 'usr_admin_1',
    });

    assert.strictEqual(result.id, 'cnt_base');
    // Base attributes are preserved
    assert.strictEqual(result.name, 'Base Contact');
    assert.strictEqual(result.email, 'base@test.com');
    assert.strictEqual(result.avatarUrl, 'https://avatar.com/base.jpg');
    assert.strictEqual(result.identifier, 'base_identifier_123');
    // Missing phoneNumber on base was filled by mergee
    assert.strictEqual(result.phoneNumber, '+84988888888');

    // Custom attributes deep merged: base values take priority
    assert.deepStrictEqual(result.customAttributes, {
      vip: true,
      plan: 'enterprise', // base 'enterprise' overrides mergee 'free'
      source: 'facebook', // filled from mergee
    });

    // Additional attributes deep merged
    assert.deepStrictEqual(result.additionalAttributes, {
      country: 'VN',
      city: 'Hanoi',
    });

    // Mergee contact is deleted
    assert.strictEqual(contactsDb.has('cnt_mergee'), false);

    // ChannelIdentity transferred to cnt_base
    assert.strictEqual(identitiesDb.get('ident_mergee_fb')?.contactId, 'cnt_base');

    // Conversation transferred to cnt_base
    assert.strictEqual(conversationsDb.get('conv_mergee_1')?.contactId, 'cnt_base');

    // Message senderId transferred to cnt_base
    assert.strictEqual(messagesDb.get('msg_mergee_1')?.senderId, 'cnt_base');

    // AuditLog recorded
    assert.strictEqual(auditLogsDb.length, 1);
    assert.strictEqual(auditLogsDb[0].action, 'CONTACT_MERGED');
    assert.strictEqual(auditLogsDb[0].resourceId, 'cnt_base');
    assert.strictEqual(auditLogsDb[0].payload.mergeeContactId, 'cnt_mergee');

    // Event contact.merged emitted
    assert.strictEqual(emittedEvents.length, 1);
    assert.strictEqual(emittedEvents[0].event, 'contact.merged');
    assert.strictEqual(emittedEvents[0].payload.primaryContactId, 'cnt_base');
    assert.strictEqual(emittedEvents[0].payload.mergedContactId, 'cnt_mergee');
    assert.strictEqual(emittedEvents[0].payload.mergedByUserId, 'usr_admin_1');
  });

  it('should be a no-op when baseContactId and mergeeContactId are identical (self-merge)', async () => {
    const result = await service.merge('ws_alpha', 'cnt_base', 'cnt_base');

    assert.strictEqual(result.id, 'cnt_base');
    assert.strictEqual(auditLogsDb.length, 0);
    assert.strictEqual(emittedEvents.length, 0);
  });

  it('should throw NotFoundException if base contact is not found', async () => {
    await assert.rejects(
      async () => {
        await service.merge('ws_alpha', 'cnt_unknown', 'cnt_mergee');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
        return true;
      },
    );
  });

  it('should throw NotFoundException if mergee contact is not found', async () => {
    await assert.rejects(
      async () => {
        await service.merge('ws_alpha', 'cnt_base', 'cnt_unknown');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
        return true;
      },
    );
  });

  it('should throw BadRequestException (CROSS_WORKSPACE_MERGE_PROHIBITED) when merging contacts from different workspaces', async () => {
    contactsDb.set('cnt_beta', {
      id: 'cnt_beta',
      workspaceId: 'ws_beta',
      name: 'Beta Contact',
      email: 'beta@test.com',
      phoneNumber: null,
      avatarUrl: null,
      identifier: null,
      customAttributes: {},
      additionalAttributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await assert.rejects(
      async () => {
        await service.merge('ws_alpha', 'cnt_base', 'cnt_beta');
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'CROSS_WORKSPACE_MERGE_PROHIBITED');
        return true;
      },
    );
  });

  it('should rollback and propagate error if any database operation fails in transaction', async () => {
    // Override message.updateMany to fail
    clientMock.message.updateMany = async () => {
      throw new Error('Database disk error');
    };

    await assert.rejects(
      async () => {
        await service.merge('ws_alpha', 'cnt_base', 'cnt_mergee');
      },
      (err: any) => {
        assert.strictEqual(err.message, 'Database disk error');
        return true;
      },
    );

    // Mergee contact should NOT have been deleted if transaction fails
    assert.strictEqual(contactsDb.has('cnt_mergee'), true);
    assert.strictEqual(auditLogsDb.length, 0);
    assert.strictEqual(emittedEvents.length, 0);
  });
});
