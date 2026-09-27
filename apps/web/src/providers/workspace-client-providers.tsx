'use client';

import { RealtimeSync } from '@/lib/socket/realtime-sync';
import { SocketProvider } from '@/lib/socket/socket-provider';

export interface WorkspaceClientProvidersProps {
  children: React.ReactNode;
}

export function WorkspaceClientProviders({ children }: WorkspaceClientProvidersProps) {
  return (
    <SocketProvider>
      <RealtimeSync />
      {children}
    </SocketProvider>
  );
}
