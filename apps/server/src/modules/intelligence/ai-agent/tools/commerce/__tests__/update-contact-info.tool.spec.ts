import { createUpdateContactInfoTool } from '../update-contact-info.tool';

describe('updateContactInfo Tool (T8)', () => {
  const workspaceId = 'ws-test-123';
  const conversationId = 'conv-test-456';
  let mockPrisma: any;
  let mockContactsService: any;
  let contactsDb: Map<string, any>;
  let updatePayloads: any[];

  beforeEach(() => {
    updatePayloads = [];
    contactsDb = new Map([
      [
        'contact-1',
        {
          id: 'contact-1',
          name: 'Khách cũ',
          phoneNumber: null,
          customAttributes: {},
          workspaceId,
        },
      ],
    ]);

    mockPrisma = {
      getClient: () => ({
        conversation: {
          findFirst: async ({ where }: any) => {
            if (where.id === conversationId && where.workspaceId === workspaceId) {
              return { id: conversationId, contactId: 'contact-1' };
            }
            return null;
          },
          updateMany: async () => ({ count: 1 }),
        },
        contact: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            const id = 'contact-new-' + Date.now();
            const contact = { id, ...data };
            contactsDb.set(id, contact);
            return contact;
          },
        },
      }),
    };

    mockContactsService = {
      update: async (wsId: string, contactId: string, payload: any) => {
        updatePayloads.push({ wsId, contactId, payload });
        const existing = contactsDb.get(contactId);
        const updated = {
          ...existing,
          ...payload,
          customAttributes: {
            ...existing?.customAttributes,
            ...payload.customAttributes,
          },
        };
        contactsDb.set(contactId, updated);
        return updated;
      },
    };
  });

  it('should normalize phone number to E.164 and map address to customAttributes', async () => {
    const tool = createUpdateContactInfoTool({
      workspaceId,
      conversationId,
      contactsService: mockContactsService,
      prisma: mockPrisma,
    });

    const result = await tool.execute!(
      {
        name: 'Nguyễn Văn Nam',
        phoneNumber: '0988123456',
        address: '15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
      },
      {} as any,
    );

    expect(result.updated).toBe(true);
    expect(result.name).toBe('Nguyễn Văn Nam');
    expect(result.phoneNumber).toBe('+84988123456');
    expect(result.address).toBe('15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội');

    // Check payload sent to ContactsService
    expect(updatePayloads.length).toBe(1);
    expect(updatePayloads[0].payload.phoneNumber).toBe('+84988123456');
    expect(updatePayloads[0].payload.customAttributes).toEqual({
      address: '15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
    });
  });

  it('should return updated = false when no fields are supplied', async () => {
    const tool = createUpdateContactInfoTool({
      workspaceId,
      conversationId,
      contactsService: mockContactsService,
      prisma: mockPrisma,
    });

    const result = await tool.execute!({}, {} as any);
    expect(result.updated).toBe(false);
    expect(updatePayloads.length).toBe(0);
  });
});
