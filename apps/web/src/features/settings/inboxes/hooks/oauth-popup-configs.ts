import { facebookApi } from '../api/facebook';
import { zaloApi } from '../api/zalo';
import type { OAuthPopupProviderConfig } from './use-oauth-popup';

/**
 * Per-provider OAuth popup wiring for useOAuthPopup / ProviderOAuthCallback.
 * Message names must match the ones the provider's callback page broadcasts.
 */
export const FACEBOOK_OAUTH_POPUP_CONFIG: OAuthPopupProviderConfig = {
  providerName: 'Facebook',
  broadcastChannelName: 'facebook_oauth_channel',
  localStorageKey: 'facebook_oauth_result',
  messageTypePrefix: 'FACEBOOK_OAUTH_',
  callbackPath: '/auth/facebook/callback',
  popupName: 'facebook_oauth_popup',
  getAuthUrl: (workspaceId, origin, returnUrl) =>
    facebookApi.getAuthUrl(workspaceId, origin, returnUrl),
};

export const ZALO_OAUTH_POPUP_CONFIG: OAuthPopupProviderConfig = {
  providerName: 'Zalo',
  broadcastChannelName: 'zalo_oauth_channel',
  localStorageKey: 'zalo_oauth_result',
  messageTypePrefix: 'ZALO_OAUTH_',
  callbackPath: '/auth/zalo/callback',
  popupName: 'zalo_oauth_popup',
  getAuthUrl: (workspaceId, origin, returnUrl) =>
    zaloApi.getAuthUrl(workspaceId, origin, returnUrl),
};
