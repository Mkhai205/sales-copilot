'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import { contactsApi } from '../api/contacts';
import type { ChannelIdentityDto, CreateChannelIdentityDto } from '@sales-copilot/shared-contracts';
import { contactKeys } from '@/lib/query-keys';

export interface UseContactIdentitiesOptions {
  workspaceSlug?: string;
  workspaceId?: string;
  enabled?: boolean;
}

export function useContactIdentities(
  contactId?: string | null,
  options: UseContactIdentitiesOptions = {},
) {
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId && contactId);

  const query = useQuery({
    queryKey: contactKeys.identities(resolvedWorkspaceId, contactId || undefined),
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

export function useLinkContactIdentity(
  contactId: string,
  options: UseContactIdentitiesOptions = {},
) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (dto: CreateChannelIdentityDto) => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await contactsApi.linkIdentity(resolvedWorkspaceId, contactId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contactKeys.identities(resolvedWorkspaceId, contactId),
      });
      queryClient.invalidateQueries({
        queryKey: contactKeys.detail(resolvedWorkspaceId, contactId),
      });
      queryClient.invalidateQueries({
        queryKey: contactKeys.list(resolvedWorkspaceId),
      });
      toast.success('Đã liên kết kênh thành công');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Không thể liên kết kênh');
    },
  });
}

export function useUnlinkContactIdentity(
  contactId: string,
  options: UseContactIdentitiesOptions = {},
) {
  const queryClient = useQueryClient();
  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const resolvedWorkspaceId = options.workspaceId || contextWorkspaceId || undefined;

  return useMutation({
    mutationFn: async (identityId: string) => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await contactsApi.unlinkIdentity(resolvedWorkspaceId, contactId, identityId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contactKeys.identities(resolvedWorkspaceId, contactId),
      });
      queryClient.invalidateQueries({
        queryKey: contactKeys.detail(resolvedWorkspaceId, contactId),
      });
      queryClient.invalidateQueries({
        queryKey: contactKeys.list(resolvedWorkspaceId),
      });
      toast.success('Đã hủy liên kết kênh');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Không thể hủy liên kết kênh');
    },
  });
}
