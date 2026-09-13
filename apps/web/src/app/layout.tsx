import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { cn } from '@/lib/utils';
import { AppProviders } from '@/providers/app-providers';
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isValidLocale, type Locale } from '@/lib/i18n';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Sales Copilot Platform',
  description: 'Omnichannel Conversation & AI Sales Platform',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale: Locale = isValidLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn('h-full', 'antialiased', 'font-sans', inter.variable)}
    >
      <body className="h-full overflow-hidden bg-background text-foreground antialiased">
        <AppProviders initialLocale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
