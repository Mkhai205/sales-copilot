'use client';

import * as React from 'react';
import { RealtimeSync, SocketProvider } from '@/lib/socket';

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
