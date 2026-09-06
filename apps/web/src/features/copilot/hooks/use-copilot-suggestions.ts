'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import type { CopilotSuggestionDto } from '@sales-copilot/shared-contracts';

export interface UseCopilotSuggestionsOptions {
  conversationId?: string;
  workspaceId?: string;
  enabled?: boolean;
}

export function useCopilotSuggestions({
  conversationId,
  workspaceId,
  enabled = true,
}: UseCopilotSuggestionsOptions) {
  return useQuery({
    queryKey: ['copilot-suggestions', conversationId],
    queryFn: async () => {
      if (!workspaceId || !conversationId) return [];
      const res = await fetchApi<CopilotSuggestionDto[]>(
        `/workspaces/${workspaceId}/copilot/conversations/${conversationId}/suggestions`,
        {
          headers: workspaceHeaders(workspaceId),
        },
      );
      return res.data || [];
    },
    enabled: Boolean(enabled && conversationId && workspaceId),
    staleTime: 5000,
  });
}

export function useApplySuggestion(workspaceId?: string, conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await fetchApi<CopilotSuggestionDto>(
        `/workspaces/${workspaceId}/copilot/suggestions/${suggestionId}/apply`,
        {
          method: 'POST',
          headers: workspaceHeaders(workspaceId),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['copilot-suggestions', conversationId],
        });
      }
    },
  });
}

export function useAcceptSuggestion(workspaceId?: string, conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await fetchApi<CopilotSuggestionDto>(
        `/workspaces/${workspaceId}/copilot/suggestions/${suggestionId}/accept`,
        {
          method: 'POST',
          headers: workspaceHeaders(workspaceId),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['copilot-suggestions', conversationId],
        });
      }
    },
  });
}

export function useDismissSuggestion(workspaceId?: string, conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ suggestionId, reason }: { suggestionId: string; reason?: string }) => {
      if (!workspaceId) throw new Error('Workspace ID is required');
      const res = await fetchApi<CopilotSuggestionDto>(
        `/workspaces/${workspaceId}/copilot/suggestions/${suggestionId}/dismiss`,
        {
          method: 'POST',
          headers: workspaceHeaders(workspaceId),
          body: JSON.stringify({ reason }),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['copilot-suggestions', conversationId],
        });
      }
      toast.success('Đã bỏ qua gợi ý');
    },
  });
}

export function useGenerateSuggestions(workspaceId?: string, conversationId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options?: { messageId?: string; force?: boolean }) => {
      if (!workspaceId || !conversationId)
        throw new Error('Workspace and Conversation are required');
      const res = await fetchApi<CopilotSuggestionDto[]>(
        `/workspaces/${workspaceId}/copilot/conversations/${conversationId}/generate`,
        {
          method: 'POST',
          headers: workspaceHeaders(workspaceId),
          body: JSON.stringify(options || {}),
        },
      );
      return res.data;
    },
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: ['copilot-suggestions', conversationId],
        });
      }
      toast.success('Đã làm mới gợi ý bán hàng');
    },
    onError: (err: any) => {
      toast.error('Không thể sinh gợi ý', {
        description: err?.message || 'Vui lòng thử lại sau',
      });
    },
  });
}
