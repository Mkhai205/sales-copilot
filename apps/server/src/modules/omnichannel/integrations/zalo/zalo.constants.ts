/**
 * Zalo Official Account (OA) integration constants — OpenAPI v3 + OAuth v4 (OA).
 *
 * Reference: https://developers.zalo.me/docs/api/official-account-api
 */

// ─── Endpoints ───────────────────────────────────────────────────────────────

export const ZALO_OAUTH_AUTHORIZE_URL = 'https://oauth.zaloapp.com/v4/oa/permission';
export const ZALO_OAUTH_TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';

/**
 * OpenAPI base — overridable via env so local/staging environments can point at a
 * mock Zalo server (see docs/guides/zalo-local-testing.md) without a real OA.
 */
export const ZALO_OPEN_API_BASE =
  (process.env.ZALO_OPEN_API_BASE || '').replace(/\/+$/, '') || 'https://openapi.zalo.me/v3.0';

/** OA info: `GET /oa` — oa_id, name, avatar of the authorized Official Account. */
export const ZALO_OA_INFO_PATH = '/oa';
/** Sender profile: `POST /oa/user/info` — display_name, avatar, shared_info. */
export const ZALO_USER_INFO_PATH = '/oa/user/info';
/** Customer-service message (7-day interaction window): `POST /oa/message/cs`. */
export const ZALO_SEND_CS_MESSAGE_PATH = '/oa/message/cs';

// ─── OAuth state (Redis) ─────────────────────────────────────────────────────

export const ZALO_OAUTH_STATE_PREFIX = 'zalo_oauth_state:';
export const ZALO_OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

/** Temporary OAuth token session (Redis) bridging the popup callback and the connect step. */
export const ZALO_OAUTH_SESSION_PREFIX = 'zalo_oauth_session:';
export const ZALO_OAUTH_SESSION_TTL_SECONDS = 1800; // 30 minutes

// ─── Webhook ─────────────────────────────────────────────────────────────────

/** Zalo signs every callback with `sha256(app_id + rawBody + timestamp + oa_secret_key)`. */
export const ZALO_SIGNATURE_HEADER = 'x-zevent-signature';

/** Event name Zalo sends when the callback URL is verified in the OA Console. */
export const ZALO_CALLBACK_VERIFY_EVENT = 'oa_callback_verify';

/**
 * Tolerance applied to the `timestamp` field of signed webhook events to reject
 * replayed payloads. Zalo timestamps are epoch milliseconds (string or number).
 */
export const ZALO_TIMESTAMP_TOLERANCE_MS = 10 * 60 * 1000; // ±10 minutes

// ─── Token lifecycle ─────────────────────────────────────────────────────────

/**
 * OAuth v4 token endpoint requires the app secret as a request HEADER.
 * Reference: developers.zalo.me/docs/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
 */
export const ZALO_SECRET_KEY_HEADER = 'secret_key';

/**
 * Docs state the OA access token is valid for 25 hours (`expires_in` = 90000s) and the
 * refresh token for 3 months (single-use, rotates on every refresh). Refresh when the
 * remaining validity drops below this margin.
 */
export const ZALO_TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fallback token lifetime (25h) used when the response carries neither `expires_in`
 * nor the docs-typo variant `expire_in`.
 */
export const ZALO_DEFAULT_TOKEN_LIFETIME_S = 90_000;

// ─── Credential keys (stored encrypted in Channel.credentials) ───────────────

/**
 * Per-channel credential contract:
 * - `appId` comes from the platform env (ZALO_APP_ID) and is copied into credentials at
 *   connect time so webhook MAC verification is self-contained per channel. The app
 *   secret stays platform-level (env) — it is only needed for the OAuth token endpoint.
 * - `accessTokenExpiresAt` is an ISO timestamp persisted together with the rotated
 *   access/refresh token pair.
 */
export const ZALO_CREDENTIAL_KEYS = {
  appId: 'appId',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  accessTokenExpiresAt: 'accessTokenExpiresAt',
  oaSecretKey: 'oaSecretKey',
  oaId: 'oaId',
} as const;

// ─── Zalo error codes we act on programmatically ─────────────────────────────

/**
 * Zalo OpenAPI error envelope: `{ error: <number>, message: <string> }` (error = 0 means OK).
 * Codes verified against a real OA; undocumented codes pass through with their raw message.
 */
export const ZALO_ERROR_CODES = {
  OK: 0,
  /** Access token invalid or expired → refresh + retry once. */
  INVALID_ACCESS_TOKEN: -216,
} as const;

/** Message fragments (lowercase) identifying a closed 7-day CS interaction window. */
export const ZALO_CS_WINDOW_MESSAGE_FRAGMENTS = ['7 days', '7 ngày', 'không tương tác'];
