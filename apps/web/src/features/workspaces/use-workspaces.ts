'use client';

import { useQuery } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api/workspaces';
import type { UserWorkspaceDto } from '@sales-copilot/shared-contracts';

export function useWorkspaces() {
  return useQuery<UserWorkspaceDto[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await workspacesApi.list();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
