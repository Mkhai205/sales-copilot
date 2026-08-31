'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateInboxDto,
  InboxDetailDto,
  InboxDto,
  InboxMemberDto,
  UpdateInboxDto,
} from '@sales-copilot/shared-contracts';
import { inboxesApi } from '@/lib/api/inboxes';

export function useInboxes(workspaceId?: string) {
  return useQuery<InboxDto[]>({
    queryKey: ['workspaces', workspaceId, 'inboxes'],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await inboxesApi.list(workspaceId);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export function useInbox(workspaceId?: string, inboxId?: string) {
  return useQuery<InboxDetailDto>({
    queryKey: ['workspaces', workspaceId, 'inboxes', inboxId],
    queryFn: async () => {
      if (!workspaceId || !inboxId) {
        throw new Error('Workspace ID and Inbox ID are required');
      }
      const res = await inboxesApi.getById(workspaceId, inboxId);
      return res.data;
    },
    enabled: !!workspaceId && !!inboxId,
    staleTime: 60 * 1000,
  });
}

export function useCreateInbox(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dto,
      memberUserIds = [],
    }: {
      dto: CreateInboxDto;
      memberUserIds?: string[];
    }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      // 1. Create Inbox + Channel
      const res = await inboxesApi.create(workspaceId, dto);
      const newInbox = res.data;

      // 2. Add members if provided
      if (memberUserIds.length > 0) {
        for (const userId of memberUserIds) {
          try {
            await inboxesApi.addMember(workspaceId, newInbox.id, userId);
          } catch {
            // Member addition can be retried in inbox edit
          }
        }
      }

      return newInbox;
    },
    onSuccess: newInbox => {
      queryClient.setQueriesData<InboxDto[]>(
        { queryKey: ['workspaces', workspaceId, 'inboxes'] },
        old => {
          if (!old) return [newInbox as unknown as InboxDto];
          if (old.some(i => i.id === newInbox.id)) return old;
          return [newInbox as unknown as InboxDto, ...old];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Inbox created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create inbox');
    },
  });
}

export function useUpdateInbox(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inboxId, dto }: { inboxId: string; dto: UpdateInboxDto }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await inboxesApi.update(workspaceId, inboxId, dto);
      return res.data;
    },
    onSuccess: updatedInbox => {
      queryClient.setQueriesData<InboxDto[]>(
        { queryKey: ['workspaces', workspaceId, 'inboxes'] },
        old => {
          if (!old) return old;
          return old.map(i =>
            i.id === updatedInbox.id ? (updatedInbox as unknown as InboxDto) : i,
          );
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Inbox updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update inbox');
    },
  });
}

export function useDeleteInbox(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inboxId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await inboxesApi.delete(workspaceId, inboxId);
      return { inboxId, success: res.success };
    },
    onSuccess: ({ inboxId }) => {
      queryClient.setQueriesData<InboxDto[]>(
        { queryKey: ['workspaces', workspaceId, 'inboxes'] },
        old => {
          if (!old) return old;
          return old.filter(i => i.id !== inboxId);
        },
      );
      toast.success('Inbox deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete inbox');
    },
  });
}

export function useInboxMembers(workspaceId?: string, inboxId?: string) {
  return useQuery<InboxMemberDto[]>({
    queryKey: ['workspaces', workspaceId, 'inboxes', inboxId, 'members'],
    queryFn: async () => {
      if (!workspaceId || !inboxId) {
        throw new Error('Workspace ID and Inbox ID are required');
      }
      const res = await inboxesApi.listMembers(workspaceId, inboxId);
      return res.data;
    },
    enabled: !!workspaceId && !!inboxId,
    staleTime: 60 * 1000,
  });
}

export function useAddInboxMember(workspaceId?: string, inboxId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!workspaceId || !inboxId) {
        throw new Error('Workspace ID and Inbox ID are required');
      }
      const res = await inboxesApi.addMember(workspaceId, inboxId, userId);
      return res.data;
    },
    onSuccess: newMember => {
      queryClient.setQueriesData<InboxMemberDto[]>(
        { queryKey: ['workspaces', workspaceId, 'inboxes', inboxId, 'members'] },
        old => {
          if (!old) return [newMember];
          if (old.some(m => m.userId === newMember.userId)) return old;
          return [...old, newMember];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Member added to inbox');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add member to inbox');
    },
  });
}

export function useRemoveInboxMember(workspaceId?: string, inboxId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!workspaceId || !inboxId) {
        throw new Error('Workspace ID and Inbox ID are required');
      }
      const res = await inboxesApi.removeMember(workspaceId, inboxId, userId);
      return { userId, success: res.success };
    },
    onSuccess: ({ userId }) => {
      queryClient.setQueriesData<InboxMemberDto[]>(
        { queryKey: ['workspaces', workspaceId, 'inboxes', inboxId, 'members'] },
        old => {
          if (!old) return old;
          return old.filter(m => m.userId !== userId);
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Member removed from inbox');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member from inbox');
    },
  });
}
