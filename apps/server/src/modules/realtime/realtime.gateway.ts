import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  WsClientEvent,
  WsServerEvent,
  joinWorkspaceSchema,
  leaveWorkspaceSchema,
  joinConversationSchema,
  leaveConversationSchema,
  typingIndicatorSchema,
  posEditingActionSchema,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { TokenService } from '../auth/token.service';
import { PresenceService } from './presence.service';
import { PosPresenceService } from '../pos/presence/pos-presence.service';
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
 * and agent presence heartbeats. Clustering across instances is handled globally via RedisIoAdapter.
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

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly presenceService?: PresenceService,
    @Optional() private readonly workspacesService?: WorkspacesService,
    @Optional() private readonly posPresenceService?: PosPresenceService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    // Gateway lifecycle teardown hook
  }

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
      let availableWorkspaceIds: string[] = [];
      if (this.workspacesService) {
        const userWorkspaces = await this.workspacesService.findWorkspacesByUserId(payload.sub);
        availableWorkspaceIds = userWorkspaces.map(w => w.id);
      } else {
        const memberships = await this.prisma.getClient().workspaceMember.findMany({
          where: { userId: payload.sub },
          select: { workspaceId: true },
        });
        availableWorkspaceIds = memberships.map(m => m.workspaceId);
      }

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

      if (this.posPresenceService) {
        this.posPresenceService
          .cleanupUserLocks(data.userId)
          .then(unlockedList => {
            for (const item of unlockedList) {
              const room = `conversation_${item.conversationId}`;
              const envelope = {
                event: WsServerEvent.POS_COLLISION_STATUS,
                workspaceId: item.workspaceId,
                timestamp: new Date().toISOString(),
                data: {
                  conversationId: item.conversationId,
                  isLocked: false,
                  lockedBy: null,
                  remainingTtlSeconds: 0,
                },
              };
              this.server.to(room).emit(WsServerEvent.POS_COLLISION_STATUS, envelope);
              this.server.to(room).emit('event', envelope);
            }
          })
          .catch(() => {});
      }

      if (this.eventEmitter) {
        this.eventEmitter.emit('agent.disconnected', {
          userId: data.userId,
          email: data.email,
          role: data.role,
          socketId: client.id,
          joinedWorkspaceIds:
            data.joinedWorkspaceIds.length > 0
              ? data.joinedWorkspaceIds
              : data.availableWorkspaceIds,
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
        (this.workspacesService
          ? await this.workspacesService.isMember(workspaceId, socketData.userId)
          : Boolean(
              await this.prisma.getClient().workspaceMember.findFirst({
                where: { userId: socketData.userId, workspaceId },
              }),
            ));

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

      // Check if workspace is suspended
      const wsRecord = await this.prisma.getClient().workspace?.findUnique?.({
        where: { id: workspaceId },
        select: { isSuspended: true, suspendedReason: true },
      });

      if (wsRecord?.isSuspended) {
        this.logger.warn(
          `User ${socketData.userId} attempted to join suspended workspace ${workspaceId}`,
        );
        const error: RealtimeErrorPayload = {
          code: 'WORKSPACE_SUSPENDED',
          message: wsRecord.suspendedReason || 'Workspace has been suspended',
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

      // Mark agent ONLINE in presence service
      if (this.presenceService) {
        await this.presenceService.setOnline(workspaceId, socketData.userId);
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
   * Listens for workspace suspension events, notifies all sockets in the workspace room,
   * and evicts all connected sockets from the room.
   */
  @OnEvent('workspace.suspended')
  async handleWorkspaceSuspended(payload: { workspaceId: string; reason?: string }): Promise<void> {
    try {
      const { workspaceId, reason } = payload;
      const roomName = `workspace_${workspaceId}`;
      this.logger.warn(`Workspace ${workspaceId} suspended. Evicting sockets from ${roomName}`);

      const envelope = {
        event: 'workspace_suspended',
        workspaceId,
        timestamp: new Date().toISOString(),
        data: {
          workspaceId,
          reason: reason || 'Workspace has been suspended by platform administrator',
        },
      };

      if (this.server) {
        this.server.to(roomName).emit('workspace_suspended', envelope);
        this.server.to(roomName).emit('event', envelope);

        if (typeof this.server.in(roomName)?.fetchSockets === 'function') {
          const sockets = await this.server.in(roomName).fetchSockets();
          for (const socket of sockets) {
            const socketData = socket.data as RealtimeSocketData | undefined;
            if (socketData) {
              socketData.joinedWorkspaceIds = socketData.joinedWorkspaceIds.filter(
                id => id !== workspaceId,
              );
              if (socketData.joinedConversations) {
                for (const [convId, wsId] of Object.entries(socketData.joinedConversations)) {
                  if (wsId === workspaceId) {
                    socket.leave(`conversation_${convId}`);
                    delete socketData.joinedConversations[convId];
                  }
                }
              }
              if (this.presenceService && socketData.userId) {
                await this.presenceService
                  .setOffline(workspaceId, socketData.userId)
                  .catch(() => {});
              }
            }
          }
        }

        this.server.in(roomName).socketsLeave?.(roomName);
      }
    } catch (err) {
      this.logger.error(
        `Error handling workspace.suspended event: ${(err as Error).message}`,
        (err as Error).stack,
      );
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

      // If presenceService is available, mark agent OFFLINE in that workspace
      if (this.presenceService) {
        this.presenceService.setOffline(workspaceId, socketData.userId).catch(() => {});
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
        select: {
          id: true,
          workspaceId: true,
          workspace: {
            select: { isSuspended: true, suspendedReason: true },
          },
        },
      });

      if (!conversation) {
        const error: RealtimeErrorPayload = {
          code: 'CONVERSATION_NOT_FOUND',
          message: `Conversation with id '${conversationId}' not found`,
        };
        client.emit('error', error);
        return { success: false, error };
      }

      if (conversation.workspace?.isSuspended) {
        this.logger.warn(
          `User ${socketData.userId} attempted to join conversation in suspended workspace ${conversation.workspaceId}`,
        );
        const error: RealtimeErrorPayload = {
          code: 'WORKSPACE_SUSPENDED',
          message: conversation.workspace.suspendedReason || 'Workspace has been suspended',
        };
        client.emit('error', error);
        return { success: false, error };
      }

      // Verify user is a member of the workspace that owns this conversation
      const isMember =
        socketData.availableWorkspaceIds.includes(conversation.workspaceId) ||
        (this.workspacesService
          ? await this.workspacesService.isMember(conversation.workspaceId, socketData.userId)
          : Boolean(
              await this.prisma.getClient().workspaceMember.findFirst({
                where: { userId: socketData.userId, workspaceId: conversation.workspaceId },
              }),
            ));

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

      // 1. Fast path: check in-memory joinedConversations (FINDING-P7-02: 0 DB queries on keystroke)
      let workspaceId = socketData.joinedConversations?.[conversationId];

      if (!workspaceId) {
        // Fallback for edge cases: query conversation from DB
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

        workspaceId = conversation.workspaceId;
      }

      // Verify user has membership in the conversation workspace (fast path via availableWorkspaceIds)
      const isMember =
        socketData.availableWorkspaceIds.includes(workspaceId) ||
        (this.workspacesService
          ? await this.workspacesService.isMember(workspaceId, socketData.userId)
          : Boolean(
              await this.prisma.getClient().workspaceMember.findFirst({
                where: { userId: socketData.userId, workspaceId },
              }),
            ));

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
        workspaceId,
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
          workspaceId,
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
        workspaceId,
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

  /**
   * Handles client heartbeat ping to refresh presence TTL across active/available workspaces.
   */
  @SubscribeMessage(WsClientEvent.HEARTBEAT)
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    client: Socket,
    _payload?: unknown,
  ): Promise<{ success: boolean; timestamp: string }> {
    const socketData = client.data as RealtimeSocketData | undefined;
    if (!socketData?.userId) {
      return { success: false, timestamp: new Date().toISOString() };
    }

    if (this.presenceService) {
      const activeWorkspaces =
        socketData.joinedWorkspaceIds.length > 0
          ? socketData.joinedWorkspaceIds
          : socketData.availableWorkspaceIds;

      for (const workspaceId of activeWorkspaces) {
        await this.presenceService.heartbeat(workspaceId, socketData.userId);
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // POS Collision Locking Handlers (Milestone M2)
  // ==========================================================================

  @SubscribeMessage(WsClientEvent.POS_EDITING_START)
  @SubscribeMessage('pos.editing_start')
  async handlePosEditingStart(
    client: Socket,
    payload: unknown,
  ): Promise<{
    success: boolean;
    isLocked: boolean;
    lockedBy?: any;
    remainingTtlSeconds?: number;
    error?: any;
  }> {
    try {
      const socketData = client.data as RealtimeSocketData | undefined;
      if (!socketData?.userId) {
        return {
          success: false,
          isLocked: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        };
      }

      const parseResult = posEditingActionSchema.safeParse(payload);
      if (!parseResult.success) {
        return {
          success: false,
          isLocked: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid payload' },
        };
      }

      const { workspaceId, conversationId } = parseResult.data;
      if (!this.posPresenceService) {
        return { success: true, isLocked: false, remainingTtlSeconds: 30 };
      }

      const user = {
        userId: socketData.userId,
        userName: socketData.email ? socketData.email.split('@')[0] : 'Agent',
        userEmail: socketData.email,
      };

      const result = await this.posPresenceService.startEditing(workspaceId, conversationId, user);

      // Broadcast updated collision status to the conversation room
      const status = await this.posPresenceService.getEditingStatus(workspaceId, conversationId);
      const room = `conversation_${conversationId}`;
      const envelope = {
        event: WsServerEvent.POS_COLLISION_STATUS,
        workspaceId,
        timestamp: new Date().toISOString(),
        data: {
          conversationId,
          ...status,
        },
      };
      client.to(room).emit(WsServerEvent.POS_COLLISION_STATUS, envelope);
      client.to(room).emit('event', envelope);

      return result;
    } catch (err) {
      this.logger.error(`Error in handlePosEditingStart: ${(err as Error).message}`);
      return {
        success: false,
        isLocked: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal error' },
      };
    }
  }

  @SubscribeMessage(WsClientEvent.POS_EDITING_HEARTBEAT)
  @SubscribeMessage('pos.editing_heartbeat')
  async handlePosEditingHeartbeat(
    client: Socket,
    payload: unknown,
  ): Promise<{ success: boolean; remainingTtlSeconds: number }> {
    const socketData = client.data as RealtimeSocketData | undefined;
    if (!socketData?.userId || !this.posPresenceService) {
      return { success: false, remainingTtlSeconds: 0 };
    }

    const parseResult = posEditingActionSchema.safeParse(payload);
    if (!parseResult.success) {
      return { success: false, remainingTtlSeconds: 0 };
    }

    const { workspaceId, conversationId } = parseResult.data;
    return this.posPresenceService.refreshHeartbeat(workspaceId, conversationId, socketData.userId);
  }

  @SubscribeMessage(WsClientEvent.POS_EDITING_STOP)
  @SubscribeMessage('pos.editing_stop')
  async handlePosEditingStop(client: Socket, payload: unknown): Promise<{ success: boolean }> {
    const socketData = client.data as RealtimeSocketData | undefined;
    if (!socketData?.userId || !this.posPresenceService) {
      return { success: false };
    }

    const parseResult = posEditingActionSchema.safeParse(payload);
    if (!parseResult.success) {
      return { success: false };
    }

    const { workspaceId, conversationId } = parseResult.data;
    const released = await this.posPresenceService.stopEditing(
      workspaceId,
      conversationId,
      socketData.userId,
    );

    // Broadcast unlocked status
    const status = await this.posPresenceService.getEditingStatus(workspaceId, conversationId);
    const room = `conversation_${conversationId}`;
    const envelope = {
      event: WsServerEvent.POS_COLLISION_STATUS,
      workspaceId,
      timestamp: new Date().toISOString(),
      data: {
        conversationId,
        ...status,
      },
    };
    client.to(room).emit(WsServerEvent.POS_COLLISION_STATUS, envelope);
    client.to(room).emit('event', envelope);

    return { success: released };
  }

  @SubscribeMessage(WsClientEvent.POS_EDITING_TAKEOVER)
  @SubscribeMessage('pos.editing_takeover')
  async handlePosEditingTakeover(
    client: Socket,
    payload: unknown,
  ): Promise<{ success: boolean; previousLockedBy?: any; remainingTtlSeconds: number }> {
    const socketData = client.data as RealtimeSocketData | undefined;
    if (!socketData?.userId || !this.posPresenceService) {
      return { success: false, remainingTtlSeconds: 0 };
    }

    const parseResult = posEditingActionSchema.safeParse(payload);
    if (!parseResult.success) {
      return { success: false, remainingTtlSeconds: 0 };
    }

    const { workspaceId, conversationId } = parseResult.data;
    const user = {
      userId: socketData.userId,
      userName: socketData.email ? socketData.email.split('@')[0] : 'Agent',
      userEmail: socketData.email,
    };

    const res = await this.posPresenceService.takeoverEditing(workspaceId, conversationId, user);

    const status = await this.posPresenceService.getEditingStatus(workspaceId, conversationId);
    const room = `conversation_${conversationId}`;
    const envelope = {
      event: WsServerEvent.POS_COLLISION_STATUS,
      workspaceId,
      timestamp: new Date().toISOString(),
      data: {
        conversationId,
        ...status,
      },
    };
    this.server.to(room).emit(WsServerEvent.POS_COLLISION_STATUS, envelope);
    this.server.to(room).emit('event', envelope);

    return res;
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
