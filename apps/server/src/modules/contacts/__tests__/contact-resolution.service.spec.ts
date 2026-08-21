import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ContactResolutionService } from '../contact-resolution.service';
import { ContactIdentifyService } from '../contact-identify.service';
import { ChannelIdentityService } from '../channel-identity.service';
import { ContactMergeService } from '../contact-merge.service';
import { PrismaService } from '../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ContactResolutionService (Channel Ingestion Pipeline Orchestrator)', () => {
  let resolutionService: ContactResolutionService;
  let identityService: ChannelIdentityService;
  let identifyService: ContactIdentifyService;
  let mergeService: ContactMergeService;
  let mockPrismaService: any;
  let mockEventEmitter: any;

  let contactsDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;
  let auditLogsDb: Array<any>;

  beforeEach(() => {
    contactsDb = new Map();
    channelsDb = new Map();
    identitiesDb = new Map();
    auditLogsDb = [];

    mockEventEmitter = {
      emit: () => {},
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

    channelsDb.set('chn_fb_beta', {
      id: 'chn_fb_beta',
      workspaceId: 'ws_beta',
      inboxId: 'ib_fb_beta',
      channelType: 'FACEBOOK_MESSENGER',
      providerAccountId: 'page_789',
      credentials: {},
      settings: {},
      isConnected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          for (const ch of channelsDb.values()) {
            if (where.id && ch.id !== where.id) continue;
            if (where.workspaceId && ch.workspaceId !== where.workspaceId) continue;
            return ch;
          }
          return null;
        },
      },

      contact: {
        findFirst: async ({ where }: { where: any }) => {
          for (const cnt of contactsDb.values()) {
            if (where.id && cnt.id !== where.id) continue;
            if (where.workspaceId && cnt.workspaceId !== where.workspaceId) continue;
            if (where.identifier && cnt.identifier !== where.identifier) continue;
            if (where.email && cnt.email !== where.email) continue;
            if (where.phoneNumber && cnt.phoneNumber !== where.phoneNumber) continue;
            return {
              ...cnt,
              identities: Array.from(identitiesDb.values()).filter(i => i.contactId === cnt.id),
            };
          }
          return null;
        },

        create: async ({ data }: { data: any }) => {
          const created = {
            id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          contactsDb.set(created.id, created);
          return {
            ...created,
            identities: [],
          };
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
        findUnique: async ({
          where,
          include,
        }: {
          where: {
            id?: string;
            channelId_externalContactId?: { channelId: string; externalContactId: string };
          };
          include?: any;
        }) => {
          if (where.channelId_externalContactId) {
            const { channelId, externalContactId } = where.channelId_externalContactId;
            for (const item of identitiesDb.values()) {
              if (item.channelId === channelId && item.externalContactId === externalContactId) {
                const res = { ...item };
                if (include?.channel) res.channel = channelsDb.get(item.channelId);
                return res;
              }
            }
          }
          return null;
        },

        create: async ({ data, include }: { data: any; include?: any }) => {
          const created = {
            id: `ident_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          identitiesDb.set(created.id, created);
          const res = { ...created };
          if (include?.channel) res.channel = channelsDb.get(data.channelId);
          return res;
        },

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
        updateMany: async () => ({ count: 0 }),
      },

      message: {
        updateMany: async () => ({ count: 0 }),
      },

      auditLog: {
        create: async ({ data }: { data: any }) => {
          const item = { id: `audit_${Date.now()}`, ...data, createdAt: new Date() };
          auditLogsDb.push(item);
          return item;
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (fn: (ctx: any) => Promise<any>) =>
        fn({ tx: clientMock, txClient: clientMock }),
    };

    identityService = new ChannelIdentityService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );

    mergeService = new ContactMergeService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );

    identifyService = new ContactIdentifyService(
      mockPrismaService as PrismaService,
      mergeService,
      mockEventEmitter as EventEmitter2,
    );

    resolutionService = new ContactResolutionService(
      mockPrismaService as PrismaService,
      identityService,
      identifyService,
      mockEventEmitter as EventEmitter2,
    );
  });

  it('should create new Contact and ChannelIdentity on first inbound message from unknown sender (isNewContact: true)', async () => {
    const result = await resolutionService.resolveFromChannel({
      workspaceId: 'ws_alpha',
      channelId: 'chn_fb_alpha',
      externalContactId: 'fb_unknown_999',
      username: 'Alice Wonderland',
      contactInfo: {
        name: 'Alice Wonderland',
        email: 'alice@wonderland.com',
      },
    });

    assert.strictEqual(result.isNewContact, true);
    assert.ok(result.contact.id);
    assert.strictEqual(result.contact.name, 'Alice Wonderland');
    assert.strictEqual(result.contact.email, 'alice@wonderland.com');
    assert.strictEqual(result.channelIdentity.externalContactId, 'fb_unknown_999');
    assert.strictEqual(result.channelIdentity.channelId, 'chn_fb_alpha');
  });

  it('should return existing Contact on subsequent inbound message from same sender (isNewContact: false)', async () => {
    // 1. First inbound
    const first = await resolutionService.resolveFromChannel({
      workspaceId: 'ws_alpha',
      channelId: 'chn_fb_alpha',
      externalContactId: 'fb_user_repeated',
      username: 'Bob Builder',
    });

    assert.strictEqual(first.isNewContact, true);

    // 2. Second inbound
    const second = await resolutionService.resolveFromChannel({
      workspaceId: 'ws_alpha',
      channelId: 'chn_fb_alpha',
      externalContactId: 'fb_user_repeated',
    });

    assert.strictEqual(second.isNewContact, false);
    assert.strictEqual(second.contact.id, first.contact.id);
    assert.strictEqual(second.channelIdentity.id, first.channelIdentity.id);
  });

  it('should link channel identity to existing contact if contactInfo email matches an existing contact in workspace', async () => {
    // Seed pre-existing contact
    contactsDb.set('cnt_existing_customer', {
      id: 'cnt_existing_customer',
      workspaceId: 'ws_alpha',
      name: 'Existing Charlie',
      email: 'charlie@company.com',
      phoneNumber: null,
      identifier: null,
      customAttributes: {},
      additionalAttributes: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Inbound from Zalo with Charlie's email
    const result = await resolutionService.resolveFromChannel({
      workspaceId: 'ws_alpha',
      channelId: 'chn_zalo_alpha',
      externalContactId: 'zalo_charlie_123',
      contactInfo: {
        name: 'Charlie Zalo',
        email: 'charlie@company.com',
        phoneNumber: '+84988776655',
      },
    });

    assert.strictEqual(result.isNewContact, false);
    assert.strictEqual(result.contact.id, 'cnt_existing_customer');
    assert.strictEqual(result.contact.phoneNumber, '+84988776655');
    assert.strictEqual(result.channelIdentity.externalContactId, 'zalo_charlie_123');
    assert.strictEqual(result.channelIdentity.contactId, 'cnt_existing_customer');
  });

  it('should enrich existing contact when inbound message contains new profile info', async () => {
    // 1. Initial resolution
    const initial = await resolutionService.resolveFromChannel({
      workspaceId: 'ws_alpha',
      channelId: 'chn_fb_alpha',
      externalContactId: 'fb_enrich_user',
      username: 'David',
    });

    // 2. Later message comes with email and phone
    const enriched = await resolutionService.resolveFromChannel({
      workspaceId: 'ws_alpha',
      channelId: 'chn_fb_alpha',
      externalContactId: 'fb_enrich_user',
      contactInfo: {
        email: 'david@enrich.com',
        phoneNumber: '+84911002233',
        customAttributes: { company: 'Acme Inc' },
      },
    });

    assert.strictEqual(enriched.isNewContact, false);
    assert.strictEqual(enriched.contact.id, initial.contact.id);
    assert.strictEqual(enriched.contact.email, 'david@enrich.com');
    assert.strictEqual(enriched.contact.phoneNumber, '+84911002233');
    assert.deepStrictEqual(enriched.contact.customAttributes, { company: 'Acme Inc' });
  });

  it('should enforce tenant isolation (cannot resolve for channel of different workspace)', async () => {
    await assert.rejects(
      async () => {
        await resolutionService.resolveFromChannel({
          workspaceId: 'ws_alpha',
          channelId: 'chn_fb_beta', // ws_beta channel!
          externalContactId: 'fb_cross_tenant',
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'CHANNEL_NOT_FOUND');
        return true;
      },
    );
  });
});
