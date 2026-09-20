import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  badge,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70 shrink-0',
        className,
      )}
    >
      <div className="flex flex-col gap-1 min-w-0">
        {breadcrumbs && <div className="text-xs text-muted-foreground">{breadcrumbs}</div>}
        <div className="flex items-center gap-2 flex-wrap">
          {Icon && <Icon className="size-5 text-primary shrink-0" />}
          <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {badge && <div className="inline-flex items-center shrink-0">{badge}</div>}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-none">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
