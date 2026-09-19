import { fetchApi, workspaceHeaders } from '@/lib/api/client';
import type { DashboardSummaryDto } from '@sales-copilot/shared-contracts';

export const dashboardApi = {
  getSummary: (workspaceId: string) =>
    fetchApi<DashboardSummaryDto>(`/workspaces/${workspaceId}/dashboard/summary`, {
      headers: workspaceHeaders(workspaceId),
    }),
};
