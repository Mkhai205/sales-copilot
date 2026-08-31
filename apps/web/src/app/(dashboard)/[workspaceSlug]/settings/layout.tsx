import * as React from 'react';
import { SettingsNav } from '@/features/settings';

interface SettingsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function SettingsLayout({ children, params }: SettingsLayoutProps) {
  const { workspaceSlug } = await params;

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-background">
      {/* Settings Navigation Sub-Sidebar */}
      <aside className="h-full w-64 md:w-72 shrink-0 border-r border-border bg-card/20">
        <SettingsNav workspaceSlug={workspaceSlug} />
      </aside>

      {/* Settings Main Content Area */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
