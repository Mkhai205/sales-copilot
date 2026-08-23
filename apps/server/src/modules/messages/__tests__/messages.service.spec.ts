import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ConversationStatus,
  DeliveryStatus,
  FileType,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { MessagesService } from '../messages.service';

describe('MessagesService (Task T-1.5.6: Message Threading & Polymorphic Senders)', () => {
  let service: MessagesService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let mockAttachmentsService: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let usersDb: Map<string, any>;
  let workspaceMembersDb: Map<string, any>;
  let attachmentsDb: Map<string, any>;

  beforeEach(() => {
    emittedEvents = [];
    conversationsDb = new Map();
    messagesDb = new Map();
    contactsDb = new Map();
    usersDb = new Map();
    workspaceMembersDb = new Map();
    attachmentsDb = new Map();

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    mockAttachmentsService = {
      uploadAndCreate: async (_workspaceId: string, messageId: string, file: any, _tx?: any) => {
        const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          messageId,
          fileName: file.originalname || 'file.png',
          fileType: FileType.IMAGE,
          fileSize: file.size || 100,
          storagePath: `attachments/ws_1/${messageId}/${id}-${file.originalname || 'file.png'}`,
          contentType: file.mimetype || 'image/png',
          createdAt: new Date(),
        };
        attachmentsDb.set(id, record);
        return {
          ...record,
          fileUrl: `http://storage/${record.storagePath}`,
          createdAt: record.createdAt.toISOString(),
        };
      },
      createFromExternalUrl: async (messageId: string, data: any, _tx?: any) => {
        const id = `att_ext_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          messageId,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          storagePath: data.storagePath,
          contentType: data.contentType,
          createdAt: new Date(),
        };
        attachmentsDb.set(id, record);
        return {
          ...record,
          fileUrl: data.fileUrl || data.storagePath,
          createdAt: record.createdAt.toISOString(),
        };
      },
      deleteByMessageId: async (messageId: string) => {
        let count = 0;
        for (const [id, att] of Array.from(attachmentsDb.entries())) {
          if (att.messageId === messageId) {
            attachmentsDb.delete(id);
            count++;
          }
        }
        return { deletedCount: count };
      },
    };

    const clientMock = {
      conversation: {
        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const conv of conversationsDb.values()) {
            if (where.id && conv.id !== where.id) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;

            const copy = { ...conv };
            if (include?.contact) {
              copy.contact = contactsDb.get(conv.contactId) ?? null;
            }
            return copy;
          }
          return null;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = conversationsDb.get(where.id);
          if (!existing) throw new Error('Conversation not found');

          const unread =
            typeof data.unreadMessagesCount === 'object' && data.unreadMessagesCount?.increment
              ? existing.unreadMessagesCount + data.unreadMessagesCount.increment
              : data.unreadMessagesCount !== undefined
                ? data.unreadMessagesCount
                : existing.unreadMessagesCount;

          const updated = {
            ...existing,
            ...data,
            unreadMessagesCount: unread,
            updatedAt: new Date(),
          };
          conversationsDb.set(where.id, updated);
          return { ...updated };
        },
      },

      message: {
        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const msg of messagesDb.values()) {
            if (where.id && msg.id !== where.id) continue;
            if (where.workspaceId && msg.workspaceId !== where.workspaceId) continue;
            if (where.conversationId && msg.conversationId !== where.conversationId) continue;
            if (where.externalId && msg.externalId !== where.externalId) continue;

            const copy = { ...msg };
            if (include?.attachments) {
              copy.attachments = Array.from(attachmentsDb.values()).filter(
                (att: any) => att.messageId === msg.id,
              );
            }
            return copy;
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
          where?: any;
          include?: any;
          orderBy?: any;
          skip?: number;
          take?: number;
        }) => {
          let results = Array.from(messagesDb.values()).filter((msg: any) => {
            if (where?.workspaceId && msg.workspaceId !== where.workspaceId) return false;
            if (where?.conversationId && msg.conversationId !== where.conversationId) return false;
            if (where?.isPrivate !== undefined && msg.isPrivate !== where.isPrivate) return false;
            if (where?.createdAt?.lt && !(msg.createdAt < where.createdAt.lt)) return false;
            if (where?.createdAt?.gt && !(msg.createdAt > where.createdAt.gt)) return false;
            return true;
          });

          if (orderBy?.createdAt) {
            results.sort((a, b) =>
              orderBy.createdAt === 'asc'
                ? a.createdAt.getTime() - b.createdAt.getTime()
                : b.createdAt.getTime() - a.createdAt.getTime(),
            );
          }

          if (skip !== undefined) {
            results = results.slice(skip);
          }
          if (take !== undefined) {
            results = results.slice(0, take);
          }

          return results.map(msg => {
            const copy = { ...msg };
            if (include?.attachments) {
              copy.attachments = Array.from(attachmentsDb.values()).filter(
                (att: any) => att.messageId === msg.id,
              );
            }
            return copy;
          });
        },
        count: async ({ where }: { where?: any }) => {
          return Array.from(messagesDb.values()).filter((msg: any) => {
            if (where?.workspaceId && msg.workspaceId !== where.workspaceId) return false;
            if (where?.conversationId && msg.conversationId !== where.conversationId) return false;
            if (where?.isPrivate !== undefined && msg.isPrivate !== where.isPrivate) return false;
            return true;
          }).length;
        },
        create: async ({ data }: { data: any }) => {
          const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const now = new Date();
          const record = {
            id,
            conversationId: data.conversationId,
            workspaceId: data.workspaceId,
            senderType: data.senderType,
            senderId: data.senderId,
            messageType: data.messageType,
            contentType: data.contentType,
            content: data.content,
            isPrivate: data.isPrivate,
            deliveryStatus: data.deliveryStatus,
            externalId: data.externalId,
            metadata: data.metadata,
            createdAt: now,
            updatedAt: now,
          };
          messagesDb.set(id, record);
          return { ...record };
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
          const existing = messagesDb.get(where.id);
          if (!existing) throw new Error('Message not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          messagesDb.set(where.id, updated);
          const copy = { ...updated };
          if (include?.attachments) {
            copy.attachments = Array.from(attachmentsDb.values()).filter(
              (att: any) => att.messageId === updated.id,
            );
          }
          return copy;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = messagesDb.get(where.id);
          if (existing) messagesDb.delete(where.id);
          return existing;
        },
      },

      user: {
        findFirst: async ({ where }: { where: any }) => {
          return usersDb.get(where.id) ? { ...usersDb.get(where.id) } : null;
        },
        findMany: async ({ where }: { where: any }) => {
          if (where.id?.in) {
            return where.id.in
              .map((id: string) => usersDb.get(id))
              .filter(Boolean)
              .map((u: any) => ({ ...u }));
          }
          return Array.from(usersDb.values()).map((u: any) => ({ ...u }));
        },
      },

      contact: {
        findFirst: async ({ where }: { where: any }) => {
          return contactsDb.get(where.id) ? { ...contactsDb.get(where.id) } : null;
        },
        findMany: async ({ where }: { where: any }) => {
          if (where.id?.in) {
            return where.id.in
              .map((id: string) => contactsDb.get(id))
              .filter(Boolean)
              .map((c: any) => ({ ...c }));
          }
          return Array.from(contactsDb.values()).map((c: any) => ({ ...c }));
        },
      },

      workspaceMember: {
        findFirst: async ({ where }: { where: any }) => {
          for (const wm of workspaceMembersDb.values()) {
            if (where.workspaceId && wm.workspaceId !== where.workspaceId) continue;
            if (where.userId && wm.userId !== where.userId) continue;
            return { ...wm };
          }
          return null;
        },
      },

      $transaction: async (fn: any) => fn(clientMock),
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new MessagesService(
      mockPrismaService,
      mockEventEmitter as any,
      mockAttachmentsService,
    );

    // Seed test fixtures
    usersDb.set('usr_agent_1', {
      id: 'usr_agent_1',
      name: 'Agent Smith',
      avatarUrl: 'https://avatar/smith.png',
    });

    workspaceMembersDb.set('wm_1', {
      id: 'wm_1',
      workspaceId: 'ws_1',
      userId: 'usr_agent_1',
    });

    contactsDb.set('cnt_1', {
      id: 'cnt_1',
      workspaceId: 'ws_1',
      name: 'John Doe',
      avatarUrl: 'https://avatar/john.png',
    });

    conversationsDb.set('conv_1', {
      id: 'conv_1',
      workspaceId: 'ws_1',
      contactId: 'cnt_1',
      inboxId: 'inbox_1',
      status: ConversationStatus.OPEN,
      unreadMessagesCount: 0,
      firstReplyCreatedAt: null,
      lastActivityAt: new Date(Date.now() - 60000),
      createdAt: new Date(Date.now() - 60000),
      updatedAt: new Date(Date.now() - 60000),
    });
  });

  describe('create - Polymorphic Sender Invariant (BR-5.1)', () => {
    it('should create message for CONTACT sender with matching contactId', async () => {
      const result = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        senderId: 'cnt_1',
        content: 'Hello from customer',
      });

      assert.strictEqual(result.senderType, SenderType.CONTACT);
      assert.strictEqual(result.senderId, 'cnt_1');
      assert.strictEqual(result.content, 'Hello from customer');
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.DELIVERED);
      assert.strictEqual(result.messageType, MessageType.INCOMING);
      assert.ok(result.sender);
      assert.strictEqual(result.sender?.name, 'John Doe');

      // Check event
      const event = emittedEvents.find(e => e.event === 'message.created');
      assert.ok(event);
      assert.strictEqual(event.payload.message.id, result.id);
    });

    it('should auto-populate senderId for CONTACT when omitted', async () => {
      const result = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'Hello again',
      });

      assert.strictEqual(result.senderType, SenderType.CONTACT);
      assert.strictEqual(result.senderId, 'cnt_1');
    });

    it('should reject CONTACT message when senderId does not match conversation contactId', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', 'conv_1', {
            senderType: SenderType.CONTACT,
            senderId: 'cnt_other',
            content: 'Impersonation attempt',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SENDER');
          return true;
        },
      );
    });

    it('should create message for USER sender who is a workspace member', async () => {
      const result = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Hello, how can I help you today?',
      });

      assert.strictEqual(result.senderType, SenderType.USER);
      assert.strictEqual(result.senderId, 'usr_agent_1');
      assert.strictEqual(result.messageType, MessageType.OUTGOING);
      assert.strictEqual(result.deliveryStatus, DeliveryStatus.SENT);
      assert.strictEqual(result.sender?.name, 'Agent Smith');
    });

    it('should reject USER message when senderId is omitted', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', 'conv_1', {
            senderType: SenderType.USER,
            content: 'Missing sender ID',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SENDER');
          return true;
        },
      );
    });

    it('should reject USER message when user is not a member of the workspace', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', 'conv_1', {
            senderType: SenderType.USER,
            senderId: 'usr_stranger',
            content: 'Unauthorized agent',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SENDER');
          return true;
        },
      );
    });

    it('should create message for SYSTEM sender with null senderId', async () => {
      const result = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.SYSTEM,
        content: 'Conversation was transferred to Support Team',
      });

      assert.strictEqual(result.senderType, SenderType.SYSTEM);
      assert.strictEqual(result.senderId, null);
      assert.strictEqual(result.sender?.type, SenderType.SYSTEM);
    });

    it('should reject SYSTEM message if senderId is provided', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', 'conv_1', {
            senderType: SenderType.SYSTEM,
            senderId: 'usr_agent_1',
            content: 'Invalid system sender',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SENDER');
          return true;
        },
      );
    });
  });

  describe('create - Content & Attachment Invariant (BR-5.2)', () => {
    it('should reject message with empty content and no attachments', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', 'conv_1', {
            senderType: SenderType.USER,
            senderId: 'usr_agent_1',
            content: '   ',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'MESSAGE_CONTENT_REQUIRED');
          return true;
        },
      );
    });

    it('should allow message with empty content if uploaded files are attached', async () => {
      const mockFiles: any = [
        {
          buffer: Buffer.from('img'),
          mimetype: 'image/png',
          size: 100,
          originalname: 'photo.png',
        },
      ];

      const result = await service.create(
        'ws_1',
        'conv_1',
        {
          senderType: SenderType.USER,
          senderId: 'usr_agent_1',
          content: '',
        },
        mockFiles,
      );

      assert.strictEqual(result.content, null);
      assert.strictEqual(result.contentType, MessageContentType.FILE);
      assert.strictEqual(result.attachments?.length, 1);
      assert.strictEqual(result.attachments?.[0].fileName, 'photo.png');
    });

    it('should allow message with empty content if external attachments are provided', async () => {
      const result = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: null,
        attachments: [
          {
            fileName: 'doc.pdf',
            fileType: FileType.FILE,
            fileSize: 1000,
            storagePath: 'https://cdn/doc.pdf',
            contentType: 'application/pdf',
          },
        ],
      });

      assert.strictEqual(result.attachments?.length, 1);
      assert.strictEqual(result.attachments?.[0].fileName, 'doc.pdf');
    });
  });

  describe('create - Idempotency via externalId', () => {
    it('should return existing message when created with identical externalId', async () => {
      const msg1 = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'Original message',
        externalId: 'ext_msg_123',
      });

      const msg2 = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'Duplicate webhook event',
        externalId: 'ext_msg_123',
      });

      assert.strictEqual(msg1.id, msg2.id);
      assert.strictEqual(msg2.content, 'Original message');
      assert.strictEqual(messagesDb.size, 1);
    });
  });

  describe('create - Side Effects on Conversation State', () => {
    it('should increment unreadMessagesCount and auto-reopen RESOLVED conversation when CONTACT messages', async () => {
      conversationsDb.set('conv_1', {
        ...conversationsDb.get('conv_1'),
        status: ConversationStatus.RESOLVED,
        unreadMessagesCount: 0,
      });

      await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'I have another question',
      });

      const updatedConv = conversationsDb.get('conv_1');
      assert.strictEqual(updatedConv.status, ConversationStatus.OPEN);
      assert.strictEqual(updatedConv.unreadMessagesCount, 1);

      const reopenEvent = emittedEvents.find(e => e.event === 'conversation.reopened');
      assert.ok(reopenEvent);
      assert.strictEqual(reopenEvent.payload.conversationId, 'conv_1');
    });

    it('should auto-reopen SNOOZED conversation and clear snoozedUntil when CONTACT messages', async () => {
      conversationsDb.set('conv_1', {
        ...conversationsDb.get('conv_1'),
        status: ConversationStatus.SNOOZED,
        snoozedUntil: new Date(Date.now() + 3600000),
        unreadMessagesCount: 0,
      });

      await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'Waking up conversation',
      });

      const updatedConv = conversationsDb.get('conv_1');
      assert.strictEqual(updatedConv.status, ConversationStatus.OPEN);
      assert.strictEqual(updatedConv.snoozedUntil, null);
    });

    it('should reset unread count, set firstReplyCreatedAt, and transition OPEN -> PENDING on USER reply', async () => {
      conversationsDb.set('conv_1', {
        ...conversationsDb.get('conv_1'),
        status: ConversationStatus.OPEN,
        unreadMessagesCount: 5,
        firstReplyCreatedAt: null,
      });

      await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Here is your answer!',
      });

      const updatedConv = conversationsDb.get('conv_1');
      assert.strictEqual(updatedConv.status, ConversationStatus.PENDING);
      assert.strictEqual(updatedConv.unreadMessagesCount, 0);
      assert.ok(updatedConv.firstReplyCreatedAt instanceof Date);

      const statusEvent = emittedEvents.find(e => e.event === 'conversation.status_updated');
      assert.ok(statusEvent);
      assert.strictEqual(statusEvent.payload.currentStatus, ConversationStatus.PENDING);
    });

    it('should NOT alter conversation status or firstReplyCreatedAt on private note (isPrivate = true)', async () => {
      conversationsDb.set('conv_1', {
        ...conversationsDb.get('conv_1'),
        status: ConversationStatus.OPEN,
        unreadMessagesCount: 3,
        firstReplyCreatedAt: null,
      });

      const note = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Customer looks impatient, let me check with manager',
        isPrivate: true,
      });

      assert.strictEqual(note.isPrivate, true);

      const updatedConv = conversationsDb.get('conv_1');
      assert.strictEqual(updatedConv.status, ConversationStatus.OPEN);
      assert.strictEqual(updatedConv.unreadMessagesCount, 3);
      assert.strictEqual(updatedConv.firstReplyCreatedAt, null);
    });
  });

  describe('list - Chronological Ordering & Privacy', () => {
    beforeEach(async () => {
      await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'Message 1',
      });
      await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Internal note for agents only',
        isPrivate: true,
      });
      await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Message 2 to customer',
      });
    });

    it('should list all messages including private notes when isAgent is true', async () => {
      const res = await service.list('ws_1', 'conv_1', {}, true);
      assert.strictEqual(res.items.length, 3);
      assert.strictEqual(res.meta.total, 3);
      assert.strictEqual(res.items[0].content, 'Message 1');
      assert.strictEqual(res.items[1].isPrivate, true);
    });

    it('should hide private notes when isAgent is false', async () => {
      const res = await service.list('ws_1', 'conv_1', {}, false);
      assert.strictEqual(res.items.length, 2);
      assert.strictEqual(res.meta.total, 2);
      assert.strictEqual(
        res.items.some(m => m.isPrivate),
        false,
      );
    });
  });

  describe('getById', () => {
    it('should retrieve public message successfully', async () => {
      const created = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'Test message',
      });

      const found = await service.getById('ws_1', created.id);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.content, 'Test message');
    });

    it('should throw ForbiddenException if non-agent accesses private note', async () => {
      const note = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Private agent secret',
        isPrivate: true,
      });

      await assert.rejects(
        async () => {
          await service.getById('ws_1', note.id, false);
        },
        (err: any) => {
          assert.strictEqual(err instanceof ForbiddenException, true);
          assert.strictEqual(err.response.code, 'PRIVATE_NOTE_ACCESS_DENIED');
          return true;
        },
      );
    });

    it('should throw NotFoundException on cross-tenant lookup', async () => {
      const created = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.CONTACT,
        content: 'WS 1 message',
      });

      await assert.rejects(
        async () => {
          await service.getById('ws_other', created.id);
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'MESSAGE_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status and emit message.delivery_status_updated event', async () => {
      const created = await service.create('ws_1', 'conv_1', {
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Outbound message',
      });

      const updated = await service.updateDeliveryStatus('ws_1', created.id, {
        deliveryStatus: DeliveryStatus.READ,
      });

      assert.strictEqual(updated.deliveryStatus, DeliveryStatus.READ);

      const statusEvent = emittedEvents.find(e => e.event === 'message.delivery_status_updated');
      assert.ok(statusEvent);
      assert.strictEqual(statusEvent.payload.currentStatus, DeliveryStatus.READ);
      assert.strictEqual(statusEvent.payload.previousStatus, DeliveryStatus.SENT);
    });
  });

  describe('delete', () => {
    it('should delete message and cascade cleanup attachments', async () => {
      const mockFiles: any = [
        {
          buffer: Buffer.from('img'),
          mimetype: 'image/png',
          size: 100,
          originalname: 'photo.png',
        },
      ];

      const created = await service.create(
        'ws_1',
        'conv_1',
        {
          senderType: SenderType.USER,
          senderId: 'usr_agent_1',
          content: 'Message to delete',
        },
        mockFiles,
      );

      assert.strictEqual(attachmentsDb.size, 1);

      const result = await service.delete('ws_1', created.id);
      assert.deepStrictEqual(result, { success: true });
      assert.strictEqual(messagesDb.has(created.id), false);
      assert.strictEqual(attachmentsDb.size, 0);

      const deleteEvent = emittedEvents.find(e => e.event === 'message.deleted');
      assert.ok(deleteEvent);
      assert.strictEqual(deleteEvent.payload.messageId, created.id);
    });
  });
});
