import { PlatformRole } from '@sales-copilot/shared-contracts';

/**
 * Socket session data stored on authenticated realtime dashboard connections.
 */
export interface RealtimeSocketData {
  userId: string;
  email: string;
  role: PlatformRole;
  availableWorkspaceIds: string[];
  joinedWorkspaceIds: string[];
  joinedConversations: Record<string, string>;
  connectedAt: Date;
}

/**
 * Payload emitted to the client upon successful authentication and handshake.
 */
export interface RealtimeConnectedPayload {
  userId: string;
  email: string;
  role: PlatformRole;
  availableWorkspaceIds: string[];
  connectedAt: string;
}

/**
 * Error payload emitted when handshake or socket operations fail.
 */
export interface RealtimeErrorPayload {
  code: string;
  message: string;
}

/**
 * Result returned from room join/leave operations.
 */
export interface RealtimeRoomOperationResult {
  success: boolean;
  room?: string;
  workspaceId?: string;
  conversationId?: string;
  error?: RealtimeErrorPayload;
}
