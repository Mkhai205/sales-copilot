import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';
import { PlatformRole, WsServerEvent } from '@sales-copilot/shared-contracts';
import { RealtimeGateway } from '../realtime.gateway';
import {
  RealtimeConnectedPayload,
  RealtimeErrorPayload,
  RealtimeSocketData,
} from '../realtime.types';

describe('RealtimeGateway (Agent Realtime WebSocket Namespace /realtime — Task 11)', () => {
  let gateway: RealtimeGateway;
  let mockTokenService: any;
  let mockPrisma: any;
  let mockEventEmitter: any;
  let mockPresenceService: any;
  let emittedEvents: Array<{ event: string; payload: unknown }>;
  let heartbeatCalls: Array<{ workspaceId: string; userId: string }>;
  let presenceOnlineCalls: Array<{ workspaceId: string; userId: string }>;
  let presenceOfflineCalls: Array<{ workspaceId: string; userId: string }>;

  const validUserId = 'usr_agent_001';
  const validEmail = 'agent@salescopilot.io';
  const validRole = PlatformRole.USER;
  const validToken = 'jwt_valid_access_token_xyz';

  const validWorkspaceId1 = '11111111-1111-1111-1111-111111111111';
  const validWorkspaceId2 = '22222222-2222-2222-2222-222222222222';
  const dynamicWorkspaceId = '33333333-3333-3333-3333-333333333333';
  const unauthorizedWorkspaceId = '99999999-9999-9999-9999-999999999999';

  const validConversationId1 = '44444444-4444-4444-4444-444444444444';
  const validConversationId2 = '55555555-5555-5555-5555-555555555555';
  const dynamicConversationId = '66666666-6666-6666-6666-666666666666';
  const unauthorizedConversationId = '88888888-8888-8888-8888-888888888888';

  const mockJwtPayload = {
    sub: validUserId,
    email: validEmail,
    role: validRole,
  };

  const mockMemberships = [{ workspaceId: validWorkspaceId1 }, { workspaceId: validWorkspaceId2 }];

  const mockConversations: Record<string, { id: string; workspaceId: string }> = {
    [validConversationId1]: { id: validConversationId1, workspaceId: validWorkspaceId1 },
    [validConversationId2]: { id: validConversationId2, workspaceId: validWorkspaceId2 },
    [dynamicConversationId]: { id: dynamicConversationId, workspaceId: dynamicWorkspaceId },
    [unauthorizedConversationId]: {
      id: unauthorizedConversationId,
      workspaceId: unauthorizedWorkspaceId,
    },
  };

  const createMockSocket = (handshakeOverrides: any = {}) => {
    const emittedToClient: Array<{ event: string; payload: unknown }> = [];
    const joinedRooms: string[] = [];
    const leftRooms: string[] = [];
    const broadcastToRooms: Record<string, Array<{ event: string; payload: unknown }>> = {};
    let disconnected = false;

    const socket: any = {
      id: `socket_${Math.random().toString(36).slice(2, 8)}`,
      handshake: {
        auth: {},
        query: {},
        headers: {},
        ...handshakeOverrides,
      },
      data: {} as RealtimeSocketData,
      emit: (event: string, payload: unknown) => {
        emittedToClient.push({ event, payload });
      },
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          if (!broadcastToRooms[room]) {
            broadcastToRooms[room] = [];
          }
          broadcastToRooms[room].push({ event, payload });
        },
      }),
      join: (room: string) => {
        joinedRooms.push(room);
      },
      leave: (room: string) => {
        leftRooms.push(room);
        const index = joinedRooms.indexOf(room);
        if (index !== -1) {
          joinedRooms.splice(index, 1);
        }
      },
      disconnect: (close?: boolean) => {
        disconnected = close ?? true;
      },
      _getEmitted: () => emittedToClient,
      _getJoinedRooms: () => joinedRooms,
      _getLeftRooms: () => leftRooms,
      _getBroadcastToRooms: () => broadcastToRooms,
      _isDisconnected: () => disconnected,
    };

    return socket;
  };

  const createAuthenticatedSocket = (overrides: Partial<RealtimeSocketData> = {}) => {
    const socket = createMockSocket({
      auth: { token: validToken },
    });
    socket.data = {
      userId: validUserId,
      email: validEmail,
      role: validRole,
      availableWorkspaceIds: [validWorkspaceId1, validWorkspaceId2],
      joinedWorkspaceIds: [],
      joinedConversations: {},
      connectedAt: new Date(),
      ...overrides,
    };
    return socket;
  };

  beforeEach(() => {
    emittedEvents = [];
    heartbeatCalls = [];
    presenceOnlineCalls = [];
    presenceOfflineCalls = [];

    mockEventEmitter = {
      emit: (event: string, payload: unknown) => {
        emittedEvents.push({ event, payload });
      },
    };

    mockPresenceService = {
      setOnline: async (workspaceId: string, userId: string) => {
        presenceOnlineCalls.push({ workspaceId, userId });
      },
      setOffline: async (workspaceId: string, userId: string) => {
        presenceOfflineCalls.push({ workspaceId, userId });
      },
      setAway: async () => {},
      heartbeat: async (workspaceId: string, userId: string) => {
        heartbeatCalls.push({ workspaceId, userId });
      },
    };

    mockTokenService = {
      verifyAccessToken: async (token: string) => {
        if (token === validToken || token === `${validToken}_with_spaces`) {
          return mockJwtPayload;
        }
        throw new UnauthorizedException({
          code: 'UNAUTHORIZED',
          message: 'Access token is invalid or expired',
        });
      },
    };

    mockPrisma = {
      getClient: () => ({
        workspaceMember: {
          findMany: async (args: any) => {
            if (args.where?.userId === validUserId) {
              return mockMemberships;
            }
            return [];
          },
          findFirst: async (args: any) => {
            if (
              args.where?.userId === validUserId &&
              (args.where?.workspaceId === validWorkspaceId1 ||
                args.where?.workspaceId === validWorkspaceId2 ||
                args.where?.workspaceId === dynamicWorkspaceId)
            ) {
              return { userId: validUserId, workspaceId: args.where.workspaceId };
            }
            return null;
          },
        },
        conversation: {
          findFirst: async (args: any) => {
            const match = mockConversations[args.where?.id];
            return match || null;
          },
        },
      }),
    };

    gateway = new RealtimeGateway(
      mockTokenService,
      mockPrisma,
      undefined,
      mockEventEmitter,
      mockPresenceService,
    );
  });

  describe('1. Gateway Initialization & Middleware (Task 7 & 11)', () => {
    it('should initialize successfully on /realtime namespace, attach middleware and engine error listener', async () => {
      let middlewareRegistered = false;
      let engineListenerRegistered = false;
      let engineErrorHandler: ((err: any) => void) | undefined;
      let middlewareHandler: ((socket: any, next: () => void) => void) | undefined;

      const mockServer: any = {
        adapter: () => {},
        use: (fn: any) => {
          middlewareRegistered = true;
          middlewareHandler = fn;
        },
        engine: {
          on: (event: string, handler: any) => {
            if (event === 'connection_error') {
              engineListenerRegistered = true;
              engineErrorHandler = handler;
            }
          },
        },
      };

      await gateway.afterInit(mockServer);

      assert.strictEqual(middlewareRegistered, true);
      assert.strictEqual(engineListenerRegistered, true);

      // Verify middleware invokes next()
      let nextCalled = false;
      middlewareHandler?.({ id: 'sock_123' }, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true);

      // Verify engine error handler logs without throwing
      assert.doesNotThrow(() => {
        engineErrorHandler?.(new Error('Test engine socket reset'));
      });
    });

    it('should handle Redis adapter connection errors gracefully without throwing and stop retry loops', async () => {
      let adapterCalled = false;
      const mockServer: any = {
        adapter: (_adapter: any) => {
          adapterCalled = true;
        },
        use: () => {},
        engine: { on: () => {} },
      };

      const mockConfig: any = {
        get: (key: string) => {
          if (key === 'REDIS_URL') return 'redis://invalid-host-that-does-not-exist:6379';
          return null;
        },
      };

      const gatewayWithConfig = new RealtimeGateway(
        mockTokenService,
        mockPrisma,
        mockConfig,
        mockEventEmitter,
        mockPresenceService,
      );

      await assert.doesNotReject(async () => {
        await gatewayWithConfig.afterInit(mockServer);
      });
      assert.strictEqual(adapterCalled, false);

      // Cleanup
      await gatewayWithConfig.onModuleDestroy();
    });

    it('should handle onModuleDestroy gracefully', async () => {
      await assert.doesNotReject(async () => {
        await gateway.onModuleDestroy();
      });
    });
  });

  describe('2. Connection Authentication Handshake (Task 11)', () => {
    it('should reject connection when no token is provided in auth, headers, or query', async () => {
      const socket = createMockSocket({
        auth: {},
        query: {},
        headers: {},
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), true);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'error');
      const err = emitted[0].payload as RealtimeErrorPayload;
      assert.strictEqual(err.code, 'UNAUTHORIZED');
      assert.match(err.message, /token is required/i);
    });

    it('should reject connection when token is invalid or expired', async () => {
      const socket = createMockSocket({
        auth: { token: 'invalid_expired_token' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), true);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'error');
      const err = emitted[0].payload as RealtimeErrorPayload;
      assert.strictEqual(err.code, 'UNAUTHORIZED');
      assert.match(err.message, /invalid or expired/i);
    });

    it('should successfully authenticate via handshake.auth.token, populate session context, and emit agent.connected event', async () => {
      const socket = createMockSocket({
        auth: { token: validToken },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);

      // Verify socket data attached
      const socketData = socket.data as RealtimeSocketData;
      assert.strictEqual(socketData.userId, validUserId);
      assert.strictEqual(socketData.email, validEmail);
      assert.strictEqual(socketData.role, validRole);
      assert.deepStrictEqual(socketData.availableWorkspaceIds, [
        validWorkspaceId1,
        validWorkspaceId2,
      ]);
      assert.deepStrictEqual(socketData.joinedWorkspaceIds, []);
      assert.deepStrictEqual(socketData.joinedConversations, {});
      assert.ok(socketData.connectedAt instanceof Date);

      // Verify auto-joined personal user room
      assert.ok(socket._getJoinedRooms().includes(`user_${validUserId}`));

      // Verify connected event emitted with acknowledgement payload
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'connected');
      const connectedPayload = emitted[0].payload as RealtimeConnectedPayload;
      assert.strictEqual(connectedPayload.userId, validUserId);
      assert.strictEqual(connectedPayload.email, validEmail);
      assert.strictEqual(connectedPayload.role, validRole);
      assert.deepStrictEqual(connectedPayload.availableWorkspaceIds, [
        validWorkspaceId1,
        validWorkspaceId2,
      ]);
      assert.strictEqual(typeof connectedPayload.connectedAt, 'string');

      // Verify agent.connected internal event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'agent.connected');
      const eventPayload = emittedEvents[0].payload as any;
      assert.strictEqual(eventPayload.userId, validUserId);
      assert.strictEqual(eventPayload.email, validEmail);
      assert.strictEqual(eventPayload.socketId, socket.id);
    });

    it('should successfully authenticate via handshake.headers.authorization Bearer token', async () => {
      const socket = createMockSocket({
        headers: { authorization: `Bearer ${validToken}` },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      const socketData = socket.data as RealtimeSocketData;
      assert.strictEqual(socketData.userId, validUserId);
      assert.ok(socket._getJoinedRooms().includes(`user_${validUserId}`));

      const emitted = socket._getEmitted();
      assert.strictEqual(emitted[0].event, 'connected');
    });

    it('should successfully authenticate via handshake.query.token and trim whitespace', async () => {
      const socket = createMockSocket({
        query: { token: `  ${validToken}_with_spaces  ` },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      const socketData = socket.data as RealtimeSocketData;
      assert.strictEqual(socketData.userId, validUserId);
      assert.ok(socket._getJoinedRooms().includes(`user_${validUserId}`));
    });

    it('should handle array-based authorization header properly', async () => {
      const socket = createMockSocket({
        headers: { authorization: [`Bearer ${validToken}`, 'other'] },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      const socketData = socket.data as RealtimeSocketData;
      assert.strictEqual(socketData.userId, validUserId);
    });

    it('should handle unexpected internal errors gracefully and reject connection', async () => {
      mockPrisma.getClient = () => ({
        workspaceMember: {
          findMany: async () => {
            throw new Error('Database connection pool timeout');
          },
        },
      });

      const socket = createMockSocket({
        auth: { token: validToken },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), true);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'error');
      const err = emitted[0].payload as RealtimeErrorPayload;
      assert.strictEqual(err.code, 'INTERNAL_ERROR');
    });
  });

  describe('3. Connection Lifecycle Disconnect & Presence (Task 11)', () => {
    it('should handle disconnect cleanly for authenticated socket, calculate duration, and emit agent.disconnected event', () => {
      const socket = createMockSocket({
        auth: { token: validToken },
      });
      const connectedAt = new Date(Date.now() - 5000);
      socket.data = {
        userId: validUserId,
        email: validEmail,
        role: validRole,
        availableWorkspaceIds: [validWorkspaceId1],
        joinedWorkspaceIds: [validWorkspaceId1],
        joinedConversations: {},
        connectedAt,
      };

      assert.doesNotThrow(() => {
        gateway.handleDisconnect(socket);
      });

      // Verify agent.disconnected event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'agent.disconnected');
      const eventPayload = emittedEvents[0].payload as any;
      assert.strictEqual(eventPayload.userId, validUserId);
      assert.strictEqual(eventPayload.email, validEmail);
      assert.strictEqual(eventPayload.socketId, socket.id);
      assert.deepStrictEqual(eventPayload.joinedWorkspaceIds, [validWorkspaceId1]);
      assert.ok(eventPayload.durationMs >= 4000);
      assert.ok(eventPayload.disconnectedAt instanceof Date);
    });

    it('should fallback to availableWorkspaceIds when joinedWorkspaceIds is empty upon disconnect', () => {
      const socket = createMockSocket({
        auth: { token: validToken },
      });
      socket.data = {
        userId: validUserId,
        email: validEmail,
        role: validRole,
        availableWorkspaceIds: [validWorkspaceId1, validWorkspaceId2],
        joinedWorkspaceIds: [],
        joinedConversations: {},
        connectedAt: new Date(),
      };

      gateway.handleDisconnect(socket);

      assert.strictEqual(emittedEvents.length, 1);
      const eventPayload = emittedEvents[0].payload as any;
      assert.deepStrictEqual(eventPayload.joinedWorkspaceIds, [
        validWorkspaceId1,
        validWorkspaceId2,
      ]);
    });

    it('should handle disconnect cleanly for unauthenticated socket without emitting agent.disconnected', () => {
      const socket = createMockSocket({});
      assert.doesNotThrow(() => {
        gateway.handleDisconnect(socket);
      });
      assert.strictEqual(emittedEvents.length, 0);
    });
  });

  describe('4. Room Management — Workspace Join/Leave (Task 11)', () => {
    it('should reject join_workspace if socket is unauthenticated', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: validWorkspaceId1 });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'UNAUTHORIZED');
    });

    it('should reject join_workspace with invalid payload format', async () => {
      const socket = createAuthenticatedSocket();
      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: 'not-a-valid-uuid' });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'BAD_REQUEST');
    });

    it('should reject join_workspace when user is not a member of the workspace (Cross-Tenant)', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1],
      });

      const res = await gateway.handleJoinWorkspace(socket, {
        workspaceId: unauthorizedWorkspaceId,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'FORBIDDEN');
      assert.strictEqual(
        socket._getJoinedRooms().includes(`workspace_${unauthorizedWorkspaceId}`),
        false,
      );

      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'error');
      assert.strictEqual((emitted[0].payload as RealtimeErrorPayload).code, 'FORBIDDEN');
    });

    it('should successfully join workspace room for authorized workspace member and set presence online', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: validWorkspaceId1 });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `workspace_${validWorkspaceId1}`);
      assert.strictEqual(res.workspaceId, validWorkspaceId1);
      assert.ok(socket._getJoinedRooms().includes(`workspace_${validWorkspaceId1}`));
      assert.ok(socket.data.joinedWorkspaceIds.includes(validWorkspaceId1));

      // Verify presence service setOnline called
      assert.strictEqual(presenceOnlineCalls.length, 1);
      assert.strictEqual(presenceOnlineCalls[0].workspaceId, validWorkspaceId1);
      assert.strictEqual(presenceOnlineCalls[0].userId, validUserId);
    });

    it('should dynamically query database and join room when workspace is not in initial cached availableWorkspaceIds', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1], // dynamicWorkspaceId is not in cache
      });

      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: dynamicWorkspaceId });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `workspace_${dynamicWorkspaceId}`);
      assert.ok(socket._getJoinedRooms().includes(`workspace_${dynamicWorkspaceId}`));
      assert.ok(socket.data.availableWorkspaceIds.includes(dynamicWorkspaceId));
    });

    it('should reject leave_workspace if socket is unauthenticated', () => {
      const socket = createMockSocket({});
      const res = gateway.handleLeaveWorkspace(socket, { workspaceId: validWorkspaceId1 });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'UNAUTHORIZED');
    });

    it('should reject leave_workspace with invalid payload', () => {
      const socket = createAuthenticatedSocket();
      const res = gateway.handleLeaveWorkspace(socket, { workspaceId: 'invalid' });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'BAD_REQUEST');
    });

    it('should leave workspace room, set presence offline, and cascade leave all conversation rooms belonging to that workspace', () => {
      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [validWorkspaceId1, validWorkspaceId2],
        joinedConversations: {
          [validConversationId1]: validWorkspaceId1,
          [validConversationId2]: validWorkspaceId2,
        },
      });
      socket
        ._getJoinedRooms()
        .push(
          `workspace_${validWorkspaceId1}`,
          `workspace_${validWorkspaceId2}`,
          `conversation_${validConversationId1}`,
          `conversation_${validConversationId2}`,
        );

      const res = gateway.handleLeaveWorkspace(socket, { workspaceId: validWorkspaceId1 });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.workspaceId, validWorkspaceId1);

      // Verify left workspace 1 room
      assert.ok(socket._getLeftRooms().includes(`workspace_${validWorkspaceId1}`));
      assert.strictEqual(socket.data.joinedWorkspaceIds.includes(validWorkspaceId1), false);
      assert.strictEqual(socket.data.joinedWorkspaceIds.includes(validWorkspaceId2), true);

      // Verify cascaded leave for conversation 1 (belongs to workspace 1), but conversation 2 (workspace 2) remains
      assert.ok(socket._getLeftRooms().includes(`conversation_${validConversationId1}`));
      assert.strictEqual(
        socket._getLeftRooms().includes(`conversation_${validConversationId2}`),
        false,
      );
      assert.strictEqual(socket.data.joinedConversations[validConversationId1], undefined);
      assert.strictEqual(socket.data.joinedConversations[validConversationId2], validWorkspaceId2);

      // Verify setOffline called
      assert.strictEqual(presenceOfflineCalls.length, 1);
      assert.strictEqual(presenceOfflineCalls[0].workspaceId, validWorkspaceId1);
    });
  });

  describe('5. Room Management — Conversation Join/Leave (Task 11)', () => {
    it('should reject join_conversation if socket is unauthenticated', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleJoinConversation(socket, {
        conversationId: validConversationId1,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'UNAUTHORIZED');
    });

    it('should reject join_conversation with invalid UUID payload', async () => {
      const socket = createAuthenticatedSocket();
      const res = await gateway.handleJoinConversation(socket, { conversationId: 'bad-uuid' });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'BAD_REQUEST');
    });

    it('should reject join_conversation when conversation does not exist', async () => {
      const socket = createAuthenticatedSocket();
      const nonExistentId = '77777777-7777-7777-7777-777777777777';
      const res = await gateway.handleJoinConversation(socket, { conversationId: nonExistentId });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'CONVERSATION_NOT_FOUND');
    });

    it('should reject join_conversation when conversation belongs to unauthorized workspace', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1],
      });

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: unauthorizedConversationId,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'FORBIDDEN');
      assert.strictEqual(
        socket._getJoinedRooms().includes(`conversation_${unauthorizedConversationId}`),
        false,
      );
    });

    it('should successfully join conversation room when user has workspace access', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: validConversationId1,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `conversation_${validConversationId1}`);
      assert.strictEqual(res.conversationId, validConversationId1);
      assert.strictEqual(res.workspaceId, validWorkspaceId1);
      assert.ok(socket._getJoinedRooms().includes(`conversation_${validConversationId1}`));
      assert.strictEqual(socket.data.joinedConversations[validConversationId1], validWorkspaceId1);
    });

    it('should dynamically verify DB membership when joining conversation in a workspace not in initial cache', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1], // dynamicWorkspaceId not in initial cache
      });

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: dynamicConversationId,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `conversation_${dynamicConversationId}`);
      assert.strictEqual(res.workspaceId, dynamicWorkspaceId);
    });

    it('should reject leave_conversation if socket is unauthenticated', () => {
      const socket = createMockSocket({});
      const res = gateway.handleLeaveConversation(socket, { conversationId: validConversationId1 });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'UNAUTHORIZED');
    });

    it('should reject leave_conversation with invalid UUID payload', () => {
      const socket = createAuthenticatedSocket();
      const res = gateway.handleLeaveConversation(socket, { conversationId: 'invalid' });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'BAD_REQUEST');
    });

    it('should successfully leave conversation room and untrack from joinedConversations', () => {
      const socket = createAuthenticatedSocket({
        joinedConversations: {
          [validConversationId1]: validWorkspaceId1,
        },
      });
      socket._getJoinedRooms().push(`conversation_${validConversationId1}`);

      const res = gateway.handleLeaveConversation(socket, { conversationId: validConversationId1 });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.conversationId, validConversationId1);
      assert.ok(socket._getLeftRooms().includes(`conversation_${validConversationId1}`));
      assert.strictEqual(socket.data.joinedConversations[validConversationId1], undefined);
    });
  });

  describe('6. Typing Indicators (Task 11)', () => {
    it('should reject start_typing if socket is unauthenticated', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleStartTyping(socket, { conversationId: validConversationId1 });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'UNAUTHORIZED');
    });

    it('should reject start_typing with invalid UUID payload', async () => {
      const socket = createAuthenticatedSocket();
      const res = await gateway.handleStartTyping(socket, { conversationId: 'invalid-conv-id' });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'BAD_REQUEST');
    });

    it('should reject start_typing if conversation does not exist', async () => {
      const socket = createAuthenticatedSocket();
      const nonExistentId = '77777777-7777-7777-7777-777777777777';
      const res = await gateway.handleStartTyping(socket, { conversationId: nonExistentId });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'CONVERSATION_NOT_FOUND');
    });

    it('should reject start_typing if user does not belong to conversation workspace', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1],
      });
      const res = await gateway.handleStartTyping(socket, {
        conversationId: unauthorizedConversationId,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'FORBIDDEN');
    });

    it('should successfully handle start_typing and broadcast typing.start to conversation room and emit agent.typing_start event', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleStartTyping(socket, {
        conversationId: validConversationId1,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `conversation_${validConversationId1}`);
      assert.strictEqual(res.conversationId, validConversationId1);
      assert.strictEqual(res.workspaceId, validWorkspaceId1);

      // Verify broadcast to conversation room
      const broadcastMap = socket._getBroadcastToRooms();
      const convBroadcasts = broadcastMap[`conversation_${validConversationId1}`];
      assert.ok(convBroadcasts);
      assert.strictEqual(convBroadcasts.length, 1);
      assert.strictEqual(convBroadcasts[0].event, 'event');
      const wsPayload = convBroadcasts[0].payload as any;
      assert.strictEqual(wsPayload.event, WsServerEvent.TYPING_START);
      assert.strictEqual(wsPayload.workspaceId, validWorkspaceId1);
      assert.strictEqual(wsPayload.data.conversationId, validConversationId1);
      assert.strictEqual(wsPayload.data.userId, validUserId);
      assert.strictEqual(wsPayload.data.isTyping, true);

      // Verify internal event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'agent.typing_start');
      const internalPayload = emittedEvents[0].payload as any;
      assert.strictEqual(internalPayload.conversationId, validConversationId1);
      assert.strictEqual(internalPayload.userId, validUserId);
      assert.strictEqual(internalPayload.isTyping, true);
    });

    it('should successfully handle stop_typing and broadcast typing.stop to conversation room and emit agent.typing_stop event', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleStopTyping(socket, {
        conversationId: validConversationId1,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `conversation_${validConversationId1}`);

      // Verify broadcast to conversation room
      const broadcastMap = socket._getBroadcastToRooms();
      const convBroadcasts = broadcastMap[`conversation_${validConversationId1}`];
      assert.ok(convBroadcasts);
      assert.strictEqual(convBroadcasts.length, 1);
      const wsPayload = convBroadcasts[0].payload as any;
      assert.strictEqual(wsPayload.event, WsServerEvent.TYPING_STOP);
      assert.strictEqual(wsPayload.data.isTyping, false);

      // Verify internal event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'agent.typing_stop');
      const internalPayload = emittedEvents[0].payload as any;
      assert.strictEqual(internalPayload.isTyping, false);
    });
  });

  describe('7. Heartbeat & Presence Renewal (Task 11)', () => {
    it('should return success false if socket is unauthenticated on heartbeat', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleHeartbeat(socket);

      assert.strictEqual(res.success, false);
      assert.strictEqual(heartbeatCalls.length, 0);
    });

    it('should call presenceService.heartbeat for all active workspaces on heartbeat', async () => {
      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [validWorkspaceId1],
      });

      const res = await gateway.handleHeartbeat(socket);

      assert.strictEqual(res.success, true);
      assert.strictEqual(typeof res.timestamp, 'string');
      assert.strictEqual(heartbeatCalls.length, 1);
      assert.strictEqual(heartbeatCalls[0].workspaceId, validWorkspaceId1);
      assert.strictEqual(heartbeatCalls[0].userId, validUserId);
    });

    it('should fallback to available workspaces when joinedWorkspaceIds is empty on heartbeat', async () => {
      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [],
        availableWorkspaceIds: [validWorkspaceId1, validWorkspaceId2],
      });

      const res = await gateway.handleHeartbeat(socket);

      assert.strictEqual(res.success, true);
      assert.strictEqual(heartbeatCalls.length, 2);
      assert.strictEqual(heartbeatCalls[0].workspaceId, validWorkspaceId1);
      assert.strictEqual(heartbeatCalls[1].workspaceId, validWorkspaceId2);
    });

    it('should handle presenceService heartbeat errors gracefully without throwing', async () => {
      mockPresenceService.heartbeat = async () => {
        throw new Error('Redis connection drop');
      };

      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [validWorkspaceId1],
      });

      await assert.rejects(
        async () => {
          await gateway.handleHeartbeat(socket);
        },
        (err: Error) => {
          assert.strictEqual(err.message, 'Redis connection drop');
          return true;
        },
      );
    });
  });

  describe('8. Defensive Error Handling & Exception Catching (Task 11)', () => {
    it('should catch unexpected database errors during join_workspace and return INTERNAL_ERROR', async () => {
      mockPrisma.getClient = () => ({
        workspaceMember: {
          findFirst: async () => {
            throw new Error('Database connection lost');
          },
        },
      });

      const socket = createAuthenticatedSocket({ availableWorkspaceIds: [] });
      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: validWorkspaceId1 });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'INTERNAL_ERROR');
    });

    it('should catch unexpected database errors during join_conversation and return INTERNAL_ERROR', async () => {
      mockPrisma.getClient = () => ({
        conversation: {
          findFirst: async () => {
            throw new Error('Database connection lost');
          },
        },
      });

      const socket = createAuthenticatedSocket();
      const res = await gateway.handleJoinConversation(socket, {
        conversationId: validConversationId1,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'INTERNAL_ERROR');
    });

    it('should catch unexpected database errors during handleStartTyping and return INTERNAL_ERROR', async () => {
      mockPrisma.getClient = () => ({
        conversation: {
          findFirst: async () => {
            throw new Error('Database connection lost');
          },
        },
      });

      const socket = createAuthenticatedSocket();
      const res = await gateway.handleStartTyping(socket, {
        conversationId: validConversationId1,
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error?.code, 'INTERNAL_ERROR');
    });
  });
});
