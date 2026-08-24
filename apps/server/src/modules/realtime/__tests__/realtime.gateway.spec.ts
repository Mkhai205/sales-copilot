import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { UnauthorizedException } from '@nestjs/common';
import { PlatformRole } from '@sales-copilot/shared-contracts';
import { RealtimeGateway } from '../realtime.gateway';
import {
  RealtimeConnectedPayload,
  RealtimeErrorPayload,
  RealtimeSocketData,
} from '../realtime.types';

describe('RealtimeGateway (Agent Realtime WebSocket Namespace /realtime)', () => {
  let gateway: RealtimeGateway;
  let mockTokenService: any;
  let mockPrisma: any;

  const validUserId = 'usr_agent_001';
  const validEmail = 'agent@salescopilot.io';
  const validRole = PlatformRole.USER;
  const validToken = 'jwt_valid_access_token_xyz';

  const validWorkspaceId1 = '11111111-1111-1111-1111-111111111111';
  const validWorkspaceId2 = '22222222-2222-2222-2222-222222222222';
  const unauthorizedWorkspaceId = '99999999-9999-9999-9999-999999999999';

  const validConversationId1 = '33333333-3333-3333-3333-333333333333';
  const validConversationId2 = '44444444-4444-4444-4444-444444444444';
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
    [unauthorizedConversationId]: {
      id: unauthorizedConversationId,
      workspaceId: unauthorizedWorkspaceId,
    },
  };

  const createMockSocket = (handshakeOverrides: any = {}) => {
    const emittedToClient: Array<{ event: string; payload: unknown }> = [];
    const joinedRooms: string[] = [];
    const leftRooms: string[] = [];
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
    mockTokenService = {
      verifyAccessToken: async (token: string) => {
        if (token === validToken) {
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
                args.where?.workspaceId === validWorkspaceId2)
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

    gateway = new RealtimeGateway(mockTokenService, mockPrisma);
  });

  describe('Gateway Initialization', () => {
    it('should initialize successfully on /realtime namespace', () => {
      assert.doesNotThrow(() => {
        gateway.afterInit({} as any);
      });
    });
  });

  describe('Connection Authentication Handshake', () => {
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

    it('should successfully authenticate via handshake.auth.token and populate session context', async () => {
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

    it('should successfully authenticate via handshake.query.token', async () => {
      const socket = createMockSocket({
        query: { token: validToken },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      const socketData = socket.data as RealtimeSocketData;
      assert.strictEqual(socketData.userId, validUserId);
      assert.ok(socket._getJoinedRooms().includes(`user_${validUserId}`));
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

  describe('Room Management — Workspace Join/Leave (Task 3)', () => {
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

    it('should successfully join workspace room for authorized workspace member', async () => {
      const socket = createAuthenticatedSocket();

      const res = await gateway.handleJoinWorkspace(socket, { workspaceId: validWorkspaceId1 });

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.room, `workspace_${validWorkspaceId1}`);
      assert.strictEqual(res.workspaceId, validWorkspaceId1);
      assert.ok(socket._getJoinedRooms().includes(`workspace_${validWorkspaceId1}`));
      assert.ok(socket.data.joinedWorkspaceIds.includes(validWorkspaceId1));
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

    it('should leave workspace room and cascade leave all conversation rooms belonging to that workspace', () => {
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
    });
  });

  describe('Room Management — Conversation Join/Leave (Task 3)', () => {
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

  describe('Connection Lifecycle Disconnect', () => {
    it('should handle disconnect cleanly for authenticated socket', () => {
      const socket = createMockSocket({
        auth: { token: validToken },
      });
      socket.data = {
        userId: validUserId,
        email: validEmail,
        role: validRole,
        availableWorkspaceIds: ['ws_001'],
        joinedWorkspaceIds: ['ws_001'],
        joinedConversations: {},
        connectedAt: new Date(),
      };

      assert.doesNotThrow(() => {
        gateway.handleDisconnect(socket);
      });
    });

    it('should handle disconnect cleanly for unauthenticated socket', () => {
      const socket = createMockSocket({});
      assert.doesNotThrow(() => {
        gateway.handleDisconnect(socket);
      });
    });
  });
});
