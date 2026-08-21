import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelIdentityDto, ChannelType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { ContactsController } from '../contacts.controller';
import { ContactsService } from '../contacts.service';
import { ChannelIdentityService } from '../channel-identity.service';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('ContactsController (Presentation Layer Endpoints)', () => {
  let controller: ContactsController;
  let mockContactsService: Partial<ContactsService>;
  let mockChannelIdentityService: Partial<ChannelIdentityService>;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws_test_1',
    role: WorkspaceRole.OWNER,
    workspace: {
      id: 'ws_test_1',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      billingPlan: 'FREE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const sampleContact = {
    id: 'cnt_1',
    workspaceId: 'ws_test_1',
    name: 'Nguyen Van A',
    email: 'nguyenvana@example.com',
    phoneNumber: '+84901234567',
    avatarUrl: null,
    identifier: 'ID_001',
    customAttributes: { vip: true },
    additionalAttributes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    identities: [],
  };

  const sampleIdentity: ChannelIdentityDto = {
    id: 'ident_1',
    contactId: 'cnt_1',
    workspaceId: 'ws_test_1',
    channelId: 'chn_1',
    channelType: ChannelType.FACEBOOK_MESSENGER,
    externalContactId: 'fb_123456',
    username: 'Nguyen Van A FB',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockContactsService = {
      findAll: async (_workspaceId: string, _query: any) => ({
        items: [sampleContact],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
      search: async (_workspaceId: string, _query: any) => ({
        items: [sampleContact],
        meta: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
      findById: async (_workspaceId: string, _contactId: string) => sampleContact,
      create: async (_workspaceId: string, dto: any) => ({
        ...sampleContact,
        ...dto,
      }),
      update: async (_workspaceId: string, _contactId: string, dto: any) => ({
        ...sampleContact,
        ...dto,
      }),
      delete: async (_workspaceId: string, _contactId: string) => ({ success: true }),
    };

    mockChannelIdentityService = {
      findByContactId: async (_workspaceId: string, _contactId: string) => [sampleIdentity],
      createForContact: async (_workspaceId: string, contactId: string, dto: any) => ({
        ...sampleIdentity,
        contactId,
        channelId: dto.channelId,
        externalContactId: dto.externalContactId,
      }),
      delete: async (_workspaceId: string, _contactId: string, _identityId: string) => ({
        success: true,
      }),
    };

    controller = new ContactsController(
      mockContactsService as ContactsService,
      mockChannelIdentityService as ChannelIdentityService,
    );
  });

  describe('Contact Core Endpoints', () => {
    it('should list contacts with pagination meta', async () => {
      const result = await controller.listContacts(mockContext, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].name, 'Nguyen Van A');
      assert.strictEqual(result.meta.total, 1);
    });

    it('should search contacts with query', async () => {
      const result = await controller.searchContacts(mockContext, {
        q: 'Nguyen',
        page: 1,
        limit: 20,
      });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].name, 'Nguyen Van A');
    });

    it('should create a new contact', async () => {
      const result = await controller.createContact(mockContext, {
        name: 'Tran Van C',
        email: 'tranvanc@example.com',
      });

      assert.strictEqual(result.name, 'Tran Van C');
      assert.strictEqual(result.email, 'tranvanc@example.com');
    });

    it('should get contact details by ID', async () => {
      const result = await controller.getContact(mockContext, 'cnt_1');
      assert.strictEqual(result.id, 'cnt_1');
      assert.strictEqual(result.name, 'Nguyen Van A');
    });

    it('should update contact details', async () => {
      const result = await controller.updateContact(mockContext, 'cnt_1', {
        name: 'Nguyen Van A Renamed',
      });
      assert.strictEqual(result.name, 'Nguyen Van A Renamed');
    });

    it('should delete contact', async () => {
      const result = await controller.deleteContact(mockContext, 'cnt_1');
      assert.deepStrictEqual(result, { success: true });
    });
  });

  describe('Nested Channel Identity Endpoints', () => {
    it('should list channel identities of contact', async () => {
      const result = await controller.listContactIdentities(mockContext, 'cnt_1');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].externalContactId, 'fb_123456');
    });

    it('should link a new channel identity to contact', async () => {
      const result = await controller.linkContactIdentity(mockContext, 'cnt_1', {
        channelId: 'chn_zalo_1',
        externalContactId: 'zalo_999',
      });

      assert.strictEqual(result.contactId, 'cnt_1');
      assert.strictEqual(result.channelId, 'chn_zalo_1');
      assert.strictEqual(result.externalContactId, 'zalo_999');
    });

    it('should unlink channel identity from contact', async () => {
      const result = await controller.unlinkContactIdentity(mockContext, 'cnt_1', 'ident_1');
      assert.deepStrictEqual(result, { success: true });
    });
  });
});
