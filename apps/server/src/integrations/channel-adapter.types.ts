import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';

/**
 * Event kind parsed by a channel adapter:
 * - 'message': Normal inbound message (text, media, interactive)
 * - 'delivery_status': Delivery/read receipt or failure notification
 */
export type InboundEventKind = 'message' | 'delivery_status';

/**
 * Normalized delivery status update from an external channel (e.g. Facebook delivery/read receipts).
 */
export interface DeliveryStatusInfo {
  externalMessageId: string;
  status: DeliveryStatus;
  timestamp: Date;
  errorMessage?: string;
}

/**
 * Normalized attachment structure received from an external channel.
 */
export interface InboundAttachment {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  contentType: MessageContentType;
}

/**
 * Normalized external sender information (contact identity details).
 */
export interface InboundSenderInfo {
  name?: string;
  avatarUrl?: string;
  username?: string;
  phoneNumber?: string;
  email?: string;
}

/**
 * Standardized inbound message payload parsed by a channel adapter.
 */
export interface InboundMessagePayload {
  /**
   * Event kind distinction: 'message' (default) or 'delivery_status'.
   */
  eventKind?: InboundEventKind;

  /**
   * Channel-specific identifier of the sender (e.g. Facebook PSID, Zalo user ID, Telegram chat/user ID).
   */
  externalContactId: string;

  /**
   * Unique message identifier in the external provider system.
   */
  externalMessageId: string;

  /**
   * Plaintext message content if applicable.
   */
  content?: string;

  /**
   * Content type (TEXT, IMAGE, VIDEO, AUDIO, FILE).
   */
  contentType: MessageContentType;

  /**
   * List of normalized attachments (media, documents).
   */
  attachments?: InboundAttachment[];

  /**
   * Additional profile metadata extracted from the webhook event.
   */
  senderInfo?: InboundSenderInfo;

  /**
   * Message sent timestamp provided by the channel or server receipt time.
   */
  timestamp: Date;

  /**
   * Original raw event payload for auditing or channel-specific extensions.
   */
  rawPayload?: Record<string, unknown>;

  /**
   * Delivery status information when eventKind === 'delivery_status'.
   */
  deliveryStatusInfo?: DeliveryStatusInfo;
}

/**
 * Incoming HTTP request metadata for verifying webhook signatures and tokens.
 */
export interface WebhookVerificationRequest {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: string | Buffer | unknown;
  query?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  webhookSecret?: string;
}

/**
 * Execution context representing the channel and decrypted credentials.
 */
export interface ChannelContext {
  channelId: string;
  inboxId: string;
  workspaceId: string;
  channelType: ChannelType;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown>;
  providerAccountId?: string | null;
}

/**
 * Attachment payload when sending an outbound message.
 */
export interface OutboundAttachment {
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

/**
 * Outbound message payload to be delivered via a channel adapter.
 */
export interface OutboundMessagePayload {
  recipientExternalId: string;
  content?: string;
  contentType?: MessageContentType;
  attachments?: OutboundAttachment[];
  externalConversationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result returned after delivering an outbound message to a channel provider.
 */
export interface SendMessageResult {
  externalMessageId: string;
  deliveryStatus: DeliveryStatus;
  rawResponse?: unknown;
}

/**
 * Remote channel metadata retrieved from the provider (page/bot details).
 */
export interface ChannelInfo {
  providerAccountId?: string;
  name: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}
