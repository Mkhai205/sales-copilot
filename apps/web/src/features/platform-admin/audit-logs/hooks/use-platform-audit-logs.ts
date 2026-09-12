'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  PaginationMeta,
  PlatformAuditLogDto,
  QueryPlatformAuditLogsDto,
} from '@sales-copilot/shared-contracts';
import { platformAdminApi } from '@/lib/api/platform-admin';

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
      const res = await platformAdminApi.getAuditLogs(params);
      return {
        items: res.data ?? [],
        meta: res.meta,
      };
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/**
 * React Query hook to fetch single platform audit log entry by ID.
 */
export function usePlatformAuditLogDetail(id?: string | null) {
  return useQuery<PlatformAuditLogDto>({
    queryKey: ['platform-admin', 'audit-logs', 'detail', id],
    queryFn: async () => {
      if (!id) throw new Error('Audit Log ID is required');
      const res = await platformAdminApi.getAuditLogById(id);
      return res.data;
    },
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}
