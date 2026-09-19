import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ContactResolutionService } from '../contact-resolution.service';
import { ContactsService } from '../contacts.service';
import { PrismaService } from '../../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ContactResolutionService (3NF Multi-Channel Identity Resolution Engine)', () => {
  let resolutionService: ContactResolutionService;
  let contactsService: ContactsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;
  let auditLogsDb: Array<any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let clientMock: any;

  beforeEach(() => {
    contactsDb = new Map();
    channelsDb = new Map();
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

    // Seed channels
    channelsDb.set('chn_fb_alpha', {
      id: 'chn_fb_alpha',
      workspaceId: 'ws_alpha',
      inboxId: 'ib_fb_alpha',
      channelType: 'FACEBOOK_MESSENGER',
      providerAccountId: 'page_123',
      credentials: {},
      settings: {},
      isConnected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    channelsDb.set('chn_zalo_alpha', {
      id: 'chn_zalo_alpha',
      workspaceId: 'ws_alpha',
      inboxId: 'ib_zalo_alpha',
      channelType: 'ZALO',
      providerAccountId: 'oa_456',
      credentials: {},
      settings: {},
      isConnected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    clientMock = {
      contact: {
        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const contact of contactsDb.values()) {
            if (where.id && typeof where.id === 'string' && contact.id !== where.id) continue;
            if (
              where.id &&
              typeof where.id === 'object' &&
              where.id.not &&
              contact.id === where.id.not
            ) {
              continue;
            }
            if (where.workspaceId && contact.workspaceId !== where.workspaceId) continue;
            if (where.email && contact.email?.toLowerCase() !== where.email?.toLowerCase())
              continue;
            if (where.identifier && contact.identifier !== where.identifier) continue;
            if (where.phoneNumber && contact.phoneNumber !== where.phoneNumber) continue;

            const res = { ...contact };
            if (include?.identities) {
              res.identities = Array.from(identitiesDb.values()).filter(
                (i: any) => i.contactId === contact.id,
              );
            }
            return res;
          }
          return null;
        },
        create: async ({ data, include }: { data: any; include?: any }) => {
          const id = `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const record = {
            id,
            workspaceId: data.workspaceId,
            name: data.name,
            email: data.email ?? null,
            phoneNumber: data.phoneNumber ?? null,
            avatarUrl: data.avatarUrl ?? null,
            identifier: data.identifier ?? null,
            customAttributes: data.customAttributes ?? {},
            additionalAttributes: data.additionalAttributes ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          contactsDb.set(id, record);
          const res: any = { ...record };
          if (include?.identities) res.identities = [];
          return res;
        },
        update: async ({ where, data, include }: { where: any; data: any; include?: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = contactsDb.get(id);
          if (!existing) throw new Error('Contact not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          contactsDb.set(id, updated);
          const res = { ...updated };
          if (include?.identities) {
            res.identities = Array.from(identitiesDb.values()).filter(
              (i: any) => i.contactId === id,
            );
          }
          return res;
        },
        delete: async ({ where }: { where: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const deleted = contactsDb.get(id);
          contactsDb.delete(id);
          return deleted;
        },
      },

      channel: {
        findFirst: async ({ where }: { where: any }) => {
          for (const chn of channelsDb.values()) {
            if (where.id && chn.id !== where.id) continue;
            if (where.workspaceId && chn.workspaceId !== where.workspaceId) continue;
            return { ...chn };
          }
          return null;
        },
      },

      channelIdentity: {
        findUnique: async ({ where }: { where: any }) => {
          if (where.channelId_externalContactId) {
            const { channelId, externalContactId } = where.channelId_externalContactId;
            for (const ident of identitiesDb.values()) {
              if (ident.channelId === channelId && ident.externalContactId === externalContactId) {
                return { ...ident, channel: channelsDb.get(ident.channelId) };
              }
            }
          }
          return null;
        },
        findMany: async ({ where }: { where: any }) => {
          return Array.from(identitiesDb.values())
            .filter((i: any) => {
              if (where.contactId && i.contactId !== where.contactId) return false;
              if (where.workspaceId && i.workspaceId !== where.workspaceId) return false;
              return true;
            })
            .map((i: any) => ({ ...i, channel: channelsDb.get(i.channelId) }));
        },
        create: async ({ data, include }: { data: any; include?: any }) => {
          const id = `ident_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const record = {
            id,
            contactId: data.contactId,
            workspaceId: data.workspaceId,
            channelId: data.channelId,
            externalContactId: data.externalContactId,
            username: data.username ?? null,
            metadata: data.metadata ?? {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          identitiesDb.set(id, record);
          const res: any = { ...record };
          if (include?.channel) res.channel = channelsDb.get(data.channelId);
          return res;
        },
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const ident of identitiesDb.values()) {
            if (where.contactId && ident.contactId !== where.contactId) continue;
            if (where.workspaceId && ident.workspaceId !== where.workspaceId) continue;
            ident.contactId = data.contactId;
            identitiesDb.set(ident.id, ident);
            count++;
          }
          return { count };
        },
        delete: async ({ where }: { where: any }) => {
          const deleted = identitiesDb.get(where.id);
          identitiesDb.delete(where.id);
          return deleted;
        },
      },

      conversation: {
        findMany: async ({ where }: { where: any }) => {
          return Array.from(conversationsDb.values()).filter((c: any) => {
            if (where.contactId && c.contactId !== where.contactId) return false;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
            return true;
          });
        },
        update: async ({ where, data }: { where: any; data: any }) => {
          const existing = conversationsDb.get(where.id);
          if (existing) {
            const updated = { ...existing, ...data };
            conversationsDb.set(where.id, updated);
            return updated;
          }
          return null;
        },
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const conv of conversationsDb.values()) {
            if (where.contactId && conv.contactId !== where.contactId) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            conv.contactId = data.contactId;
            conversationsDb.set(conv.id, conv);
            count++;
          }
          return { count };
        },
      },

      message: {
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const msg of messagesDb.values()) {
            if (where.workspaceId && msg.workspaceId !== where.workspaceId) continue;
            if (where.senderType && msg.senderType !== where.senderType) continue;
            if (where.senderId && msg.senderId !== where.senderId) continue;
            msg.senderId = data.senderId;
            messagesDb.set(msg.id, msg);
            count++;
          }
          return { count };
        },
      },

      order: {
        count: async () => 0,
        updateMany: async () => ({ count: 0 }),
      },

      shippingAddress: {
        updateMany: async () => ({ count: 0 }),
      },

      auditLog: {
        create: async ({ data }: { data: any }) => {
          auditLogsDb.push(data);
          return data;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      get client() {
        return clientMock;
      },
      runInTransaction: async (cb: any) => cb({ txClient: clientMock }),
    };

    contactsService = new ContactsService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );
    resolutionService = new ContactResolutionService(
      mockPrismaService as PrismaService,
      contactsService,
      mockEventEmitter as EventEmitter2,
    );
  });

  describe('resolveFromChannel (Inbound Pipeline)', () => {
    it('should return existing contact when ChannelIdentity is already known', async () => {
      // Seed contact and identity
      contactsDb.set('cnt_existing', {
        id: 'cnt_existing',
        workspaceId: 'ws_alpha',
        name: 'Existing Customer',
        email: 'customer@test.com',
        customAttributes: {},
        additionalAttributes: {},
      });

      identitiesDb.set('ident_existing', {
        id: 'ident_existing',
        contactId: 'cnt_existing',
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_user_100',
        username: 'FB User 100',
      });

      const result = await resolutionService.resolveFromChannel({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_user_100',
      });

      assert.strictEqual(result.isNewContact, false);
      assert.strictEqual(result.contact.id, 'cnt_existing');
      assert.strictEqual(result.channelIdentity.externalContactId, 'fb_user_100');
    });

    it('should match existing contact by email and link new ChannelIdentity', async () => {
      contactsDb.set('cnt_by_email', {
        id: 'cnt_by_email',
        workspaceId: 'ws_alpha',
        name: 'Email Matched Customer',
        email: 'match@test.com',
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
      });

      const result = await resolutionService.resolveFromChannel({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_user_200',
        contactInfo: {
          email: 'match@test.com',
          name: 'FB Profile Name',
        },
      });

      assert.strictEqual(result.isNewContact, false);
      assert.strictEqual(result.contact.id, 'cnt_by_email');
      assert.strictEqual(result.channelIdentity.externalContactId, 'fb_user_200');
      assert.strictEqual(result.channelIdentity.contactId, 'cnt_by_email');
    });

    it('should atomically create new Contact and link ChannelIdentity when no match exists', async () => {
      const result = await resolutionService.resolveFromChannel({
        workspaceId: 'ws_alpha',
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_user_999',
        username: 'Zalo Stranger',
        contactInfo: {
          phoneNumber: '+84977111222',
        },
      });

      assert.strictEqual(result.isNewContact, true);
      assert.strictEqual(result.contact.name, 'Zalo Stranger');
      assert.strictEqual(result.contact.phoneNumber, '+84977111222');
      assert.strictEqual(result.channelIdentity.externalContactId, 'zalo_user_999');
      assert.strictEqual(result.channelIdentity.contactId, result.contact.id);
    });

    it('should recover gracefully when P2002 race condition occurs during concurrent resolution', async () => {
      // First, create the contact and identity that won the race
      const wonContact = await contactsService.create('ws_alpha', {
        name: 'Concurrent Winner',
      });
      identitiesDb.set('ident_race_1', {
        id: 'ident_race_1',
        contactId: wonContact.id,
        workspaceId: 'ws_alpha',
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_race_user',
        username: 'Concurrent Winner',
      });

      // Simulate a concurrent runner where create throws P2002
      const origCreate = clientMock.channelIdentity.create;
      let throwOnce = true;
      clientMock.channelIdentity.create = async (args: any) => {
        if (throwOnce && args.data.externalContactId === 'zalo_race_user') {
          throwOnce = false;
          const err: any = new Error('Unique constraint failed on channelId_externalContactId');
          err.code = 'P2002';
          throw err;
        }
        return origCreate(args);
      };

      const result = await resolutionService.resolveFromChannel({
        workspaceId: 'ws_alpha',
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_race_user',
        username: 'Concurrent Winner',
      });

      assert.strictEqual(result.isNewContact, false);
      assert.strictEqual(result.contact.id, wonContact.id);
      assert.strictEqual(result.channelIdentity.externalContactId, 'zalo_race_user');
      clientMock.channelIdentity.create = origCreate;
    });

    it('should emit contact.created when findOrCreateIdentity auto-provisions a contact', async () => {
      emittedEvents = [];
      const identity = await resolutionService.findOrCreateIdentity({
        workspaceId: 'ws_alpha',
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_autoprovision_1',
        username: 'Auto User',
      });

      assert.strictEqual(identity.externalContactId, 'zalo_autoprovision_1');
      const contactCreated = emittedEvents.find(e => e.event === 'contact.created');
      assert.ok(contactCreated);
      assert.strictEqual(contactCreated.payload.contact.name, 'Auto User');
      assert.strictEqual(contactCreated.payload.workspaceId, 'ws_alpha');

      const identityCreated = emittedEvents.find(e => e.event === 'channel_identity.created');
      assert.ok(identityCreated);
    });
  });

  describe('identify (3-Tier Priority Chain & Conflict Guards)', () => {
    it('should merge active contact into existing contact when identifier matches', async () => {
      const existing = await contactsService.create('ws_alpha', {
        name: 'Identified Base',
        identifier: 'CRM_001',
      });

      const current = await contactsService.create('ws_alpha', {
        name: 'Visitor Current',
      });

      const identified = await resolutionService.identify(
        'ws_alpha',
        { id: current.id },
        { identifier: 'CRM_001', name: 'Visitor Current' },
      );

      assert.strictEqual(identified.id, existing.id);
      assert.strictEqual(contactsDb.has(current.id), false); // merged and deleted
    });

    it('should respect identifier conflict guard when matching email', async () => {
      // Existing contact has email match but a conflicting identifier
      const existingWithEmail = await contactsService.create('ws_alpha', {
        name: 'Existing Customer',
        email: 'alice@alphacorp.com',
        identifier: 'ID_ALICE_REAL',
      });

      const current = await contactsService.create('ws_alpha', {
        name: 'Visitor Bob',
        identifier: 'ID_BOB_DIFF',
      });

      // Attempt to identify current with alice's email but bob's identifier -> conflict guard stops merge
      const result = await resolutionService.identify(
        'ws_alpha',
        { id: current.id },
        { email: 'alice@alphacorp.com', identifier: 'ID_BOB_DIFF' },
      );

      // Contact was NOT merged into alice
      assert.strictEqual(result.id, current.id);
      assert.strictEqual(contactsDb.has(existingWithEmail.id), true);
    });
  });
});
