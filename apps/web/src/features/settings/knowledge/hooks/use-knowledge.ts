'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateKnowledgeArticleDto,
  KnowledgeArticleDto,
  KnowledgeArticleListResponseDto,
  KnowledgeArticleQueryDto,
  TestSearchKnowledgeDto,
  TestSearchResultDto,
  UpdateKnowledgeArticleDto,
} from '@sales-copilot/shared-contracts';
import { knowledgeApi } from '../api/knowledge';
import { knowledgeKeys } from '@/lib/query-keys';

export function useKnowledgeArticles(workspaceId?: string, query?: KnowledgeArticleQueryDto) {
  return useQuery<KnowledgeArticleListResponseDto>({
    queryKey: knowledgeKeys.list(workspaceId, query),
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await knowledgeApi.list(workspaceId, query);
      const rawData = res.data;
      let items: KnowledgeArticleDto[] = [];
      let meta = res.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };

      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object' && Array.isArray((rawData as any).items)) {
        items = (rawData as any).items;
        meta = (rawData as any).meta || meta;
      }

      return {
        items,
        meta: {
          total: Number(meta.total ?? items.length),
          page: Number(meta.page ?? 1),
          limit: Number(meta.limit ?? 20),
          totalPages: Number(
            meta.totalPages ?? (Math.ceil((meta.total ?? items.length) / (meta.limit ?? 20)) || 1),
          ),
        },
      };
    },
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useCreateKnowledgeArticle(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateKnowledgeArticleDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await knowledgeApi.create(workspaceId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(workspaceId),
      });
      toast.success('Đã tạo bài viết kiến thức thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể tạo bài viết kiến thức');
    },
  });
}

export function useUpdateKnowledgeArticle(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateKnowledgeArticleDto }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await knowledgeApi.update(workspaceId, id, dto);
      return res.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.detail(workspaceId, id),
      });
      toast.success('Đã cập nhật bài viết thành công');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể cập nhật bài viết');
    },
  });
}

export function useDeleteKnowledgeArticle(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await knowledgeApi.delete(workspaceId, id);
      return { id, success: res.success };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(workspaceId),
      });
      toast.success('Đã xóa bài viết vĩnh viễn');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể xóa bài viết');
    },
  });
}

export function useReindexKnowledgeArticle(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await knowledgeApi.reindex(workspaceId, id);
      return res.data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.list(workspaceId),
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.detail(workspaceId, id),
      });
      toast.success('Đã yêu cầu cập nhật lại vector embedding');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Không thể re-index bài viết');
    },
  });
}

export function useTestSearchKnowledge(workspaceId?: string) {
  return useMutation<TestSearchResultDto[], Error, TestSearchKnowledgeDto>({
    mutationFn: async (dto: TestSearchKnowledgeDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await knowledgeApi.testSearch(workspaceId, dto);
      return res.data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Lỗi khi thử nghiệm tìm kiếm ngữ nghĩa');
    },
  });
}
