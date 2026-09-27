import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  CreateKnowledgeArticleDto,
  KnowledgeArticleDto,
  KnowledgeArticleListResponseDto,
  KnowledgeArticleQueryDto,
  TestSearchKnowledgeDto,
  TestSearchResultDto,
  UpdateKnowledgeArticleDto,
} from '@sales-copilot/shared-contracts';

export const knowledgeApi = {
  list: (workspaceId: string, query?: KnowledgeArticleQueryDto) =>
    fetchApi<KnowledgeArticleListResponseDto>(`/knowledge-articles${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateKnowledgeArticleDto) =>
    fetchApi<KnowledgeArticleDto>('/knowledge-articles', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateKnowledgeArticleDto) =>
    fetchApi<KnowledgeArticleDto>(`/knowledge-articles/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: true }>(`/knowledge-articles/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),

  reindex: (workspaceId: string, id: string) =>
    fetchApi<KnowledgeArticleDto>(`/knowledge-articles/${id}/reindex`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
    }),

  testSearch: (workspaceId: string, dto: TestSearchKnowledgeDto) =>
    fetchApi<TestSearchResultDto[]>('/knowledge-articles/test-search', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),
};
