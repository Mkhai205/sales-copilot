'use client';

import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '../api';

import type { UserWorkspaceDto } from '@sales-copilot/shared-contracts';

import { workspaceKeys } from '@/lib/query-keys';

export function useWorkspaces() {
  return useQuery<UserWorkspaceDto[]>({
    queryKey: workspaceKeys.all,
    queryFn: async () => {
      const res = await workspacesApi.list();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
