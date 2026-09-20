'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard-client';
import { dashboardKeys } from '@/lib/query-keys';

export function useDashboardSummary(workspaceId?: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(workspaceId),
    queryFn: async () => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }
      const res = await dashboardApi.getSummary(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
  });
}
