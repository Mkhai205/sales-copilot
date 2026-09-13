'use client';

import * as React from 'react';
import { ThemeProvider } from './theme-provider';
import { QueryProvider } from './query-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

import { I18nProvider, type Locale } from '@/lib/i18n';

export interface AppProvidersProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function AppProviders({ children, initialLocale }: AppProvidersProps) {
  return (
    <I18nProvider initialLocale={initialLocale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <QueryProvider>
          <TooltipProvider>
            {children}
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </QueryProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
