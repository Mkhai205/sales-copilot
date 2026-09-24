'use client';

import { useQuery } from '@tanstack/react-query';
import type { PlatformMetricsOverviewDto } from '@sales-copilot/shared-contracts';
import { metricsApi } from '../api/metrics';

export function usePlatformMetricsOverview() {
  return useQuery<PlatformMetricsOverviewDto>({
    queryKey: ['platform-admin', 'metrics', 'overview'],
    queryFn: async () => {
      const res = await metricsApi.getMetricsOverview();
      return res.data;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
