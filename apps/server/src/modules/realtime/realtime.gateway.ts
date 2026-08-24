import { Injectable, Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../auth/token.service';
import {
  RealtimeConnectedPayload,
  RealtimeErrorPayload,
  RealtimeSocketData,
} from './realtime.types';

/**
 * Dedicated WebSocket Gateway for Agent Dashboard Realtime events.
 * Namespace: `/realtime`
 *
 * Handles JWT authentication handshake, tenant/user room provisioning,
 * and connection lifecycle management.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(_server: Server) {
    this.logger.log('RealtimeGateway initialized on namespace /realtime');
  }

  /**
   * Authenticates incoming agent dashboard connection via JWT access token,
   * queries user workspace memberships, and provisions personal user room.
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
   * Handles agent disconnection and logging.
   */
  handleDisconnect(client: Socket): void {
    const data = client.data as RealtimeSocketData | undefined;
    if (data?.userId) {
      this.logger.log(
        `Realtime client disconnected (socket: ${client.id}, userId: ${data.userId})`,
      );
    } else {
      this.logger.log(`Unauthenticated realtime client disconnected (socket: ${client.id})`);
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
