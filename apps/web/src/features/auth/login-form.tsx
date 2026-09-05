'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { loginSchema, type LoginDto } from '@sales-copilot/shared-contracts';
import { loginAction } from './actions';
import {
  AlertCircleIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  HeadphonesIcon,
  SparklesIcon,
} from 'lucide-react';

const TEST_ACCOUNTS = [
  {
    role: 'Super Admin',
    name: 'Super Administrator',
    email: 'superadmin@salescopilot.io',
    password: 'SalesCopilot@2026!',
    icon: ShieldCheckIcon,
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  {
    role: 'Admin',
    name: 'Workspace Admin',
    email: 'admin@salescopilot.io',
    password: 'SalesCopilot@2026!',
    icon: UserCheckIcon,
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  {
    role: 'Agent',
    name: 'Sarah Agent',
    email: 'agent@salescopilot.io',
    password: 'SalesCopilot@2026!',
    icon: HeadphonesIcon,
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
];

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleSelectTestAccount = (account: (typeof TEST_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setFieldErrors({});
    setApiError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setApiError(null);
    setFieldErrors({});

    const formData: LoginDto = { email, password };

    // Client-side schema validation
    const parseResult = loginSchema.safeParse(formData);
    if (!parseResult.success) {
      const formatted: { email?: string; password?: string } = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path[0] as 'email' | 'password';
        if (fieldName && !formatted[fieldName]) {
          formatted[fieldName] = issue.message;
        }
      }
      setFieldErrors(formatted);
      return;
    }

    setIsPending(true);

    try {
      const result = await loginAction(formData);
      if (result && !result.success && result.error) {
        setApiError(result.error.message || 'Login failed. Please check your credentials.');
        setIsPending(false);
      }
    } catch (err: any) {
      // Next.js redirect may throw NEXT_REDIRECT in internal client router handling, which shouldn't be treated as error
      if (err?.digest?.startsWith('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') {
        return;
      }
      setApiError(err?.message || 'An unexpected error occurred. Please try again.');
      setIsPending(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6 w-full', className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-lg border-border/80 bg-card">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Left: Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 flex flex-col justify-center">
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 mb-2">
                <div className="flex items-center justify-center mb-1">
                  <Image
                    src="/brand/logo.png"
                    alt="Sales Copilot"
                    width={180}
                    height={60}
                    priority
                    unoptimized
                    className="h-10 w-auto object-contain dark:hidden"
                  />
                  <Image
                    src="/brand/logo-dark.png"
                    alt="Sales Copilot"
                    width={180}
                    height={60}
                    priority
                    unoptimized
                    className="hidden h-10 w-auto object-contain dark:block"
                  />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                <p className="text-xs text-muted-foreground text-center">
                  Sign in to your account to access conversations
                </p>
              </div>

              {apiError && (
                <Alert variant="destructive" className="py-2.5 px-3">
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription className="text-xs">{apiError}</AlertDescription>
                </Alert>
              )}

              <Field data-invalid={!!fieldErrors.email}>
                <FieldLabel htmlFor="email" className="text-xs font-medium">
                  Email address
                </FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  className="h-9"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isPending}
                  required
                />
                {fieldErrors.email && <FieldError>{fieldErrors.email}</FieldError>}
              </Field>

              <Field data-invalid={!!fieldErrors.password}>
                <div className="flex items-center justify-between w-full">
                  <FieldLabel htmlFor="password" className="text-xs font-medium">
                    Password
                  </FieldLabel>
                  <a
                    href="#"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  className="h-9"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isPending}
                  required
                />
                {fieldErrors.password && <FieldError>{fieldErrors.password}</FieldError>}
              </Field>

              <Field className="mt-1">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-9 font-medium shadow-sm cursor-pointer"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Spinner className="mr-2" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </Field>

              {/* Quick Test Accounts Section */}
              <div className="mt-3 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <SparklesIcon className="size-3 text-primary" />
                    <span>Test Accounts</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">1-Click Fill</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {TEST_ACCOUNTS.map(acc => {
                    const Icon = acc.icon;
                    const isSelected = email === acc.email;
                    return (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleSelectTestAccount(acc)}
                        disabled={isPending}
                        className={cn(
                          'flex flex-col items-start gap-1 p-2 rounded-md border text-left transition-all cursor-pointer',
                          'hover:border-primary/50 hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring',
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-xs'
                            : 'border-border/60 bg-card/60',
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                              acc.badgeClass,
                            )}
                          >
                            <Icon className="size-2.5" />
                            {acc.role}
                          </span>
                        </div>
                        <span
                          className="text-[10px] text-muted-foreground font-mono truncate w-full"
                          title={acc.email}
                        >
                          {acc.email.split('@')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <FieldDescription className="text-center mt-1 text-xs">
                Don&apos;t have an account?{' '}
                <a href="#" className="font-medium text-primary hover:underline">
                  Sign up
                </a>
              </FieldDescription>
            </FieldGroup>
          </form>

          {/* Right: Feature Showcase Panel */}
          <div className="relative hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-primary/15 via-primary/5 to-muted border-l border-border/60">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20">
                Omnichannel Platform
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Unified Customer Conversations & AI Sales Copilot
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect Facebook, Zalo, Telegram, Email, and Web Chat in a single real-time inbox.
              </p>
            </div>

            {/* Visual Illustration */}
            <div className="my-auto flex items-center justify-center py-3">
              <Image
                src="/auth-showcase.svg"
                alt="Sales Copilot Omnichannel Chat"
                width={300}
                height={220}
                priority
                className="max-h-48 w-auto object-contain drop-shadow-sm"
              />
            </div>

            <div className="space-y-2.5 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span>Real-time WebSocket event streaming</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-blue-500 shrink-0" />
                <span>Multi-tenant workspace isolation</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-purple-500 shrink-0" />
                <span>Smart agent auto-assignment & canned replies</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
        By clicking continue, you agree to our{' '}
        <a href="#" className="underline hover:text-primary">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="underline hover:text-primary">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  );
}
