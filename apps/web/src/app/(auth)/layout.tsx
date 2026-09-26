const BACKGROUND_GRID_STYLE: React.CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(45deg, color-mix(in oklch, var(--primary) 7%, transparent) 0, color-mix(in oklch, var(--primary) 7%, transparent) 1px, transparent 1px, transparent 20px),
    repeating-linear-gradient(-45deg, color-mix(in oklch, var(--primary) 7%, transparent) 0, color-mix(in oklch, var(--primary) 7%, transparent) 1px, transparent 1px, transparent 20px)
  `,
  backgroundSize: '40px 40px',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      {/* Dynamic Grid using theme primary color token */}
      <div className="pointer-events-none absolute inset-0 -z-10" style={BACKGROUND_GRID_STYLE} />
      {/* Content */}
      {children}
    </div>
  );
}
