import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { AppProviders } from '@/providers/app-providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Sales Copilot Platform',
  description: 'Omnichannel Conversation & AI Sales Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('h-full', 'antialiased', 'font-sans', 'font-sans', inter.variable)}
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
