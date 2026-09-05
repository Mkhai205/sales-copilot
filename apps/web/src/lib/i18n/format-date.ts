import {
  formatDistanceToNowStrict,
  format,
  isToday,
  isYesterday,
  parseISO,
  isValid,
} from 'date-fns';
import { vi, enUS } from 'date-fns/locale';
import type { Locale } from './config';

const DATE_FNS_LOCALES = {
  vi,
  en: enUS,
};

export function getDateFnsLocale(locale: Locale) {
  return DATE_FNS_LOCALES[locale] || DATE_FNS_LOCALES.vi;
}

export function formatRelativeTime(
  dateInput: Date | string | number,
  locale: Locale = 'vi',
): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (!isValid(date)) return '';
    return formatDistanceToNowStrict(date, {
      addSuffix: false,
      locale: getDateFnsLocale(locale),
    });
  } catch {
    return '';
  }
}

export function formatConversationTimestamp(
  dateInput: Date | string | number,
  locale: Locale = 'vi',
): string {
  if (!dateInput) return '';
  try {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : new Date(dateInput);
    if (!isValid(date)) return '';

    const dateLocale = getDateFnsLocale(locale);

    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: dateLocale });
    }

    if (isYesterday(date)) {
      return locale === 'vi' ? 'Hôm qua' : 'Yesterday';
    }

    return format(date, 'dd/MM/yyyy', { locale: dateLocale });
  } catch {
    return '';
  }
}
