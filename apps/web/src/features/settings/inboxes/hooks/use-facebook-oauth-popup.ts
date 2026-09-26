'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { facebookApi } from '../api/facebook';

interface UseFacebookOAuthPopupOptions {
  workspaceId: string;
  onSuccess: (sessionId: string) => void;
  onError?: (error: string) => void;
}

interface OAuthResultEventData {
  type: 'FACEBOOK_OAUTH_SUCCESS' | 'FACEBOOK_OAUTH_ERROR';
  sessionId?: string;
  error?: string;
}

export function useFacebookOAuthPopup({
  workspaceId,
  onSuccess,
  onError,
}: UseFacebookOAuthPopupOptions) {
  const [isConnecting, setIsConnecting] = React.useState(false);
  const popupRef = React.useRef<Window | null>(null);
  const checkClosedTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable callbacks via refs to prevent unnecessary re-subscriptions
  const onSuccessRef = React.useRef(onSuccess);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);

  const handleOAuthEvent = React.useCallback((data: OAuthResultEventData) => {
    if (checkClosedTimerRef.current) {
      clearInterval(checkClosedTimerRef.current);
      checkClosedTimerRef.current = null;
    }
    setIsConnecting(false);

    if (data.type === 'FACEBOOK_OAUTH_SUCCESS' && data.sessionId) {
      onSuccessRef.current?.(data.sessionId);
    } else if (data.type === 'FACEBOOK_OAUTH_ERROR') {
      onErrorRef.current?.(data.error || 'Xác thực Facebook thất bại');
    }
  }, []);

  // Multi-channel listener (BroadcastChannel, Storage event, PostMessage)
  React.useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('facebook_oauth_channel');
        bc.onmessage = (event: MessageEvent<OAuthResultEventData>) => {
          if (event.data?.type?.startsWith('FACEBOOK_OAUTH_')) {
            handleOAuthEvent(event.data);
          }
        };
      }
    } catch {
      // ignore BroadcastChannel errors
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'facebook_oauth_result' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as OAuthResultEventData;
          if (parsed?.type?.startsWith('FACEBOOK_OAUTH_')) {
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
        if (data?.type?.startsWith('FACEBOOK_OAUTH_')) {
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
  }, [handleOAuthEvent]);

  const openOAuthPopup = React.useCallback(async () => {
    if (!workspaceId || isConnecting) return;

    if (typeof window === 'undefined') return;

    // 1. Open popup immediately in synchronous user click handler (anti-popup blocker)
    const popupWidth = 600;
    const popupHeight = 700;
    const left = window.screenX + (window.outerWidth - popupWidth) / 2;
    const top = window.screenY + (window.outerHeight - popupHeight) / 2;
    const popupFeatures = `width=${popupWidth},height=${popupHeight},left=${left},top=${top},scrollbars=yes,status=yes`;

    const popup = window.open('about:blank', 'facebook_oauth_popup', popupFeatures);
    if (!popup) {
      toast.error(
        'Trình duyệt đã chặn cửa sổ Popup. Vui lòng cho phép popup để tiếp tục kết nối Facebook.',
      );
      return;
    }

    popupRef.current = popup;
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
      const returnUrl = `${origin}/auth/facebook/callback`;
      const res = await facebookApi.getAuthUrl(workspaceId, origin, returnUrl);

      if (popup && !popup.closed) {
        popup.location.href = res.data.authUrl;
        popup.focus();
      }
    } catch (err: unknown) {
      if (popup && !popup.closed) {
        popup.close();
      }
      setIsConnecting(false);
      const message = err instanceof Error ? err.message : 'Không thể khởi tạo ủy quyền Facebook';
      toast.error(message);
    }
  }, [workspaceId, isConnecting]);

  return {
    openOAuthPopup,
    isConnecting,
  };
}
