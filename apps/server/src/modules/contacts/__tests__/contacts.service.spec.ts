import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ContactsService } from '../contacts.service';
import { PrismaService } from '../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ContactsService (Contact CRUD & Dynamic Custom Attributes)', () => {
  let service: ContactsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;
  let conversationsDb: Map<string, any>;

  beforeEach(() => {
    contactsDb = new Map();
    identitiesDb = new Map();
    conversationsDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
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

          // Sorting
          if (orderBy) {
            const field = Object.keys(orderBy)[0];
            const direction = orderBy[field];
            results.sort((a, b) => {
              const valA = a[field];
              const valB = b[field];
              if (valA < valB) return direction === 'asc' ? -1 : 1;
              if (valA > valB) return direction === 'asc' ? 1 : -1;
              return 0;
            });
          }

          if (typeof skip === 'number') {
            results = results.slice(skip);
          }
          if (typeof take === 'number') {
            results = results.slice(0, take);
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
          // Check DB-level @@unique([workspaceId, identifier])
          if (data.identifier) {
            for (const c of contactsDb.values()) {
              if (c.workspaceId === data.workspaceId && c.identifier === data.identifier) {
                const err: any = new Error('Unique constraint failed on (workspaceId, identifier)');
                err.code = 'P2002';
                err.meta = { target: ['identifier'] };
                throw err;
              }
            }
          }

          const created = {
            id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          contactsDb.set(created.id, created);

          const result = { ...created };
          if (include?.identities) {
            result.identities = [];
          }
          return result;
        },

        update: async ({
          where,
          data,
          include,
        }: {
          where: { id: string };
          data: any;
          include?: any;
        }) => {
          const existing = contactsDb.get(where.id);
          if (!existing) return null;

          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          contactsDb.set(where.id, updated);

          const result = { ...updated };
          if (include?.identities) {
            result.identities = Array.from(identitiesDb.values()).filter(
              (i: any) => i.contactId === where.id,
            );
          }
          return result;
        },

        delete: async ({ where }: { where: { id: string } }) => {
          const existing = contactsDb.get(where.id);
          if (existing) {
            contactsDb.delete(where.id);
            // Cascade delete identities
            for (const [key, identity] of identitiesDb.entries()) {
              if (identity.contactId === where.id) {
                identitiesDb.delete(key);
              }
            }
          }
          return existing;
        },
      },
      conversation: {
        count: async ({ where }: any) => {
          let count = 0;
          for (const conv of conversationsDb.values()) {
            if (where.contactId && conv.contactId !== where.contactId) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            count++;
          }
          return count;
        },
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (fn: (tx: any) => Promise<any>) => fn(clientMock),
    };

    service = new ContactsService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );
  });

  describe('Contact Creation & Sanitization', () => {
    it('should create a contact successfully and emit contact.created event', async () => {
      const contact = await service.create('ws_alpha', {
        name: 'Nguyen Van A',
        email: '  NguyenVanA@EXAMPLE.com  ',
        phoneNumber: '+84901234567',
        identifier: 'CRM_CUST_001',
        customAttributes: { company: 'TechCorp', vipTier: 'Gold' },
      });

      assert.ok(contact.id);
      assert.strictEqual(contact.workspaceId, 'ws_alpha');
      assert.strictEqual(contact.name, 'Nguyen Van A');
      assert.strictEqual(contact.email, 'nguyenvana@example.com');
      assert.strictEqual(contact.phoneNumber, '+84901234567');
      assert.strictEqual(contact.identifier, 'CRM_CUST_001');
      assert.deepStrictEqual(contact.customAttributes, { company: 'TechCorp', vipTier: 'Gold' });
      assert.deepStrictEqual(contact.additionalAttributes, {});

      // Verify event was emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'contact.created');
      assert.strictEqual(emittedEvents[0].payload.contact.id, contact.id);
    });

    it('should convert empty strings to null for optional unique/formatted fields', async () => {
      const contact = await service.create('ws_alpha', {
        name: 'Le Thi B',
        email: '',
        phoneNumber: '',
        avatarUrl: '',
        identifier: '',
      });

      assert.strictEqual(contact.email, null);
      assert.strictEqual(contact.phoneNumber, null);
      assert.strictEqual(contact.avatarUrl, null);
      assert.strictEqual(contact.identifier, null);
    });

    it('should throw ConflictException (IDENTIFIER_ALREADY_EXISTS) when duplicate identifier in same workspace', async () => {
      await service.create('ws_alpha', {
        name: 'First User',
        identifier: 'ID_UNIQUE_001',
      });

      await assert.rejects(
        async () => {
          await service.create('ws_alpha', {
            name: 'Second User',
            identifier: 'ID_UNIQUE_001',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'IDENTIFIER_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should throw ConflictException (EMAIL_ALREADY_EXISTS) when duplicate email in same workspace', async () => {
      await service.create('ws_alpha', {
        name: 'First User',
        email: 'user@domain.com',
      });

      await assert.rejects(
        async () => {
          await service.create('ws_alpha', {
            name: 'Second User',
            email: 'USER@DOMAIN.COM',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'EMAIL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow same identifier and email in different workspaces (multi-tenancy)', async () => {
      const c1 = await service.create('ws_alpha', {
        name: 'User In Alpha',
        email: 'same@company.com',
        identifier: 'CUST_100',
      });

      const c2 = await service.create('ws_beta', {
        name: 'User In Beta',
        email: 'same@company.com',
        identifier: 'CUST_100',
      });

      assert.strictEqual(c1.workspaceId, 'ws_alpha');
      assert.strictEqual(c2.workspaceId, 'ws_beta');
      assert.strictEqual(c1.email, c2.email);
    });
  });

  describe('Find All, Search & Pagination', () => {
    beforeEach(async () => {
      await service.create('ws_alpha', {
        name: 'Alice Johnson',
        email: 'alice@wonderland.com',
        phoneNumber: '+84911111111',
        identifier: 'ACC_ALICE',
      });
      await service.create('ws_alpha', {
        name: 'Bob Smith',
        email: 'bob@builder.com',
        phoneNumber: '+84922222222',
        identifier: 'ACC_BOB',
      });
      await service.create('ws_alpha', {
        name: 'Charlie Brown',
        email: 'charlie@peanuts.com',
        phoneNumber: '+84933333333',
        identifier: 'ACC_CHARLIE',
      });
      // Different workspace contact
      await service.create('ws_beta', {
        name: 'Alice Other',
        email: 'alice@other.com',
      });
    });

    it('should list all contacts in workspace with pagination meta', async () => {
      const result = await service.findAll('ws_alpha', {
        page: 1,
        limit: 2,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.total, 3);
      assert.strictEqual(result.meta.page, 1);
      assert.strictEqual(result.meta.totalPages, 2);
      assert.strictEqual(result.meta.hasMore, true);
      assert.strictEqual(result.items[0].name, 'Alice Johnson');
      assert.strictEqual(result.items[1].name, 'Bob Smith');
    });

    it('should filter contacts using query q (ILIKE search)', async () => {
      // By email substring
      const resEmail = await service.findAll('ws_alpha', {
        page: 1,
        limit: 10,
        q: 'builder',
      });
      assert.strictEqual(resEmail.items.length, 1);
      assert.strictEqual(resEmail.items[0].name, 'Bob Smith');

      // By phone
      const resPhone = await service.findAll('ws_alpha', {
        page: 1,
        limit: 10,
        q: '933333333',
      });
      assert.strictEqual(resPhone.items.length, 1);
      assert.strictEqual(resPhone.items[0].name, 'Charlie Brown');

      // By identifier
      const resId = await service.findAll('ws_alpha', {
        page: 1,
        limit: 10,
        q: 'ACC_ALICE',
      });
      assert.strictEqual(resId.items.length, 1);
      assert.strictEqual(resId.items[0].name, 'Alice Johnson');
    });

    it('should perform dedicated search endpoint query', async () => {
      const res = await service.search('ws_alpha', {
        q: 'Alice',
        page: 1,
        limit: 10,
      });

      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.items[0].workspaceId, 'ws_alpha');
      assert.strictEqual(res.items[0].name, 'Alice Johnson');
    });
  });

  describe('Find By ID & Channel Identities', () => {
    it('should retrieve contact by ID with linked identities', async () => {
      const contact = await service.create('ws_alpha', {
        name: 'David Bowie',
        email: 'david@starman.com',
      });

      // Add a mock identity linked to this contact
      identitiesDb.set('ident_1', {
        id: 'ident_1',
        contactId: contact.id,
        workspaceId: 'ws_alpha',
        channelId: 'chn_facebook_1',
        externalContactId: 'fb_psid_123456',
        username: 'david.bowie.fb',
        metadata: { profilePic: 'https://fb.com/pic.png' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const found = await service.findById('ws_alpha', contact.id);
      assert.strictEqual(found.id, contact.id);
      assert.strictEqual(found.name, 'David Bowie');
      assert.strictEqual(found.identities?.length, 1);
      assert.strictEqual(found.identities?.[0].externalContactId, 'fb_psid_123456');
    });

    it('should throw NotFoundException (CONTACT_NOT_FOUND) when contact does not exist', async () => {
      await assert.rejects(
        async () => {
          await service.findById('ws_alpha', 'cnt_non_existent');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when attempting to access contact of another workspace', async () => {
      const contactInBeta = await service.create('ws_beta', {
        name: 'Beta User',
      });

      await assert.rejects(
        async () => {
          await service.findById('ws_alpha', contactInBeta.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('Update Contact & Deep Merge Attributes', () => {
    it('should update contact and deep merge customAttributes and additionalAttributes', async () => {
      const created = await service.create('ws_alpha', {
        name: 'Eva Green',
        email: 'eva@domain.com',
        customAttributes: { initialKey: 'initialVal', tier: 'Silver' },
        additionalAttributes: { country: 'VN' },
      });

      emittedEvents = []; // reset events

      const updated = await service.update('ws_alpha', created.id, {
        name: 'Eva Green Modified',
        customAttributes: { tier: 'Platinum', newAttribute: 'Active' },
        additionalAttributes: { city: 'Hanoi' },
      });

      assert.strictEqual(updated.name, 'Eva Green Modified');
      // Verify deep merged customAttributes
      assert.deepStrictEqual(updated.customAttributes, {
        initialKey: 'initialVal',
        tier: 'Platinum',
        newAttribute: 'Active',
      });
      // Verify deep merged additionalAttributes
      assert.deepStrictEqual(updated.additionalAttributes, {
        country: 'VN',
        city: 'Hanoi',
      });

      // Verify contact.updated event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'contact.updated');
      assert.strictEqual(emittedEvents[0].payload.contact.id, created.id);
      assert.deepStrictEqual(emittedEvents[0].payload.previousAttributes.customAttributes, {
        initialKey: 'initialVal',
        tier: 'Silver',
      });
    });

    it('should throw ConflictException (EMAIL_ALREADY_EXISTS) when updating email to one that exists', async () => {
      await service.create('ws_alpha', {
        name: 'User 1',
        email: 'user1@company.com',
      });
      const user2 = await service.create('ws_alpha', {
        name: 'User 2',
        email: 'user2@company.com',
      });

      await assert.rejects(
        async () => {
          await service.update('ws_alpha', user2.id, {
            email: 'user1@company.com',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'EMAIL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow updating own email with same value without error', async () => {
      const user = await service.create('ws_alpha', {
        name: 'User',
        email: 'user@company.com',
      });

      const updated = await service.update('ws_alpha', user.id, {
        email: 'user@company.com',
        name: 'User Renamed',
      });

      assert.strictEqual(updated.name, 'User Renamed');
    });

    it('should throw ConflictException (IDENTIFIER_ALREADY_EXISTS) when updating identifier to existing one', async () => {
      await service.create('ws_alpha', {
        name: 'Cust 1',
        identifier: 'ID_001',
      });
      const cust2 = await service.create('ws_alpha', {
        name: 'Cust 2',
        identifier: 'ID_002',
      });

      await assert.rejects(
        async () => {
          await service.update('ws_alpha', cust2.id, {
            identifier: 'ID_001',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'IDENTIFIER_ALREADY_EXISTS');
          return true;
        },
      );
    });
  });

  describe('Delete Contact & Cascade', () => {
    it('should delete contact, cascade identities, and emit contact.deleted event', async () => {
      const contact = await service.create('ws_alpha', {
        name: 'To Be Deleted',
        email: 'delete@me.com',
      });

      identitiesDb.set('id_link_1', {
        id: 'id_link_1',
        contactId: contact.id,
        workspaceId: 'ws_alpha',
        channelId: 'chn_1',
        externalContactId: 'ext_1',
      });

      emittedEvents = [];

      const result = await service.delete('ws_alpha', contact.id);
      assert.deepStrictEqual(result, { success: true });

      // Verify contact was deleted
      await assert.rejects(async () => {
        await service.findById('ws_alpha', contact.id);
      });

      // Verify identity was cascade deleted
      assert.strictEqual(identitiesDb.has('id_link_1'), false);

      // Verify event was emitted with snapshot
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'contact.deleted');
      assert.strictEqual(emittedEvents[0].payload.contact.name, 'To Be Deleted');
    });

    it('should throw NotFoundException (CONTACT_NOT_FOUND) when deleting non-existent contact', async () => {
      await assert.rejects(
        async () => {
          await service.delete('ws_alpha', 'cnt_unknown');
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should enforce tenant isolation on delete', async () => {
      const contactInBeta = await service.create('ws_beta', {
        name: 'Beta Contact',
      });

      await assert.rejects(
        async () => {
          await service.delete('ws_alpha', contactInBeta.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException (CONTACT_HAS_CONVERSATIONS) when deleting contact with active conversations', async () => {
      const contact = await service.create('ws_alpha', {
        name: 'Contact with Tickets',
      });

      conversationsDb.set('conv_1', {
        id: 'conv_1',
        workspaceId: 'ws_alpha',
        contactId: contact.id,
      });

      await assert.rejects(
        async () => {
          await service.delete('ws_alpha', contact.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_HAS_CONVERSATIONS');
          return true;
        },
      );
    });
  });
});
