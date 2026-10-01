/**
 * Zalo Personal (unofficial) integration constants.
 *
 * Built on zca-js (https://github.com/RFS-ADRENO/zca-js) which simulates Zalo Web
 * for personal accounts. Zalo provides NO official API for personal accounts —
 * this channel violates Zalo ToS and the linked account may be banned at any
 * time. Users must be warned in the UI and advised to use a secondary account.
 */

// ─── Credential keys (stored encrypted in Channel.credentials) ───────────────

/**
 * zca-js session credentials — there is no refresh token; the session cookie
 * expires only when the account logs out / is banned / kicks the web session.
 */
export const ZALO_PERSONAL_CREDENTIAL_KEYS = {
  imei: 'imei',
  cookie: 'cookie',
  userAgent: 'userAgent',
  ownUserId: 'ownUserId',
} as const;

// ─── Connect (QR) session ────────────────────────────────────────────────────

export const ZALO_PERSONAL_CONNECT_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Listener reconnect ──────────────────────────────────────────────────────

/** Delays between re-login attempts when the listener drops (capped at the last value). */
export const ZALO_PERSONAL_RECONNECT_BACKOFF_MS = [5_000, 15_000, 45_000, 120_000, 300_000];

// ─── Outbound rate limiting (anti-spam) ──────────────────────────────────────

/** Minimum spacing between two outbound messages on the same channel. */
export const ZALO_PERSONAL_MIN_SEND_INTERVAL_MS = 1_500;

/** Maximum outbound messages per channel per calendar day. */
export const ZALO_PERSONAL_DAILY_SEND_LIMIT = 300;

// ─── Inbound envelope ────────────────────────────────────────────────────────

/** `kind` marker embedded in the ingestion envelope produced by the listener. */
export const ZALO_PERSONAL_ENVELOPE_KIND = 'zalo_personal';
