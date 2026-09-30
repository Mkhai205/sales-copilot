import { PlatformAuditAction, PlatformAuditTargetType } from '@sales-copilot/shared-contracts';

export interface ActionBadgeConfig {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label: string;
  className: string;
}

/**
 * Resolves UI badge variant and label for platform audit actions.
 */
export function getActionBadgeConfig(action?: string | null): ActionBadgeConfig {
  switch (action) {
    case PlatformAuditAction.WORKSPACE_SUSPENDED:
      return {
        variant: 'destructive',
        label: 'Tạm khóa Shop',
        className: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      };
    case PlatformAuditAction.WORKSPACE_ACTIVATED:
      return {
        variant: 'secondary',
        label: 'Kích hoạt Shop',
        className:
          'bg-success/15 text-success hover:bg-success/25 dark:bg-success/50 dark:text-success',
      };
    case PlatformAuditAction.PLAN_CHANGED:
      return {
        variant: 'default',
        label: 'Đổi gói cước',
        className:
          'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800',
      };
    case PlatformAuditAction.QUOTA_UPDATED:
      return {
        variant: 'default',
        label: 'Cập nhật Quota',
        className:
          'bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800',
      };
    case PlatformAuditAction.SYSTEM_SETTING_UPDATED:
      return {
        variant: 'outline',
        label: 'Sửa cấu hình',
        className:
          'bg-warning/15 text-warning border-warning/50 dark:bg-warning/50 dark:text-warning dark:border-warning',
      };
    default:
      return {
        variant: 'secondary',
        label: action || 'Hành động khác',
        className: 'bg-muted text-muted-foreground hover:bg-muted/80',
      };
  }
}

export interface TargetTypeBadgeConfig {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label: string;
  className: string;
}

/**
 * Resolves UI badge configuration for target entity types.
 */
export function getTargetTypeBadgeConfig(targetType?: string | null): TargetTypeBadgeConfig {
  switch (targetType) {
    case PlatformAuditTargetType.WORKSPACE:
      return {
        variant: 'secondary',
        label: 'Workspace',
        className: 'bg-info/15 text-info hover:bg-info/25 dark:bg-info/50 dark:text-info',
      };
    case PlatformAuditTargetType.SYSTEM_SETTING:
      return {
        variant: 'secondary',
        label: 'Cấu hình',
        className:
          'bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:bg-violet-950/50 dark:text-violet-300',
      };
    case PlatformAuditTargetType.USER:
      return {
        variant: 'secondary',
        label: 'Người dùng',
        className:
          'bg-orange-500/15 text-orange-700 hover:bg-orange-500/25 dark:bg-orange-950/50 dark:text-orange-300',
      };
    default:
      return {
        variant: 'outline',
        label: targetType || 'Khác',
        className: 'bg-muted/50 text-muted-foreground',
      };
  }
}

/**
 * Formats date/timestamp to standard Vietnamese format with seconds (dd/MM/yyyy HH:mm:ss).
 */
import { formatDateTime as libFormatDateTime } from '@/lib/format-date';

export function formatDateTime(date?: string | number | Date | null): string {
  // Audit trail keeps second precision (decision D7 delegates formatting to the shared lib)
  return libFormatDateTime(date, { seconds: true });
}

/**
 * Normalizes user-entered date string inputs to full UTC ISO range boundaries.
 * `startDate` becomes start-of-day (`00:00:00.000Z`)
 * `endDate` becomes end-of-day (`23:59:59.999Z`)
 */
export function normalizeDateFilterRange(
  startDate?: string,
  endDate?: string,
): { startDate?: string; endDate?: string } {
  let normalizedStart: string | undefined;
  let normalizedEnd: string | undefined;

  if (startDate?.trim()) {
    const trimmed = startDate.trim();
    if (trimmed.includes('T')) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) normalizedStart = d.toISOString();
    } else {
      const d = new Date(`${trimmed}T00:00:00.000Z`);
      if (!isNaN(d.getTime())) normalizedStart = d.toISOString();
    }
  }

  if (endDate?.trim()) {
    const trimmed = endDate.trim();
    if (trimmed.includes('T')) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) normalizedEnd = d.toISOString();
    } else {
      const d = new Date(`${trimmed}T23:59:59.999Z`);
      if (!isNaN(d.getTime())) normalizedEnd = d.toISOString();
    }
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
  };
}

/**
 * Checks whether the date filter range is logically valid (startDate <= endDate).
 */
export function isValidDateFilterRange(startDate?: string, endDate?: string): boolean {
  if (!startDate || !endDate) return true;
  const { startDate: start, endDate: end } = normalizeDateFilterRange(startDate, endDate);
  if (!start || !end) return true;
  return new Date(start).getTime() <= new Date(end).getTime();
}
