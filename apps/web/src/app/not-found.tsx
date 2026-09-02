'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-md border-border bg-card shadow-2xl text-center">
        <CardHeader className="items-center pb-2">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <Compass className="size-7" />
          </div>
          <div className="text-6xl font-extrabold tracking-tight text-primary">404</div>
          <CardTitle className="text-xl font-bold text-foreground mt-2">Page Not Found</CardTitle>
          <CardDescription className="text-muted-foreground text-center">
            The page or workspace resource you are looking for might have been moved, deleted, or
            does not exist.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          <p className="text-xs text-muted-foreground">
            Please verify the URL in the address bar or navigate back to your workspace dashboard.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
          <Button variant="default" asChild className="w-full sm:w-auto">
            <Link href="/">
              <Home data-icon="inline-start" />
              Return to Home
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/';
              }
            }}
            className="w-full sm:w-auto"
          >
            <ArrowLeft data-icon="inline-start" />
            Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
