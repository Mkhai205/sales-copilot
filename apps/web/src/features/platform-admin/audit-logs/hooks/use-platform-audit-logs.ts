'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  PaginationMeta,
  PlatformAuditLogDto,
  QueryPlatformAuditLogsDto,
} from '@sales-copilot/shared-contracts';
import { auditLogsApi } from '../api/audit-logs';

export interface UsePlatformAuditLogsResult {
  items: PlatformAuditLogDto[];
  meta?: PaginationMeta;
}

/**
 * React Query hook to fetch paginated platform audit logs with filter support.
 */
export function usePlatformAuditLogs(params?: Partial<QueryPlatformAuditLogsDto>) {
  return useQuery<UsePlatformAuditLogsResult>({
    queryKey: ['platform-admin', 'audit-logs', params],
    queryFn: async () => {
      const res = await auditLogsApi.getAuditLogs(params);
      return {
        items: res.data ?? [],
        meta: res.meta,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
