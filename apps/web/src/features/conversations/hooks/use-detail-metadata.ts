'use client';

import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api/workspaces';
import { teamsApi } from '@/lib/api/teams';
import { labelsApi } from '@/lib/api/labels';
import { contactsApi } from '@/lib/api/contacts';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import type { ChannelIdentityDto, LabelDto, TeamDto, WorkspaceMemberDto } from '@/lib/api/types';

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
    queryKey: ['workspace-members', resolvedWorkspaceId],
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
    queryKey: ['teams', resolvedWorkspaceId],
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
    queryKey: ['labels', resolvedWorkspaceId],
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

export function useContactIdentities(contactId?: string | null, options: MetadataOptions = {}) {
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId && contactId);

  const query = useQuery({
    queryKey: ['contact-identities', resolvedWorkspaceId, contactId],
    queryFn: async () => {
      if (!resolvedWorkspaceId || !contactId)
        throw new Error('Workspace ID and Contact ID are required');
      const res = await contactsApi.listIdentities(resolvedWorkspaceId, contactId);
      return res.data;
    },
    enabled: isEnabled,
    staleTime: 30_000,
  });

  return {
    ...query,
    identities: (query.data || []) as ChannelIdentityDto[],
  };
}
