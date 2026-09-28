import {
  formatDistanceToNowStrict,
  format,
  isToday,
  isYesterday,
  parseISO,
  isValid,
} from 'date-fns';
import { vi } from 'date-fns/locale';

export function formatRelativeTime(dateInput: Date | string | number): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (!isValid(date)) return '';
    return formatDistanceToNowStrict(date, {
      addSuffix: false,
      locale: vi,
    });
  } catch {
    return '';
  }
}

export function formatConversationTimestamp(dateInput: Date | string | number): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (!isValid(date)) return '';

    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: vi });
    }

    if (isYesterday(date)) {
      return 'Hôm qua';
    }

    return format(date, 'dd/MM/yyyy', { locale: vi });
  } catch {
    return '';
  }
}

const VN_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/**
 * Canonical Vietnamese datetime formatter (dd/MM/yyyy HH:mm, +seconds opt-in).
 * Returns '-' for null/undefined/invalid inputs. Phase 4 decision D7: single
 * source of truth — do not add local per-component date formatters.
 */
export function formatDateTime(
  dateInput: Date | string | number | null | undefined,
  opts?: { seconds?: boolean },
): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') return '-';
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('vi-VN', {
      ...VN_DATETIME_OPTIONS,
      ...(opts?.seconds ? { second: '2-digit' } : {}),
    }).format(d);
  } catch {
    return '-';
  }
}
