'use client';

import * as React from 'react';
import type { UserWorkspaceDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { useWorkspaces } from '@/features/settings/general/hooks/use-workspaces';

export interface WorkspaceContextValue {
  workspaceSlug: string;
  /** Resolved workspace id — undefined while the workspace list is loading */
  workspaceId: string | undefined;
  workspace: UserWorkspaceDto | null;
  role: WorkspaceRole | null;
  isLoading: boolean;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

export interface WorkspaceProviderProps {
  workspaceSlug: string;
  children: React.ReactNode;
}

/**
 * Resolves the active workspace once per workspace subtree (mounted in
 * app/(workspace)/[workspaceSlug]/layout.tsx) and exposes id/role/object to
 * every descendant — replacing the per-component useWorkspaces()+find
 * boilerplate previously repeated across ~30 files.
 */
export function WorkspaceProvider({ workspaceSlug, children }: WorkspaceProviderProps) {
  const { data: workspaces, isLoading } = useWorkspaces();

  const workspace = React.useMemo(
    () => workspaces?.find(w => w.slug === workspaceSlug) ?? null,
    [workspaces, workspaceSlug],
  );

  const value = React.useMemo<WorkspaceContextValue>(
    () => ({
      workspaceSlug,
      workspaceId: workspace?.id,
      workspace,
      role: (workspace?.role as WorkspaceRole) ?? null,
      isLoading,
    }),
    [workspaceSlug, workspace, isLoading],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Access the active workspace inside the (workspace) route subtree. Throws
 * when used outside <WorkspaceProvider> — every workspace-scoped consumer
 * lives under that subtree by construction.
 */
export function useWorkspaceContext(): WorkspaceContextValue {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a <WorkspaceProvider>');
  }
  return context;
}
