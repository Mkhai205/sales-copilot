import { fetchApi, type ApiResponse } from '@/lib/api/client';
import type { PlatformMetricsOverviewDto } from '@sales-copilot/shared-contracts';

export const metricsApi = {
  /**
   * Fetch platform metrics overview and infrastructure health status.
   */
  async getMetricsOverview(): Promise<ApiResponse<PlatformMetricsOverviewDto>> {
    return fetchApi<PlatformMetricsOverviewDto>('/platform-admin/metrics/overview');
  },
};
