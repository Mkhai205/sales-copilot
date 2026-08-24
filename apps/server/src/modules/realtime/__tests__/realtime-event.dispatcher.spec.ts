import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ConversationPriority,
  ConversationStatus,
  DeliveryStatus,
  MessageContentType,
  MessageType,
  Priority,
  SenderType,
  WsServerEvent,
} from '@sales-copilot/shared-contracts';
import { RealtimeEventDispatcher } from '../realtime-event.dispatcher';

describe('RealtimeEventDispatcher — Message & Conversation Events (Task 5)', () => {
  let dispatcher: RealtimeEventDispatcher;
  let emittedBroadcasts: Array<{ room: string; event: string; payload: unknown }>;
  let mockGateway: any;

  const workspaceId = '11111111-1111-1111-1111-111111111111';
  const conversationId = '22222222-2222-2222-2222-222222222222';
  const messageId = '33333333-3333-3333-3333-333333333333';
  const agent1Id = 'usr_agent_001';
  const agent2Id = 'usr_agent_002';

  const mockMessage: any = {
    id: messageId,
    conversationId,
    workspaceId,
    senderType: SenderType.USER,
    senderId: agent1Id,
    messageType: MessageType.OUTGOING,
    contentType: MessageContentType.TEXT,
    content: 'Hello customer!',
    isPrivate: false,
    deliveryStatus: DeliveryStatus.DELIVERED,
    createdAt: new Date().toISOString(),
  };

  const mockConversation: any = {
    id: conversationId,
    displayId: 101,
    workspaceId,
    inboxId: 'inbox_001',
    contactId: 'contact_001',
    status: ConversationStatus.OPEN,
    priority: ConversationPriority.HIGH,
    unreadMessagesCount: 0,
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    emittedBroadcasts = [];

    mockGateway = {
      server: {
        to: (room: string) => ({
          emit: (event: string, payload: unknown) => {
            emittedBroadcasts.push({ room, event, payload });
          },
        }),
      },
    };

    dispatcher = new RealtimeEventDispatcher(mockGateway);
  });

  describe('Message Event Dispatches', () => {
    it('should broadcast message.created to conversation and workspace rooms', () => {
      dispatcher.handleMessageCreated({
        workspaceId,
        conversationId,
        message: mockMessage,
        isPrivate: false,
      });

      const conversationEmissions = emittedBroadcasts.filter(
        e => e.room === `conversation_${conversationId}`,
      );
      const workspaceEmissions = emittedBroadcasts.filter(
        e => e.room === `workspace_${workspaceId}`,
      );

      assert.strictEqual(conversationEmissions.length, 2); // typed event + generic 'event'
      assert.strictEqual(workspaceEmissions.length, 2);

      const typedEvent = conversationEmissions.find(e => e.event === WsServerEvent.MESSAGE_CREATED);
      assert.ok(typedEvent);
      assert.deepStrictEqual((typedEvent.payload as any).data, mockMessage);
      assert.strictEqual((typedEvent.payload as any).event, WsServerEvent.MESSAGE_CREATED);
    });

    it('should broadcast message.updated to conversation and workspace rooms', () => {
      dispatcher.handleMessageUpdated({
        workspaceId,
        conversationId,
        messageId,
        message: mockMessage,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.MESSAGE_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.MESSAGE_UPDATED,
        ),
      );
    });

    it('should broadcast message.deleted to conversation and workspace rooms', () => {
      dispatcher.handleMessageDeleted({
        workspaceId,
        conversationId,
        messageId,
      });

      const convBroadcast = emittedBroadcasts.find(
        e =>
          e.room === `conversation_${conversationId}` && e.event === WsServerEvent.MESSAGE_DELETED,
      );
      assert.ok(convBroadcast);
      assert.deepStrictEqual((convBroadcast.payload as any).data, {
        conversationId,
        messageId,
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.MESSAGE_DELETED,
      );
      assert.ok(wsBroadcast);
    });

    it('should broadcast message.delivery_status_updated to conversation and workspace rooms', () => {
      dispatcher.handleMessageDeliveryStatusUpdated({
        workspaceId,
        conversationId,
        messageId,
        previousStatus: DeliveryStatus.SENT,
        currentStatus: DeliveryStatus.DELIVERED,
        message: mockMessage,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
        ),
      );
    });
  });

  describe('Conversation Event Dispatches', () => {
    it('should broadcast conversation.created to workspace room', () => {
      dispatcher.handleConversationCreated({
        workspaceId,
        conversation: mockConversation,
      });

      const wsBroadcast = emittedBroadcasts.find(
        e =>
          e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CONVERSATION_CREATED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, mockConversation);
    });

    it('should broadcast conversation.status_updated to conversation and workspace rooms', () => {
      dispatcher.handleConversationStatusUpdated({
        workspaceId,
        conversationId,
        previousStatus: ConversationStatus.OPEN,
        currentStatus: ConversationStatus.RESOLVED,
        conversation: mockConversation,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_STATUS_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_STATUS_UPDATED,
        ),
      );
    });

    it('should broadcast conversation.reopened to conversation and workspace rooms', () => {
      dispatcher.handleConversationReopened({
        workspaceId,
        conversationId,
        triggeredBySenderType: 'CONTACT',
        conversation: mockConversation,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_REOPENED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_REOPENED,
        ),
      );
    });

    it('should broadcast conversation.assigned to workspace, conversation, new assignee and previous assignee rooms', () => {
      dispatcher.handleConversationAssigned({
        workspaceId,
        conversationId,
        previousAssigneeId: agent1Id,
        newAssigneeId: agent2Id,
        teamId: 'team_001',
        assignedByUserId: 'usr_admin_001',
        conversation: mockConversation,
      });

      // 1. Workspace room
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      );

      // 2. Conversation room
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      );

      // 3. New assignee direct notification room
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `user_${agent2Id}` && e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      );

      // 4. Previous assignee direct notification room
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `user_${agent1Id}` && e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      );
    });

    it('should broadcast conversation.priority_updated to conversation and workspace rooms', () => {
      dispatcher.handleConversationPriorityUpdated({
        workspaceId,
        conversationId,
        previousPriority: Priority.LOW,
        currentPriority: Priority.URGENT,
        conversation: mockConversation,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_PRIORITY_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_PRIORITY_UPDATED,
        ),
      );
    });

    it('should broadcast conversation.labels_updated to conversation and workspace rooms', () => {
      dispatcher.handleConversationLabelsUpdated({
        workspaceId,
        conversationId,
        labelIds: ['lbl_001', 'lbl_002'],
        labels: [],
        conversation: mockConversation,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_LABELS_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_LABELS_UPDATED,
        ),
      );
    });
  });

  describe('Error Isolation & Resilience', () => {
    it('should not throw or crash when gateway server throws during emission', () => {
      mockGateway.server.to = () => {
        throw new Error('Socket adapter network failure');
      };

      assert.doesNotThrow(() => {
        dispatcher.handleMessageCreated({
          workspaceId,
          conversationId,
          message: mockMessage,
          isPrivate: false,
        });
      });
    });

    it('should gracefully handle null/undefined payloads or missing workspaceId', () => {
      assert.doesNotThrow(() => {
        dispatcher.handleMessageCreated(null as any);
        dispatcher.handleConversationCreated({} as any);
      });
      assert.strictEqual(emittedBroadcasts.length, 0);
    });
  });
});
