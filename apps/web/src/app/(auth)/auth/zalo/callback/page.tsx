'use client';

import * as React from 'react';
import {
  OAuthCallbackLoadingFallback,
  ProviderOAuthCallback,
} from '@/components/oauth/provider-oauth-callback';

const ZALO_CALLBACK_CONFIG = {
  broadcastChannelName: 'zalo_oauth_channel',
  localStorageKey: 'zalo_oauth_result',
  successType: 'ZALO_OAUTH_SUCCESS',
  errorType: 'ZALO_OAUTH_ERROR',
  providerName: 'Zalo',
  successDescription: 'Đang đồng bộ thông tin Official Account, cửa sổ sẽ tự động đóng...',
  mapError: (error: string) => {
    const lower = error.toLowerCase();
    if (lower.includes('access_denied') || lower.includes('user_denied')) {
      return 'Bạn đã từ chối cấp quyền truy cập Zalo.';
    }
    if (lower.includes('invalid_oauth_state')) {
      return 'Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.';
    }
    return error;
  },
};

export default function ZaloOAuthCallbackPage() {
  return (
    <div className="flex items-center justify-center">
      <React.Suspense fallback={<OAuthCallbackLoadingFallback />}>
        <ProviderOAuthCallback config={ZALO_CALLBACK_CONFIG} />
      </React.Suspense>
    </div>
  );
}
