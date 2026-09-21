import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  joinWorkspaceSchema,
  leaveWorkspaceSchema,
  joinConversationSchema,
  leaveConversationSchema,
  typingIndicatorSchema,
  commerceEditingActionSchema,
  orderShippedEventPayloadSchema,
  DomainEvent,
  WsServerEvent,
  WsClientEvent,
  PresenceStatus,
} from '../index';
import * as realtimeExports from '../index';

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

  describe('Commerce Collision & Lifecycle Schemas', () => {
    it('should validate commerceEditingActionSchema with valid UUIDs', () => {
      const parsed = commerceEditingActionSchema.parse({
        workspaceId: validUuid,
        conversationId: validUuid,
      });
      assert.strictEqual(parsed.workspaceId, validUuid);
      assert.strictEqual(parsed.conversationId, validUuid);
    });

    it('should reject commerceEditingActionSchema with invalid UUIDs', () => {
      assert.throws(() => {
        commerceEditingActionSchema.parse({
          workspaceId: 'invalid-id',
          conversationId: validUuid,
        });
      }, /Invalid workspace ID format/);

      assert.throws(() => {
        commerceEditingActionSchema.parse({
          workspaceId: validUuid,
          conversationId: 'invalid-id',
        });
      }, /Invalid conversation ID format/);
    });

    it('should validate orderShippedEventPayloadSchema with valid payload', () => {
      const payload = {
        workspaceId: validUuid,
        orderId: validUuid,
        orderNumber: 'ORD-1001',
        displayId: 1001,
        trackingCode: 'VNP123456789',
        shippingCarrier: 'VNPost',
        shippedAt: new Date().toISOString(),
        order: { id: validUuid, total: 100000 },
      };
      const parsed = orderShippedEventPayloadSchema.parse(payload);
      assert.strictEqual(parsed.orderNumber, 'ORD-1001');
      assert.strictEqual(parsed.shippingCarrier, 'VNPost');
    });

    it('should reject orderShippedEventPayloadSchema when missing required fields', () => {
      assert.throws(() => {
        orderShippedEventPayloadSchema.parse({
          workspaceId: validUuid,
          orderId: validUuid,
        });
      });
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
      assert.strictEqual(DomainEvent.COMMERCE_COLLISION_STATUS, 'commerce.collision_status');
    });

    it('should match WsServerEvent and WsClientEvent enum values', () => {
      assert.strictEqual(WsServerEvent.MESSAGE_CREATED, 'message.created');
      assert.strictEqual(WsServerEvent.CONVERSATION_STATUS_UPDATED, 'conversation.status_updated');
      assert.strictEqual(WsServerEvent.PRESENCE_UPDATED, 'presence.updated');
      assert.strictEqual(WsServerEvent.COMMERCE_COLLISION_STATUS, 'commerce.collision_status');
      assert.strictEqual(WsClientEvent.JOIN_WORKSPACE, 'join_workspace');
      assert.strictEqual(WsClientEvent.LEAVE_WORKSPACE, 'leave_workspace');
      assert.strictEqual(WsClientEvent.JOIN_CONVERSATION, 'join_conversation');
      assert.strictEqual(WsClientEvent.LEAVE_CONVERSATION, 'leave_conversation');
      assert.strictEqual(WsClientEvent.START_TYPING, 'start_typing');
      assert.strictEqual(WsClientEvent.STOP_TYPING, 'stop_typing');
      assert.strictEqual(WsClientEvent.HEARTBEAT, 'heartbeat');
      assert.strictEqual(WsClientEvent.COMMERCE_EDITING_START, 'commerce.editing_start');
      assert.strictEqual(WsClientEvent.COMMERCE_EDITING_HEARTBEAT, 'commerce.editing_heartbeat');
      assert.strictEqual(WsClientEvent.COMMERCE_EDITING_STOP, 'commerce.editing_stop');
      assert.strictEqual(WsClientEvent.COMMERCE_EDITING_TAKEOVER, 'commerce.editing_takeover');
    });

    it('should have correct PresenceStatus enum values', () => {
      assert.strictEqual(PresenceStatus.ONLINE, 'ONLINE');
      assert.strictEqual(PresenceStatus.OFFLINE, 'OFFLINE');
      assert.strictEqual(PresenceStatus.AWAY, 'AWAY');
    });

    it('should ensure no deprecated POS aliases are present on realtime enums or exports', () => {
      const posPrefix = ['P', 'O', 'S', '_'].join('');
      const posKeys = [
        ...Object.keys(DomainEvent),
        ...Object.keys(WsServerEvent),
        ...Object.keys(WsClientEvent),
      ].filter(k => k.startsWith(posPrefix));
      assert.deepStrictEqual(posKeys, []);

      // Verify no POS exported symbols in realtime exports
      const exportedPosSymbols = Object.keys(realtimeExports).filter(key =>
        key.toLowerCase().startsWith('pos'),
      );
      assert.deepStrictEqual(exportedPosSymbols, []);
    });
  });
});
