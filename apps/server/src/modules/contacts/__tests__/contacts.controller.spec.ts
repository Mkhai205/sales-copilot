import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { ContactsController } from '../contacts.controller';
import { ContactsService } from '../contacts.service';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('ContactsController (Presentation Layer Endpoints)', () => {
  let controller: ContactsController;
  let mockContactsService: Partial<ContactsService>;

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

    controller = new ContactsController(mockContactsService as ContactsService);
  });

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
