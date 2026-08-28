'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { loginSchema } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { loginAction } from './actions';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setValidationErrors({});
    setServerError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    // Validate client-side
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'email') {
          fieldErrors.email = 'Please enter a valid email address';
        } else if (issue.path[0] === 'password') {
          fieldErrors.password = 'Password must be at least 6 characters';
        }
      }
      setValidationErrors(fieldErrors);
      return;
    }

    setValidationErrors({});

    startTransition(async () => {
      const result = await loginAction({ email, password });
      if (result && !result.success && result.error) {
        setServerError(result.error.message);
      }
    });
  };

  return (
    <div className="w-full max-w-md">
      {/* Background card with glass effect */}
      <div className="relative rounded-2xl border border-border/80 bg-card/80 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300">
        {/* Glow Accent Top */}
        <div className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-32 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Sparkles className="size-5" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 mb-2">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/5 py-0.5 text-xs text-primary font-medium"
            >
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Omnichannel Engine Active
            </Badge>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales Copilot</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in to access unified inbox, contacts, and AI sales intelligence
          </p>
        </div>

        {/* Server Error Callout */}
        {serverError && (
          <Alert variant="destructive" className="mb-6 animate-in fade-in-50">
            <AlertCircle className="size-4" />
            <AlertTitle>Authentication Failed</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="flex items-center justify-between text-xs font-medium text-foreground/90"
            >
              <span>Work Email</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (validationErrors.email) {
                    setValidationErrors(prev => ({ ...prev, email: undefined }));
                  }
                }}
                disabled={isPending}
                autoFocus
                autoComplete="email"
                className="h-10 pl-9.5 pr-3 text-sm focus-visible:ring-primary/40"
                aria-invalid={!!validationErrors.email}
              />
            </div>
            {validationErrors.email && (
              <p className="text-xs font-medium text-destructive animate-in fade-in-50">
                {validationErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-foreground/90">
              <label htmlFor="login-password">Password</label>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (validationErrors.password) {
                    setValidationErrors(prev => ({
                      ...prev,
                      password: undefined,
                    }));
                  }
                }}
                disabled={isPending}
                autoComplete="current-password"
                className="h-10 pl-9.5 pr-10 text-sm focus-visible:ring-primary/40"
                aria-invalid={!!validationErrors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                disabled={isPending}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {validationErrors.password && (
              <p className="text-xs font-medium text-destructive animate-in fade-in-50">
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="w-full mt-2 h-10 text-sm font-semibold tracking-wide shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Verifying credentials...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                Sign in to Dashboard
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
        </form>

        {/* Development Quick Fill Helpers */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-6 pt-5 border-t border-border/60">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-primary" />
                Dev Quick Fill:
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@salescopilot.io', 'Admin123456!')}
                className="flex-1 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground/80 hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                <div className="font-semibold text-primary">Admin</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  admin@salescopilot.io
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('agent@salescopilot.io', 'Agent123456!')}
                className="flex-1 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground/80 hover:bg-accent/40 hover:text-foreground transition-colors"
              >
                <div className="font-semibold text-accent-foreground">Agent</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  agent@salescopilot.io
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Note */}
      <p className="mt-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <ShieldCheck className="size-3.5 text-emerald-500" />
        Multi-tenant isolation & end-to-end encrypted sessions
      </p>
    </div>
  );
}
