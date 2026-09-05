import * as React from 'react';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-background">
      {/* Settings Main Content Area */}
      <main className="flex-1 min-w-0 h-full overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
