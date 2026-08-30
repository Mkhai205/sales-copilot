'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import type { UserDto } from '@sales-copilot/shared-contracts';

export function useCurrentUser() {
  return useQuery<UserDto>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}
