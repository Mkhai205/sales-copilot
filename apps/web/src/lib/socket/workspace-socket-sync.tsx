'use client';

import * as React from 'react';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { useWorkspaceRoom } from './use-socket';

export interface WorkspaceSocketSyncProps {
  workspaceSlug: string;
}

/**
 * Headless synchronization component that resolves workspace ID from slug
 * and binds the socket to the workspace room.
 */
export function WorkspaceSocketSync({ workspaceSlug }: WorkspaceSocketSyncProps) {
  const { data: workspaces } = useWorkspaces();

  const currentWorkspace = React.useMemo(() => {
    if (!workspaces || !workspaceSlug) return undefined;
    return workspaces.find(ws => ws.slug === workspaceSlug);
  }, [workspaces, workspaceSlug]);

  useWorkspaceRoom(currentWorkspace?.id);

  return null;
}
