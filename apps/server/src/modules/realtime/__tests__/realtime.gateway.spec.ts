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

  const mockJwtPayload = {
    sub: validUserId,
    email: validEmail,
    role: validRole,
  };

  const mockMemberships = [{ workspaceId: 'ws_001' }, { workspaceId: 'ws_002' }];

  const createMockSocket = (handshakeOverrides: any = {}) => {
    const emittedToClient: Array<{ event: string; payload: unknown }> = [];
    const joinedRooms: string[] = [];
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
      disconnect: (close?: boolean) => {
        disconnected = close ?? true;
      },
      _getEmitted: () => emittedToClient,
      _getJoinedRooms: () => joinedRooms,
      _isDisconnected: () => disconnected,
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
      assert.deepStrictEqual(socketData.availableWorkspaceIds, ['ws_001', 'ws_002']);
      assert.deepStrictEqual(socketData.joinedWorkspaceIds, []);
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
      assert.deepStrictEqual(connectedPayload.availableWorkspaceIds, ['ws_001', 'ws_002']);
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
