'use client';

import * as React from 'react';
import { RealtimeSync, SocketProvider } from '@/lib/socket';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <RealtimeSync />
      <div className="h-full min-h-0 w-full overflow-hidden">{children}</div>
    </SocketProvider>
  );
}
