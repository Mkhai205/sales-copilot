'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaces } from '@/features/identity';
import { contactsApi } from '../api/contacts';
import type { ChannelIdentityDto } from '@sales-copilot/shared-contracts';

export interface UseContactIdentitiesOptions {
  workspaceSlug?: string;
  workspaceId?: string;
  enabled?: boolean;
}

export function useContactIdentities(
  contactId?: string | null,
  options: UseContactIdentitiesOptions = {},
) {
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
      if (!resolvedWorkspaceId || !contactId) {
        throw new Error('Workspace ID and Contact ID are required');
      }
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
