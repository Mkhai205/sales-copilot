import { SystemServiceHealthStatus } from '@sales-copilot/shared-contracts';

export interface HealthBadgeConfig {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label: string;
  dotClass: string;
  pulse: boolean;
  className: string;
}

/**
 * Calculates active ratio percentage safely (handles 0 total, negative numbers, etc.).
 * Returns an integer percentage from 0 to 100.
 */
export function calculateActiveRatio(active?: number | null, total?: number | null): number {
  if (!active || !total || total <= 0 || active <= 0 || !isFinite(active) || !isFinite(total)) {
    return 0;
  }
  if (active >= total) {
    return 100;
  }
  return Math.round((active / total) * 100);
}

/**
 * Resolves UI badge configuration, visual indicator colors, and labels for service health status.
 */
export function getHealthBadgeConfig(
  status?: SystemServiceHealthStatus | string | null,
): HealthBadgeConfig {
  switch (status) {
    case 'HEALTHY':
      return {
        variant: 'secondary',
        label: 'Hoạt động bình thường',
        dotClass: 'bg-emerald-500',
        pulse: true,
        className:
          'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-300',
      };
    case 'DEGRADED':
      return {
        variant: 'secondary',
        label: 'Hiệu năng suy giảm',
        dotClass: 'bg-amber-500',
        pulse: true,
        className:
          'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/20 dark:bg-amber-950/50 dark:text-amber-300',
      };
    case 'DOWN':
      return {
        variant: 'destructive',
        label: 'Mất kết nối',
        dotClass: 'bg-rose-500',
        pulse: false,
        className:
          'bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/20',
      };
    default:
      return {
        variant: 'outline',
        label: 'Không xác định',
        dotClass: 'bg-muted-foreground',
        pulse: false,
        className: 'text-muted-foreground',
      };
  }
}

/**
 * Formats integer metric counts with localized thousands separators (e.g. 12500 -> 12.500).
 */
export function formatMetricNumber(num?: number | null): string {
  if (num === undefined || num === null || !isFinite(num)) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.floor(num)));
}

/**
 * Formats average decimal metrics with localized precision (e.g. 3.5 -> "3,5", 3.0 -> "3").
 */
export function formatAverageNumber(num?: number | null, maxDecimals = 1): string {
  if (num === undefined || num === null || !isFinite(num) || num <= 0) {
    return '0';
  }
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(num);
}
