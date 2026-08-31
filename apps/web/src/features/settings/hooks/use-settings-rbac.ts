'use client';

import * as React from 'react';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { useCurrentUser } from '@/features/auth/use-current-user';
import {
  getDefaultSettingsRoute,
  getPermittedSettingsNavItems,
  isSettingsSectionAllowed,
  SETTINGS_CATEGORIES,
  type SettingsCategory,
  type SettingsNavItem,
} from '../settings-nav-items';

export interface GroupedSettingsNav {
  id: SettingsCategory;
  label: string;
  items: SettingsNavItem[];
}

export function useSettingsRbac(workspaceSlug: string) {
  const { data: workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();

  const currentWorkspace = React.useMemo(() => {
    return workspaces?.find(w => w.slug === workspaceSlug) || null;
  }, [workspaces, workspaceSlug]);

  const currentRole: WorkspaceRole | null = currentWorkspace?.role ?? null;

  const isAdmin = currentRole === WorkspaceRole.OWNER || currentRole === WorkspaceRole.ADMIN;
  const isOwner = currentRole === WorkspaceRole.OWNER;
  const isAgent = currentRole === WorkspaceRole.AGENT;
  const isViewer = currentRole === WorkspaceRole.VIEWER;

  const accessibleNavItems = React.useMemo(() => {
    return getPermittedSettingsNavItems(currentRole);
  }, [currentRole]);

  const groupedNavItems = React.useMemo<GroupedSettingsNav[]>(() => {
    return SETTINGS_CATEGORIES.map(category => ({
      id: category.id,
      label: category.label,
      items: accessibleNavItems.filter(item => item.category === category.id),
    })).filter(group => group.items.length > 0);
  }, [accessibleNavItems]);

  const canAccess = React.useCallback(
    (segment: string) => {
      return isSettingsSectionAllowed(segment, currentRole);
    },
    [currentRole],
  );

  const defaultRoute = React.useMemo(() => {
    return getDefaultSettingsRoute(workspaceSlug, currentRole);
  }, [workspaceSlug, currentRole]);

  return {
    currentWorkspace,
    currentUser,
    currentRole,
    isAdmin,
    isOwner,
    isAgent,
    isViewer,
    isLoading: isLoadingWorkspaces || isLoadingUser,
    accessibleNavItems,
    groupedNavItems,
    canAccess,
    defaultRoute,
  };
}
