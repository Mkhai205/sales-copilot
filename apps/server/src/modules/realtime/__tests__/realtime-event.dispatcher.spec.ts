import { assertDefined } from '../../../../test/test-assertions';
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
        to: (room: string | string[]) => ({
          emit: (event: string, payload: unknown) => {
            if (Array.isArray(room)) {
              for (const r of room) {
                emittedBroadcasts.push({ room: r, event, payload });
              }
            } else {
              emittedBroadcasts.push({ room, event, payload });
            }
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

      expect(conversationEmissions.length).toBe(2); // typed event + generic 'event'
      expect(workspaceEmissions.length).toBe(2);

      const typedEvent = conversationEmissions.find(e => e.event === WsServerEvent.MESSAGE_CREATED);
      assertDefined(typedEvent);
      expect((typedEvent.payload as any).data).toEqual(mockMessage);
      expect((typedEvent.payload as any).event).toBe(WsServerEvent.MESSAGE_CREATED);

      const genericEvent = conversationEmissions.find(e => e.event === 'event');
      assertDefined(genericEvent);
      expect((genericEvent.payload as any).data).toEqual(mockMessage);
    });

    it('should broadcast message.updated to conversation and workspace rooms', () => {
      dispatcher.handleMessageUpdated({
        workspaceId,
        conversationId,
        messageId,
        message: mockMessage,
      });

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.MESSAGE_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.MESSAGE_UPDATED,
        ),
      ).toBeTruthy();
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
      assertDefined(convBroadcast);
      expect((convBroadcast.payload as any).data).toEqual({
        conversationId,
        messageId,
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.MESSAGE_DELETED,
      );
      assertDefined(wsBroadcast);
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

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.MESSAGE_DELIVERY_STATUS_UPDATED,
        ),
      ).toBeTruthy();
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
      assertDefined(wsBroadcast);
      expect((wsBroadcast.payload as any).data).toEqual(mockConversation);

      // Verify not broadcast to conversation-specific room
      expect(emittedBroadcasts.some(e => e.room === `conversation_${conversationId}`)).toBe(false);
    });

    it('should broadcast conversation.status_updated to conversation and workspace rooms', () => {
      dispatcher.handleConversationStatusUpdated({
        workspaceId,
        conversationId,
        previousStatus: ConversationStatus.OPEN,
        currentStatus: ConversationStatus.RESOLVED,
        conversation: mockConversation,
      });

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_STATUS_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_STATUS_UPDATED,
        ),
      ).toBeTruthy();
    });

    it('should broadcast conversation.reopened to conversation and workspace rooms', () => {
      dispatcher.handleConversationReopened({
        workspaceId,
        conversationId,
        triggeredBySenderType: 'CONTACT',
        conversation: mockConversation,
      });

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_REOPENED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_REOPENED,
        ),
      ).toBeTruthy();
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
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      ).toBeTruthy();

      // 2. Conversation room
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      ).toBeTruthy();

      // 3. New assignee direct notification room
      expect(
        emittedBroadcasts.some(
          e => e.room === `user_${agent2Id}` && e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      ).toBeTruthy();

      // 4. Previous assignee direct notification room
      expect(
        emittedBroadcasts.some(
          e => e.room === `user_${agent1Id}` && e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      ).toBeTruthy();
    });

    it('should broadcast conversation.priority_updated to conversation and workspace rooms', () => {
      dispatcher.handleConversationPriorityUpdated({
        workspaceId,
        conversationId,
        previousPriority: Priority.LOW,
        currentPriority: Priority.URGENT,
        conversation: mockConversation,
      });

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_PRIORITY_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_PRIORITY_UPDATED,
        ),
      ).toBeTruthy();
    });

    it('should broadcast conversation.labels_updated to conversation and workspace rooms', () => {
      dispatcher.handleConversationLabelsUpdated({
        workspaceId,
        conversationId,
        labelIds: ['lbl_001', 'lbl_002'],
        labels: [],
        conversation: mockConversation,
      });

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` &&
            e.event === WsServerEvent.CONVERSATION_LABELS_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CONVERSATION_LABELS_UPDATED,
        ),
      ).toBeTruthy();
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
      assertDefined(wsBroadcast);
      expect((wsBroadcast.payload as any).data).toEqual(mockContact);
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
      assertDefined(wsBroadcast);
      expect((wsBroadcast.payload as any).data).toEqual(mockContact);
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
      assertDefined(wsBroadcast);
      expect((wsBroadcast.payload as any).data).toEqual({
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
      assertDefined(wsBroadcast);
      expect((wsBroadcast.payload as any).data).toEqual({
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

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CHANNEL_IDENTITY_CREATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `workspace_${workspaceId}` &&
            e.event === WsServerEvent.CHANNEL_IDENTITY_DELETED,
        ),
      ).toBeTruthy();
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

      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.LABEL_CREATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.LABEL_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.LABEL_DELETED,
        ),
      ).toBeTruthy();
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

      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CHANNEL_CREATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CHANNEL_UPDATED,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CHANNEL_DELETED,
        ),
      ).toBeTruthy();
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

      expect(
        emittedBroadcasts.some(
          e =>
            e.room === `conversation_${conversationId}` && e.event === WsServerEvent.TYPING_START,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `conversation_${conversationId}` && e.event === WsServerEvent.TYPING_STOP,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.TYPING_START,
        ),
      ).toBeTruthy();
      expect(
        emittedBroadcasts.some(
          e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.TYPING_STOP,
        ),
      ).toBeTruthy();
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
      assertDefined(wsBroadcast);
      expect((wsBroadcast.payload as any).data).toEqual({
        userId: 'usr_001',
        status: PresenceStatus.ONLINE,
        lastSeenAt: payload.lastSeenAt,
      });
    });
  });

  describe('7. Error Isolation & Resilience (Task 12)', () => {
    it('should not throw or crash when gateway server throws during emission', () => {
      mockGateway.server.to = () => {
        throw new Error('Socket adapter network failure');
      };

      expect(() => {
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
      }).not.toThrow();
    });

    it('should not throw when gateway is undefined / unprovided', () => {
      const unprovidedDispatcher = new RealtimeEventDispatcher(undefined);

      expect(() => {
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
      }).not.toThrow();
    });

    it('should not throw when gateway.server is undefined', () => {
      const noServerGateway: any = {};
      const noServerDispatcher = new RealtimeEventDispatcher(noServerGateway);

      expect(() => {
        noServerDispatcher.handleConversationCreated({
          workspaceId,
          conversation: mockConversation,
        });
      }).not.toThrow();
    });

    it('should gracefully handle null/undefined payloads or missing workspaceId', () => {
      expect(() => {
        dispatcher.handleMessageCreated(null as any);
        dispatcher.handleConversationCreated({} as any);
        dispatcher.handleContactCreated({} as any);
        dispatcher.handlePresenceUpdated(null as any);
        dispatcher.handleOrderShipped(null as any);
      }).not.toThrow();
      expect(emittedBroadcasts.length).toBe(0);
    });

    it('should broadcast ORDER_SHIPPED to conversation and workspace rooms', () => {
      dispatcher.handleOrderShipped({
        workspaceId,
        orderId: 'ord_123',
        orderNumber: 'ORD-123',
        displayId: 101,
        conversationId,
        trackingCode: 'GHTK123456',
        shippingCarrier: 'GHTK',
        shippedAt: new Date().toISOString(),
        order: { id: 'ord_123' },
      });

      const wsBroadcast = emittedBroadcasts.find(
        b => b.room === `workspace_${workspaceId}` && b.event === WsServerEvent.ORDER_SHIPPED,
      );
      assertDefined(wsBroadcast);

      const convBroadcast = emittedBroadcasts.find(
        b => b.room === `conversation_${conversationId}` && b.event === WsServerEvent.ORDER_SHIPPED,
      );
      assertDefined(convBroadcast);
    });
  });
});
