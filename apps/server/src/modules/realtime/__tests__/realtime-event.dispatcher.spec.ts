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
  PresenceStatus,
} from '@sales-copilot/shared-contracts';
import { RealtimeEventDispatcher } from '../realtime-event.dispatcher';

describe('RealtimeEventDispatcher — Event Routing & Error Isolation (Task 12)', () => {
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

  describe('1. Message Event Dispatches (Task 12)', () => {
    it('should broadcast message.created to conversation and workspace rooms on both typed and generic channels', () => {
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

      const genericEvent = conversationEmissions.find(e => e.event === 'event');
      assert.ok(genericEvent);
      assert.deepStrictEqual((genericEvent.payload as any).data, mockMessage);
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

  describe('2. Conversation Event Dispatches (Task 12)', () => {
    it('should broadcast conversation.created to workspace room only', () => {
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

      // Verify not broadcast to conversation-specific room
      assert.strictEqual(
        emittedBroadcasts.some(e => e.room === `conversation_${conversationId}`),
        false,
      );
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

    it('should broadcast conversation.assigned to workspace, conversation, new assignee, and previous assignee rooms', () => {
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

  describe('3. Contact & Channel Identity Event Dispatches (Task 12)', () => {
    const contactId = 'cont_1111_2222';
    const mockContact: any = {
      id: contactId,
      workspaceId,
      name: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '+84987654321',
      avatarUrl: null,
      identifier: 'id_123',
      customAttributes: {},
      additionalAttributes: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should broadcast contact.created to workspace room', () => {
      dispatcher.handleContactCreated({
        workspaceId,
        contact: mockContact,
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CONTACT_CREATED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, mockContact);
    });

    it('should broadcast contact.updated to workspace room', () => {
      dispatcher.handleContactUpdated({
        workspaceId,
        contact: mockContact,
        previousAttributes: {},
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CONTACT_UPDATED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, mockContact);
    });

    it('should broadcast contact.deleted to workspace room', () => {
      dispatcher.handleContactDeleted({
        workspaceId,
        contactId,
        contact: mockContact,
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CONTACT_DELETED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, {
        contactId,
        contact: mockContact,
      });
    });

    it('should broadcast contact.merged to workspace room', () => {
      dispatcher.handleContactMerged({
        workspaceId,
        primaryContactId: 'cont_primary',
        mergedContactId: 'cont_merged',
        mergedByUserId: 'usr_admin',
        mergedAttributes: {},
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CONTACT_MERGED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, {
        primaryContactId: 'cont_primary',
        mergedContactId: 'cont_merged',
        mergedByUserId: 'usr_admin',
        mergedAttributes: {},
      });
    });

    it('should broadcast channel_identity.created and deleted to workspace room', () => {
      const mockIdentity: any = {
        id: 'ci_001',
        channelId: 'chan_001',
        contactId,
        externalContactId: 'ext_001',
      };

      dispatcher.handleChannelIdentityCreated({ workspaceId, identity: mockIdentity });
      dispatcher.handleChannelIdentityDeleted({
        workspaceId,
        identityId: 'ci_001',
        contactId,
        identity: mockIdentity,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CHANNEL_IDENTITY_CREATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CHANNEL_IDENTITY_DELETED,
        ),
      );
    });
  });

  describe('4. Label & Channel Event Dispatches (Task 12)', () => {
    it('should broadcast label events to workspace room', () => {
      const mockLabel: any = {
        id: 'lbl_001',
        workspaceId,
        title: 'VIP',
        color: '#FF0000',
      };

      dispatcher.handleLabelCreated({ workspaceId, label: mockLabel });
      dispatcher.handleLabelUpdated({ workspaceId, label: mockLabel });
      dispatcher.handleLabelDeleted({ workspaceId, labelId: 'lbl_001', label: mockLabel });

      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.LABEL_CREATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.LABEL_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.LABEL_DELETED,
        ),
      );
    });

    it('should broadcast channel events to workspace room', () => {
      dispatcher.handleChannelCreated({
        workspaceId,
        inboxId: 'inbox_1',
        channelId: 'chan_1',
        channelType: 'WEB_CHAT' as any,
      });
      dispatcher.handleChannelUpdated({
        workspaceId,
        inboxId: 'inbox_1',
        channelId: 'chan_1',
        channelType: 'WEB_CHAT' as any,
      });
      dispatcher.handleChannelDeleted({
        workspaceId,
        inboxId: 'inbox_1',
        channelId: 'chan_1',
        channelType: 'WEB_CHAT' as any,
      });

      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CHANNEL_CREATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CHANNEL_UPDATED,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CHANNEL_DELETED,
        ),
      );
    });
  });

  describe('5. Typing & Presence Event Dispatches (Task 12)', () => {
    it('should broadcast typing.start and typing.stop to conversation and workspace rooms', () => {
      dispatcher.handleTypingStart({
        workspaceId,
        conversationId,
        userId: 'usr_001',
        isTyping: true,
      });
      dispatcher.handleTypingStop({
        workspaceId,
        conversationId,
        userId: 'usr_001',
        isTyping: false,
      });

      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` && e.event === WsServerEvent.TYPING_START,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `conversation_${conversationId}` && e.event === WsServerEvent.TYPING_STOP,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.TYPING_START,
        ),
      );
      assert.ok(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.TYPING_STOP,
        ),
      );
    });

    it('should broadcast presence.updated to workspace room', () => {
      const payload = {
        workspaceId,
        userId: 'usr_001',
        status: PresenceStatus.ONLINE,
        lastSeenAt: new Date().toISOString(),
      };

      dispatcher.handlePresenceUpdated(payload);

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.PRESENCE_UPDATED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, {
        userId: 'usr_001',
        status: PresenceStatus.ONLINE,
        lastSeenAt: payload.lastSeenAt,
      });
    });
  });

  describe('6. Error Isolation & Resilience (Task 12)', () => {
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
        dispatcher.handleContactCreated({
          workspaceId,
          contact: {} as any,
        });
        dispatcher.handlePresenceUpdated({
          workspaceId,
          userId: 'usr_001',
          status: PresenceStatus.ONLINE,
          lastSeenAt: new Date().toISOString(),
        });
      });
    });

    it('should not throw when gateway is undefined / unprovided', () => {
      const unprovidedDispatcher = new RealtimeEventDispatcher(undefined);

      assert.doesNotThrow(() => {
        unprovidedDispatcher.handleMessageCreated({
          workspaceId,
          conversationId,
          message: mockMessage,
          isPrivate: false,
        });
        unprovidedDispatcher.handlePresenceUpdated({
          workspaceId,
          userId: 'usr_001',
          status: PresenceStatus.ONLINE,
          lastSeenAt: new Date().toISOString(),
        });
      });
    });

    it('should not throw when gateway.server is undefined', () => {
      const noServerGateway: any = {};
      const noServerDispatcher = new RealtimeEventDispatcher(noServerGateway);

      assert.doesNotThrow(() => {
        noServerDispatcher.handleConversationCreated({
          workspaceId,
          conversation: mockConversation,
        });
      });
    });

    it('should gracefully handle null/undefined payloads or missing workspaceId', () => {
      assert.doesNotThrow(() => {
        dispatcher.handleMessageCreated(null as any);
        dispatcher.handleConversationCreated({} as any);
        dispatcher.handleContactCreated({} as any);
        dispatcher.handlePresenceUpdated(null as any);
      });
      assert.strictEqual(emittedBroadcasts.length, 0);
    });
  });
});
