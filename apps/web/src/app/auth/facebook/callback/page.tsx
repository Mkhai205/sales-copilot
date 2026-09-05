'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

function FacebookOAuthCallbackContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const error = searchParams.get('error');

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (sessionId) {
      // 1. PostMessage to opener if available
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'FACEBOOK_OAUTH_SUCCESS', sessionId }, '*');
        }
      } catch {
        // ignore
      }

      // 2. BroadcastChannel
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('facebook_oauth_channel');
          bc.postMessage({ type: 'FACEBOOK_OAUTH_SUCCESS', sessionId });
          bc.close();
        }
      } catch {
        // ignore
      }

      // 3. LocalStorage storage event (100% reliable same-origin communication)
      try {
        localStorage.setItem(
          'facebook_oauth_result',
          JSON.stringify({ type: 'FACEBOOK_OAUTH_SUCCESS', sessionId, time: Date.now() }),
        );
      } catch {
        // ignore
      }

      // Auto close after brief delay
      timer = setTimeout(() => {
        try {
          window.close();
        } catch {
          // ignore
        }
      }, 800);
    } else if (error) {
      try {
        if (window.opener) {
          window.opener.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', error }, '*');
        }
      } catch {
        // ignore
      }
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('facebook_oauth_channel');
          bc.postMessage({ type: 'FACEBOOK_OAUTH_ERROR', error });
          bc.close();
        }
      } catch {
        // ignore
      }
      try {
        localStorage.setItem(
          'facebook_oauth_result',
          JSON.stringify({ type: 'FACEBOOK_OAUTH_ERROR', error, time: Date.now() }),
        );
      } catch {
        // ignore
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, error]);

  return (
    <div className="flex flex-col items-center gap-3 text-center max-w-sm p-6 rounded-xl border border-border bg-card shadow-sm">
      {error ? (
        <>
          <XCircle className="size-10 text-destructive" />
          <h2 className="text-sm font-semibold">Kết nối thất bại</h2>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.close()}
            className="mt-2 text-xs"
          >
            Đóng cửa sổ
          </Button>
        </>
      ) : sessionId ? (
        <>
          <CheckCircle2 className="size-10 text-emerald-500 animate-in zoom-in-50" />
          <h2 className="text-sm font-semibold">Kết nối thành công!</h2>
          <p className="text-xs text-muted-foreground">
            Đang đồng bộ danh sách Fanpage của bạn, cửa sổ sẽ tự động đóng...
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.close()}
            className="mt-2 text-xs"
          >
            Đóng cửa sổ
          </Button>
        </>
      ) : (
        <>
          <Spinner className="size-6 text-primary" />
          <p className="text-xs text-muted-foreground">Đang xử lý xác thực...</p>
        </>
      )}
    </div>
  );
}

export default function FacebookOAuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background text-foreground">
      <React.Suspense
        fallback={
          <div className="flex flex-col items-center gap-3 text-center max-w-sm p-6 rounded-xl border border-border bg-card shadow-sm">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs text-muted-foreground">Đang tải...</p>
          </div>
        }
      >
        <FacebookOAuthCallbackContent />
      </React.Suspense>
    </div>
  );
}
