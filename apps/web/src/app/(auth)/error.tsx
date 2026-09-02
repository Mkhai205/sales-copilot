'use client';

import * as React from 'react';
import Link from 'next/link';
import { LogIn, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps) {
  React.useEffect(() => {
    console.error('Authentication Error:', error);
  }, [error]);

  return (
    <Card className="w-full max-w-sm border-border bg-card shadow-2xl text-center">
      <CardHeader className="items-center pb-2">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
          <ShieldAlert className="size-6" />
        </div>
        <CardTitle className="text-lg font-semibold text-foreground">
          Authentication Error
        </CardTitle>
        <CardDescription className="text-muted-foreground text-center">
          We encountered an issue during the authentication process. Please try again or return to
          the sign-in page.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 pt-2">
        {error.message && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-center text-xs text-muted-foreground">
            {error.message}
          </div>
        )}
        {error.digest && (
          <div className="font-mono text-[11px] text-muted-foreground/80">
            Reference ID: {error.digest}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
        <Button variant="default" onClick={() => reset()} className="w-full sm:w-auto">
          <RotateCcw data-icon="inline-start" />
          Try Again
        </Button>
        <Button variant="outline" asChild className="w-full sm:w-auto">
          <Link href="/login">
            <LogIn data-icon="inline-start" />
            Back to Login
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
