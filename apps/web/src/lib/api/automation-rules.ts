import { buildQueryString, fetchApi, workspaceHeaders } from './client';
import type {
  AutomationRuleDto,
  AutomationRuleListQueryDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from '@sales-copilot/shared-contracts';

export const automationRulesApi = {
  list: (workspaceId: string, query?: AutomationRuleListQueryDto) =>
    fetchApi<AutomationRuleDto[]>(`/automation-rules${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  get: (workspaceId: string, id: string) =>
    fetchApi<AutomationRuleDto>(`/automation-rules/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  create: (workspaceId: string, dto: CreateAutomationRuleDto) =>
    fetchApi<AutomationRuleDto>('/automation-rules', {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  update: (workspaceId: string, id: string, dto: UpdateAutomationRuleDto) =>
    fetchApi<AutomationRuleDto>(`/automation-rules/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  delete: (workspaceId: string, id: string) =>
    fetchApi<{ success: true }>(`/automation-rules/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),
};
