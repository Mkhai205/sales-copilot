'use client';

import * as React from 'react';
import { toast } from 'sonner';

/**
 * Per-provider wiring for the shared OAuth popup hook — each provider supplies its
 * transport endpoints and the message names its callback page broadcasts.
 */
export interface OAuthPopupProviderConfig {
  /** Human-facing provider name used in toasts (e.g. 'Facebook', 'Zalo'). */
  providerName: string;
  broadcastChannelName: string;
  localStorageKey: string;
  /** Message type prefix broadcast by the provider's callback page (e.g. 'FACEBOOK_OAUTH_'). */
  messageTypePrefix: string;
  /** Frontend path the API redirects the popup to after authorization. */
  callbackPath: string;
  popupName: string;
  getAuthUrl: (
    workspaceId: string,
    origin: string,
    returnUrl: string,
  ) => Promise<{ data: { authUrl: string } }>;
}

interface UseOAuthPopupOptions {
  workspaceId: string;
  onSuccess: (sessionId: string) => void;
  onError?: (error: string) => void;
}

interface OAuthResultEventData {
  type: string; // `${prefix}SUCCESS` | `${prefix}ERROR`
  sessionId?: string;
  error?: string;
}

/**
 * Shared OAuth popup flow used by Facebook and Zalo channel connections:
 * opens a popup synchronously on user click (anti-popup-blocker), navigates it to the
 * provider's authorization URL, and listens for the callback page's result via
 * BroadcastChannel / storage event / postMessage.
 */
export function useOAuthPopup(
  config: OAuthPopupProviderConfig,
  { workspaceId, onSuccess, onError }: UseOAuthPopupOptions,
) {
  const [isConnecting, setIsConnecting] = React.useState(false);
  const checkClosedTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable callbacks via refs to prevent unnecessary re-subscriptions
  const onSuccessRef = React.useRef(onSuccess);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const handleOAuthEvent = React.useCallback(
    (data: OAuthResultEventData) => {
      if (checkClosedTimerRef.current) {
        clearInterval(checkClosedTimerRef.current);
        checkClosedTimerRef.current = null;
      }
      setIsConnecting(false);

      if (data.type === `${config.messageTypePrefix}SUCCESS` && data.sessionId) {
        onSuccessRef.current?.(data.sessionId);
      } else if (data.type === `${config.messageTypePrefix}ERROR`) {
        onErrorRef.current?.(data.error || `Xác thực ${config.providerName} thất bại`);
      }
    },
    [config.messageTypePrefix, config.providerName],
  );

  // Multi-channel listener (BroadcastChannel, Storage event, PostMessage)
  React.useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel(config.broadcastChannelName);
        bc.onmessage = (event: MessageEvent<OAuthResultEventData>) => {
          if (event.data?.type?.startsWith(config.messageTypePrefix)) {
            handleOAuthEvent(event.data);
          }
        };
      }
    } catch {
      // ignore BroadcastChannel errors
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === config.localStorageKey && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as OAuthResultEventData;
          if (parsed?.type?.startsWith(config.messageTypePrefix)) {
            handleOAuthEvent(parsed);
          }
        } catch {
          // ignore parsing error
        }
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof window !== 'undefined' && event.origin === window.location.origin) {
        const data = event.data as OAuthResultEventData;
        if (data?.type?.startsWith(config.messageTypePrefix)) {
          handleOAuthEvent(data);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('message', handleMessage);

    return () => {
      if (bc) {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
      if (checkClosedTimerRef.current) {
        clearInterval(checkClosedTimerRef.current);
      }
    };
  }, [
    config.broadcastChannelName,
    config.localStorageKey,
    config.messageTypePrefix,
    handleOAuthEvent,
  ]);

  const openOAuthPopup = React.useCallback(async () => {
    if (!workspaceId || isConnecting) return;

    if (typeof window === 'undefined') return;

    // 1. Open popup immediately in synchronous user click handler (anti-popup blocker)
    const popupWidth = 600;
    const popupHeight = 700;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;
    const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,status=yes`;

    const popup = window.open('about:blank', config.popupName, popupFeatures);
    if (!popup) {
      toast.error(
        `Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép popup để tiếp tục kết nối ${config.providerName}.`,
      );
      return;
    }

    setIsConnecting(true);

    // Monitor if user manually closes popup window before completing
    if (checkClosedTimerRef.current) {
      clearInterval(checkClosedTimerRef.current);
    }
    checkClosedTimerRef.current = setInterval(() => {
      if (popup.closed) {
        if (checkClosedTimerRef.current) {
          clearInterval(checkClosedTimerRef.current);
          checkClosedTimerRef.current = null;
        }
        setIsConnecting(false);
      }
    }, 500);

    try {
      const origin = window.location.origin;
      const returnUrl = `${origin}${config.callbackPath}`;
      const res = await config.getAuthUrl(workspaceId, origin, returnUrl);

      if (popup && !popup.closed) {
        popup.location.href = res.data.authUrl;
        popup.focus();
      }
    } catch (err: unknown) {
      if (popup && !popup.closed) {
        popup.close();
      }
      setIsConnecting(false);
      const message =
        err instanceof Error ? err.message : `Không thể khởi tạo ủy quyền ${config.providerName}`;
      toast.error(message);
    }
  }, [config, workspaceId, isConnecting]);

  return {
    openOAuthPopup,
    isConnecting,
  };
}
