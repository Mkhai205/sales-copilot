'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertCircle, MessageSquare, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params?.workspaceSlug;

  React.useEffect(() => {
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-md border-border bg-card shadow-lg text-center">
        <CardHeader className="items-center pb-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">Workspace Error</CardTitle>
          <CardDescription className="text-muted-foreground text-center">
            An error occurred while loading this section of the workspace. You can retry or return
            to your conversations.
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
              Error Digest: {error.digest}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
          <Button variant="default" onClick={() => reset()} className="w-full sm:w-auto">
            <RotateCcw data-icon="inline-start" />
            Try Again
          </Button>
          {workspaceSlug && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href={`/${workspaceSlug}/conversations`}>
                <MessageSquare data-icon="inline-start" />
                Conversations
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
