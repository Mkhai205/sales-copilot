import { expectReject } from '../../../../test/test-assertions';
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
  let mockCommercePresenceService: any;
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
  const suspendedWorkspaceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const suspendedConversationId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

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
    [suspendedConversationId]: {
      id: suspendedConversationId,
      workspaceId: suspendedWorkspaceId,
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
            if (!match) return null;
            return {
              ...match,
              workspace: {
                isSuspended: match.workspaceId === suspendedWorkspaceId,
                suspendedReason:
                  match.workspaceId === suspendedWorkspaceId ? 'Payment overdue' : null,
              },
            };
          },
        },
        workspace: {
          findUnique: async (args: any) => {
            if (args.where?.id === suspendedWorkspaceId) {
              return { isSuspended: true, suspendedReason: 'Account suspended by platform admin' };
            }
            return { isSuspended: false, suspendedReason: null };
          },
        },
      }),
    };

    mockCommercePresenceService = {
      startEditing: jest.fn().mockResolvedValue({
        success: true,
        isLocked: false,
        remainingTtlSeconds: 30,
      }),
      refreshHeartbeat: jest.fn().mockResolvedValue({
        success: true,
        remainingTtlSeconds: 30,
      }),
      stopEditing: jest.fn().mockResolvedValue(true),
      takeoverEditing: jest.fn().mockResolvedValue({
        success: true,
        remainingTtlSeconds: 30,
      }),
      getEditingStatus: jest.fn().mockResolvedValue({
        isLocked: false,
        lockedBy: null,
        remainingTtlSeconds: 0,
      }),
      cleanupUserLocks: jest
        .fn()
        .mockResolvedValue([
          { workspaceId: validWorkspaceId1, conversationId: validConversationId1 },
        ]),
    };

    gateway = new RealtimeGateway(
      mockTokenService,
      mockPrisma,
      undefined,
      mockEventEmitter,
      mockPresenceService,
      undefined,
      mockCommercePresenceService,
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

      expect(middlewareRegistered).toBe(true);
      expect(engineListenerRegistered).toBe(true);

      // Verify middleware invokes next()
      let nextCalled = false;
      middlewareHandler?.({ id: 'sock_123' }, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);

      // Verify engine error handler logs without throwing
      expect(() => {
        engineErrorHandler?.(new Error('Test engine socket reset'));
      }).not.toThrow();
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

      await await expect(async () => {
        await gatewayWithConfig.afterInit(mockServer);
      }).resolves.not.toThrow();
      expect(adapterCalled).toBe(false);

      // Cleanup
      await gatewayWithConfig.onModuleDestroy();
    });

    it('should handle onModuleDestroy gracefully', async () => {
      await await expect(async () => {
        await gateway.onModuleDestroy();
      }).resolves.not.toThrow();
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

      expect(socket._isDisconnected()).toBe(true);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('error');
      const err = emitted[0].payload as RealtimeErrorPayload;
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toMatch(/token is required/i);
    });

    it('should reject connection when token is invalid or expired', async () => {
      const socket = createMockSocket({
        auth: { token: 'invalid_expired_token' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(true);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('error');
      const err = emitted[0].payload as RealtimeErrorPayload;
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toMatch(/invalid or expired/i);
    });

    it('should successfully authenticate via handshake.auth.token, populate session context, and emit agent.connected event', async () => {
      const socket = createMockSocket({
        auth: { token: validToken },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);

      // Verify socket data attached
      const socketData = socket.data as RealtimeSocketData;
      expect(socketData.userId).toBe(validUserId);
      expect(socketData.email).toBe(validEmail);
      expect(socketData.role).toBe(validRole);
      expect(socketData.availableWorkspaceIds).toEqual([validWorkspaceId1, validWorkspaceId2]);
      expect(socketData.joinedWorkspaceIds).toEqual([]);
      expect(socketData.joinedConversations).toEqual({});
      expect(socketData.connectedAt instanceof Date).toBeTruthy();

      // Verify auto-joined personal user room
      expect(socket._getJoinedRooms().includes(`user_${validUserId}`)).toBeTruthy();

      // Verify connected event emitted with acknowledgement payload
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('connected');
      const connectedPayload = emitted[0].payload as RealtimeConnectedPayload;
      expect(connectedPayload.userId).toBe(validUserId);
      expect(connectedPayload.email).toBe(validEmail);
      expect(connectedPayload.role).toBe(validRole);
      expect(connectedPayload.availableWorkspaceIds).toEqual([
        validWorkspaceId1,
        validWorkspaceId2,
      ]);
      expect(typeof connectedPayload.connectedAt).toBe('string');

      // Verify agent.connected internal event emitted
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('agent.connected');
      const eventPayload = emittedEvents[0].payload as any;
      expect(eventPayload.userId).toBe(validUserId);
      expect(eventPayload.email).toBe(validEmail);
      expect(eventPayload.socketId).toBe(socket.id);
    });

    it('should successfully authenticate via handshake.headers.authorization Bearer token', async () => {
      const socket = createMockSocket({
        headers: { authorization: `Bearer ${validToken}` },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      const socketData = socket.data as RealtimeSocketData;
      expect(socketData.userId).toBe(validUserId);
      expect(socket._getJoinedRooms().includes(`user_${validUserId}`)).toBeTruthy();

      const emitted = socket._getEmitted();
      expect(emitted[0].event).toBe('connected');
    });

    it('should successfully authenticate via handshake.query.token and trim whitespace', async () => {
      const socket = createMockSocket({
        query: { token: `  ${validToken}_with_spaces  ` },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      const socketData = socket.data as RealtimeSocketData;
      expect(socketData.userId).toBe(validUserId);
      expect(socket._getJoinedRooms().includes(`user_${validUserId}`)).toBeTruthy();
    });

    it('should handle array-based authorization header properly', async () => {
      const socket = createMockSocket({
        headers: { authorization: [`Bearer ${validToken}`, 'other'] },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      const socketData = socket.data as RealtimeSocketData;
      expect(socketData.userId).toBe(validUserId);
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

      expect(socket._isDisconnected()).toBe(true);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('error');
      const err = emitted[0].payload as RealtimeErrorPayload;
      expect(err.code).toBe('INTERNAL_ERROR');
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

      expect(() => {
        gateway.handleDisconnect(socket);
      }).not.toThrow();

      // Verify agent.disconnected event emitted
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('agent.disconnected');
      const eventPayload = emittedEvents[0].payload as any;
      expect(eventPayload.userId).toBe(validUserId);
      expect(eventPayload.email).toBe(validEmail);
      expect(eventPayload.socketId).toBe(socket.id);
      expect(eventPayload.joinedWorkspaceIds).toEqual([validWorkspaceId1]);
      expect(eventPayload.durationMs >= 4000).toBeTruthy();
      expect(eventPayload.disconnectedAt instanceof Date).toBeTruthy();
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

      expect(emittedEvents.length).toBe(1);
      const eventPayload = emittedEvents[0].payload as any;
      expect(eventPayload.joinedWorkspaceIds).toEqual([validWorkspaceId1, validWorkspaceId2]);
    });

    it('should handle disconnect cleanly for unauthenticated socket without emitting agent.disconnected', () => {
      const socket = createMockSocket({});
      expect(() => {
        gateway.handleDisconnect(socket);
      }).not.toThrow();
      expect(emittedEvents.length).toBe(0);
    });
  });

  describe('4. Room Management — Workspace Join/Leave (Task 11)', () => {
    it('should reject join_workspace if socket is unauthenticated', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: validWorkspaceId1 });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject join_workspace with invalid payload format', async () => {
      const socket = createAuthenticatedSocket();
      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: 'not-a-valid-uuid' });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('BAD_REQUEST');
    });

    it('should reject join_workspace when user is not a member of the workspace (Cross-Tenant)', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1],
      });

      const res = await gateway.handleJoinWorkspace(socket, {
        workspaceId: unauthorizedWorkspaceId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('FORBIDDEN');
      expect(socket._getJoinedRooms().includes(`workspace_${unauthorizedWorkspaceId}`)).toBe(false);

      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('error');
      expect((emitted[0].payload as RealtimeErrorPayload).code).toBe('FORBIDDEN');
    });

    it('should successfully join workspace room for authorized workspace member and set presence online', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: validWorkspaceId1 });

      expect(res.success).toBe(true);
      expect(res.room).toBe(`workspace_${validWorkspaceId1}`);
      expect(res.workspaceId).toBe(validWorkspaceId1);
      expect(socket._getJoinedRooms().includes(`workspace_${validWorkspaceId1}`)).toBeTruthy();
      expect(socket.data.joinedWorkspaceIds.includes(validWorkspaceId1)).toBeTruthy();

      // Verify presence service setOnline called
      expect(presenceOnlineCalls.length).toBe(1);
      expect(presenceOnlineCalls[0].workspaceId).toBe(validWorkspaceId1);
      expect(presenceOnlineCalls[0].userId).toBe(validUserId);
    });

    it('should dynamically query database and join room when workspace is not in initial cached availableWorkspaceIds', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1], // dynamicWorkspaceId is not in cache
      });

      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: dynamicWorkspaceId });

      expect(res.success).toBe(true);
      expect(res.room).toBe(`workspace_${dynamicWorkspaceId}`);
      expect(socket._getJoinedRooms().includes(`workspace_${dynamicWorkspaceId}`)).toBeTruthy();
      expect(socket.data.availableWorkspaceIds.includes(dynamicWorkspaceId)).toBeTruthy();
    });

    it('should reject join_workspace when workspace is suspended', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [suspendedWorkspaceId],
      });

      const res = await gateway.handleJoinWorkspace(socket, {
        workspaceId: suspendedWorkspaceId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('WORKSPACE_SUSPENDED');
      expect(res.error?.message).toBe('Account suspended by platform admin');
      expect(socket._getJoinedRooms().includes(`workspace_${suspendedWorkspaceId}`)).toBe(false);
    });

    it('should handle workspace.suspended event by broadcasting and evicting room sockets', async () => {
      let emittedEvent: any = null;
      let socketsLeftRoom: string | null = null;
      const testRoom = 'workspace_suspended_ws_001';

      (gateway as any).server = {
        to: (room: string) => ({
          emit: (event: string, payload: any) => {
            emittedEvent = { room, event, payload };
          },
        }),
        in: (_room: string) => ({
          socketsLeave: (r: string) => {
            socketsLeftRoom = r;
          },
          fetchSockets: async () => [],
        }),
      };

      await gateway.handleWorkspaceSuspended({
        workspaceId: 'suspended_ws_001',
        reason: 'Terms violation',
      });

      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent.room).toBe(testRoom);
      expect(emittedEvent.payload.event).toBe('workspace_suspended');
      expect(emittedEvent.payload.data.reason).toBe('Terms violation');
      expect(socketsLeftRoom).toBe(testRoom);
    });

    it('should reject leave_workspace if socket is unauthenticated', () => {
      const socket = createMockSocket({});
      const res = gateway.handleLeaveWorkspace(socket, { workspaceId: validWorkspaceId1 });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject leave_workspace with invalid payload', () => {
      const socket = createAuthenticatedSocket();
      const res = gateway.handleLeaveWorkspace(socket, { workspaceId: 'invalid' });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('BAD_REQUEST');
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

      expect(res.success).toBe(true);
      expect(res.workspaceId).toBe(validWorkspaceId1);

      // Verify left workspace 1 room
      expect(socket._getLeftRooms().includes(`workspace_${validWorkspaceId1}`)).toBeTruthy();
      expect(socket.data.joinedWorkspaceIds.includes(validWorkspaceId1)).toBe(false);
      expect(socket.data.joinedWorkspaceIds.includes(validWorkspaceId2)).toBe(true);

      // Verify cascaded leave for conversation 1 (belongs to workspace 1), but conversation 2 (workspace 2) remains
      expect(socket._getLeftRooms().includes(`conversation_${validConversationId1}`)).toBeTruthy();
      expect(socket._getLeftRooms().includes(`conversation_${validConversationId2}`)).toBe(false);
      expect(socket.data.joinedConversations[validConversationId1]).toBe(undefined);
      expect(socket.data.joinedConversations[validConversationId2]).toBe(validWorkspaceId2);

      // Verify setOffline called
      expect(presenceOfflineCalls.length).toBe(1);
      expect(presenceOfflineCalls[0].workspaceId).toBe(validWorkspaceId1);
    });
  });

  describe('5. Room Management — Conversation Join/Leave (Task 11)', () => {
    it('should reject join_conversation if socket is unauthenticated', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleJoinConversation(socket, {
        conversationId: validConversationId1,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject join_conversation with invalid UUID payload', async () => {
      const socket = createAuthenticatedSocket();
      const res = await gateway.handleJoinConversation(socket, { conversationId: 'bad-uuid' });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('BAD_REQUEST');
    });

    it('should reject join_conversation when conversation does not exist', async () => {
      const socket = createAuthenticatedSocket();
      const nonExistentId = '77777777-7777-7777-7777-777777777777';
      const res = await gateway.handleJoinConversation(socket, { conversationId: nonExistentId });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('should reject join_conversation when conversation belongs to unauthorized workspace', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1],
      });

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: unauthorizedConversationId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('FORBIDDEN');
      expect(socket._getJoinedRooms().includes(`conversation_${unauthorizedConversationId}`)).toBe(
        false,
      );
    });

    it('should successfully join conversation room when user has workspace access', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: validConversationId1,
      });

      expect(res.success).toBe(true);
      expect(res.room).toBe(`conversation_${validConversationId1}`);
      expect(res.conversationId).toBe(validConversationId1);
      expect(res.workspaceId).toBe(validWorkspaceId1);
      expect(
        socket._getJoinedRooms().includes(`conversation_${validConversationId1}`),
      ).toBeTruthy();
      expect(socket.data.joinedConversations[validConversationId1]).toBe(validWorkspaceId1);
    });

    it('should dynamically verify DB membership when joining conversation in a workspace not in initial cache', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1], // dynamicWorkspaceId not in initial cache
      });

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: dynamicConversationId,
      });

      expect(res.success).toBe(true);
      expect(res.room).toBe(`conversation_${dynamicConversationId}`);
      expect(res.workspaceId).toBe(dynamicWorkspaceId);
    });

    it('should reject join_conversation when workspace of conversation is suspended', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [suspendedWorkspaceId],
      });

      const res = await gateway.handleJoinConversation(socket, {
        conversationId: suspendedConversationId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('WORKSPACE_SUSPENDED');
      expect(res.error?.message).toBe('Payment overdue');
      expect(socket._getJoinedRooms().includes(`conversation_${suspendedConversationId}`)).toBe(
        false,
      );
    });

    it('should reject leave_conversation if socket is unauthenticated', () => {
      const socket = createMockSocket({});
      const res = gateway.handleLeaveConversation(socket, { conversationId: validConversationId1 });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject leave_conversation with invalid UUID payload', () => {
      const socket = createAuthenticatedSocket();
      const res = gateway.handleLeaveConversation(socket, { conversationId: 'invalid' });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('BAD_REQUEST');
    });

    it('should successfully leave conversation room and untrack from joinedConversations', () => {
      const socket = createAuthenticatedSocket({
        joinedConversations: {
          [validConversationId1]: validWorkspaceId1,
        },
      });
      socket._getJoinedRooms().push(`conversation_${validConversationId1}`);

      const res = gateway.handleLeaveConversation(socket, { conversationId: validConversationId1 });

      expect(res.success).toBe(true);
      expect(res.conversationId).toBe(validConversationId1);
      expect(socket._getLeftRooms().includes(`conversation_${validConversationId1}`)).toBeTruthy();
      expect(socket.data.joinedConversations[validConversationId1]).toBe(undefined);
    });
  });

  describe('6. Typing Indicators (Task 11)', () => {
    it('should reject start_typing if socket is unauthenticated', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleStartTyping(socket, { conversationId: validConversationId1 });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject start_typing with invalid UUID payload', async () => {
      const socket = createAuthenticatedSocket();
      const res = await gateway.handleStartTyping(socket, { conversationId: 'invalid-conv-id' });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('BAD_REQUEST');
    });

    it('should reject start_typing if conversation does not exist', async () => {
      const socket = createAuthenticatedSocket();
      const nonExistentId = '77777777-7777-7777-7777-777777777777';
      const res = await gateway.handleStartTyping(socket, { conversationId: nonExistentId });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('should reject start_typing if user does not belong to conversation workspace', async () => {
      const socket = createAuthenticatedSocket({
        availableWorkspaceIds: [validWorkspaceId1],
      });
      const res = await gateway.handleStartTyping(socket, {
        conversationId: unauthorizedConversationId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('FORBIDDEN');
    });

    it('should successfully handle start_typing and broadcast typing.start to conversation room and emit agent.typing_start event', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleStartTyping(socket, {
        conversationId: validConversationId1,
      });

      expect(res.success).toBe(true);
      expect(res.room).toBe(`conversation_${validConversationId1}`);
      expect(res.conversationId).toBe(validConversationId1);
      expect(res.workspaceId).toBe(validWorkspaceId1);

      // Verify broadcast to conversation room
      const broadcastMap = socket._getBroadcastToRooms();
      const convBroadcasts = broadcastMap[`conversation_${validConversationId1}`];
      expect(convBroadcasts).toBeTruthy();
      expect(convBroadcasts.length).toBe(1);
      expect(convBroadcasts[0].event).toBe('event');
      const wsPayload = convBroadcasts[0].payload as any;
      expect(wsPayload.event).toBe(WsServerEvent.TYPING_START);
      expect(wsPayload.workspaceId).toBe(validWorkspaceId1);
      expect(wsPayload.data.conversationId).toBe(validConversationId1);
      expect(wsPayload.data.userId).toBe(validUserId);
      expect(wsPayload.data.isTyping).toBe(true);

      // Verify internal event emitted
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('agent.typing_start');
      const internalPayload = emittedEvents[0].payload as any;
      expect(internalPayload.conversationId).toBe(validConversationId1);
      expect(internalPayload.userId).toBe(validUserId);
      expect(internalPayload.isTyping).toBe(true);
    });

    it('should successfully handle stop_typing and broadcast typing.stop to conversation room and emit agent.typing_stop event', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleStopTyping(socket, {
        conversationId: validConversationId1,
      });

      expect(res.success).toBe(true);
      expect(res.room).toBe(`conversation_${validConversationId1}`);

      // Verify broadcast to conversation room
      const broadcastMap = socket._getBroadcastToRooms();
      const convBroadcasts = broadcastMap[`conversation_${validConversationId1}`];
      expect(convBroadcasts).toBeTruthy();
      expect(convBroadcasts.length).toBe(1);
      const wsPayload = convBroadcasts[0].payload as any;
      expect(wsPayload.event).toBe(WsServerEvent.TYPING_STOP);
      expect(wsPayload.data.isTyping).toBe(false);

      // Verify internal event emitted
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('agent.typing_stop');
      const internalPayload = emittedEvents[0].payload as any;
      expect(internalPayload.isTyping).toBe(false);
    });
  });

  describe('7. Heartbeat & Presence Renewal (Task 11)', () => {
    it('should return success false if socket is unauthenticated on heartbeat', async () => {
      const socket = createMockSocket({});
      const res = await gateway.handleHeartbeat(socket);

      expect(res.success).toBe(false);
      expect(heartbeatCalls.length).toBe(0);
    });

    it('should call presenceService.heartbeat for all active workspaces on heartbeat', async () => {
      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [validWorkspaceId1],
      });

      const res = await gateway.handleHeartbeat(socket);

      expect(res.success).toBe(true);
      expect(typeof res.timestamp).toBe('string');
      expect(heartbeatCalls.length).toBe(1);
      expect(heartbeatCalls[0].workspaceId).toBe(validWorkspaceId1);
      expect(heartbeatCalls[0].userId).toBe(validUserId);
    });

    it('should fallback to available workspaces when joinedWorkspaceIds is empty on heartbeat', async () => {
      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [],
        availableWorkspaceIds: [validWorkspaceId1, validWorkspaceId2],
      });

      const res = await gateway.handleHeartbeat(socket);

      expect(res.success).toBe(true);
      expect(heartbeatCalls.length).toBe(2);
      expect(heartbeatCalls[0].workspaceId).toBe(validWorkspaceId1);
      expect(heartbeatCalls[1].workspaceId).toBe(validWorkspaceId2);
    });

    it('should handle presenceService heartbeat errors gracefully without throwing', async () => {
      mockPresenceService.heartbeat = async () => {
        throw new Error('Redis connection drop');
      };

      const socket = createAuthenticatedSocket({
        joinedWorkspaceIds: [validWorkspaceId1],
      });

      await expectReject(
        async () => {
          await gateway.handleHeartbeat(socket);
        },
        (err: Error) => {
          expect(err.message).toBe('Redis connection drop');
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

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INTERNAL_ERROR');
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

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INTERNAL_ERROR');
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

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Typing Status Handlers (FINDING-P7-02: Zero DB Queries on Keystrokes)', () => {
    it('should broadcast typing_start using in-memory joinedConversations without any database queries', async () => {
      let dbQueryCount = 0;
      mockPrisma.getClient = () => ({
        conversation: {
          findFirst: async () => {
            dbQueryCount++;
            return null;
          },
        },
        workspaceMember: {
          findFirst: async () => {
            dbQueryCount++;
            return null;
          },
        },
      });

      const socket = createAuthenticatedSocket();
      (socket.data as RealtimeSocketData).joinedConversations = {
        [validConversationId1]: validWorkspaceId1,
      };

      const res = await gateway.handleStartTyping(socket, {
        conversationId: validConversationId1,
      });

      expect(res.success).toBe(true);
      expect(dbQueryCount).toBe(0);
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('agent.typing_start');
    });

    it('should broadcast typing_stop using in-memory joinedConversations without database queries', async () => {
      let dbQueryCount = 0;
      mockPrisma.getClient = () => ({
        conversation: {
          findFirst: async () => {
            dbQueryCount++;
            return null;
          },
        },
        workspaceMember: {
          findFirst: async () => {
            dbQueryCount++;
            return null;
          },
        },
      });

      const socket = createAuthenticatedSocket();
      (socket.data as RealtimeSocketData).joinedConversations = {
        [validConversationId1]: validWorkspaceId1,
      };

      const res = await gateway.handleStopTyping(socket, {
        conversationId: validConversationId1,
      });

      expect(res.success).toBe(true);
      expect(dbQueryCount).toBe(0);
      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('agent.typing_stop');
    });

    it('should fallback to DB query if conversation was not pre-joined and reject if not found', async () => {
      mockPrisma.getClient = () => ({
        conversation: {
          findFirst: async () => null,
        },
      });

      const socket = createAuthenticatedSocket();
      const res = await gateway.handleStartTyping(socket, {
        conversationId: '77777777-7777-7777-7777-777777777777',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('8. Commerce Collision Locking & Presence Handlers', () => {
    let mockServerBroadcasts: Array<{ room: string; event: string; payload: any }>;

    beforeEach(() => {
      mockServerBroadcasts = [];
      gateway.server = {
        to: (room: string) => ({
          emit: (event: string, payload: any) => {
            mockServerBroadcasts.push({ room, event, payload });
          },
        }),
      } as any;
    });

    it('should acquire lock, broadcast COMMERCE_COLLISION_STATUS and emit no legacy collision events on handleCommerceEditingStart', async () => {
      const socket = createAuthenticatedSocket();
      const payload = {
        workspaceId: validWorkspaceId1,
        conversationId: validConversationId1,
      };

      const result = await gateway.handleCommerceEditingStart(socket, payload);

      expect(result.success).toBe(true);
      expect(mockCommercePresenceService.startEditing).toHaveBeenCalledWith(
        validWorkspaceId1,
        validConversationId1,
        expect.objectContaining({ userId: validUserId }),
      );

      const roomBroadcasts =
        socket._getBroadcastToRooms()[`conversation_${validConversationId1}`] || [];
      const collisionEvents = roomBroadcasts.filter(
        (b: any) => b.event === WsServerEvent.COMMERCE_COLLISION_STATUS,
      );
      const posEvents = roomBroadcasts.filter((b: any) => (b.event as string).includes('POS'));

      expect(collisionEvents.length).toBe(1);
      expect(posEvents.length).toBe(0);
    });

    it('should renew editing heartbeat on handleCommerceEditingHeartbeat', async () => {
      const socket = createAuthenticatedSocket();
      const payload = {
        workspaceId: validWorkspaceId1,
        conversationId: validConversationId1,
      };

      const result = await gateway.handleCommerceEditingHeartbeat(socket, payload);

      expect(result.success).toBe(true);
      expect(mockCommercePresenceService.refreshHeartbeat).toHaveBeenCalledWith(
        validWorkspaceId1,
        validConversationId1,
        validUserId,
      );
    });

    it('should release lock and broadcast unlocked COMMERCE_COLLISION_STATUS on handleCommerceEditingStop', async () => {
      const socket = createAuthenticatedSocket();
      const payload = {
        workspaceId: validWorkspaceId1,
        conversationId: validConversationId1,
      };

      const result = await gateway.handleCommerceEditingStop(socket, payload);

      expect(result.success).toBe(true);
      expect(mockCommercePresenceService.stopEditing).toHaveBeenCalledWith(
        validWorkspaceId1,
        validConversationId1,
        validUserId,
      );

      const roomBroadcasts =
        socket._getBroadcastToRooms()[`conversation_${validConversationId1}`] || [];
      const collisionEvents = roomBroadcasts.filter(
        (b: any) => b.event === WsServerEvent.COMMERCE_COLLISION_STATUS,
      );
      expect(collisionEvents.length).toBe(1);
    });

    it('should takeover lock and broadcast COMMERCE_COLLISION_STATUS to room on handleCommerceEditingTakeover', async () => {
      const socket = createAuthenticatedSocket();
      const payload = {
        workspaceId: validWorkspaceId1,
        conversationId: validConversationId1,
      };

      const result = await gateway.handleCommerceEditingTakeover(socket, payload);

      expect(result.success).toBe(true);
      expect(mockCommercePresenceService.takeoverEditing).toHaveBeenCalledWith(
        validWorkspaceId1,
        validConversationId1,
        expect.objectContaining({ userId: validUserId }),
      );

      const collisionBroadcasts = mockServerBroadcasts.filter(
        b =>
          b.room === `conversation_${validConversationId1}` &&
          b.event === WsServerEvent.COMMERCE_COLLISION_STATUS,
      );
      expect(collisionBroadcasts.length).toBe(1);
    });

    it('should cleanup user locks and broadcast COMMERCE_COLLISION_STATUS to released rooms on handleDisconnect', async () => {
      const socket = createAuthenticatedSocket();
      gateway.handleDisconnect(socket);

      // Await promise micro/macro-task completion
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockCommercePresenceService.cleanupUserLocks).toHaveBeenCalledWith(validUserId);
      const releasedBroadcasts = mockServerBroadcasts.filter(
        b =>
          b.room === `conversation_${validConversationId1}` &&
          b.event === WsServerEvent.COMMERCE_COLLISION_STATUS,
      );
      expect(releasedBroadcasts.length).toBe(1);
      const posBroadcasts = mockServerBroadcasts.filter(b => (b.event as string).includes('POS'));
      expect(posBroadcasts.length).toBe(0);
    });

    it('should reject unauthenticated socket with UNAUTHORIZED on handleCommerceEditingStart', async () => {
      const socket = createMockSocket();
      const payload = {
        workspaceId: validWorkspaceId1,
        conversationId: validConversationId1,
      };

      const result = await gateway.handleCommerceEditingStart(socket, payload);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid payload with BAD_REQUEST on handleCommerceEditingStart', async () => {
      const socket = createAuthenticatedSocket();
      const invalidPayload = {
        workspaceId: 'not-a-uuid',
        conversationId: validConversationId1,
      };

      const result = await gateway.handleCommerceEditingStart(socket, invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BAD_REQUEST');
    });

    it('should reject invalid payload gracefully on heartbeat, stop and takeover', async () => {
      const socket = createAuthenticatedSocket();
      const invalidPayload = { workspaceId: 'not-a-uuid', conversationId: 'invalid' };

      const hbRes = await gateway.handleCommerceEditingHeartbeat(socket, invalidPayload);
      expect(hbRes.success).toBe(false);

      const stopRes = await gateway.handleCommerceEditingStop(socket, invalidPayload);
      expect(stopRes.success).toBe(false);

      const takeoverRes = await gateway.handleCommerceEditingTakeover(socket, invalidPayload);
      expect(takeoverRes.success).toBe(false);
    });
  });
});
