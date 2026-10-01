/**
 * Zalo Official Account (OA) wire types — OpenAPI v3 + OAuth v4 (OA).
 * Field shapes follow Zalo docs; optional fields are kept tolerant because Zalo
 * adds/removes fields without version bumps.
 */

// ─── OAuth ───────────────────────────────────────────────────────────────────

export interface ZaloTokenResponse {
  access_token: string;
  refresh_token: string;
  /** Token lifetime in seconds. The refresh docs table shows the typo variant `expire_in`. */
  expires_in?: number;
  expire_in?: number;
  error?: number;
  message?: string;
}

export interface ZaloOaInfoResponse {
  oa_id?: string;
  name?: string;
  description?: string;
  avatar?: string;
  cover?: string;
  num_followers?: number;
  error?: number;
  message?: string;
}

export interface ZaloUserInfoResponse {
  user_id?: string;
  display_name?: string;
  avatar?: string;
  user_alias?: string;
  user_gender?: string;
  user_birthday?: string;
  shared_info?: Record<string, unknown>;
  error?: number;
  message?: string;
}

// ─── Webhook events ──────────────────────────────────────────────────────────

/**
 * Zalo callback envelope. `data` may arrive as a JSON-encoded string or an
 * already-parsed object depending on the event — both are handled.
 */
export interface ZaloWebhookEvent {
  event_name?: string;
  app_id?: string;
  timestamp?: string | number;
  message_id?: string;
  data?: unknown;
}

export interface ZaloEventData {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    msg_id?: string;
    text?: string;
    attachments?: ZaloEventAttachment[];
    link?: string;
  };
  user_id?: string;
  user_id_by_app_id?: string;
  msg_id?: string;
  msg_ids?: string[];
  verify_token?: string;
  [key: string]: unknown;
}

export interface ZaloEventAttachment {
  type?: string; // 'image' | 'file' | 'link' | 'sticker' | 'audio' | 'voice' | ...
  payload?: {
    url?: string;
    name?: string;
    [key: string]: unknown;
  };
}

// ─── Send CS message ─────────────────────────────────────────────────────────

export interface ZaloSendCsMessageResponse {
  msg_id?: string;
  error?: number;
  message?: string;
}

/** Template payload passthrough (`attachment.payload`) — template_type + provider-specific fields. */
export interface ZaloTemplatePayload {
  template_type: string;
  [key: string]: unknown;
}
