'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { salesApi } from '../api/sales-client';
import type {
  CreateLeadDto,
  InvalidateSalesEvidenceDto,
  LeadResponseDto,
  LeadScoreHistoryItemDto,
  LeadScoreResponseDto,
  SalesEvidenceResponseDto,
} from '@sales-copilot/shared-contracts';

export function useContactLead(workspaceId?: string, contactId?: string) {
  return useQuery<LeadResponseDto | null>({
    queryKey: ['contact-lead', workspaceId, contactId],
    queryFn: async () => {
      if (!workspaceId || !contactId) return null;
      try {
        const res = await salesApi.listLeads(workspaceId, { contactId, limit: 1 });
        return res.data.items?.[0] || null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(workspaceId && contactId),
    staleTime: 30000,
  });
}

export function useLeadScore(workspaceId?: string, leadId?: string | null) {
  return useQuery<LeadScoreResponseDto | null>({
    queryKey: ['lead-score', workspaceId, leadId],
    queryFn: async () => {
      if (!workspaceId || !leadId) return null;
      try {
        const res = await salesApi.getLeadScore(workspaceId, leadId);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: Boolean(workspaceId && leadId),
    staleTime: 30000,
  });
}

export function useLeadScoreHistory(workspaceId?: string, leadId?: string | null) {
  return useQuery<LeadScoreHistoryItemDto[]>({
    queryKey: ['lead-score-history', workspaceId, leadId],
    queryFn: async () => {
      if (!workspaceId || !leadId) return [];
      try {
        const res = await salesApi.getLeadScoreHistory(workspaceId, leadId, { limit: 10 });
        return res.data.items || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(workspaceId && leadId),
    staleTime: 30000,
  });
}

export function useConversationEvidence(workspaceId?: string, conversationId?: string) {
  return useQuery<SalesEvidenceResponseDto[]>({
    queryKey: ['sales-evidence', conversationId],
    queryFn: async () => {
      if (!workspaceId || !conversationId) return [];
      try {
        const res = await salesApi.listEvidenceByConversation(workspaceId, conversationId, {
          includeInvalidated: true,
        });
        return res.data || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(workspaceId && conversationId),
    staleTime: 15000,
  });
}

export function useRecalculateScore(workspaceId: string, leadId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason?: string) => {
      if (!leadId) throw new Error('Lead ID is required');
      const res = await salesApi.recalculateLeadScore(workspaceId, leadId, {
        reason: reason || 'Manual recalculation from sales detail panel',
      });
      return res.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['lead-score', workspaceId, leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-score-history', workspaceId, leadId] });
      queryClient.invalidateQueries({ queryKey: ['contact-lead', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast.success(`Đã cập nhật điểm Lead: ${data.score}/100 (${data.grade})`);
    },
    onError: (err: any) => {
      toast.error('Không thể tính lại điểm Lead', {
        description: err.message || 'Vui lòng thử lại sau',
      });
    },
  });
}

export function useInvalidateEvidence(
  workspaceId: string,
  conversationId?: string,
  leadId?: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      evidenceId,
      dto,
    }: {
      evidenceId: string;
      dto: InvalidateSalesEvidenceDto;
    }) => {
      const res = await salesApi.invalidateEvidence(workspaceId, evidenceId, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-evidence', conversationId] });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: ['lead-score', workspaceId, leadId] });
        queryClient.invalidateQueries({ queryKey: ['lead-score-history', workspaceId, leadId] });
      }
      toast.success('Đã vô hiệu hóa bằng chứng bán hàng');
    },
    onError: (err: any) => {
      toast.error('Không thể vô hiệu hóa bằng chứng', {
        description: err.message || 'Vui lòng thử lại sau',
      });
    },
  });
}

export function useCreateLead(workspaceId: string, contactId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto?: Partial<CreateLeadDto>) => {
      if (!contactId) throw new Error('Contact ID is required');
      const payload: CreateLeadDto = {
        contactId,
        ...dto,
      };
      const res = await salesApi.createLead(workspaceId, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-lead', workspaceId, contactId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Đã khởi tạo Lead cho khách hàng thành công');
    },
    onError: (err: any) => {
      toast.error('Không thể khởi tạo Lead', {
        description: err.message || 'Vui lòng thử lại sau',
      });
    },
  });
}
