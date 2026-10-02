/**
 * Structural types for the slice of zca-js used by this integration.
 * Runtime values (Zalo class, ThreadType enum) are imported from 'zca-js';
 * here we re-declare the wire shapes we depend on so the connection service
 * stays testable with plain objects.
 */

/** zca-js loginQR event type values (mirrors LoginQRCallbackEventType). */
export const ZaloLoginQREvent = {
  QRCodeGenerated: 0,
  QRCodeExpired: 1,
  QRCodeScanned: 2,
  QRCodeDeclined: 3,
  GotLoginInfo: 4,
} as const;

/** Structural shape of a zca-js loginQR callback event. */
export interface ZaloLoginQREventPayload {
  type: number;
  data?: any;
  actions?: { retry?: () => unknown; abort?: () => unknown } | null;
}

/** Persisted session credentials (encrypted into Channel.credentials). */
export interface ZaloPersonalCredentials {
  imei: string;
  cookie: unknown[];
  userAgent: string;
  ownUserId: string;
}

/** Attachment extracted from TMessage.attach JSON. */
export interface ZaloPersonalAttachment {
  type: string;
  url?: string;
  fileName?: string;
}

/**
 * Plain-JSON envelope the connection service pushes into the ingestion pipeline
 * (must survive JSON.stringify through ChannelEvent + BullMQ).
 */
export interface ZaloPersonalEnvelope {
  kind: 'zalo_personal';
  v: 1;
  message: {
    msgId: string;
    threadId: string;
    isSelf: boolean;
    text: string;
    attachments: ZaloPersonalAttachment[];
    /** zca-js TMessage.msgType — authoritative source for media content typing. */
    msgType?: string;
    /** Original attach JSON string, preserved for diagnosing Zalo shape drift. */
    rawAttach?: string;
  };
}

export interface ZaloPersonalSendMessageResponse {
  message: { msgId?: string } | null;
  attachment: Array<{ msgId?: string } | null>;
}
