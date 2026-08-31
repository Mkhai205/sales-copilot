'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AutomationRuleDto,
  AutomationRuleListQueryDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from '@sales-copilot/shared-contracts';
import { automationRulesApi } from '@/lib/api/automation-rules';

export function useAutomationRules(workspaceId?: string, query?: AutomationRuleListQueryDto) {
  return useQuery<AutomationRuleDto[]>({
    queryKey: ['workspaces', workspaceId, 'automation-rules', query],
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await automationRulesApi.list(workspaceId, query);
      return res.data;
    },
    enabled: !!workspaceId,
    staleTime: 30 * 1000,
  });
}

export function useAutomationRule(workspaceId?: string, ruleId?: string) {
  return useQuery<AutomationRuleDto>({
    queryKey: ['workspaces', workspaceId, 'automation-rules', ruleId],
    queryFn: async () => {
      if (!workspaceId || !ruleId) {
        throw new Error('Workspace ID and Rule ID are required');
      }
      const res = await automationRulesApi.get(workspaceId, ruleId);
      return res.data;
    },
    enabled: !!workspaceId && !!ruleId,
    staleTime: 30 * 1000,
  });
}

export function useCreateAutomationRule(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: CreateAutomationRuleDto) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await automationRulesApi.create(workspaceId, dto);
      return res.data;
    },
    onSuccess: newRule => {
      queryClient.setQueriesData<AutomationRuleDto[]>(
        { queryKey: ['workspaces', workspaceId, 'automation-rules'] },
        old => {
          if (!old) return [newRule];
          if (old.some(r => r.id === newRule.id)) return old;
          return [...old, newRule];
        },
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'automation-rules'],
      });
      toast.success('Automation rule created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create automation rule');
    },
  });
}

export function useUpdateAutomationRule(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, dto }: { ruleId: string; dto: UpdateAutomationRuleDto }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await automationRulesApi.update(workspaceId, ruleId, dto);
      return res.data;
    },
    onSuccess: updatedRule => {
      queryClient.setQueriesData<AutomationRuleDto[]>(
        { queryKey: ['workspaces', workspaceId, 'automation-rules'] },
        old => {
          if (!old) return [updatedRule];
          return old.map(r => (r.id === updatedRule.id ? updatedRule : r));
        },
      );
      queryClient.setQueryData(
        ['workspaces', workspaceId, 'automation-rules', updatedRule.id],
        updatedRule,
      );
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'automation-rules'],
      });
      toast.success('Automation rule updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update automation rule');
    },
  });
}

export function useToggleAutomationRuleActive(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await automationRulesApi.update(workspaceId, ruleId, { isActive });
      return res.data;
    },
    onMutate: async ({ ruleId, isActive }) => {
      await queryClient.cancelQueries({
        queryKey: ['workspaces', workspaceId, 'automation-rules'],
      });

      const previousRules = queryClient.getQueryData<AutomationRuleDto[]>([
        'workspaces',
        workspaceId,
        'automation-rules',
      ]);

      queryClient.setQueriesData<AutomationRuleDto[]>(
        { queryKey: ['workspaces', workspaceId, 'automation-rules'] },
        old => {
          if (!old) return old;
          return old.map(r => (r.id === ruleId ? { ...r, isActive } : r));
        },
      );

      return { previousRules };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(
          ['workspaces', workspaceId, 'automation-rules'],
          context.previousRules,
        );
      }
      toast.error(error.message || 'Failed to toggle rule state');
    },
    onSuccess: rule => {
      toast.success(`Rule "${rule.name}" is now ${rule.isActive ? 'active' : 'inactive'}`);
    },
  });
}

export function useDeleteAutomationRule(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await automationRulesApi.delete(workspaceId, ruleId);
      return { ruleId, success: res.success };
    },
    onSuccess: ({ ruleId }) => {
      queryClient.setQueriesData<AutomationRuleDto[]>(
        { queryKey: ['workspaces', workspaceId, 'automation-rules'] },
        old => {
          if (!old) return old;
          return old.filter(r => r.id !== ruleId);
        },
      );
      toast.success('Automation rule deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete automation rule');
    },
  });
}
