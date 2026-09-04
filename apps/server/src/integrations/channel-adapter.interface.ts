import { ChannelType } from '@sales-copilot/shared-contracts';
import {
  ChannelContext,
  ChannelInfo,
  InboundMessagePayload,
  InboundSenderInfo,
  OutboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from './channel-adapter.types';

/**
 * Standard integration interface contract for all external omnichannel providers
 * (e.g. Facebook Messenger, Zalo OA, Telegram Bot, Email SMTP/IMAP, Web Chat).
 */
export interface ChannelAdapter {
  /**
   * The channel type supported by this adapter.
   */
  readonly channelType: ChannelType;

  /**
   * Verifies incoming webhook request authentication (HMAC signature, verification token, challenge).
   *
   * @param request HTTP request metadata, headers, body, and query
   * @param credentials Decrypted channel credentials (e.g. app secret, webhook secret)
   * @returns True if the webhook request is valid and authenticated
   */
  verifyWebhook(
    request: WebhookVerificationRequest,
    credentials?: Record<string, unknown>,
  ): boolean | Promise<boolean>;

  /**
   * Normalizes vendor-specific inbound webhook payloads into standard internal InboundMessagePayload array.
   *
   * @param rawBody Raw webhook body received from the channel provider
   * @param headers HTTP headers for context (e.g. event type headers)
   * @returns Array of normalized inbound message payloads
   */
  parseInboundPayload(
    rawBody: unknown,
    headers?: Record<string, string | string[] | undefined>,
  ): InboundMessagePayload[] | Promise<InboundMessagePayload[]>;

  /**
   * Sends an outbound message through the provider's API.
   *
   * @param channel Channel context including decrypted access tokens
   * @param message Standardized outbound message payload
   * @returns Result with external message ID and delivery status
   */
  sendMessage(channel: ChannelContext, message: OutboundMessagePayload): Promise<SendMessageResult>;

  /**
   * Fetches channel metadata from the provider (e.g. Page Name, OA Name, Bot username, Avatar).
   *
   * @param channel Channel context including decrypted access tokens
   * @returns Channel information
   */
  getChannelInfo(channel: ChannelContext): Promise<ChannelInfo>;

  /**
   * Fetches sender's user profile (e.g. Full Name, Avatar URL) from the channel provider.
   *
   * @param channel Channel context including decrypted access tokens
   * @param externalContactId External user identifier (e.g. Facebook PSID, Telegram user ID)
   * @returns Sender information or null if unavailable
   */
  fetchSenderInfo?(
    channel: ChannelContext,
    externalContactId: string,
  ): Promise<InboundSenderInfo | null>;
}
