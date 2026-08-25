import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConversationPriority,
  ConversationStatus,
  DeliveryStatus,
  DomainEvent,
  MessageContentType,
  MessageType,
  PresenceStatus,
  SenderType,
  WsServerEvent,
} from '@sales-copilot/shared-contracts';
import { RealtimeEventDispatcher } from '../realtime-event.dispatcher';
import { PresenceService } from '../presence.service';

describe('Realtime Integration (Full End-to-End Event Pipeline — Task 14)', () => {
  let eventEmitter: EventEmitter2;
  let dispatcher: RealtimeEventDispatcher;
  let presenceService: PresenceService;
  let emittedBroadcasts: Array<{ room: string; event: string; payload: unknown }>;
  let mockGateway: any;
  let mockRedis: any;

  // In-memory Redis store
  let redisHashes: Record<string, Record<string, string>>;
  let redisKeys: Record<string, { value: string; ttl: number; setAt: number }>;

  const workspaceId = '11111111-1111-1111-1111-111111111111';
  const conversationId = '22222222-2222-2222-2222-222222222222';
  const messageId = '33333333-3333-3333-3333-333333333333';
  const oldAssigneeId = 'usr_agent_001';
  const newAssigneeId = 'usr_agent_002';

  beforeEach(() => {
    emittedBroadcasts = [];
    redisHashes = {};
    redisKeys = {};

    // 1. Real EventEmitter2 instance
    eventEmitter = new EventEmitter2({ wildcard: true });

    // 2. Mock Gateway capturing broadcasts
    mockGateway = {
      server: {
        to: (room: string) => ({
          emit: (event: string, payload: unknown) => {
            emittedBroadcasts.push({ room, event, payload });
          },
        }),
      },
    };

    // 3. Real RealtimeEventDispatcher connected to gateway
    dispatcher = new RealtimeEventDispatcher(mockGateway);

    // 4. Bind Dispatcher methods to real EventEmitter2 events
    eventEmitter.on(DomainEvent.MESSAGE_CREATED, p => dispatcher.handleMessageCreated(p));
    eventEmitter.on(DomainEvent.MESSAGE_UPDATED, p => dispatcher.handleMessageUpdated(p));
    eventEmitter.on(DomainEvent.MESSAGE_DELETED, p => dispatcher.handleMessageDeleted(p));
    eventEmitter.on(DomainEvent.MESSAGE_DELIVERY_STATUS_UPDATED, p =>
      dispatcher.handleMessageDeliveryStatusUpdated(p),
    );
    eventEmitter.on(DomainEvent.CONVERSATION_CREATED, p => dispatcher.handleConversationCreated(p));
    eventEmitter.on(DomainEvent.CONVERSATION_STATUS_UPDATED, p =>
      dispatcher.handleConversationStatusUpdated(p),
    );
    eventEmitter.on(DomainEvent.CONVERSATION_ASSIGNED, p =>
      dispatcher.handleConversationAssigned(p),
    );
    eventEmitter.on(DomainEvent.CONVERSATION_PRIORITY_UPDATED, p =>
      dispatcher.handleConversationPriorityUpdated(p),
    );
    eventEmitter.on(DomainEvent.CONVERSATION_REOPENED, p =>
      dispatcher.handleConversationReopened(p),
    );
    eventEmitter.on(DomainEvent.CONVERSATION_LABELS_UPDATED, p =>
      dispatcher.handleConversationLabelsUpdated(p),
    );
    eventEmitter.on(DomainEvent.CONTACT_CREATED, p => dispatcher.handleContactCreated(p));
    eventEmitter.on(DomainEvent.CONTACT_UPDATED, p => dispatcher.handleContactUpdated(p));
    eventEmitter.on(DomainEvent.CONTACT_DELETED, p => dispatcher.handleContactDeleted(p));
    eventEmitter.on(DomainEvent.CONTACT_MERGED, p => dispatcher.handleContactMerged(p));
    eventEmitter.on(DomainEvent.CHANNEL_IDENTITY_CREATED, p =>
      dispatcher.handleChannelIdentityCreated(p),
    );
    eventEmitter.on(DomainEvent.CHANNEL_IDENTITY_DELETED, p =>
      dispatcher.handleChannelIdentityDeleted(p),
    );
    eventEmitter.on(DomainEvent.LABEL_CREATED, p => dispatcher.handleLabelCreated(p));
    eventEmitter.on(DomainEvent.LABEL_UPDATED, p => dispatcher.handleLabelUpdated(p));
    eventEmitter.on(DomainEvent.LABEL_DELETED, p => dispatcher.handleLabelDeleted(p));
    eventEmitter.on(DomainEvent.CHANNEL_CREATED, p => dispatcher.handleChannelCreated(p));
    eventEmitter.on(DomainEvent.CHANNEL_UPDATED, p => dispatcher.handleChannelUpdated(p));
    eventEmitter.on(DomainEvent.CHANNEL_DELETED, p => dispatcher.handleChannelDeleted(p));
    eventEmitter.on(DomainEvent.TYPING_START, p => dispatcher.handleTypingStart(p));
    eventEmitter.on(DomainEvent.TYPING_STOP, p => dispatcher.handleTypingStop(p));
    eventEmitter.on(DomainEvent.PRESENCE_UPDATED, p => dispatcher.handlePresenceUpdated(p));

    // 5. Mock Redis Client for PresenceService
    mockRedis = {
      hset: async (key: string, field: string, value: string) => {
        if (!redisHashes[key]) redisHashes[key] = {};
        redisHashes[key][field] = value;
        return 1;
      },
      hget: async (key: string, field: string) => {
        return redisHashes[key]?.[field] || null;
      },
      hdel: async (key: string, ...fields: string[]) => {
        if (!redisHashes[key]) return 0;
        let count = 0;
        for (const f of fields) {
          if (f in redisHashes[key]) {
            delete redisHashes[key][f];
            count++;
          }
        }
        return count;
      },
      hgetall: async (key: string) => {
        return redisHashes[key] || {};
      },
      get: async (key: string) => {
        const item = redisKeys[key];
        if (!item) return null;
        if (item.ttl > 0 && Date.now() - item.setAt > item.ttl * 1000) {
          delete redisKeys[key];
          return null;
        }
        return item.value;
      },
      setex: async (key: string, ttlSeconds: number, value: string) => {
        redisKeys[key] = {
          value,
          ttl: ttlSeconds,
          setAt: Date.now(),
        };
      },
      del: async (keyOrKeys: string | string[]) => {
        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        let count = 0;
        for (const k of keys) {
          if (k in redisKeys) {
            delete redisKeys[k];
            count++;
          }
        }
        return count;
      },
      ttl: async (key: string) => {
        const item = redisKeys[key];
        if (!item) return -2;
        const elapsedSec = Math.floor((Date.now() - item.setAt) / 1000);
        const remaining = item.ttl - elapsedSec;
        return remaining > 0 ? remaining : -2;
      },
      scan: async (pattern: string) => {
        const prefix = pattern.replace('*', '');
        return Object.keys(redisHashes).filter(k => k.startsWith(prefix));
      },
    };

    // 6. Real PresenceService connected to EventEmitter2
    presenceService = new PresenceService(mockRedis, eventEmitter);
  });

  describe('Scenario 1: Message Lifecycle Pipeline', () => {
    it('should route message.created from Domain Event through EventEmitter2 to WebSocket rooms', () => {
      const messagePayload = {
        workspaceId,
        conversationId,
        message: {
          id: messageId,
          conversationId,
          workspaceId,
          senderType: SenderType.USER,
          senderId: oldAssigneeId,
          messageType: MessageType.OUTGOING,
          contentType: MessageContentType.TEXT,
          content: 'Integration message test',
          isPrivate: false,
          deliveryStatus: DeliveryStatus.DELIVERED,
          createdAt: new Date().toISOString(),
        },
      };

      // Service emits domain event
      eventEmitter.emit(DomainEvent.MESSAGE_CREATED, messagePayload);

      // Verify Dispatcher broadcast to conversation room
      const convBroadcasts = emittedBroadcasts.filter(
        e =>
          e.room === `conversation_${conversationId}` && e.event === WsServerEvent.MESSAGE_CREATED,
      );
      assert.strictEqual(convBroadcasts.length, 1);
      assert.deepStrictEqual((convBroadcasts[0].payload as any).data, messagePayload.message);

      // Verify Dispatcher broadcast to workspace room
      const wsBroadcasts = emittedBroadcasts.filter(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.MESSAGE_CREATED,
      );
      assert.strictEqual(wsBroadcasts.length, 1);
    });

    it('should route message.deleted through EventEmitter2 to conversation and workspace rooms', () => {
      eventEmitter.emit(DomainEvent.MESSAGE_DELETED, {
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
    });
  });

  describe('Scenario 2: Conversation Assignment Multi-Room Pipeline', () => {
    it('should fan-out conversation.assigned to workspace, conversation, new assignee, and old assignee rooms', () => {
      const mockConversation: any = {
        id: conversationId,
        workspaceId,
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.HIGH,
      };

      eventEmitter.emit(DomainEvent.CONVERSATION_ASSIGNED, {
        workspaceId,
        conversationId,
        previousAssigneeId: oldAssigneeId,
        newAssigneeId: newAssigneeId,
        teamId: 'team_sales',
        assignedByUserId: 'usr_supervisor',
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

      // 3. New assignee personal notification room
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `user_${newAssigneeId}` && e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      );

      // 4. Old assignee personal notification room
      assert.ok(
        emittedBroadcasts.some(
          e =>
            e.room === `user_${oldAssigneeId}` && e.event === WsServerEvent.CONVERSATION_ASSIGNED,
        ),
      );
    });
  });

  describe('Scenario 3: Contact Merged Pipeline', () => {
    it('should broadcast contact.merged to workspace room', () => {
      eventEmitter.emit(DomainEvent.CONTACT_MERGED, {
        workspaceId,
        primaryContactId: 'cont_primary_1',
        mergedContactId: 'cont_merged_2',
        mergedByUserId: 'usr_admin',
        mergedAttributes: { email: 'merged@example.com' },
      });

      const wsBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.CONTACT_MERGED,
      );
      assert.ok(wsBroadcast);
      assert.deepStrictEqual((wsBroadcast.payload as any).data, {
        primaryContactId: 'cont_primary_1',
        mergedContactId: 'cont_merged_2',
        mergedByUserId: 'usr_admin',
        mergedAttributes: { email: 'merged@example.com' },
      });
    });
  });

  describe('Scenario 4: Presence Service -> EventEmitter2 -> WebSocket Broadcast Pipeline', () => {
    it('should trigger presence.updated broadcast to workspace room when agent connects and goes online', async () => {
      // 1. Agent goes online via PresenceService
      await presenceService.setOnline(workspaceId, newAssigneeId);

      // 2. Verify Redis state
      const userPres = await presenceService.getUserPresence(workspaceId, newAssigneeId);
      assert.strictEqual(userPres?.status, PresenceStatus.ONLINE);

      // 3. Verify WebSocket broadcast was dispatched to workspace room
      const wsPresenceBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.PRESENCE_UPDATED,
      );
      assert.ok(wsPresenceBroadcast);
      assert.strictEqual((wsPresenceBroadcast.payload as any).data.userId, newAssigneeId);
      assert.strictEqual((wsPresenceBroadcast.payload as any).data.status, PresenceStatus.ONLINE);
    });

    it('should trigger presence.updated broadcast when agent goes offline', async () => {
      await presenceService.setOnline(workspaceId, newAssigneeId);
      emittedBroadcasts = [];

      // 1. Agent goes offline
      await presenceService.setOffline(workspaceId, newAssigneeId);

      // 2. Verify Redis state
      const userPres = await presenceService.getUserPresence(workspaceId, newAssigneeId);
      assert.strictEqual(userPres?.status, PresenceStatus.OFFLINE);

      // 3. Verify WebSocket broadcast was dispatched to workspace room
      const wsPresenceBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.PRESENCE_UPDATED,
      );
      assert.ok(wsPresenceBroadcast);
      assert.strictEqual((wsPresenceBroadcast.payload as any).data.status, PresenceStatus.OFFLINE);
    });
  });

  describe('Scenario 5: Scheduled Stale Cleanup -> Realtime Broadcast Pipeline', () => {
    it('should detect expired agent TTL, mark OFFLINE, and broadcast presence update to workspace room', async () => {
      await presenceService.setOnline(workspaceId, oldAssigneeId);
      emittedBroadcasts = [];

      // Expire TTL key in Redis
      await mockRedis.del(`presence:user:${oldAssigneeId}:${workspaceId}`);

      // Cron triggers cleanup
      await presenceService.cleanupStalePresence();

      // Verify WebSocket broadcast received
      const wsPresenceBroadcast = emittedBroadcasts.find(
        e => e.room === `workspace_${workspaceId}` && e.event === WsServerEvent.PRESENCE_UPDATED,
      );
      assert.ok(wsPresenceBroadcast);
      assert.strictEqual((wsPresenceBroadcast.payload as any).data.userId, oldAssigneeId);
      assert.strictEqual((wsPresenceBroadcast.payload as any).data.status, PresenceStatus.OFFLINE);
    });
  });

  describe('Scenario 6: End-to-End Error Isolation', () => {
    it('should ensure gateway socket error never crashes upstream service or event pipeline', async () => {
      mockGateway.server.to = () => {
        throw new Error('Socket.io transport disconnect');
      };

      // 1. Emitting domain event should not throw
      assert.doesNotThrow(() => {
        eventEmitter.emit(DomainEvent.MESSAGE_CREATED, {
          workspaceId,
          conversationId,
          message: { id: messageId },
        });
      });

      // 2. Presence transition should not throw
      await assert.doesNotReject(async () => {
        await presenceService.setOnline(workspaceId, oldAssigneeId);
      });
    });
  });
});
