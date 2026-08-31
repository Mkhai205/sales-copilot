'use client';

import { useRealtimeSync } from './use-realtime-sync';

/**
 * Headless synchronizer component that connects all WebSocket domain events
 * directly to the TanStack Query cache.
 */
export function RealtimeSync() {
  useRealtimeSync();
  return null;
}
