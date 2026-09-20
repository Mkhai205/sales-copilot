'use client';

import { useQuery } from '@tanstack/react-query';
import { workspacesApi, teamsApi, labelsApi, useWorkspaces } from '@/features/settings';
import type { LabelDto, TeamDto, WorkspaceMemberDto } from '@sales-copilot/shared-contracts';
import { memberKeys, teamKeys, labelKeys } from '@/lib/query-keys';

interface MetadataOptions {
  workspaceSlug?: string;
  workspaceId?: string;
  enabled?: boolean;
}

export function useWorkspaceMembers(options: MetadataOptions = {}) {
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId);

  const query = useQuery({
    queryKey: memberKeys.list(resolvedWorkspaceId),
    queryFn: async () => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await workspacesApi.listMembers(resolvedWorkspaceId);
      return res.data;
    },
    enabled: isEnabled,
    staleTime: 60_000,
  });

  return {
    ...query,
    members: (query.data || []) as WorkspaceMemberDto[],
  };
}

export function useWorkspaceTeams(options: MetadataOptions = {}) {
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId);

  const query = useQuery({
    queryKey: teamKeys.list(resolvedWorkspaceId),
    queryFn: async () => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await teamsApi.list(resolvedWorkspaceId);
      return res.data;
    },
    enabled: isEnabled,
    staleTime: 60_000,
  });

  return {
    ...query,
    teams: (query.data || []) as TeamDto[],
  };
}

export function useWorkspaceLabels(options: MetadataOptions = {}) {
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId);

  const query = useQuery({
    queryKey: labelKeys.list(resolvedWorkspaceId),
    queryFn: async () => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await labelsApi.list(resolvedWorkspaceId);
      return res.data;
    },
    enabled: isEnabled,
    staleTime: 30_000,
  });

  return {
    ...query,
    labels: (query.data || []) as LabelDto[],
  };
}

export { useContactIdentities, type UseContactIdentitiesOptions } from '../contacts';
