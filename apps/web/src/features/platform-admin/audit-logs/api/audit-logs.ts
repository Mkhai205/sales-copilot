import { fetchApi, buildQueryString, type ApiResponse } from '@/lib/api/client';
import type {
  QueryPlatformAuditLogsDto,
  PlatformAuditLogDto,
} from '@sales-copilot/shared-contracts';

export const auditLogsApi = {
  /**
   * Fetch paginated platform audit logs with optional filtering.
   */
  async getAuditLogs(
    params?: Partial<QueryPlatformAuditLogsDto>,
  ): Promise<ApiResponse<PlatformAuditLogDto[]>> {
    const qs = buildQueryString(params);
    return fetchApi<PlatformAuditLogDto[]>(`/platform-admin/audit-logs${qs}`);
  },
};
