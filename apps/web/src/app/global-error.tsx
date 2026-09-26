'use client';

import * as React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  React.useEffect(() => {
    console.error('Global Application Error:', error);
  }, [error]);

  return (
    <html lang="vi" className="h-full antialiased font-sans">
      <body className="h-full flex min-h-screen items-center justify-center bg-background p-6 text-foreground antialiased">
        <Card className="w-full max-w-md border-border bg-card shadow-2xl">
          <CardHeader className="text-center items-center pb-2">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
              <AlertTriangle className="size-6" />
            </div>
            <CardTitle className="text-lg font-semibold text-foreground">
              Sự cố hệ thống nghiêm trọng
            </CardTitle>
            <CardDescription className="text-muted-foreground text-center">
              Đã xảy ra lỗi không mong muốn trong quá trình dựng giao diện gốc. Vui lòng thử lại
              hoặc tải lại toàn bộ ứng dụng.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-2 pt-2">
            {error.digest && (
              <div className="rounded-md border border-border/50 bg-muted/40 p-2.5 text-center font-mono text-[11px] text-muted-foreground break-all select-all">
                Mã tham chiếu: {error.digest}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
            <Button variant="default" onClick={() => reset()} className="w-full sm:w-auto">
              <RotateCcw data-icon="inline-start" />
              Thử lại
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/';
              }}
              className="w-full sm:w-auto"
            >
              <Home data-icon="inline-start" />
              Tải lại trang chủ
            </Button>
          </CardFooter>
        </Card>
      </body>
    </html>
  );
}
