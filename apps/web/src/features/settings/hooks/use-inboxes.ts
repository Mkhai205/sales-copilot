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
  const queryClient = useQueryClient();

  return useQuery<InboxDetailDto>({
    queryKey: ['workspaces', workspaceId, 'inboxes', inboxId],
    queryFn: async () => {
      if (!workspaceId || !inboxId) {
        throw new Error('Workspace ID and Inbox ID are required');
      }
      const res = await inboxesApi.getById(workspaceId, inboxId);
      return res.data;
    },
    initialData: () => {
      const list = queryClient.getQueryData<InboxDto[]>(['workspaces', workspaceId, 'inboxes']);
      const match = list?.find(i => i.id === inboxId);
      return match ? (match as unknown as InboxDetailDto) : undefined;
    },
    initialDataUpdatedAt: 0,
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
      queryClient.setQueryData<InboxDto[]>(['workspaces', workspaceId, 'inboxes'], old => {
        if (!old) return [newInbox as unknown as InboxDto];
        if (old.some(i => i.id === newInbox.id)) return old;
        return [newInbox as unknown as InboxDto, ...old];
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Đã tạo hộp thư thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Tạo hộp thư thất bại');
    },
  });
}

export interface UpdateInboxMutationArgs {
  inboxId: string;
  dto: UpdateInboxDto;
  silent?: boolean;
  successMessage?: string;
}

export function useUpdateInbox(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inboxId, dto }: UpdateInboxMutationArgs) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await inboxesApi.update(workspaceId, inboxId, dto);
      return res.data;
    },
    onSuccess: (updatedInbox, variables) => {
      // 1. Update list cache safely (exact match only, never fuzzy-match detail query)
      queryClient.setQueryData<InboxDto[]>(['workspaces', workspaceId, 'inboxes'], old => {
        if (!old || !Array.isArray(old)) return old;
        return old.map(i => (i.id === updatedInbox.id ? (updatedInbox as unknown as InboxDto) : i));
      });

      // 2. Update detail cache safely
      queryClient.setQueryData<InboxDetailDto>(
        ['workspaces', workspaceId, 'inboxes', updatedInbox.id],
        old => (old ? { ...old, ...updatedInbox } : (updatedInbox as unknown as InboxDetailDto)),
      );

      // 3. Invalidate to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });

      if (!variables.silent) {
        toast.success(variables.successMessage || 'Cập nhật cài đặt hộp thư thành công');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Cập nhật cài đặt hộp thư thất bại');
    },
  });
}

export interface DeleteInboxMutationArgs {
  inboxId: string;
  silent?: boolean;
  successMessage?: string;
}

export function useDeleteInbox(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: string | DeleteInboxMutationArgs) => {
      const inboxId = typeof args === 'string' ? args : args.inboxId;
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await inboxesApi.delete(workspaceId, inboxId);
      return { inboxId, success: res.success };
    },
    onSuccess: ({ inboxId }, variables) => {
      // Exact list update
      queryClient.setQueryData<InboxDto[]>(['workspaces', workspaceId, 'inboxes'], old => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter(i => i.id !== inboxId);
      });
      // Remove detail query
      queryClient.removeQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes', inboxId],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });

      const silent = typeof variables === 'object' && variables.silent;
      const successMessage = typeof variables === 'object' ? variables.successMessage : undefined;
      if (!silent) {
        toast.success(successMessage || 'Đã xóa hộp thư thành công');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Xóa hộp thư thất bại');
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
      queryClient.setQueryData<InboxMemberDto[]>(
        ['workspaces', workspaceId, 'inboxes', inboxId, 'members'],
        old => {
          if (!old || !Array.isArray(old)) return [newMember];
          if (old.some(m => m.userId === newMember.userId)) return old;
          return [...old, newMember];
        },
      );
      queryClient.setQueryData<InboxDetailDto>(
        ['workspaces', workspaceId, 'inboxes', inboxId],
        old => (old ? { ...old, memberCount: (old.memberCount ?? 0) + 1 } : old),
      );
      queryClient.setQueryData<InboxDto[]>(['workspaces', workspaceId, 'inboxes'], old =>
        old && Array.isArray(old)
          ? old.map(i => (i.id === inboxId ? { ...i, memberCount: (i.memberCount ?? 0) + 1 } : i))
          : old,
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Đã thêm nhân viên vào hộp thư');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Thêm nhân viên thất bại');
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
      queryClient.setQueryData<InboxMemberDto[]>(
        ['workspaces', workspaceId, 'inboxes', inboxId, 'members'],
        old => {
          if (!old || !Array.isArray(old)) return old;
          return old.filter(m => m.userId !== userId);
        },
      );
      queryClient.setQueryData<InboxDetailDto>(
        ['workspaces', workspaceId, 'inboxes', inboxId],
        old => (old ? { ...old, memberCount: Math.max(0, (old.memberCount ?? 1) - 1) } : old),
      );
      queryClient.setQueryData<InboxDto[]>(['workspaces', workspaceId, 'inboxes'], old =>
        old && Array.isArray(old)
          ? old.map(i =>
              i.id === inboxId ? { ...i, memberCount: Math.max(0, (i.memberCount ?? 1) - 1) } : i,
            )
          : old,
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'inboxes'],
      });
      toast.success('Đã xóa nhân viên khỏi hộp thư');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Xóa nhân viên thất bại');
    },
  });
}
