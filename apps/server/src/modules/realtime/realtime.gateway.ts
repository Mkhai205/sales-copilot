import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import {
  WsClientEvent,
  WsServerEvent,
  joinWorkspaceSchema,
  leaveWorkspaceSchema,
  joinConversationSchema,
  leaveConversationSchema,
  typingIndicatorSchema,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../auth/token.service';
import {
  RealtimeConnectedPayload,
  RealtimeErrorPayload,
  RealtimeRoomOperationResult,
  RealtimeSocketData,
} from './realtime.types';

/**
 * Dedicated WebSocket Gateway for Agent Dashboard Realtime events.
 * Namespace: `/realtime`
 *
 * Handles JWT authentication handshake, tenant/workspace room provisioning,
 * conversation room routing, typing indicators, connection lifecycle management,
 * and multi-server Redis Pub/Sub adapter clustering.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private pubClient?: RedisClientType;
  private subClient?: RedisClientType;

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async afterInit(server: Server): Promise<void> {
    this.logger.log('RealtimeGateway initialized on namespace /realtime');

    // Register engine connection error listener
    if (server.engine) {
      server.engine.on('connection_error', (err: unknown) => {
        const error = err as Error | { message?: string; stack?: string };
        this.logger.error(
          `Socket.io engine connection error: ${error?.message || String(err)}`,
          error?.stack,
        );
      });
    }

    // Register connection attempt logging / diagnostics middleware
    server.use((socket: Socket, next: (err?: Error) => void) => {
      this.logger.debug(`Incoming WebSocket connection attempt from socket: ${socket.id}`);
      next();
    });

    await this.setupRedisAdapter(server);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pubClient?.isOpen) {
      try {
        await this.pubClient.quit();
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis adapter pubClient: ${(err as Error).message}`);
      }
    }
    if (this.subClient?.isOpen) {
      try {
        await this.subClient.quit();
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis adapter subClient: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Configures Socket.io Redis Pub/Sub Adapter for horizontal multi-instance clustering.
   * Gracefully degrades to single-server in-memory mode if Redis is unavailable.
   */
  private async setupRedisAdapter(server: Server): Promise<void> {
    const redisUrl = this.configService?.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.log(
        'REDIS_URL not configured. RealtimeGateway operating in single-server in-memory mode',
      );
      return;
    }

    try {
      this.pubClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            if (retries > 2) {
              return false; // Stop reconnecting after 2 retries to prevent test/process hanging
            }
            return Math.min(retries * 50, 200);
          },
        },
      }) as RedisClientType;
      this.subClient = this.pubClient.duplicate() as RedisClientType;

      this.pubClient.on('error', (err: Error) => {
        this.logger.warn(`Redis adapter pubClient error: ${err.message}`);
      });

      this.subClient.on('error', (err: Error) => {
        this.logger.warn(`Redis adapter subClient error: ${err.message}`);
      });

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

      server.adapter(createAdapter(this.pubClient, this.subClient));
      this.logger.log(
        '✅ Socket.io Redis Pub/Sub Adapter initialized successfully for horizontal scaling',
      );
    } catch (err) {
      this.logger.warn(
        `Failed to initialize Redis adapter (${(err as Error).message}). Falling back to single-server in-memory adapter`,
      );
      if (this.pubClient) {
        try {
          await this.pubClient.disconnect();
        } catch {
          // Ignore cleanup errors
        }
        this.pubClient = undefined;
      }
      if (this.subClient) {
        try {
          await this.subClient.disconnect();
        } catch {
          // Ignore cleanup errors
        }
        this.subClient = undefined;
      }
    }
  }

  /**
   * Authenticates incoming agent dashboard connection via JWT access token,
   * queries user workspace memberships, provisions personal user room,
   * and notifies presence / lifecycle listeners.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // 1. Extract JWT access token from handshake auth, query, or authorization headers
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Realtime connection rejected: no token provided (socket: ${client.id})`);
        const errorPayload: RealtimeErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Authentication token is required to connect to realtime gateway',
        };
        client.emit('error', errorPayload);
        client.disconnect(true);
        return;
      }

      // 2. Verify JWT token using TokenService
      let payload;
      try {
        payload = await this.tokenService.verifyAccessToken(token);
      } catch (verifyErr) {
        this.logger.warn(
          `Realtime connection rejected: invalid or expired token (socket: ${client.id}, error: ${(verifyErr as Error).message})`,
        );
        const errorPayload: RealtimeErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Access token is invalid or expired',
        };
        client.emit('error', errorPayload);
        client.disconnect(true);
        return;
      }

      // 3. Query active workspace memberships for the authenticated user
      const memberships = await this.prisma.getClient().workspaceMember.findMany({
        where: { userId: payload.sub },
        select: { workspaceId: true },
      });
      const availableWorkspaceIds = memberships.map(m => m.workspaceId);

      // 4. Attach authenticated user session context to client socket
      const socketData: RealtimeSocketData = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        availableWorkspaceIds,
        joinedWorkspaceIds: [],
        joinedConversations: {},
        connectedAt: new Date(),
      };
      client.data = socketData;

      // 5. Automatically join personal user room for direct assignments and notifications
      client.join(`user_${payload.sub}`);

      // 6. Emit connected acknowledgement to client
      const connectedPayload: RealtimeConnectedPayload = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        availableWorkspaceIds,
        connectedAt: socketData.connectedAt.toISOString(),
      };
      client.emit('connected', connectedPayload);

      // 7. Emit internal agent.connected event for presence and analytics
      if (this.eventEmitter) {
        this.eventEmitter.emit('agent.connected', {
          userId: payload.sub,
          email: payload.email,
          role: payload.role,
          socketId: client.id,
          availableWorkspaceIds,
          connectedAt: socketData.connectedAt,
        });
      }

      this.logger.log(
        `Realtime client connected (socket: ${client.id}, userId: ${payload.sub}, email: ${payload.email}, workspaces: ${availableWorkspaceIds.length})`,
      );
    } catch (err) {
      this.logger.error(
        `Error during realtime connection: ${(err as Error).message}`,
        (err as Error).stack,
      );
      const errorPayload: RealtimeErrorPayload = {
        code: 'INTERNAL_ERROR',
        message: 'Internal error establishing realtime connection',
      };
      client.emit('error', errorPayload);
      client.disconnect(true);
    }
  }

  /**
   * Handles agent disconnection, logging with session duration, and notifying presence listeners.
   */
  handleDisconnect(client: Socket): void {
    const data = client.data as RealtimeSocketData | undefined;
    if (data?.userId) {
      const durationMs = data.connectedAt ? Date.now() - new Date(data.connectedAt).getTime() : 0;

      this.logger.log(
        `Realtime client disconnected (socket: ${client.id}, userId: ${data.userId}, email: ${data.email}, durationMs: ${durationMs}ms, joinedWorkspaces: [${data.joinedWorkspaceIds.join(', ')}])`,
      );

      if (this.eventEmitter) {
        this.eventEmitter.emit('agent.disconnected', {
          userId: data.userId,
          email: data.email,
          role: data.role,
          socketId: client.id,
          joinedWorkspaceIds: data.joinedWorkspaceIds,
          durationMs,
          disconnectedAt: new Date(),
        });
      }
    } else {
      this.logger.log(`Unauthenticated realtime client disconnected (socket: ${client.id})`);
    }
  }

  /**
   * Handles joining a workspace room (workspace_{workspaceId}).
   * Verifies that the authenticated user is an active member of the workspace.
   */
  @SubscribeMessage(WsClientEvent.JOIN_WORKSPACE)
  @SubscribeMessage('join_workspace')
  async handleJoinWorkspace(
    client: Socket,
    payload: unknown,
  ): Promise<RealtimeRoomOperationResult> {
    try {
      const socketData = client.data as RealtimeSocketData | undefined;
      if (!socketData?.userId) {
        const error: RealtimeErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Socket session is not authenticated',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const parseResult = joinWorkspaceSchema.safeParse(payload);
      if (!parseResult.success) {
        const error: RealtimeErrorPayload = {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0]?.message || 'Invalid join_workspace payload',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const { workspaceId } = parseResult.data;

      // Check membership from DB or cached availableWorkspaceIds
      const isMember =
        socketData.availableWorkspaceIds.includes(workspaceId) ||
        Boolean(
          await this.prisma.getClient().workspaceMember.findFirst({
            where: { userId: socketData.userId, workspaceId },
          }),
        );

      if (!isMember) {
        this.logger.warn(
          `User ${socketData.userId} attempted to join unauthorized workspace ${workspaceId}`,
        );
        const error: RealtimeErrorPayload = {
          code: 'FORBIDDEN',
          message: 'You are not a member of this workspace',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const roomName = `workspace_${workspaceId}`;
      client.join(roomName);

      if (!socketData.joinedWorkspaceIds.includes(workspaceId)) {
        socketData.joinedWorkspaceIds.push(workspaceId);
      }
      if (!socketData.availableWorkspaceIds.includes(workspaceId)) {
        socketData.availableWorkspaceIds.push(workspaceId);
      }

      this.logger.log(`Socket ${client.id} (user: ${socketData.userId}) joined room ${roomName}`);

      return {
        success: true,
        room: roomName,
        workspaceId,
      };
    } catch (err) {
      this.logger.error(
        `Error in handleJoinWorkspace: ${(err as Error).message}`,
        (err as Error).stack,
      );
      const error: RealtimeErrorPayload = {
        code: 'INTERNAL_ERROR',
        message: 'Internal error processing join_workspace request',
      };
      client.emit('error', error);
      return { success: false, error };
    }
  }

  /**
   * Handles leaving a workspace room (workspace_{workspaceId}) and any active
   * conversation rooms that belong to that workspace.
   */
  @SubscribeMessage(WsClientEvent.LEAVE_WORKSPACE)
  @SubscribeMessage('leave_workspace')
  handleLeaveWorkspace(client: Socket, payload: unknown): RealtimeRoomOperationResult {
    try {
      const socketData = client.data as RealtimeSocketData | undefined;
      if (!socketData?.userId) {
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Socket session is not authenticated' },
        };
      }

      const parseResult = leaveWorkspaceSchema.safeParse(payload);
      if (!parseResult.success) {
        return {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid leave_workspace payload' },
        };
      }

      const { workspaceId } = parseResult.data;
      const roomName = `workspace_${workspaceId}`;
      client.leave(roomName);

      socketData.joinedWorkspaceIds = socketData.joinedWorkspaceIds.filter(
        id => id !== workspaceId,
      );

      // Leave any open conversations that belong to this workspace
      if (socketData.joinedConversations) {
        for (const [convId, wsId] of Object.entries(socketData.joinedConversations)) {
          if (wsId === workspaceId) {
            client.leave(`conversation_${convId}`);
            delete socketData.joinedConversations[convId];
          }
        }
      }

      this.logger.log(`Socket ${client.id} (user: ${socketData.userId}) left room ${roomName}`);

      return {
        success: true,
        room: roomName,
        workspaceId,
      };
    } catch (err) {
      this.logger.error(
        `Error in handleLeaveWorkspace: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal error processing leave_workspace request',
        },
      };
    }
  }

  /**
   * Handles joining a conversation room (conversation_{conversationId}).
   * Verifies that the conversation exists and belongs to a workspace the user has membership in.
   */
  @SubscribeMessage(WsClientEvent.JOIN_CONVERSATION)
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    client: Socket,
    payload: unknown,
  ): Promise<RealtimeRoomOperationResult> {
    try {
      const socketData = client.data as RealtimeSocketData | undefined;
      if (!socketData?.userId) {
        const error: RealtimeErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Socket session is not authenticated',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const parseResult = joinConversationSchema.safeParse(payload);
      if (!parseResult.success) {
        const error: RealtimeErrorPayload = {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0]?.message || 'Invalid join_conversation payload',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const { conversationId } = parseResult.data;

      // Look up conversation
      const conversation = await this.prisma.getClient().conversation.findFirst({
        where: { id: conversationId },
        select: { id: true, workspaceId: true },
      });

      if (!conversation) {
        const error: RealtimeErrorPayload = {
          code: 'CONVERSATION_NOT_FOUND',
          message: `Conversation with id '${conversationId}' not found`,
        };
        client.emit('error', error);
        return { success: false, error };
      }

      // Verify user is a member of the workspace that owns this conversation
      const isMember =
        socketData.availableWorkspaceIds.includes(conversation.workspaceId) ||
        Boolean(
          await this.prisma.getClient().workspaceMember.findFirst({
            where: { userId: socketData.userId, workspaceId: conversation.workspaceId },
          }),
        );

      if (!isMember) {
        this.logger.warn(
          `User ${socketData.userId} attempted to join conversation ${conversationId} without workspace access`,
        );
        const error: RealtimeErrorPayload = {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const roomName = `conversation_${conversationId}`;
      client.join(roomName);

      if (!socketData.joinedConversations) {
        socketData.joinedConversations = {};
      }
      socketData.joinedConversations[conversationId] = conversation.workspaceId;

      this.logger.log(
        `Socket ${client.id} (user: ${socketData.userId}) joined conversation room ${roomName}`,
      );

      return {
        success: true,
        room: roomName,
        conversationId,
        workspaceId: conversation.workspaceId,
      };
    } catch (err) {
      this.logger.error(
        `Error in handleJoinConversation: ${(err as Error).message}`,
        (err as Error).stack,
      );
      const error: RealtimeErrorPayload = {
        code: 'INTERNAL_ERROR',
        message: 'Internal error processing join_conversation request',
      };
      client.emit('error', error);
      return { success: false, error };
    }
  }

  /**
   * Handles leaving a conversation room (conversation_{conversationId}).
   */
  @SubscribeMessage(WsClientEvent.LEAVE_CONVERSATION)
  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(client: Socket, payload: unknown): RealtimeRoomOperationResult {
    try {
      const socketData = client.data as RealtimeSocketData | undefined;
      if (!socketData?.userId) {
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Socket session is not authenticated' },
        };
      }

      const parseResult = leaveConversationSchema.safeParse(payload);
      if (!parseResult.success) {
        return {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid leave_conversation payload' },
        };
      }

      const { conversationId } = parseResult.data;
      const roomName = `conversation_${conversationId}`;
      client.leave(roomName);

      if (socketData.joinedConversations) {
        delete socketData.joinedConversations[conversationId];
      }

      this.logger.log(
        `Socket ${client.id} (user: ${socketData.userId}) left conversation room ${roomName}`,
      );

      return {
        success: true,
        room: roomName,
        conversationId,
      };
    } catch (err) {
      this.logger.error(
        `Error in handleLeaveConversation: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal error processing leave_conversation request',
        },
      };
    }
  }

  /**
   * Handles agent typing start indicator in a conversation.
   * Broadcasts to conversation room (excluding sender) and notifies internal listeners.
   */
  @SubscribeMessage(WsClientEvent.START_TYPING)
  @SubscribeMessage('start_typing')
  async handleStartTyping(client: Socket, payload: unknown): Promise<RealtimeRoomOperationResult> {
    return this.handleTypingStatus(client, payload, true);
  }

  /**
   * Handles agent typing stop indicator in a conversation.
   * Broadcasts to conversation room (excluding sender) and notifies internal listeners.
   */
  @SubscribeMessage(WsClientEvent.STOP_TYPING)
  @SubscribeMessage('stop_typing')
  async handleStopTyping(client: Socket, payload: unknown): Promise<RealtimeRoomOperationResult> {
    return this.handleTypingStatus(client, payload, false);
  }

  /**
   * Common handler for agent typing status updates.
   */
  private async handleTypingStatus(
    client: Socket,
    payload: unknown,
    isTyping: boolean,
  ): Promise<RealtimeRoomOperationResult> {
    try {
      const socketData = client.data as RealtimeSocketData | undefined;
      if (!socketData?.userId) {
        const error: RealtimeErrorPayload = {
          code: 'UNAUTHORIZED',
          message: 'Socket session is not authenticated',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const rawPayload =
        typeof payload === 'object' && payload !== null && !('isTyping' in payload)
          ? { ...(payload as Record<string, unknown>), isTyping }
          : payload;

      const parseResult = typingIndicatorSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        const error: RealtimeErrorPayload = {
          code: 'BAD_REQUEST',
          message: parseResult.error.errors[0]?.message || 'Invalid typing indicator payload',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const { conversationId } = parseResult.data;

      // Verify conversation exists and fetch workspace
      const conversation = await this.prisma.getClient().conversation.findFirst({
        where: { id: conversationId },
        select: { id: true, workspaceId: true },
      });

      if (!conversation) {
        const error: RealtimeErrorPayload = {
          code: 'CONVERSATION_NOT_FOUND',
          message: `Conversation with id '${conversationId}' not found`,
        };
        client.emit('error', error);
        return { success: false, error };
      }

      // Verify user has membership in the conversation workspace
      const isMember =
        socketData.availableWorkspaceIds.includes(conversation.workspaceId) ||
        Boolean(
          await this.prisma.getClient().workspaceMember.findFirst({
            where: { userId: socketData.userId, workspaceId: conversation.workspaceId },
          }),
        );

      if (!isMember) {
        this.logger.warn(
          `User ${socketData.userId} attempted to broadcast typing in conversation ${conversationId} without workspace access`,
        );
        const error: RealtimeErrorPayload = {
          code: 'FORBIDDEN',
          message: 'You do not have access to this conversation',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      const targetRoom = `conversation_${conversationId}`;

      // Broadcast to other agents viewing the conversation (excluding sender)
      client.to(targetRoom).emit('event', {
        event: isTyping ? WsServerEvent.TYPING_START : WsServerEvent.TYPING_STOP,
        workspaceId: conversation.workspaceId,
        timestamp: new Date().toISOString(),
        data: {
          conversationId,
          userId: socketData.userId,
          email: socketData.email,
          isTyping,
        },
      });

      if (this.eventEmitter) {
        this.eventEmitter.emit(isTyping ? 'agent.typing_start' : 'agent.typing_stop', {
          workspaceId: conversation.workspaceId,
          conversationId,
          userId: socketData.userId,
          email: socketData.email,
          isTyping,
        });
      }

      return {
        success: true,
        room: targetRoom,
        conversationId,
        workspaceId: conversation.workspaceId,
      };
    } catch (err) {
      this.logger.error(
        `Error in handleTypingStatus: ${(err as Error).message}`,
        (err as Error).stack,
      );
      const error: RealtimeErrorPayload = {
        code: 'INTERNAL_ERROR',
        message: 'Internal error processing typing indicator',
      };
      client.emit('error', error);
      return { success: false, error };
    }
  }

  // --- Helper Methods ---

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth || {};
    const query = (client.handshake.query as Record<string, string | string[] | undefined>) || {};
    const headers = client.handshake.headers || {};

    let candidate = auth.token || query.token;

    if (!candidate && headers.authorization) {
      const authHeader = Array.isArray(headers.authorization)
        ? headers.authorization[0]
        : headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        candidate = authHeader.slice(7).trim();
      }
    }

    if (Array.isArray(candidate)) {
      return candidate[0]?.trim();
    }
    return typeof candidate === 'string' ? candidate.trim() : undefined;
  }
}
