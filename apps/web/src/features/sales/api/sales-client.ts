import { buildQueryString, fetchApi, workspaceHeaders } from '../../../lib/api/client';
import type {
  CreateLeadDto,
  InvalidateSalesEvidenceDto,
  LeadResponseDto,
  LeadScoreHistoryItemDto,
  LeadScoreResponseDto,
  ListLeadEvidenceQueryDto,
  ListLeadScoreHistoryQueryDto,
  PaginationMeta,
  RecalculateScoreDto,
  SalesEvidenceResponseDto,
} from '@sales-copilot/shared-contracts';

export const salesApi = {
  // Leads
  listLeads: (workspaceId: string, query?: Record<string, any>) =>
    fetchApi<{ items: LeadResponseDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/leads${buildQueryString(query)}`,
      { headers: workspaceHeaders(workspaceId) },
    ),

  getLead: (workspaceId: string, leadId: string) =>
    fetchApi<LeadResponseDto>(`/workspaces/${workspaceId}/leads/${leadId}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  createLead: (workspaceId: string, dto: CreateLeadDto) =>
    fetchApi<LeadResponseDto>(`/workspaces/${workspaceId}/leads`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  // Lead Score
  getLeadScore: (workspaceId: string, leadId: string) =>
    fetchApi<LeadScoreResponseDto>(`/workspaces/${workspaceId}/leads/${leadId}/score`, {
      headers: workspaceHeaders(workspaceId),
    }),

  getLeadScoreHistory: (
    workspaceId: string,
    leadId: string,
    query?: ListLeadScoreHistoryQueryDto,
  ) =>
    fetchApi<{ items: LeadScoreHistoryItemDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/leads/${leadId}/score/history${buildQueryString(query)}`,
      { headers: workspaceHeaders(workspaceId) },
    ),

  recalculateLeadScore: (workspaceId: string, leadId: string, dto?: RecalculateScoreDto) =>
    fetchApi<LeadScoreResponseDto>(`/workspaces/${workspaceId}/leads/${leadId}/score/recalculate`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto || {}),
    }),

  // Sales Evidence
  listEvidenceByConversation: (
    workspaceId: string,
    conversationId: string,
    query?: ListLeadEvidenceQueryDto,
  ) =>
    fetchApi<SalesEvidenceResponseDto[]>(
      `/workspaces/${workspaceId}/conversations/${conversationId}/evidence${buildQueryString(query)}`,
      { headers: workspaceHeaders(workspaceId) },
    ),

  listEvidenceByLead: (workspaceId: string, leadId: string, query?: ListLeadEvidenceQueryDto) =>
    fetchApi<{ items: SalesEvidenceResponseDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/leads/${leadId}/evidence${buildQueryString(query)}`,
      { headers: workspaceHeaders(workspaceId) },
    ),

  invalidateEvidence: (workspaceId: string, evidenceId: string, dto: InvalidateSalesEvidenceDto) =>
    fetchApi<SalesEvidenceResponseDto>(`/workspaces/${workspaceId}/sales-evidence/${evidenceId}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),
};
