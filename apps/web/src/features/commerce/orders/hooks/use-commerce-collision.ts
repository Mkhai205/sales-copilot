'use client';

import * as React from 'react';
import {
  WsClientEvent,
  WsServerEvent,
  type CommerceCollisionStatusPayload,
} from '@sales-copilot/shared-contracts';
import { getSocketClient } from '@/lib/socket/socket-client';

export function useCommerceCollision({
  workspaceId,
  conversationId,
  isOpen,
}: {
  workspaceId?: string;
  conversationId?: string;
  isOpen: boolean;
}) {
  const [collisionStatus, setCollisionStatus] =
    React.useState<CommerceCollisionStatusPayload | null>(null);

  React.useEffect(() => {
    if (!isOpen || !workspaceId || !conversationId) {
      return;
    }

    const socket = getSocketClient();

    // 1. Listen for collision status updates
    const handleCollisionStatus = (envelope: any) => {
      const data: CommerceCollisionStatusPayload = envelope?.data || envelope;
      if (data?.conversationId === conversationId) {
        setCollisionStatus(data);
      }
    };

    socket.on(WsServerEvent.COMMERCE_COLLISION_STATUS, handleCollisionStatus);

    // 2. Announce editing start
    socket.emit(
      WsClientEvent.COMMERCE_EDITING_START,
      { workspaceId, conversationId },
      (response: any) => {
        if (response && response.isLocked) {
          setCollisionStatus({
            workspaceId,
            conversationId,
            isLocked: true,
            lockedBy: response.lockedBy,
            remainingTtlSeconds: response.remainingTtlSeconds,
          });
        }
      },
    );

    // 3. Setup heartbeat ping every 12 seconds
    const interval = setInterval(() => {
      socket.emit(WsClientEvent.COMMERCE_EDITING_HEARTBEAT, { workspaceId, conversationId });
    }, 12_000);

    // 4. Cleanup on close or unmount
    return () => {
      clearInterval(interval);
      socket.off(WsServerEvent.COMMERCE_COLLISION_STATUS, handleCollisionStatus);
      socket.emit(WsClientEvent.COMMERCE_EDITING_STOP, { workspaceId, conversationId });
    };
  }, [isOpen, workspaceId, conversationId]);

  const takeover = React.useCallback(() => {
    if (!workspaceId || !conversationId) return;
    const socket = getSocketClient();
    socket.emit(
      WsClientEvent.COMMERCE_EDITING_TAKEOVER,
      { workspaceId, conversationId },
      (response: any) => {
        if (response && response.success) {
          setCollisionStatus({
            workspaceId,
            conversationId,
            isLocked: false,
            lockedBy: null,
            remainingTtlSeconds: 30,
          });
        }
      },
    );
  }, [workspaceId, conversationId]);

  return {
    isLocked: Boolean(collisionStatus?.isLocked),
    lockedBy: collisionStatus?.lockedBy || null,
    remainingTtlSeconds: collisionStatus?.remainingTtlSeconds ?? 0,
    takeover,
  };
}
