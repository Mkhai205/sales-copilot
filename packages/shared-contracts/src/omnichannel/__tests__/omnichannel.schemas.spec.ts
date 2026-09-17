import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  createLabelSchema,
  updateLabelSchema,
  labelListQuerySchema,
  createConversationSchema,
  updateConversationStatusSchema,
  assignConversationSchema,
  updateConversationPrioritySchema,
  assignLabelsSchema,
  conversationListQuerySchema,
  ConversationStatus,
  Priority,
  createMessageSchema,
  sendMessageSchema,
  updateDeliveryStatusSchema,
  messageListQuerySchema,
  createAttachmentInputSchema,
  SenderType,
  MessageType,
  MessageContentType,
  DeliveryStatus,
  FileType,
  createContactSchema,
  mergeContactsSchema,
  contactListQuerySchema,
  createChannelIdentitySchema,
  createInboxSchema,
  ChannelType,
  createCannedResponseSchema,
} from '../index';

describe('Shared Contracts — Omnichannel Context Schemas', () => {
  describe('Labels Schemas', () => {
    it('should validate valid createLabel payload', () => {
      const valid = {
        title: 'VIP Customer',
        description: 'High priority customer',
        color: '#FF5733',
        showOnSidebar: true,
      };
      const parsed = createLabelSchema.parse(valid);
      assert.strictEqual(parsed.title, 'VIP Customer');
      assert.strictEqual(parsed.color, '#FF5733');
      assert.strictEqual(parsed.showOnSidebar, true);
    });

    it('should trim title and apply default color & sidebar setting', () => {
      const parsed = createLabelSchema.parse({ title: '  Urgent  ' });
      assert.strictEqual(parsed.title, 'Urgent');
      assert.strictEqual(parsed.color, '#2563eb');
      assert.strictEqual(parsed.showOnSidebar, true);
    });

    it('should reject invalid hex color format', () => {
      assert.throws(() => {
        createLabelSchema.parse({ title: 'Test', color: 'invalid-color' });
      }, /Invalid color format/);
    });

    it('should reject title exceeding 50 characters', () => {
      assert.throws(() => {
        createLabelSchema.parse({ title: 'A'.repeat(51) });
      }, /cannot exceed 50 characters/);
    });

    it('should allow partial updates with updateLabelSchema', () => {
      const parsed = updateLabelSchema.parse({ color: '#00FF00' });
      assert.strictEqual(parsed.color, '#00FF00');
      assert.strictEqual(parsed.title, undefined);
    });

    it('should parse label list query params and preprocess showOnSidebar boolean', () => {
      const query1 = labelListQuerySchema.parse({ showOnSidebar: 'true', page: '2' });
      assert.strictEqual(query1.showOnSidebar, true);
      assert.strictEqual(query1.page, 2);

      const query2 = labelListQuerySchema.parse({ showOnSidebar: 'false' });
      assert.strictEqual(query2.showOnSidebar, false);
    });
  });

  describe('Conversations Schemas', () => {
    const validContactId = '11111111-1111-1111-1111-111111111111';
    const validInboxId = '22222222-2222-2222-2222-222222222222';
    const validAssigneeId = '33333333-3333-3333-3333-333333333333';

    it('should validate valid createConversation payload with default priority', () => {
      const parsed = createConversationSchema.parse({
        contactId: validContactId,
        inboxId: validInboxId,
      });
      assert.strictEqual(parsed.contactId, validContactId);
      assert.strictEqual(parsed.inboxId, validInboxId);
      assert.strictEqual(parsed.priority, Priority.MEDIUM);
    });

    it('should reject invalid UUIDs for contactId or inboxId', () => {
      assert.throws(() => {
        createConversationSchema.parse({
          contactId: 'not-a-uuid',
          inboxId: validInboxId,
        });
      }, /Invalid contact ID/);
    });

    it('should validate updateConversationStatusSchema with snoozedUntil ISO string', () => {
      const snoozedTime = new Date(Date.now() + 3600000).toISOString();
      const parsed = updateConversationStatusSchema.parse({
        status: ConversationStatus.SNOOZED,
        snoozedUntil: snoozedTime,
      });
      assert.strictEqual(parsed.status, ConversationStatus.SNOOZED);
      assert.strictEqual(parsed.snoozedUntil, snoozedTime);
    });

    it('should reject invalid snoozedUntil datetime format', () => {
      assert.throws(() => {
        updateConversationStatusSchema.parse({
          status: ConversationStatus.SNOOZED,
          snoozedUntil: 'not-a-date',
        });
      }, /snoozedUntil must be a valid ISO-8601 datetime/);
    });

    it('should validate assignConversationSchema', () => {
      const parsed = assignConversationSchema.parse({
        assigneeId: validAssigneeId,
        teamId: null,
      });
      assert.strictEqual(parsed.assigneeId, validAssigneeId);
      assert.strictEqual(parsed.teamId, null);
    });

    it('should validate updateConversationPrioritySchema', () => {
      const parsed = updateConversationPrioritySchema.parse({
        priority: Priority.URGENT,
      });
      assert.strictEqual(parsed.priority, Priority.URGENT);
    });

    it('should validate assignLabelsSchema and reject empty array', () => {
      const labelId1 = '44444444-4444-4444-4444-444444444444';
      const parsed = assignLabelsSchema.parse({ labelIds: [labelId1] });
      assert.deepStrictEqual(parsed.labelIds, [labelId1]);

      assert.throws(() => {
        assignLabelsSchema.parse({ labelIds: [] });
      }, /At least one label ID is required/);
    });

    it('should parse conversationListQuerySchema with defaults and filters', () => {
      const parsed = conversationListQuerySchema.parse({
        status: ConversationStatus.OPEN,
        assigneeId: 'unassigned',
        page: '1',
        limit: '15',
      });
      assert.strictEqual(parsed.status, ConversationStatus.OPEN);
      assert.strictEqual(parsed.assigneeId, 'unassigned');
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 15);
      assert.strictEqual(parsed.sortBy, 'lastActivityAt');
      assert.strictEqual(parsed.sortOrder, 'desc');
    });
  });

  describe('Messages & Attachments Schemas', () => {
    it('should validate createAttachmentInputSchema', () => {
      const valid = {
        fileName: 'contract.pdf',
        fileType: FileType.FILE,
        fileSize: 1048576,
        storagePath: 'attachments/ws_1/msg_1/uuid-contract.pdf',
        contentType: 'application/pdf',
      };
      const parsed = createAttachmentInputSchema.parse(valid);
      assert.strictEqual(parsed.fileName, 'contract.pdf');
      assert.strictEqual(parsed.fileType, FileType.FILE);
      assert.strictEqual(parsed.fileSize, 1048576);
    });

    it('should reject negative file size for attachments', () => {
      assert.throws(() => {
        createAttachmentInputSchema.parse({
          fileName: 'photo.png',
          fileType: FileType.IMAGE,
          fileSize: -1,
          storagePath: 'attachments/ws_1/photo.png',
          contentType: 'image/png',
        });
      }, /File size must be positive/);
    });

    it('should validate createMessageSchema with defaults', () => {
      const parsed = createMessageSchema.parse({
        content: 'Hello, how can I help you today?',
      });
      assert.strictEqual(parsed.content, 'Hello, how can I help you today?');
      assert.strictEqual(parsed.senderType, SenderType.USER);
      assert.strictEqual(parsed.messageType, MessageType.OUTGOING);
      assert.strictEqual(parsed.contentType, MessageContentType.TEXT);
      assert.strictEqual(parsed.isPrivate, false);
    });

    it('should validate private note creation', () => {
      const agentId = '55555555-5555-5555-5555-555555555555';
      const parsed = createMessageSchema.parse({
        content: 'Customer requested refund review internally',
        senderType: SenderType.USER,
        senderId: agentId,
        isPrivate: true,
      });
      assert.strictEqual(parsed.isPrivate, true);
      assert.strictEqual(parsed.senderId, agentId);
    });

    it('should validate sendMessageSchema with attachments', () => {
      const parsed = sendMessageSchema.parse({
        content: 'Please see the attached file',
        contentType: MessageContentType.TEXT,
        isPrivate: false,
        attachments: [
          {
            fileUrl: 'https://storage.example.com/file.pdf',
            fileName: 'file.pdf',
            fileType: 'FILE',
            fileSize: 2048,
          },
        ],
      });
      assert.strictEqual(parsed.content, 'Please see the attached file');
      assert.strictEqual(parsed.attachments?.length, 1);
    });

    it('should validate updateDeliveryStatusSchema', () => {
      const parsed = updateDeliveryStatusSchema.parse({
        deliveryStatus: DeliveryStatus.DELIVERED,
      });
      assert.strictEqual(parsed.deliveryStatus, DeliveryStatus.DELIVERED);
    });

    it('should validate messageListQuerySchema pagination params', () => {
      const beforeId = '66666666-6666-6666-6666-666666666666';
      const parsed = messageListQuerySchema.parse({
        limit: '25',
        beforeId,
      });
      assert.strictEqual(parsed.limit, 25);
      assert.strictEqual(parsed.beforeId, beforeId);
      assert.strictEqual(parsed.page, 1);
    });
  });

  describe('Contacts Schemas', () => {
    const contactId1 = '11111111-1111-1111-1111-111111111111';
    const contactId2 = '22222222-2222-2222-2222-222222222222';
    const channelId = '33333333-3333-3333-3333-333333333333';

    it('should validate createContactSchema with valid fields', () => {
      const parsed = createContactSchema.parse({
        name: 'Nguyen Van B',
        email: 'customer@example.com',
        phoneNumber: '+84912345678',
        customAttributes: { loyaltyTier: 'GOLD' },
      });
      assert.strictEqual(parsed.name, 'Nguyen Van B');
      assert.strictEqual(parsed.email, 'customer@example.com');
      assert.strictEqual(parsed.phoneNumber, '+84912345678');
      assert.deepStrictEqual(parsed.customAttributes, { loyaltyTier: 'GOLD' });
    });

    it('should accept empty string for email and phoneNumber in createContactSchema', () => {
      const parsed = createContactSchema.parse({
        name: 'Walk-in Customer',
        email: '',
        phoneNumber: '',
      });
      assert.strictEqual(parsed.name, 'Walk-in Customer');
      assert.strictEqual(parsed.email, '');
      assert.strictEqual(parsed.phoneNumber, '');
    });

    it('should reject invalid phone format (non-E.164) when provided', () => {
      assert.throws(() => {
        createContactSchema.parse({
          name: 'Customer',
          phoneNumber: '0912345678', // Missing + country code
        });
      });
    });

    it('should validate mergeContactsSchema and reject merging same contact into itself', () => {
      const valid = mergeContactsSchema.parse({
        baseContactId: contactId1,
        mergeeContactId: contactId2,
      });
      assert.strictEqual(valid.baseContactId, contactId1);
      assert.strictEqual(valid.mergeeContactId, contactId2);

      assert.throws(() => {
        mergeContactsSchema.parse({
          baseContactId: contactId1,
          mergeeContactId: contactId1,
        });
      }, /Base contact and mergee contact must be different/);
    });

    it('should parse contactListQuerySchema with defaults and coercion', () => {
      const parsed = contactListQuerySchema.parse({
        page: '2',
        limit: '30',
        q: 'Nguyen',
      });
      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.limit, 30);
      assert.strictEqual(parsed.q, 'Nguyen');
      assert.strictEqual(parsed.sortBy, 'createdAt');
      assert.strictEqual(parsed.sortOrder, 'desc');
    });

    it('should validate createChannelIdentitySchema', () => {
      const parsed = createChannelIdentitySchema.parse({
        channelId,
        externalContactId: 'fb_psid_123456',
        username: 'nguyen.fb',
      });
      assert.strictEqual(parsed.channelId, channelId);
      assert.strictEqual(parsed.externalContactId, 'fb_psid_123456');
      assert.strictEqual(parsed.username, 'nguyen.fb');
    });
  });

  describe('Inboxes Schemas', () => {
    it('should validate createInboxSchema with defaults', () => {
      const parsed = createInboxSchema.parse({
        name: 'Zalo OA Official',
        channelType: ChannelType.ZALO,
      });
      assert.strictEqual(parsed.name, 'Zalo OA Official');
      assert.strictEqual(parsed.channelType, ChannelType.ZALO);
      assert.strictEqual(parsed.isAutoAssignmentEnabled, false);
    });

    it('should reject createInboxSchema with empty name', () => {
      assert.throws(() => {
        createInboxSchema.parse({
          name: '',
          channelType: ChannelType.FACEBOOK_MESSENGER,
        });
      });
    });
  });

  describe('Canned Responses Schemas', () => {
    it('should validate createCannedResponseSchema', () => {
      const parsed = createCannedResponseSchema.parse({
        shortCode: 'xinchao',
        content: 'Dạ shop Sales Copilot xin chào quý khách!',
      });
      assert.strictEqual(parsed.shortCode, 'xinchao');
      assert.strictEqual(parsed.content, 'Dạ shop Sales Copilot xin chào quý khách!');
    });

    it('should reject empty shortCode or content', () => {
      assert.throws(() => {
        createCannedResponseSchema.parse({ shortCode: '', content: 'hello' });
      });
      assert.throws(() => {
        createCannedResponseSchema.parse({ shortCode: 'hi', content: '' });
      });
    });
  });
});
