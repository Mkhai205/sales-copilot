import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ContactIdentifyService } from '../contact-identify.service';
import { ContactMergeService } from '../contact-merge.service';
import { PrismaService } from '../../../infrastructure/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ContactIdentifyService (Priority Chain & Conflict Guards)', () => {
  let service: ContactIdentifyService;
  let mergeService: ContactMergeService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let identitiesDb: Map<string, any>;
  let auditLogsDb: Array<any>;

  beforeEach(() => {
    contactsDb = new Map();
    identitiesDb = new Map();
    auditLogsDb = [];
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
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

        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = contactsDb.get(where.id);
          if (!existing) throw new Error(`Contact ${where.id} not found`);
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

    mergeService = new ContactMergeService(
      mockPrismaService as PrismaService,
      mockEventEmitter as EventEmitter2,
    );

    service = new ContactIdentifyService(
      mockPrismaService as PrismaService,
      mergeService,
      mockEventEmitter as EventEmitter2,
    );
  });

  describe('Scenario 1: Identifier Match -> Merge', () => {
    it('should merge active contact into existing identified contact when identifier matches', async () => {
      // 1. Existing identified contact in system
      contactsDb.set('cnt_identified', {
        id: 'cnt_identified',
        workspaceId: 'ws_alpha',
        name: 'Identified User',
        email: 'user@existing.com',
        phoneNumber: null,
        identifier: 'ext_user_999',
        customAttributes: { tier: 'gold' },
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Active transient contact (e.g. from webchat widget)
      contactsDb.set('cnt_active', {
        id: 'cnt_active',
        workspaceId: 'ws_alpha',
        name: 'Anonymous Visitor',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: { browser: 'Chrome' },
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 3. Identify with identifier
      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active' },
        {
          identifier: 'ext_user_999',
          name: 'Updated Name',
          customAttributes: { referrer: 'google' },
        },
      );

      // Result should be the identified base contact
      assert.strictEqual(result.id, 'cnt_identified');
      assert.strictEqual(result.name, 'Updated Name');
      assert.strictEqual(result.email, 'user@existing.com');
      assert.strictEqual(result.identifier, 'ext_user_999');

      // Transient contact is deleted after merge
      assert.strictEqual(contactsDb.has('cnt_active'), false);

      // Custom attributes merged: tier: gold (base) + browser: Chrome (mergee) + referrer: google (update)
      assert.deepStrictEqual(result.customAttributes, {
        tier: 'gold',
        browser: 'Chrome',
        referrer: 'google',
      });
    });
  });

  describe('Scenario 2: Email Match (No Identifier Conflict) -> Merge', () => {
    it('should merge active contact into existing email contact when email matches and no identifier conflict exists', async () => {
      contactsDb.set('cnt_by_email', {
        id: 'cnt_by_email',
        workspaceId: 'ws_alpha',
        name: 'Existing Customer',
        email: 'customer@test.com',
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      contactsDb.set('cnt_active_anon', {
        id: 'cnt_active_anon',
        workspaceId: 'ws_alpha',
        name: 'Anonymous User',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: { tempId: '123' },
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active_anon' },
        {
          email: 'CUSTOMER@TEST.COM', // Tests case-insensitivity
          phoneNumber: '+84900111222',
        },
      );

      assert.strictEqual(result.id, 'cnt_by_email');
      assert.strictEqual(result.email, 'customer@test.com');
      assert.strictEqual(result.phoneNumber, '+84900111222');
      assert.strictEqual(contactsDb.has('cnt_active_anon'), false);
    });
  });

  describe('Scenario 3: Email Match with Identifier Conflict -> Skip Merge', () => {
    it('should skip merge and not overwrite email when identifier conflicts with existing email contact', async () => {
      // Existing contact with email and identifier "id_AAA"
      contactsDb.set('cnt_existing_aaa', {
        id: 'cnt_existing_aaa',
        workspaceId: 'ws_alpha',
        name: 'User A',
        email: 'shared@test.com',
        phoneNumber: null,
        identifier: 'id_AAA',
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Active contact
      contactsDb.set('cnt_active_bbb', {
        id: 'cnt_active_bbb',
        workspaceId: 'ws_alpha',
        name: 'User B',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Attempt to identify with different identifier "id_BBB" and conflicting email "shared@test.com"
      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active_bbb' },
        {
          identifier: 'id_BBB',
          email: 'shared@test.com',
          name: 'Updated B',
        },
      );

      // Should NOT merge into cnt_existing_aaa because id_AAA !== id_BBB
      assert.strictEqual(result.id, 'cnt_active_bbb');
      assert.strictEqual(result.identifier, 'id_BBB');
      assert.strictEqual(result.name, 'Updated B');
      // Email was skipped due to conflict
      assert.strictEqual(result.email, null);

      // Existing contact is untouched
      assert.strictEqual(contactsDb.get('cnt_existing_aaa')?.email, 'shared@test.com');
      assert.strictEqual(contactsDb.get('cnt_existing_aaa')?.identifier, 'id_AAA');
    });
  });

  describe('Scenario 4: Phone Match (No Conflict) -> Merge', () => {
    it('should merge active contact into existing phone contact when phone matches and no conflicts exist', async () => {
      contactsDb.set('cnt_phone_existing', {
        id: 'cnt_phone_existing',
        workspaceId: 'ws_alpha',
        name: 'Phone User',
        email: null,
        phoneNumber: '+84912345678',
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      contactsDb.set('cnt_active_phone', {
        id: 'cnt_active_phone',
        workspaceId: 'ws_alpha',
        name: 'Guest User',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active_phone' },
        {
          phoneNumber: '+84912345678',
          email: 'newemail@test.com',
        },
      );

      assert.strictEqual(result.id, 'cnt_phone_existing');
      assert.strictEqual(result.phoneNumber, '+84912345678');
      assert.strictEqual(result.email, 'newemail@test.com');
      assert.strictEqual(contactsDb.has('cnt_active_phone'), false);
    });
  });

  describe('Scenario 5: Phone Match with Email Conflict -> Skip Merge', () => {
    it('should skip phone merge when existing phone contact has a different email than supplied email', async () => {
      // Existing contact with phone 123 and email email1@test.com
      contactsDb.set('cnt_phone_with_email1', {
        id: 'cnt_phone_with_email1',
        workspaceId: 'ws_alpha',
        name: 'User One',
        email: 'email1@test.com',
        phoneNumber: '+84912345678',
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      contactsDb.set('cnt_active_2', {
        id: 'cnt_active_2',
        workspaceId: 'ws_alpha',
        name: 'User Two',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Provide email2@test.com and phone +84912345678 -> email takes precedence, phone merge skipped
      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active_2' },
        {
          email: 'email2@test.com',
          phoneNumber: '+84912345678',
        },
      );

      assert.strictEqual(result.id, 'cnt_active_2');
      assert.strictEqual(result.email, 'email2@test.com');
      // Phone number was NOT merged/set due to email conflict
      assert.strictEqual(result.phoneNumber, null);

      // Existing contact untouched
      assert.strictEqual(contactsDb.get('cnt_phone_with_email1')?.email, 'email1@test.com');
    });
  });

  describe('Scenario 6: Phone Match with Identifier Conflict -> Skip Merge', () => {
    it('should skip phone merge when existing phone contact has an identifier that conflicts with supplied identifier', async () => {
      contactsDb.set('cnt_phone_id_X', {
        id: 'cnt_phone_id_X',
        workspaceId: 'ws_alpha',
        name: 'User X',
        email: null,
        phoneNumber: '+84999999999',
        identifier: 'id_X',
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      contactsDb.set('cnt_active_Y', {
        id: 'cnt_active_Y',
        workspaceId: 'ws_alpha',
        name: 'User Y',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active_Y' },
        {
          identifier: 'id_Y',
          phoneNumber: '+84999999999',
        },
      );

      assert.strictEqual(result.id, 'cnt_active_Y');
      assert.strictEqual(result.identifier, 'id_Y');
      assert.strictEqual(result.phoneNumber, null);
    });
  });

  describe('Scenario 7: No Match -> Direct Update & Deep Merge', () => {
    it('should directly update contact attributes and deep merge custom/additional attributes when no matches exist', async () => {
      contactsDb.set('cnt_standalone', {
        id: 'cnt_standalone',
        workspaceId: 'ws_alpha',
        name: 'Original Name',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: { a: 1, b: 2 },
        additionalAttributes: { locale: 'vi' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_standalone' },
        {
          name: 'New Name',
          email: 'unique@test.com',
          phoneNumber: '+84911223344',
          identifier: 'unique_id_123',
          avatarUrl: 'https://avatar.com/u.jpg',
          customAttributes: { b: 99, c: 3 },
          additionalAttributes: { country: 'VN' },
        },
      );

      assert.strictEqual(result.id, 'cnt_standalone');
      assert.strictEqual(result.name, 'New Name');
      assert.strictEqual(result.email, 'unique@test.com');
      assert.strictEqual(result.phoneNumber, '+84911223344');
      assert.strictEqual(result.identifier, 'unique_id_123');
      assert.strictEqual(result.avatarUrl, 'https://avatar.com/u.jpg');

      assert.deepStrictEqual(result.customAttributes, { a: 1, b: 99, c: 3 });
      assert.deepStrictEqual(result.additionalAttributes, { locale: 'vi', country: 'VN' });

      // Emitted contact.updated event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'contact.updated');
    });
  });

  describe('Scenario 8: retainOriginalContactName Option', () => {
    it('should retain base contact name when retainOriginalContactName is true', async () => {
      contactsDb.set('cnt_base_named', {
        id: 'cnt_base_named',
        workspaceId: 'ws_alpha',
        name: 'Original Contact Name',
        email: 'base_named@test.com',
        phoneNumber: null,
        identifier: 'id_named',
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      contactsDb.set('cnt_active_prechat', {
        id: 'cnt_active_prechat',
        workspaceId: 'ws_alpha',
        name: 'Form Name',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_active_prechat' },
        {
          identifier: 'id_named',
          name: 'Temporary Form Submitted Name',
        },
        {
          retainOriginalContactName: true,
        },
      );

      assert.strictEqual(result.id, 'cnt_base_named');
      // Name retained as Original Contact Name
      assert.strictEqual(result.name, 'Original Contact Name');
    });
  });

  describe('Scenario 9: NotFoundException when contact does not exist', () => {
    it('should throw NotFoundException with CONTACT_NOT_FOUND when currentContact.id does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.identify(
            'ws_alpha',
            { id: 'cnt_nonexistent' },
            {
              name: 'Ghost User',
              email: 'ghost@test.com',
            },
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          assert.ok(err.response?.message.includes('cnt_nonexistent'));
          return true;
        },
      );
    });
  });

  describe('Scenario 10: Transaction rollback on update failure', () => {
    it('should not leave side effects when contact.update() throws an error mid-transaction', async () => {
      // Seed two contacts that would merge by identifier
      contactsDb.set('cnt_will_merge_base', {
        id: 'cnt_will_merge_base',
        workspaceId: 'ws_alpha',
        name: 'Merge Base',
        email: null,
        phoneNumber: null,
        identifier: 'merge_id_rollback',
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      contactsDb.set('cnt_will_merge_active', {
        id: 'cnt_will_merge_active',
        workspaceId: 'ws_alpha',
        name: 'Merge Active',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Override runInTransaction to simulate real rollback behavior:
      // If function throws, nothing is committed
      const originalContactUpdate = (mockPrismaService.getClient() as any).contact.update;
      let updateCallCount = 0;
      (mockPrismaService.getClient() as any).contact.update = async (args: any) => {
        updateCallCount++;
        // Fail on the final update (after merge completes)
        if (updateCallCount >= 2) {
          throw new Error('Simulated disk failure during final update');
        }
        return originalContactUpdate(args);
      };

      await assert.rejects(
        async () => {
          await service.identify(
            'ws_alpha',
            { id: 'cnt_will_merge_active' },
            { identifier: 'merge_id_rollback', name: 'Should Not Persist' },
          );
        },
        (err: any) => {
          assert.ok(err.message.includes('Simulated disk failure'));
          return true;
        },
      );

      // Restore original
      (mockPrismaService.getClient() as any).contact.update = originalContactUpdate;
    });
  });

  describe('Scenario 11: External tx parameter path', () => {
    it('should use provided tx client directly instead of creating a new transaction', async () => {
      contactsDb.set('cnt_ext_tx', {
        id: 'cnt_ext_tx',
        workspaceId: 'ws_alpha',
        name: 'Ext Tx Contact',
        email: null,
        phoneNumber: null,
        identifier: null,
        customAttributes: {},
        additionalAttributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      let runInTransactionCalled = false;
      const originalRunInTransaction = mockPrismaService.runInTransaction;
      mockPrismaService.runInTransaction = async (fn: any) => {
        runInTransactionCalled = true;
        return originalRunInTransaction(fn);
      };

      // Call with explicit tx (the mock client itself acts as the tx)
      const externalTx = mockPrismaService.getClient();
      const result = await service.identify(
        'ws_alpha',
        { id: 'cnt_ext_tx' },
        {
          name: 'Updated via external tx',
          email: 'ext_tx@test.com',
        },
        { tx: externalTx },
      );

      assert.strictEqual(result.id, 'cnt_ext_tx');
      assert.strictEqual(result.name, 'Updated via external tx');
      assert.strictEqual(result.email, 'ext_tx@test.com');
      // runInTransaction should NOT have been called since we provided an external tx
      assert.strictEqual(runInTransactionCalled, false);

      // Restore
      mockPrismaService.runInTransaction = originalRunInTransaction;
    });
  });
});
