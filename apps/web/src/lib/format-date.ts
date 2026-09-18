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
