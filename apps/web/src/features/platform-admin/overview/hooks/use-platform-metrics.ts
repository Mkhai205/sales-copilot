'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlatformMetricsOverviewDto } from '@sales-copilot/shared-contracts';
import { platformAdminApi } from '@/lib/api/platform-admin';

export function usePlatformMetricsOverview() {
  return useQuery<PlatformMetricsOverviewDto>({
    queryKey: ['platform-admin', 'metrics', 'overview'],
    queryFn: async () => {
      const res = await platformAdminApi.getMetricsOverview();
      return res.data;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
