import { assertDefined, expectReject } from '../../../../../test/test-assertions';
import { ConversationStatus } from '@sales-copilot/shared-contracts';
import { ContactsService } from '../contacts.service';
import { PrismaService } from '../../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ContactsService (Profile Management, Dynamic Attributes, Atomic Merge & Identity Sub-Resources)', () => {
  let service: ContactsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let ordersDb: Map<string, any>;
  let auditLogsDb: Array<any>;
  let clientMock: any;

  beforeEach(() => {
    contactsDb = new Map();
    channelsDb = new Map();
    identitiesDb = new Map();
    conversationsDb = new Map();
    messagesDb = new Map();
    ordersDb = new Map();
    auditLogsDb = [];
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    // Seed channels
    channelsDb.set('chn_fb_1', {
      id: 'chn_fb_1',
      workspaceId: 'ws_alpha',
      channelType: 'FACEBOOK_MESSENGER',
      inboxId: 'ib_1',
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
            if (where.email && contact.email !== where.email) continue;
            if (where.identifier && contact.identifier !== where.identifier) continue;
            if (where.phoneNumber && contact.phoneNumber !== where.phoneNumber) continue;

            const result = { ...contact };
            if (include?.identities) {
              result.identities = Array.from(identitiesDb.values()).filter(
                (i: any) => i.contactId === contact.id,
              );
            }
            return result;
          }
          return null;
        },

        findMany: async ({
          where,
          include,
          orderBy,
          skip,
          take,
        }: {
          where: any;
          include?: any;
          orderBy?: any;
          skip?: number;
          take?: number;
        }) => {
          let results: any[] = [];
          for (const contact of contactsDb.values()) {
            if (where.workspaceId && contact.workspaceId !== where.workspaceId) continue;

            if (where.OR && Array.isArray(where.OR)) {
              const matchesOr = where.OR.some((clause: any) => {
                if (clause.name?.contains) {
                  return contact.name?.toLowerCase().includes(clause.name.contains.toLowerCase());
                }
                if (clause.email?.contains) {
                  return contact.email?.toLowerCase().includes(clause.email.contains.toLowerCase());
                }
                if (clause.phoneNumber?.contains) {
                  return contact.phoneNumber?.includes(clause.phoneNumber.contains);
                }
                if (clause.identifier?.contains) {
                  return contact.identifier
                    ?.toLowerCase()
                    .includes(clause.identifier.contains.toLowerCase());
                }
                return false;
              });
              if (!matchesOr) continue;
            }

            const item = { ...contact };
            if (include?.identities) {
              item.identities = Array.from(identitiesDb.values()).filter(
                (i: any) => i.contactId === contact.id,
              );
            }
            results.push(item);
          }

          if (orderBy) {
            const key = Object.keys(orderBy)[0];
            const direction = orderBy[key];
            results.sort((a, b) => {
              if (direction === 'asc') return a[key] > b[key] ? 1 : -1;
              return a[key] < b[key] ? 1 : -1;
            });
          }

          if (skip !== undefined && take !== undefined) {
            results = results.slice(skip, skip + take);
          }

          return results;
        },

        count: async ({ where }: { where: any }) => {
          let count = 0;
          for (const contact of contactsDb.values()) {
            if (where.workspaceId && contact.workspaceId !== where.workspaceId) continue;
            if (where.OR && Array.isArray(where.OR)) {
              const matchesOr = where.OR.some((clause: any) => {
                if (clause.name?.contains) {
                  return contact.name?.toLowerCase().includes(clause.name.contains.toLowerCase());
                }
                if (clause.email?.contains) {
                  return contact.email?.toLowerCase().includes(clause.email.contains.toLowerCase());
                }
                if (clause.phoneNumber?.contains) {
                  return contact.phoneNumber?.includes(clause.phoneNumber.contains);
                }
                if (clause.identifier?.contains) {
                  return contact.identifier
                    ?.toLowerCase()
                    .includes(clause.identifier.contains.toLowerCase());
                }
                return false;
              });
              if (!matchesOr) continue;
            }
            count++;
          }
          return count;
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

          const result: any = { ...record };
          if (include?.identities) {
            result.identities = [];
          }
          return result;
        },

        update: async ({ where, data, include }: { where: any; data: any; include?: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = contactsDb.get(id);
          if (!existing) throw new Error('Contact not found');

          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          contactsDb.set(id, updated);

          const result = { ...updated };
          if (include?.identities) {
            result.identities = Array.from(identitiesDb.values()).filter(
              (i: any) => i.contactId === id,
            );
          }
          return result;
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
        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const ident of identitiesDb.values()) {
            if (where.id && ident.id !== where.id) continue;
            if (where.contactId && ident.contactId !== where.contactId) continue;
            if (where.workspaceId && ident.workspaceId !== where.workspaceId) continue;
            const res = { ...ident };
            if (include?.channel) res.channel = channelsDb.get(ident.channelId);
            return res;
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
            if (where.id?.in && !where.id.in.includes(ident.id)) continue;
            ident.contactId = data.contactId;
            identitiesDb.set(ident.id, ident);
            count++;
          }
          return { count };
        },
        delete: async ({ where }: { where: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const deleted = identitiesDb.get(id);
          identitiesDb.delete(id);
          return deleted;
        },
      },

      conversation: {
        findMany: async ({ where }: { where: any }) => {
          return Array.from(conversationsDb.values()).filter((c: any) => {
            if (where.contactId && c.contactId !== where.contactId) return false;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
            if (where.status?.in && !where.status.in.includes(c.status)) return false;
            return true;
          });
        },
        count: async ({ where }: { where: any }) => {
          let count = 0;
          for (const conv of conversationsDb.values()) {
            if (where.contactId && conv.contactId !== where.contactId) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            count++;
          }
          return count;
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
        count: async ({ where }: { where: any }) => {
          let count = 0;
          for (const ord of ordersDb.values()) {
            if (where.contactId && ord.contactId !== where.contactId) continue;
            if (where.workspaceId && ord.workspaceId !== where.workspaceId) continue;
            count++;
          }
          return count;
        },
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const ord of ordersDb.values()) {
            if (where.contactId && ord.contactId !== where.contactId) continue;
            if (where.workspaceId && ord.workspaceId !== where.workspaceId) continue;
            ord.contactId = data.contactId;
            ordersDb.set(ord.id, ord);
            count++;
          }
          return { count };
        },
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

    service = new ContactsService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );
  });

  describe('create', () => {
    it('should create a contact and normalize email to lowercase', async () => {
      const contact = await service.create('ws_alpha', {
        name: '  Nguyen Van A  ',
        email: '  VAN.A@EXAMPLE.COM ',
        phoneNumber: '+84901234567',
        customAttributes: { tier: 'gold' },
      });

      expect(contact.name).toBe('Nguyen Van A');
      expect(contact.email).toBe('van.a@example.com');
      expect(contact.phoneNumber).toBe('+84901234567');
      expect((contact.customAttributes as any).tier).toBe('gold');

      const createdEvent = emittedEvents.find(e => e.event === 'contact.created');
      assertDefined(createdEvent);
      expect(createdEvent.payload.workspaceId).toBe('ws_alpha');
    });

    it('should throw ConflictException if identifier already exists in same workspace', async () => {
      await service.create('ws_alpha', {
        name: 'User 1',
        identifier: 'ID_100',
      });

      await expectReject(
        () =>
          service.create('ws_alpha', {
            name: 'User 2',
            identifier: 'ID_100',
          }),
        /IDENTIFIER_ALREADY_EXISTS/,
      );
    });

    it('should throw ConflictException if email already exists in same workspace', async () => {
      await service.create('ws_alpha', {
        name: 'User 1',
        email: 'test@example.com',
      });

      await expectReject(
        () =>
          service.create('ws_alpha', {
            name: 'User 2',
            email: 'test@example.com',
          }),
        /EMAIL_ALREADY_EXISTS/,
      );
    });
  });

  describe('findAll and search', () => {
    beforeEach(async () => {
      await service.create('ws_alpha', {
        name: 'Nguyen Van A',
        email: 'vana@example.com',
        phoneNumber: '0901234567',
        identifier: 'ID_01',
      });
      await service.create('ws_alpha', {
        name: 'Tran Thi B',
        email: 'thib@example.com',
        phoneNumber: '0987654321',
        identifier: 'ID_02',
      });
      await service.create('ws_beta', {
        name: 'Tenant Beta Contact',
        email: 'beta@example.com',
      });
    });

    it('should return contacts only for the requested workspace', async () => {
      const result = await service.findAll('ws_alpha', { page: 1, limit: 10 });
      expect(result.items.length).toBe(2);
      expect(result.meta.total).toBe(2);
    });

    it('should search contacts across name, email, phone, and identifier', async () => {
      const byName = await service.search('ws_alpha', { q: 'Tran' });
      expect(byName.items.length).toBe(1);
      expect(byName.items[0].name).toBe('Tran Thi B');

      const byPhone = await service.search('ws_alpha', { q: '090123' });
      expect(byPhone.items.length).toBe(1);
      expect(byPhone.items[0].name).toBe('Nguyen Van A');
    });
  });

  describe('findById and update', () => {
    it('should find contact by ID', async () => {
      const created = await service.create('ws_alpha', { name: 'Direct Lookup' });
      const found = await service.findById('ws_alpha', created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Direct Lookup');
    });

    it('should deep merge customAttributes on update', async () => {
      const created = await service.create('ws_alpha', {
        name: 'Attr Test',
        customAttributes: { a: 1, b: 2 },
        additionalAttributes: { country: 'VN' },
      });

      const updated = await service.update('ws_alpha', created.id, {
        customAttributes: { b: 20, c: 30 },
        additionalAttributes: { city: 'Hanoi' },
      });

      expect(updated.customAttributes).toEqual({ a: 1, b: 20, c: 30 });
      expect(updated.additionalAttributes).toEqual({ country: 'VN', city: 'Hanoi' });
    });

    it('should throw EMAIL_ALREADY_EXISTS when updating contact email to an existing email in same workspace', async () => {
      await service.create('ws_alpha', {
        name: 'Contact A',
        email: 'collision@alphacorp.com',
      });

      const contactB = await service.create('ws_alpha', {
        name: 'Contact B',
        email: 'other@alphacorp.com',
      });

      await expectReject(
        () =>
          service.update('ws_alpha', contactB.id, {
            email: 'collision@alphacorp.com',
          }),
        /EMAIL_ALREADY_EXISTS/,
      );
    });

    it('should handle P2002 race condition on email and throw EMAIL_ALREADY_EXISTS', async () => {
      const contact = await service.create('ws_alpha', {
        name: 'Race Contact',
        email: 'race1@alphacorp.com',
      });

      const origUpdate = clientMock.contact.update;
      clientMock.contact.update = async (_args: any) => {
        const err: any = new Error('Unique constraint failed on email');
        err.code = 'P2002';
        err.meta = { target: ['workspaceId', 'email'] };
        throw err;
      };

      await expectReject(
        () =>
          service.update('ws_alpha', contact.id, {
            email: 'race2@alphacorp.com',
          }),
        /EMAIL_ALREADY_EXISTS/,
      );

      clientMock.contact.update = origUpdate;
    });
  });

  describe('delete', () => {
    it('should prevent deleting contact with existing conversations', async () => {
      const created = await service.create('ws_alpha', { name: 'Active Talker' });
      conversationsDb.set('conv_1', {
        id: 'conv_1',
        workspaceId: 'ws_alpha',
        contactId: created.id,
      });

      await expectReject(() => service.delete('ws_alpha', created.id), /CONTACT_HAS_CONVERSATIONS/);
    });

    it('should prevent deleting contact with existing orders', async () => {
      const created = await service.create('ws_alpha', { name: 'Customer With Orders' });
      ordersDb.set('ord_1', {
        id: 'ord_1',
        workspaceId: 'ws_alpha',
        contactId: created.id,
      });

      await expectReject(() => service.delete('ws_alpha', created.id), /CONTACT_HAS_ORDERS/);
    });

    it('should delete contact and emit contact.deleted event', async () => {
      const created = await service.create('ws_alpha', { name: 'Lonely Contact' });
      const res = await service.delete('ws_alpha', created.id);
      expect(res.success).toBe(true);

      const deletedEvent = emittedEvents.find(e => e.event === 'contact.deleted');
      assertDefined(deletedEvent);
      expect(deletedEvent.payload.contactId).toBe(created.id);
    });
  });

  describe('merge (Atomic Contact Merge Engine)', () => {
    let baseContact: any;
    let mergeeContact: any;

    beforeEach(async () => {
      baseContact = await service.create('ws_alpha', {
        name: 'Base Primary',
        email: 'base@alphacorp.com',
        phoneNumber: null,
        identifier: 'BASE_ID',
        customAttributes: { vip: true, plan: 'enterprise' },
        additionalAttributes: { country: 'VN' },
      });

      mergeeContact = await service.create('ws_alpha', {
        name: 'Mergee Secondary',
        email: 'mergee@alphacorp.com',
        phoneNumber: '+84988888888',
        customAttributes: { plan: 'free', source: 'fb' },
        additionalAttributes: { city: 'Da Nang' },
      });

      // Link identity to mergee
      identitiesDb.set('ident_mergee', {
        id: 'ident_mergee',
        contactId: mergeeContact.id,
        workspaceId: 'ws_alpha',
        channelId: 'chn_fb_1',
        externalContactId: 'fb_mergee_user',
      });

      // Link conversations & messages
      conversationsDb.set('conv_mergee_1', {
        id: 'conv_mergee_1',
        workspaceId: 'ws_alpha',
        contactId: mergeeContact.id,
        inboxId: 'ib_1',
        status: ConversationStatus.OPEN,
        createdAt: new Date('2026-02-01'),
      });

      messagesDb.set('msg_mergee_1', {
        id: 'msg_mergee_1',
        workspaceId: 'ws_alpha',
        conversationId: 'conv_mergee_1',
        senderType: 'CONTACT',
        senderId: mergeeContact.id,
      });

      // Link orders to mergee
      ordersDb.set('ord_mergee_1', {
        id: 'ord_mergee_1',
        workspaceId: 'ws_alpha',
        contactId: mergeeContact.id,
      });
    });

    it('should return base contact immediately for self-merge', async () => {
      const result = await service.merge('ws_alpha', baseContact.id, baseContact.id);
      expect(result.id).toBe(baseContact.id);
    });

    it('should atomically merge mergee into base, transferring identities, conversations, orders, and attributes', async () => {
      const merged = await service.merge('ws_alpha', baseContact.id, mergeeContact.id, {
        performedByUserId: 'usr_admin',
      });

      expect(merged.id).toBe(baseContact.id);
      expect(merged.name).toBe('Base Primary'); // Base name preserved
      expect(merged.phoneNumber).toBe('+84988888888'); // Mergee phone merged
      expect((merged.customAttributes as any).plan).toBe('enterprise'); // Base attribute takes precedence
      expect((merged.customAttributes as any).source).toBe('fb'); // Mergee attribute merged
      expect((merged.additionalAttributes as any).city).toBe('Da Nang');

      // Check mergee contact deleted
      expect(contactsDb.has(mergeeContact.id)).toBe(false);

      // Check identity transferred
      const identity = identitiesDb.get('ident_mergee');
      expect(identity.contactId).toBe(baseContact.id);

      // Check conversation transferred
      const conv = conversationsDb.get('conv_mergee_1');
      expect(conv.contactId).toBe(baseContact.id);

      // Check message transferred
      const msg = messagesDb.get('msg_mergee_1');
      expect(msg.senderId).toBe(baseContact.id);

      // Check orders transferred
      const order = ordersDb.get('ord_mergee_1');
      expect(order.contactId).toBe(baseContact.id);

      // Check audit log recorded
      expect(auditLogsDb.length).toBe(1);
      expect(auditLogsDb[0].action).toBe('CONTACT_MERGED');
      expect(auditLogsDb[0].userId).toBe('usr_admin');

      // Check contact.merged event emitted
      const mergeEvent = emittedEvents.find(e => e.event === 'contact.merged');
      assertDefined(mergeEvent);
      expect(mergeEvent.payload.primaryContactId).toBe(baseContact.id);
      expect(mergeEvent.payload.mergedContactId).toBe(mergeeContact.id);
    });
  });

  describe('Channel Identities Sub-Resources', () => {
    let contact: any;

    beforeEach(async () => {
      contact = await service.create('ws_alpha', { name: 'Identified Contact' });
    });

    it('should link channel identity to contact and list identities', async () => {
      const identity = await service.linkIdentity('ws_alpha', contact.id, {
        channelId: 'chn_fb_1',
        externalContactId: 'fb_psid_999',
        username: 'John Doe',
      });

      expect(identity.contactId).toBe(contact.id);
      expect(identity.externalContactId).toBe('fb_psid_999');

      const list = await service.findIdentitiesByContactId('ws_alpha', contact.id);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(identity.id);
    });

    it('should unlink channel identity and emit channel_identity.deleted', async () => {
      const identity = await service.linkIdentity('ws_alpha', contact.id, {
        channelId: 'chn_fb_1',
        externalContactId: 'fb_psid_to_delete',
      });

      const res = await service.unlinkIdentity('ws_alpha', contact.id, identity.id);
      expect(res.success).toBe(true);
      expect(identitiesDb.has(identity.id)).toBe(false);

      const unlinkedEvent = emittedEvents.find(e => e.event === 'channel_identity.deleted');
      assertDefined(unlinkedEvent);
    });
  });
});
