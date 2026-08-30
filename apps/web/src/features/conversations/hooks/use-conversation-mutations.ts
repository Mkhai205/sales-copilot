'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { conversationsApi } from '@/lib/api/conversations';
import { contactsApi } from '@/lib/api/contacts';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import type {
  AssignConversationDto,
  AssignLabelsDto,
  ConversationResponseDto,
  UpdateContactDto,
  UpdateConversationPriorityDto,
  UpdateConversationStatusDto,
} from '@/lib/api/types';

interface MutationHookOptions {
  workspaceSlug?: string;
  workspaceId?: string;
}

export function useUpdateConversationStatus(
  conversationId: string,
  options: MutationHookOptions = {},
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
    mutationFn: async (dto: UpdateConversationStatusDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.updateStatus(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      queryClient.setQueryData(
        ['conversation', resolvedWorkspaceId, conversationId],
        updatedConversation,
      );
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Conversation status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update conversation status');
    },
  });
}

export function useUpdateConversationPriority(
  conversationId: string,
  options: MutationHookOptions = {},
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
    mutationFn: async (dto: UpdateConversationPriorityDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.updatePriority(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      queryClient.setQueryData(
        ['conversation', resolvedWorkspaceId, conversationId],
        updatedConversation,
      );
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Priority updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update priority');
    },
  });
}

export function useAssignConversation(conversationId: string, options: MutationHookOptions = {}) {
  const queryClient = useQueryClient();
  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    options.workspaceId ||
    (options.workspaceSlug
      ? workspaces?.find(w => w.slug === options.workspaceSlug)?.id
      : undefined) ||
    workspaces?.[0]?.id;

  return useMutation({
    mutationFn: async (dto: AssignConversationDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.assign(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: (updatedConversation: ConversationResponseDto) => {
      queryClient.setQueryData(
        ['conversation', resolvedWorkspaceId, conversationId],
        updatedConversation,
      );
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Assignment updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update assignment');
    },
  });
}

export function useAssignConversationLabels(
  conversationId: string,
  options: MutationHookOptions = {},
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
    mutationFn: async (dto: AssignLabelsDto) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.assignLabels(resolvedWorkspaceId, conversationId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', resolvedWorkspaceId, conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Label added');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add label');
    },
  });
}

export function useRemoveConversationLabel(
  conversationId: string,
  options: MutationHookOptions = {},
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
    mutationFn: async (labelId: string) => {
      if (!resolvedWorkspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await conversationsApi.removeLabel(resolvedWorkspaceId, conversationId, labelId);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', resolvedWorkspaceId, conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Label removed');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove label');
    },
  });
}

export function useUpdateContact(
  contactId: string,
  options: MutationHookOptions & { conversationId?: string } = {},
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
        queryKey: ['conversations', resolvedWorkspaceId],
      });
      toast.success('Contact info updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update contact info');
    },
  });
}
