import * as React from 'react';
import { WorkspaceClientProviders } from '@/providers/workspace-client-providers';

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceClientProviders>
      <div className="h-full min-h-0 w-full overflow-hidden">{children}</div>
    </WorkspaceClientProviders>
  );
}
