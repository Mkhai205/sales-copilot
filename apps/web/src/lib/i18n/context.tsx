'use client';

import * as React from 'react';
import { type Locale, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isValidLocale } from './config';
import { vi } from './locales/vi';
import { en } from './locales/en';
import type { TranslationKey, TranslationParams } from './types';

const DICTIONARIES: Record<Locale, typeof vi> = {
  vi,
  en,
};

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function resolveNestedValue(obj: unknown, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const keys = path.split('.');
  let current: any = obj;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;
  return Object.entries(params).reduce((acc, [key, val]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
  }, text);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: TranslationKey | (string & {}), params?: TranslationParams) => string;
  isLoaded: boolean;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    if (initialLocale && isValidLocale(initialLocale)) {
      return initialLocale;
    }
    return DEFAULT_LOCALE;
  });
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Initialize from cookie / localStorage on client mount
  React.useEffect(() => {
    let detectedLocale: Locale | null = null;

    // 1. Check cookie first
    const cookieLocale = getCookie(LOCALE_COOKIE_NAME);
    if (isValidLocale(cookieLocale)) {
      detectedLocale = cookieLocale;
    }

    // 2. Check localStorage if cookie was not set
    if (!detectedLocale) {
      try {
        const storedLocale = localStorage.getItem(LOCALE_COOKIE_NAME);
        if (isValidLocale(storedLocale)) {
          detectedLocale = storedLocale;
        }
      } catch {
        // Ignore localStorage access error in restricted environments
      }
    }

    // 3. Check browser language if neither cookie nor storage exist
    if (!detectedLocale && typeof navigator !== 'undefined') {
      const browserLang = navigator.language?.toLowerCase() || '';
      if (browserLang.startsWith('vi')) {
        detectedLocale = 'vi';
      } else if (browserLang.startsWith('en')) {
        detectedLocale = 'en';
      }
    }

    if (detectedLocale && detectedLocale !== locale) {
      setLocaleState(detectedLocale);
    }
    setIsLoaded(true);
  }, []);

  const setLocale = React.useCallback((nextLocale: Locale) => {
    if (!isValidLocale(nextLocale)) return;

    setLocaleState(nextLocale);
    setCookie(LOCALE_COOKIE_NAME, nextLocale);

    try {
      localStorage.setItem(LOCALE_COOKIE_NAME, nextLocale);
    } catch {
      // Ignore
    }

    // Update <html lang="..."> attribute for accessibility
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLocale;
    }
  }, []);

  const t = React.useCallback(
    (key: TranslationKey | (string & {}), params?: TranslationParams): string => {
      const activeDict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
      let translated = resolveNestedValue(activeDict, key);

      // Fallback to default dictionary (Vietnamese) if missing in current
      if (translated === undefined && locale !== DEFAULT_LOCALE) {
        translated = resolveNestedValue(DICTIONARIES[DEFAULT_LOCALE], key);
      }

      // Fallback to English dictionary if still missing
      if (translated === undefined && locale !== 'en') {
        translated = resolveNestedValue(DICTIONARIES.en, key);
      }

      if (translated === undefined) {
        return key;
      }

      return interpolate(translated, params);
    },
    [locale],
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      isLoaded,
    }),
    [locale, setLocale, t, isLoaded],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an <I18nProvider>');
  }
  return context;
}

export const useTranslation = useI18n;
