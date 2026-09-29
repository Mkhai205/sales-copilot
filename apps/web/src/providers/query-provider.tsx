'use client';

import { useState } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ApiClientError } from '@/lib/api/client';

/**
 * Session-expiry recovery: when any query or mutation receives a 401 the
 * httpOnly access cookie is expired (the proxy only refreshes on navigation),
 * so send the user to /login preserving the attempted location. Skipped when
 * already on /login — that page runs no queries.
 */
function handleUnauthorized(error: unknown) {
  if (
    typeof window === 'undefined' ||
    window.location.pathname.startsWith('/login') ||
    !(error instanceof ApiClientError) ||
    error.status !== 401
  ) {
    return;
  }
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?redirect=${redirect}`;
}

/**
 * Client errors are deterministic — retrying 400/401/403/404/409/422 just
 * delays the error surface. Network failures and 408/5xx get 2 attempts.
 */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 409, 422]);
const MAX_RETRIES = 2;

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiClientError && NON_RETRYABLE_STATUSES.has(error.status)) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleUnauthorized }),
        mutationCache: new MutationCache({ onError: handleUnauthorized }),
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30s
            retry: shouldRetryQuery,
            // Realtime updates arrive via socket; staleTime + polling cover
            // the rest. Focus refetch would burst across every cached query.
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
