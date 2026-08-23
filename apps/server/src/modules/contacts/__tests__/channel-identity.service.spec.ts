import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelIdentityService } from '../channel-identity.service';
import { PrismaService } from '../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ChannelIdentityService (Multi-Channel Identity Mapping & Resolution)', () => {
  let service: ChannelIdentityService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;

  beforeEach(() => {
    contactsDb = new Map();
    channelsDb = new Map();
    identitiesDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    // Seed sample channels
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

    // Seed sample contact
    contactsDb.set('cnt_alpha_1', {
      id: 'cnt_alpha_1',
      workspaceId: 'ws_alpha',
      name: 'Alpha Contact 1',
      email: 'alpha1@test.com',
      phoneNumber: '+84900000001',
      customAttributes: {},
      additionalAttributes: {},
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
            return cnt;
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
          return created;
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
          if (where.id) {
            const item = identitiesDb.get(where.id);
            if (!item) return null;
            const res = { ...item };
            if (include?.channel) res.channel = channelsDb.get(item.channelId);
            if (include?.contact) res.contact = contactsDb.get(item.contactId);
            return res;
          }

          if (where.channelId_externalContactId) {
            const { channelId, externalContactId } = where.channelId_externalContactId;
            for (const item of identitiesDb.values()) {
              if (item.channelId === channelId && item.externalContactId === externalContactId) {
                const res = { ...item };
                if (include?.channel) res.channel = channelsDb.get(item.channelId);
                if (include?.contact) res.contact = contactsDb.get(item.contactId);
                return res;
              }
            }
          }
          return null;
        },

        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const item of identitiesDb.values()) {
            if (where.id && item.id !== where.id) continue;
            if (where.contactId && item.contactId !== where.contactId) continue;
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;

            const res = { ...item };
            if (include?.channel) res.channel = channelsDb.get(item.channelId);
            if (include?.contact) res.contact = contactsDb.get(item.contactId);
            return res;
          }
          return null;
        },

        findMany: async ({
          where,
          include,
          orderBy,
        }: {
          where: any;
          include?: any;
          orderBy?: any;
        }) => {
          const results: any[] = [];
          for (const item of identitiesDb.values()) {
            if (where.contactId && item.contactId !== where.contactId) continue;
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
            if (where.channelId && item.channelId !== where.channelId) continue;

            const res = { ...item };
            if (include?.channel) res.channel = channelsDb.get(item.channelId);
            if (include?.contact) res.contact = contactsDb.get(item.contactId);
            results.push(res);
          }

          if (orderBy?.createdAt === 'asc') {
            results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          }
          return results;
        },

        create: async ({ data, include }: { data: any; include?: any }) => {
          // Check unique @@unique([channelId, externalContactId])
          for (const existing of identitiesDb.values()) {
            if (
              existing.channelId === data.channelId &&
              existing.externalContactId === data.externalContactId
            ) {
              const err: any = new Error(
                'Unique constraint failed on (channelId, externalContactId)',
              );
              err.code = 'P2002';
              throw err;
            }
          }

          const created = {
            id: `ident_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          identitiesDb.set(created.id, created);

          const res = { ...created };
          if (include?.channel) res.channel = channelsDb.get(data.channelId);
          if (include?.contact) res.contact = contactsDb.get(data.contactId);
          return res;
        },

        delete: async ({ where }: { where: { id: string } }) => {
          const existing = identitiesDb.get(where.id);
          if (existing) {
            identitiesDb.delete(where.id);
          }
          return existing;
        },

        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          if (where.id?.in && Array.isArray(where.id.in)) {
            for (const id of where.id.in) {
              const existing = identitiesDb.get(id);
              if (existing) {
                identitiesDb.set(id, { ...existing, ...data, updatedAt: new Date() });
                count++;
              }
            }
          }
          return { count };
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (fn: (tx: any) => Promise<any>) => fn(clientMock),
    };

    service = new ChannelIdentityService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );
  });

  describe('findOrCreate (Inbound Message Idempotency)', () => {
    it('should create new Contact and ChannelIdentity on first inbound message', async () => {
      const identity = await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_user_123',
        username: 'John Doe',
        metadata: { profileUrl: 'https://fb.com/johndoe' },
      });

      assert.ok(identity.id);
      assert.strictEqual(identity.channelId, 'chn_fb_alpha');
      assert.strictEqual(identity.externalContactId, 'fb_user_123');
      assert.strictEqual(identity.username, 'John Doe');
      assert.strictEqual(identity.channelType, 'FACEBOOK_MESSENGER');
      assert.ok(identity.contactId);

      // Verify contact was created
      assert.ok(contactsDb.has(identity.contactId!));
      assert.strictEqual(contactsDb.get(identity.contactId!)?.name, 'John Doe');

      // Verify event was emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'channel_identity.created');
    });

    it('should be idempotent and return existing identity on subsequent calls without duplicate creation', async () => {
      const first = await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_user_123',
        username: 'John Doe',
      });

      const initialCount = identitiesDb.size;
      emittedEvents = [];

      const second = await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_user_123',
        username: 'John Doe Renamed',
      });

      assert.strictEqual(second.id, first.id);
      assert.strictEqual(second.contactId, first.contactId);
      assert.strictEqual(identitiesDb.size, initialCount);
      assert.strictEqual(emittedEvents.length, 0); // No second event
    });

    it('should link to specific existing contact when contactId is supplied', async () => {
      const identity = await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_uid_999',
        contactId: 'cnt_alpha_1',
        username: 'Alpha Zalo User',
      });

      assert.strictEqual(identity.contactId, 'cnt_alpha_1');
      assert.strictEqual(identity.channelType, 'ZALO');
    });

    it('should throw NotFoundException (CHANNEL_NOT_FOUND) when channel does not belong to workspace', async () => {
      await assert.rejects(
        async () => {
          await service.findOrCreate({
            workspaceId: 'ws_alpha',
            channelId: 'chn_fb_beta', // Channel belongs to ws_beta!
            externalContactId: 'fb_user_cross',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CHANNEL_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException (CONTACT_NOT_FOUND) when contactId does not belong to workspace', async () => {
      await assert.rejects(
        async () => {
          await service.findOrCreate({
            workspaceId: 'ws_alpha',
            channelId: 'chn_fb_alpha',
            externalContactId: 'fb_user_cross',
            contactId: 'cnt_non_existent',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('findByChannelAndExternalId (Fast Lookup)', () => {
    it('should lookup existing identity by (channelId, externalContactId)', async () => {
      const created = await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_lookup_1',
      });

      const found = await service.findByChannelAndExternalId('chn_fb_alpha', 'fb_lookup_1');
      assert.ok(found);
      assert.strictEqual(found?.id, created.id);
    });

    it('should return null when identity does not exist', async () => {
      const notFound = await service.findByChannelAndExternalId(
        'chn_fb_alpha',
        'non_existent_psid',
      );
      assert.strictEqual(notFound, null);
    });
  });

  describe('findByContactId', () => {
    it('should list all identities for a contact across multiple channels', async () => {
      await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_alpha_1',
        contactId: 'cnt_alpha_1',
      });

      await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_alpha_1',
        contactId: 'cnt_alpha_1',
      });

      const list = await service.findByContactId('ws_alpha', 'cnt_alpha_1');
      assert.strictEqual(list.length, 2);
      assert.ok(list.some(i => i.channelType === 'FACEBOOK_MESSENGER'));
      assert.ok(list.some(i => i.channelType === 'ZALO'));
    });

    it('should throw NotFoundException when contact does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.findByContactId('ws_alpha', 'cnt_unknown');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('createForContact (Manual Link)', () => {
    it('should explicitly link a new channel identity to contact', async () => {
      const identity = await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_fb_alpha',
        externalContactId: 'psid_manual_1',
        username: 'Manual User',
        metadata: { source: 'dashboard' },
      });

      assert.strictEqual(identity.contactId, 'cnt_alpha_1');
      assert.strictEqual(identity.externalContactId, 'psid_manual_1');
      assert.strictEqual(identity.channelType, 'FACEBOOK_MESSENGER');
    });

    it('should return existing identity if already linked to same contact', async () => {
      const first = await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_fb_alpha',
        externalContactId: 'psid_same_contact',
      });

      const second = await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_fb_alpha',
        externalContactId: 'psid_same_contact',
      });

      assert.strictEqual(second.id, first.id);
    });

    it('should throw ConflictException (CHANNEL_IDENTITY_ALREADY_EXISTS) if externalContactId is already linked to ANOTHER contact', async () => {
      // Link to contact 1
      await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_fb_alpha',
        externalContactId: 'psid_shared_collision',
      });

      // Create contact 2
      contactsDb.set('cnt_alpha_2', {
        id: 'cnt_alpha_2',
        workspaceId: 'ws_alpha',
        name: 'Alpha Contact 2',
      });

      // Attempt to link same psid to contact 2
      await assert.rejects(
        async () => {
          await service.createForContact('ws_alpha', 'cnt_alpha_2', {
            channelId: 'chn_fb_alpha',
            externalContactId: 'psid_shared_collision',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CHANNEL_IDENTITY_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should throw NotFoundException (CHANNEL_NOT_FOUND) when linking with channel from another workspace', async () => {
      await assert.rejects(
        async () => {
          await service.createForContact('ws_alpha', 'cnt_alpha_1', {
            channelId: 'chn_fb_beta', // ws_beta channel
            externalContactId: 'psid_cross',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CHANNEL_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('delete (Unlink)', () => {
    it('should delete channel identity and preserve the Contact', async () => {
      const identity = await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_fb_alpha',
        externalContactId: 'psid_to_unlink',
      });

      emittedEvents = [];

      const result = await service.delete('ws_alpha', 'cnt_alpha_1', identity.id);
      assert.deepStrictEqual(result, { success: true });

      // Verify identity is gone
      assert.strictEqual(identitiesDb.has(identity.id), false);

      // Verify contact is still intact
      assert.ok(contactsDb.has('cnt_alpha_1'));

      // Verify event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'channel_identity.deleted');
      assert.strictEqual(emittedEvents[0].payload.identityId, identity.id);
    });

    it('should throw NotFoundException (CHANNEL_IDENTITY_NOT_FOUND) when deleting non-existent identity or identity for another contact', async () => {
      await assert.rejects(
        async () => {
          await service.delete('ws_alpha', 'cnt_alpha_1', 'ident_unknown');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CHANNEL_IDENTITY_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('transferToContact (Merge Support)', () => {
    it('should batch update contactId for identities', async () => {
      const id1 = await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_fb_alpha',
        externalContactId: 'psid_batch_1',
      });
      const id2 = await service.createForContact('ws_alpha', 'cnt_alpha_1', {
        channelId: 'chn_zalo_alpha',
        externalContactId: 'zalo_batch_2',
      });

      const res = await service.transferToContact([id1.id, id2.id], 'cnt_target_merged');
      assert.strictEqual(res.count, 2);

      assert.strictEqual(identitiesDb.get(id1.id)?.contactId, 'cnt_target_merged');
      assert.strictEqual(identitiesDb.get(id2.id)?.contactId, 'cnt_target_merged');
    });

    it('should return 0 when empty array is passed', async () => {
      const res = await service.transferToContact([], 'cnt_target_merged');
      assert.strictEqual(res.count, 0);
    });
  });

  describe('findOrCreate (P2002 Race Condition Fallback)', () => {
    it('should handle P2002 unique constraint violation by falling back to findUnique (concurrent create race)', async () => {
      // Pre-seed the identity so that the fallback findUnique will find it
      const raceIdentity = {
        id: 'ident_race_winner',
        contactId: 'cnt_alpha_1',
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_race_psid',
        username: 'Race Winner',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      identitiesDb.set(raceIdentity.id, raceIdentity);

      // Override create to always throw P2002 (simulating the losing side of a race)
      const originalCreate = (mockPrismaService.getClient() as any).channelIdentity.create;
      (mockPrismaService.getClient() as any).channelIdentity.create = async () => {
        const err: any = new Error('Unique constraint failed on (channelId, externalContactId)');
        err.code = 'P2002';
        throw err;
      };

      // findOrCreate should NOT throw; instead it should fallback to findUnique
      const result = await service.findOrCreate({
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_alpha',
        externalContactId: 'fb_race_psid',
        contactId: 'cnt_alpha_1',
      });

      assert.ok(result);
      assert.strictEqual(result.id, 'ident_race_winner');
      assert.strictEqual(result.externalContactId, 'fb_race_psid');
      assert.strictEqual(result.contactId, 'cnt_alpha_1');

      // No channel_identity.created event should have been emitted (since we used fallback)
      const createdEvents = emittedEvents.filter(e => e.event === 'channel_identity.created');
      assert.strictEqual(createdEvents.length, 0);

      // Restore
      (mockPrismaService.getClient() as any).channelIdentity.create = originalCreate;
    });
  });
});
