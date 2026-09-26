'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

type OAuthResultPayload =
  | { type: 'FACEBOOK_OAUTH_SUCCESS'; sessionId: string }
  | { type: 'FACEBOOK_OAUTH_ERROR'; error: string };

function notifyOAuthOpener(payload: OAuthResultPayload) {
  // 1. PostMessage to opener if available (restricted to same-origin for security)
  try {
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
    }
  } catch {
    // ignore
  }

  // 2. BroadcastChannel with delayed close to prevent event drop on WebKit/Safari
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('facebook_oauth_channel');
      bc.postMessage(payload);
      setTimeout(() => {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }, 1000);
    }
  } catch {
    // ignore
  }

  // 3. LocalStorage storage event (100% reliable same-origin fallback)
  try {
    localStorage.setItem('facebook_oauth_result', JSON.stringify({ ...payload, time: Date.now() }));
  } catch {
    // ignore
  }
}

function mapFacebookError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes('access_denied') || lower.includes('user_denied')) {
    return 'Bạn đã từ chối cấp quyền truy cập Facebook.';
  }
  if (lower.includes('invalid_oauth_state')) {
    return 'Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.';
  }
  return error;
}

function FacebookOAuthCallbackContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const rawError = searchParams.get('error');
  const [isTimedOut, setIsTimedOut] = React.useState(false);

  const displayError = rawError
    ? mapFacebookError(rawError)
    : isTimedOut && !sessionId
      ? 'Không nhận được dữ liệu xác thực từ Facebook. Vui lòng thử lại.'
      : null;

  React.useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    if (sessionId) {
      notifyOAuthOpener({ type: 'FACEBOOK_OAUTH_SUCCESS', sessionId });
      // Auto close after brief delay
      closeTimer = setTimeout(() => {
        try {
          window.close();
        } catch {
          // ignore
        }
      }, 800);
    } else if (rawError) {
      notifyOAuthOpener({ type: 'FACEBOOK_OAUTH_ERROR', error: rawError });
    } else {
      // Timeout guard: if neither sessionId nor error arrives after 5s, exit infinite spinner
      const timeoutId = setTimeout(() => {
        setIsTimedOut(true);
      }, 5000);
      return () => clearTimeout(timeoutId);
    }

    return () => {
      if (closeTimer) clearTimeout(closeTimer);
    };
  }, [sessionId, rawError]);

  return (
    <div className="flex flex-col items-center gap-3 text-center max-w-sm p-6 rounded-xl border border-border bg-card shadow-sm">
      {displayError ? (
        <>
          <XCircle className="size-10 text-destructive" />
          <h2 className="text-sm font-semibold">Kết nối thất bại</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{displayError}</p>
          <Button size="sm" variant="outline" onClick={() => window.close()} className="mt-2">
            Đóng cửa sổ
          </Button>
        </>
      ) : sessionId ? (
        <>
          <CheckCircle2 className="size-10 text-primary" />
          <h2 className="text-sm font-semibold">Kết nối thành công!</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Đang đồng bộ danh sách Fanpage của bạn, cửa sổ sẽ tự động đóng...
          </p>
          <Button size="sm" variant="outline" onClick={() => window.close()} className="mt-2">
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

function FacebookOAuthLoadingFallback() {
  return (
    <div className="flex flex-col items-center gap-3 text-center p-6 rounded-xl border border-border bg-card shadow-sm">
      <Spinner className="size-6 text-primary" />
      <p className="text-xs text-muted-foreground">Đang tải...</p>
    </div>
  );
}

export default function FacebookOAuthCallbackPage() {
  return (
    <div className="flex items-center justify-center">
      <React.Suspense fallback={<FacebookOAuthLoadingFallback />}>
        <FacebookOAuthCallbackContent />
      </React.Suspense>
    </div>
  );
}
