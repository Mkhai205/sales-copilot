import * as React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-background overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* Ambient background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 -z-10 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -top-40 -left-40 -z-10 size-96 rounded-full bg-primary/5 blur-3xl" />

      {/* Main container */}
      <main className="w-full flex items-center justify-center">{children}</main>
    </div>
  );
}
