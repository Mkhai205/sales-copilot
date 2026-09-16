'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspaces } from '@/features/identity';
import { contactsApi } from '../api/contacts';
import type {
  ContactDto,
  ContactListQueryDto,
  CreateContactDto,
  MergeContactsDto,
  UpdateContactDto,
} from '@sales-copilot/shared-contracts';

interface ContactHookOptions {
  workspaceSlug?: string;
  workspaceId?: string;
  enabled?: boolean;
}

export function useContacts(options: ContactHookOptions & { query?: ContactListQueryDto } = {}) {
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId);

  return useQuery<ContactDto[]>({
    queryKey: ['contacts', resolvedWorkspaceId, options.query],
    queryFn: async () => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await contactsApi.list(resolvedWorkspaceId, options.query);
      return res.data;
    },
    enabled: isEnabled,
    staleTime: 30_000,
  });
}

export function useContact(contactId?: string | null, options: ContactHookOptions = {}) {
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  const isEnabled = Boolean((options.enabled ?? true) && resolvedWorkspaceId && contactId);

  return useQuery<ContactDto>({
    queryKey: ['contact', resolvedWorkspaceId, contactId],
    queryFn: async () => {
      if (!resolvedWorkspaceId || !contactId)
        throw new Error('Workspace ID and Contact ID are required');
      const res = await contactsApi.get(resolvedWorkspaceId, contactId);
      return res.data;
    },
    enabled: isEnabled,
    staleTime: 30_000,
  });
}

export function useUpdateContact(
  contactId: string,
  options: ContactHookOptions & { conversationId?: string } = {},
) {
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  return useMutation({
    mutationFn: async (dto: UpdateContactDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await contactsApi.update(resolvedWorkspaceId, contactId, dto);
      return res.data;
    },
    onSuccess: () => {
      if (options.conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['conversation', resolvedWorkspaceId, options.conversationId],
        });
      }
      queryClient.invalidateQueries({
        queryKey: ['contacts', resolvedWorkspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['contact', resolvedWorkspaceId, contactId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Contact info updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update contact info');
    },
  });
}

export function useCreateContact(options: ContactHookOptions = {}) {
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  return useMutation({
    mutationFn: async (dto: CreateContactDto) => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await contactsApi.create(resolvedWorkspaceId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['contacts', resolvedWorkspaceId],
      });
      toast.success('Contact created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create contact');
    },
  });
}

export function useMergeContacts(options: ContactHookOptions = {}) {
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  return useMutation({
    mutationFn: async (dto: MergeContactsDto) => {
      if (!resolvedWorkspaceId) throw new Error('Workspace ID is required');
      const res = await contactsApi.merge(resolvedWorkspaceId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['contacts', resolvedWorkspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Contacts merged successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to merge contacts');
    },
  });
}
