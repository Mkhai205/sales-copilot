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
  joinWorkspaceSchema,
  leaveWorkspaceSchema,
  joinConversationSchema,
  leaveConversationSchema,
  typingIndicatorSchema,
  DomainEvent,
  WsServerEvent,
  WsClientEvent,
  PresenceStatus,
} from '../index';

describe('Shared Contracts — Epic 1.5 Schemas & Validation', () => {
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

  describe('Realtime Schemas & Event Enums (Epic 1.7)', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';

    it('should validate joinWorkspaceSchema with valid UUID', () => {
      const parsed = joinWorkspaceSchema.parse({ workspaceId: validUuid });
      assert.strictEqual(parsed.workspaceId, validUuid);
    });

    it('should reject joinWorkspaceSchema with invalid UUID', () => {
      assert.throws(() => {
        joinWorkspaceSchema.parse({ workspaceId: 'not-a-uuid' });
      }, /Invalid workspace ID format/);
    });

    it('should validate leaveWorkspaceSchema', () => {
      const parsed = leaveWorkspaceSchema.parse({ workspaceId: validUuid });
      assert.strictEqual(parsed.workspaceId, validUuid);
    });

    it('should validate joinConversationSchema with valid UUID', () => {
      const parsed = joinConversationSchema.parse({ conversationId: validUuid });
      assert.strictEqual(parsed.conversationId, validUuid);
    });

    it('should reject joinConversationSchema with invalid UUID', () => {
      assert.throws(() => {
        joinConversationSchema.parse({ conversationId: 'not-a-uuid' });
      }, /Invalid conversation ID format/);
    });

    it('should validate leaveConversationSchema', () => {
      const parsed = leaveConversationSchema.parse({ conversationId: validUuid });
      assert.strictEqual(parsed.conversationId, validUuid);
    });

    it('should validate typingIndicatorSchema', () => {
      const parsed = typingIndicatorSchema.parse({
        conversationId: validUuid,
        isTyping: true,
      });
      assert.strictEqual(parsed.conversationId, validUuid);
      assert.strictEqual(parsed.isTyping, true);
    });

    it('should match DomainEvent enum values with domain event strings', () => {
      assert.strictEqual(DomainEvent.MESSAGE_CREATED, 'message.created');
      assert.strictEqual(DomainEvent.MESSAGE_UPDATED, 'message.updated');
      assert.strictEqual(DomainEvent.MESSAGE_DELETED, 'message.deleted');
      assert.strictEqual(
        DomainEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
        'message.delivery_status_updated',
      );
      assert.strictEqual(DomainEvent.CONVERSATION_CREATED, 'conversation.created');
      assert.strictEqual(DomainEvent.CONVERSATION_STATUS_UPDATED, 'conversation.status_updated');
      assert.strictEqual(DomainEvent.CONVERSATION_ASSIGNED, 'conversation.assigned');
      assert.strictEqual(
        DomainEvent.CONVERSATION_PRIORITY_UPDATED,
        'conversation.priority_updated',
      );
      assert.strictEqual(DomainEvent.CONVERSATION_LABELS_UPDATED, 'conversation.labels_updated');
      assert.strictEqual(DomainEvent.CONTACT_CREATED, 'contact.created');
      assert.strictEqual(DomainEvent.CONTACT_UPDATED, 'contact.updated');
      assert.strictEqual(DomainEvent.CONTACT_DELETED, 'contact.deleted');
      assert.strictEqual(DomainEvent.CONTACT_MERGED, 'contact.merged');
      assert.strictEqual(DomainEvent.CHANNEL_IDENTITY_CREATED, 'channel_identity.created');
      assert.strictEqual(DomainEvent.CHANNEL_IDENTITY_DELETED, 'channel_identity.deleted');
      assert.strictEqual(DomainEvent.LABEL_CREATED, 'label.created');
      assert.strictEqual(DomainEvent.LABEL_UPDATED, 'label.updated');
      assert.strictEqual(DomainEvent.LABEL_DELETED, 'label.deleted');
      assert.strictEqual(DomainEvent.CHANNEL_CREATED, 'channel.created');
      assert.strictEqual(DomainEvent.CHANNEL_UPDATED, 'channel.updated');
      assert.strictEqual(DomainEvent.CHANNEL_DELETED, 'channel.deleted');
      assert.strictEqual(DomainEvent.PRESENCE_UPDATED, 'presence.updated');
      assert.strictEqual(DomainEvent.TYPING_START, 'typing.start');
      assert.strictEqual(DomainEvent.TYPING_STOP, 'typing.stop');
    });

    it('should match WsServerEvent and WsClientEvent enum values', () => {
      assert.strictEqual(WsServerEvent.MESSAGE_CREATED, 'message.created');
      assert.strictEqual(WsServerEvent.CONVERSATION_STATUS_UPDATED, 'conversation.status_updated');
      assert.strictEqual(WsServerEvent.PRESENCE_UPDATED, 'presence.updated');
      assert.strictEqual(WsClientEvent.JOIN_WORKSPACE, 'join_workspace');
      assert.strictEqual(WsClientEvent.LEAVE_WORKSPACE, 'leave_workspace');
      assert.strictEqual(WsClientEvent.JOIN_CONVERSATION, 'join_conversation');
      assert.strictEqual(WsClientEvent.LEAVE_CONVERSATION, 'leave_conversation');
      assert.strictEqual(WsClientEvent.START_TYPING, 'start_typing');
      assert.strictEqual(WsClientEvent.STOP_TYPING, 'stop_typing');
      assert.strictEqual(WsClientEvent.HEARTBEAT, 'heartbeat');
    });

    it('should have correct PresenceStatus enum values', () => {
      assert.strictEqual(PresenceStatus.ONLINE, 'ONLINE');
      assert.strictEqual(PresenceStatus.OFFLINE, 'OFFLINE');
      assert.strictEqual(PresenceStatus.AWAY, 'AWAY');
    });
  });
});
