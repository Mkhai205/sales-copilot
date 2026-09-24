import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import type { WorkspacePaymentSettings } from '@sales-copilot/shared-contracts';

export const bankApi = {
  getBankConfig: (workspaceId: string) =>
    fetchApi<WorkspacePaymentSettings>('/workspaces/current/bank', {
      headers: workspaceHeaders(workspaceId),
    }),

  updateBankConfig: (workspaceId: string, dto: WorkspacePaymentSettings) =>
    fetchApi<WorkspacePaymentSettings>('/workspaces/current/bank', {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),
};
