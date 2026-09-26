'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
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

interface WorkspaceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkspaceError({ error, reset }: WorkspaceErrorProps) {
  const params = useParams<{ workspaceSlug: string }>();
  const workspaceSlug = params?.workspaceSlug;
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  React.useEffect(() => {
    console.error('Workspace Error:', error);
  }, [error]);

  const handleReset = () => {
    resetQueries();
    reset();
  };

  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-md border-border bg-card shadow-lg text-center">
        <CardHeader className="items-center pb-2">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">
            Lỗi không gian làm việc
          </CardTitle>
          <CardDescription className="text-muted-foreground text-center">
            Đã xảy ra sự cố trong quá trình tải dữ liệu phân hệ này. Bạn có thể thử lại hoặc quay về
            hộp thư hội thoại.
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
              Mã tham chiếu: {error.digest}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
          <Button variant="default" onClick={handleReset} className="w-full sm:w-auto">
            <RotateCcw data-icon="inline-start" />
            Thử lại
          </Button>
          {workspaceSlug && (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link href={`/${workspaceSlug}/conversations`}>
                <MessageSquare data-icon="inline-start" />
                Hộp thư hội thoại
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
