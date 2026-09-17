import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
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

describe('Shared Contracts — Realtime Context Schemas & Events', () => {
  const validUuid = '12345678-1234-1234-1234-123456789abc';

  describe('Workspace Rooms Schemas', () => {
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
  });

  describe('Conversation Rooms & Typing Schemas', () => {
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
  });

  describe('Realtime Event Invariants', () => {
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
