export type Locale = 'vi' | 'en';

export const DEFAULT_LOCALE: Locale = 'vi';

export const SUPPORTED_LOCALES: readonly Locale[] = ['vi', 'en'] as const;

export const LOCALE_COOKIE_NAME = 'sc_locale';

export interface LocaleMeta {
  code: Locale;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LOCALES_META: Record<Locale, LocaleMeta> = {
  vi: {
    code: 'vi',
    label: 'Vietnamese',
    nativeLabel: 'Tiếng Việt',
    flag: '🇻🇳',
  },
  en: {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    flag: '🇺🇸',
  },
};

export function isValidLocale(val: unknown): val is Locale {
  return typeof val === 'string' && (val === 'vi' || val === 'en');
}
