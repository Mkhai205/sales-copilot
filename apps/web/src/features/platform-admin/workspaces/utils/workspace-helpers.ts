import { BillingPlanType } from '@sales-copilot/shared-contracts';

/**
 * Resolves UI badge variant and label for billing plans.
 */
export function getPlanBadgeConfig(plan?: BillingPlanType | string | null): {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label: string;
  className: string;
} {
  const normalized = (plan || 'FREE').toUpperCase();

  switch (normalized) {
    case BillingPlanType.ENTERPRISE:
      return {
        variant: 'default',
        label: 'ENTERPRISE',
        className:
          'bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800',
      };
    case BillingPlanType.STANDARD:
      return {
        variant: 'default',
        label: 'STANDARD',
        className:
          'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800',
      };
    case BillingPlanType.FREE:
    default:
      return {
        variant: 'secondary',
        label: 'FREE',
        className: 'bg-muted text-muted-foreground hover:bg-muted/80',
      };
  }
}

/**
 * Resolves UI badge variant and label for workspace suspension status.
 */
export function getStatusBadgeConfig(isSuspended?: boolean): {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label: string;
  className: string;
} {
  if (isSuspended) {
    return {
      variant: 'destructive',
      label: 'Đã tạm khóa',
      className: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    };
  }

  return {
    variant: 'secondary',
    label: 'Đang hoạt động',
    className:
      'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-950/50 dark:text-emerald-300',
  };
}

/**
 * Formats token count with thousands separators (e.g. 50,000 -> 50.000).
 */
export function formatTokens(tokens?: number | null): string {
  if (tokens === undefined || tokens === null || !isFinite(tokens)) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.floor(tokens)));
}

/**
 * Formats storage in megabytes to MB or GB with clean precision.
 */
export function formatStorage(mb?: number | null): string {
  if (mb === undefined || mb === null || !isFinite(mb)) {
    return '0 MB';
  }

  const safeMb = Math.max(0, mb);
  if (safeMb >= 1024) {
    const gb = safeMb / 1024;
    const rounded = Number.isInteger(gb) ? gb.toString() : gb.toFixed(1);
    return `${rounded} GB`;
  }

  return `${Math.round(safeMb)} MB`;
}

/**
 * Formats date/timestamp to standard Vietnamese format (dd/MM/yyyy HH:mm).
 */
export function formatDateTime(date?: string | number | Date | null): string {
  if (!date && date !== 0) return '-';

  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (!(d instanceof Date) || isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '-';
  }
}
