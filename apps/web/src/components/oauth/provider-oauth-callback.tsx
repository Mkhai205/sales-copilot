'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

export interface OAuthCallbackProviderConfig {
  broadcastChannelName: string;
  localStorageKey: string;
  successType: string;
  errorType: string;
  /** Human-facing provider name for copy (e.g. 'Facebook', 'Zalo'). */
  providerName: string;
  /** Copy shown on success while the popup auto-closes. */
  successDescription: string;
  /** Optional provider-specific error mapping (e.g. access_denied → friendly copy). */
  mapError?: (error: string) => string;
}

/**
 * Shared OAuth popup callback view: notifies the opener window (postMessage →
 * BroadcastChannel → localStorage) and auto-closes. Each provider mounts a thin
 * page passing its config.
 */
export function ProviderOAuthCallback({ config }: { config: OAuthCallbackProviderConfig }) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const rawError = searchParams.get('error');
  const [isTimedOut, setIsTimedOut] = React.useState(false);

  const displayError = rawError
    ? config.mapError
      ? config.mapError(rawError)
      : rawError
    : isTimedOut && !sessionId
      ? `Không nhận được dữ liệu xác thực từ ${config.providerName}. Vui lòng thử lại.`
      : null;

  React.useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const notifyOpener = (payload: Record<string, unknown>) => {
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
          const bc = new BroadcastChannel(config.broadcastChannelName);
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
        localStorage.setItem(
          config.localStorageKey,
          JSON.stringify({ ...payload, time: Date.now() }),
        );
      } catch {
        // ignore
      }
    };

    if (sessionId) {
      notifyOpener({ type: config.successType, sessionId });
      // Auto close after brief delay
      closeTimer = setTimeout(() => {
        try {
          window.close();
        } catch {
          // ignore
        }
      }, 800);
    } else if (rawError) {
      notifyOpener({ type: config.errorType, error: rawError });
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
  }, [sessionId, rawError, config]);

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
            {config.successDescription}
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

export function OAuthCallbackLoadingFallback() {
  return (
    <div className="flex flex-col items-center gap-3 text-center p-6 rounded-xl border border-border bg-card shadow-sm">
      <Spinner className="size-6 text-primary" />
      <p className="text-xs text-muted-foreground">Đang tải...</p>
    </div>
  );
}
