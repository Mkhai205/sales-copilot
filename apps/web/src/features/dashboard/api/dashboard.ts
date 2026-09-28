import { fetchApi, workspaceHeaders, buildQueryString } from '@/lib/api/client';
import type { DashboardSummaryDto } from '@sales-copilot/shared-contracts';

export interface DashboardSummaryParams {
  from?: string;
  to?: string;
}

export const dashboardApi = {
  getSummary: (workspaceId: string, params?: DashboardSummaryParams) =>
    fetchApi<DashboardSummaryDto>(`/dashboard/summary${buildQueryString(params)}`, {
      headers: workspaceHeaders(workspaceId),
    }),
};
