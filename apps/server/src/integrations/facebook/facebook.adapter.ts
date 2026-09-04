import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { ChannelAdapter } from '../channel-adapter.interface';
import {
  ChannelContext,
  ChannelInfo,
  InboundAttachment,
  InboundMessagePayload,
  InboundSenderInfo,
  OutboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from '../channel-adapter.types';

export interface FacebookApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface FacebookApiResponse<T = unknown> {
  error?: FacebookApiError;
  success?: boolean;
  recipient_id?: string;
  message_id?: string;
  [key: string]: unknown;
}

export interface FacebookPageProfile {
  id: string;
  name: string;
  picture?: {
    data?: {
      height?: number;
      is_silhouette?: boolean;
      url?: string;
      width?: number;
    };
  };
}

export interface FacebookUserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  profile_pic?: string;
}

export interface FacebookMessagingAttachmentPayload {
  url?: string;
  title?: string;
  sticker_id?: number;
  coordinates?: {
    lat: number;
    long: number;
  };
  [key: string]: unknown;
}

export interface FacebookMessagingAttachment {
  type: 'image' | 'audio' | 'video' | 'file' | 'location' | 'fallback' | 'template' | string;
  payload?: FacebookMessagingAttachmentPayload;
}

export interface FacebookQuickReply {
  payload: string;
}

export interface FacebookPostback {
  mid?: string;
  title?: string;
  payload: string;
}

export interface FacebookDeliveryReceipt {
  mids?: string[];
  watermark: number;
  seq?: number;
}

export interface FacebookReadReceipt {
  watermark: number;
  seq?: number;
  mid?: string;
}

export interface FacebookInboundMessage {
  mid: string;
  text?: string;
  is_echo?: boolean;
  app_id?: number;
  metadata?: string;
  quick_reply?: FacebookQuickReply;
  attachments?: FacebookMessagingAttachment[];
}

export interface FacebookMessagingEntry {
  sender?: {
    id: string;
  };
  recipient?: {
    id: string;
  };
  timestamp?: number;
  message?: FacebookInboundMessage;
  postback?: FacebookPostback;
  delivery?: FacebookDeliveryReceipt;
  read?: FacebookReadReceipt;
}

export interface FacebookWebhookEntry {
  id: string;
  time: number;
  messaging?: FacebookMessagingEntry[];
  standby?: FacebookMessagingEntry[];
}

export interface FacebookWebhookPayload {
  object: 'page' | string;
  entry: FacebookWebhookEntry[];
}

/**
 * Facebook Messenger Platform Channel Adapter.
 *
 * Implements the ChannelAdapter contract for Facebook Messenger:
 * - Webhook HMAC-SHA256 signature verification (X-Hub-Signature-256)
 * - Inbound webhook payload normalization (Messages, Postbacks, Delivery Receipts, Read Receipts)
 * - Outbound message delivery via Graph API (/me/messages)
 * - Page metadata retrieval via Graph API (/me)
 * - Page subscription and user profile management
 */
@Injectable()
export class FacebookAdapter implements ChannelAdapter {
  private readonly logger = new Logger(FacebookAdapter.name);
  readonly channelType: ChannelType = ChannelType.FACEBOOK_MESSENGER;

  private readonly graphApiBaseUrl = 'https://graph.facebook.com';
  private readonly defaultGraphApiVersion = 'v19.0';

  /**
   * Helper to extract page access token from channel credentials.
   */
  private extractPageAccessToken(credentials?: Record<string, unknown>): string {
    const token =
      credentials?.pageAccessToken ||
      credentials?.page_access_token ||
      credentials?.accessToken ||
      credentials?.access_token ||
      credentials?.token;
    if (!token || typeof token !== 'string') {
      throw new Error('Facebook Page Access Token is missing in channel credentials');
    }
    return token;
  }

  /**
   * Helper to extract app secret from credentials or request.
   */
  private extractAppSecret(
    request: WebhookVerificationRequest,
    credentials?: Record<string, unknown>,
  ): string | null {
    const secret =
      credentials?.appSecret ||
      credentials?.app_secret ||
      credentials?.clientSecret ||
      credentials?.webhookSecret ||
      request.webhookSecret;
    if (secret && typeof secret === 'string') {
      return secret;
    }
    return null;
  }

  /**
   * Verifies incoming webhook request authentication.
   *
   * For POST requests: Validates HMAC-SHA256 signature from 'X-Hub-Signature-256' header.
   * For GET challenges: Validates 'hub.verify_token' against credentials.
   */
  verifyWebhook(
    request: WebhookVerificationRequest,
    credentials?: Record<string, unknown>,
  ): boolean {
    // 1. Check if this is a GET challenge verification handshake
    if (request.query && request.query['hub.mode'] === 'subscribe') {
      const expectedToken =
        credentials?.verifyToken ||
        credentials?.verify_token ||
        credentials?.webhookSecret ||
        request.webhookSecret;
      const receivedToken = request.query['hub.verify_token'];
      if (expectedToken && receivedToken) {
        return (Array.isArray(receivedToken) ? receivedToken[0] : receivedToken) === expectedToken;
      }
      return false;
    }

    // 2. Validate HMAC-SHA256 signature for POST webhook events
    const signatureHeader =
      request.headers['x-hub-signature-256'] ||
      request.headers['X-Hub-Signature-256'] ||
      request.headers['x-hub-signature'] ||
      request.headers['X-Hub-Signature'];

    if (!signatureHeader) {
      this.logger.warn('Facebook webhook verification failed: Missing signature header');
      return false;
    }

    const appSecret = this.extractAppSecret(request, credentials);
    if (!appSecret) {
      this.logger.warn('Facebook webhook verification failed: App Secret is not configured');
      return false;
    }

    const headerValue = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!headerValue) {
      return false;
    }

    // Convert rawBody to Buffer
    let bodyBuffer: Buffer;
    if (Buffer.isBuffer(request.rawBody)) {
      bodyBuffer = request.rawBody;
    } else if (typeof request.rawBody === 'string') {
      bodyBuffer = Buffer.from(request.rawBody, 'utf-8');
    } else if (typeof request.rawBody === 'object' && request.rawBody !== null) {
      bodyBuffer = Buffer.from(JSON.stringify(request.rawBody), 'utf-8');
    } else {
      this.logger.warn('Facebook webhook verification failed: Empty or invalid rawBody');
      return false;
    }

    // Determine algorithm (sha256 or fallback sha1)
    let algorithm = 'sha256';
    let receivedHash = headerValue;

    if (headerValue.startsWith('sha256=')) {
      algorithm = 'sha256';
      receivedHash = headerValue.slice(7);
    } else if (headerValue.startsWith('sha1=')) {
      algorithm = 'sha1';
      receivedHash = headerValue.slice(5);
    }

    try {
      const expectedHash = crypto.createHmac(algorithm, appSecret).update(bodyBuffer).digest('hex');

      if (expectedHash.length !== receivedHash.length) {
        return false;
      }

      const expectedBuffer = Buffer.from(expectedHash, 'hex');
      const receivedBuffer = Buffer.from(receivedHash, 'hex');

      if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
    } catch (err) {
      this.logger.error(
        `Error during Facebook HMAC signature comparison: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Normalizes vendor-specific Facebook webhook payloads into internal InboundMessagePayload array.
   *
   * Handles:
   * - Inbound text and media messages (image, video, audio, file)
   * - Location sharing attachments
   * - Quick reply button responses
   * - Postback button clicks (e.g. Get Started, Menu items)
   * - Delivery receipts (DELIVERED status)
   * - Read receipts (READ status)
   * - Filters out echo messages (is_echo: true)
   */
  parseInboundPayload(
    rawBody: unknown,
    _headers?: Record<string, string | string[] | undefined>,
  ): InboundMessagePayload[] {
    let payload: FacebookWebhookPayload;

    if (typeof rawBody === 'string') {
      try {
        payload = JSON.parse(rawBody);
      } catch (err) {
        this.logger.warn(
          `Failed to parse Facebook webhook payload JSON: ${(err as Error).message}`,
        );
        return [];
      }
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      payload = rawBody as FacebookWebhookPayload;
    } else {
      return [];
    }

    // Facebook Messenger webhooks must have object === 'page'
    if (payload.object !== 'page' || !Array.isArray(payload.entry)) {
      return [];
    }

    const results: InboundMessagePayload[] = [];

    for (const entry of payload.entry) {
      const messagingList = entry.messaging || entry.standby || [];
      if (!Array.isArray(messagingList)) continue;

      for (const messaging of messagingList) {
        const senderId = messaging.sender?.id;
        const entryTime = entry.time ? new Date(entry.time) : new Date();
        const timestamp = messaging.timestamp ? new Date(messaging.timestamp) : entryTime;

        // 1. Handle inbound user message
        if (messaging.message) {
          const msg = messaging.message;

          // Skip echo messages (our own messages sent by Page echoed back by Facebook)
          if (msg.is_echo === true) {
            continue;
          }

          if (!senderId) {
            continue;
          }

          const externalMessageId = msg.mid || `fb_msg_${timestamp.getTime()}_${senderId}`;

          let content: string | undefined = msg.text || undefined;
          let contentType: MessageContentType = MessageContentType.TEXT;
          const attachments: InboundAttachment[] = [];

          // Handle quick reply payload if text is missing or payload present
          if (msg.quick_reply?.payload && !content) {
            content = msg.quick_reply.payload;
          }

          // Parse attachments
          let fallbackLinkPreview: { url: string; title?: string } | undefined;
          if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
            const seenAttachmentKeys = new Set<string>();

            for (const att of msg.attachments) {
              // Extract Facebook's OpenGraph link preview / fallback attachments
              if (att.type === 'fallback') {
                if (att.payload?.url) {
                  let targetUrl = att.payload.url;
                  try {
                    const parsedUrl = new URL(targetUrl);
                    if (
                      parsedUrl.hostname.includes('facebook.com') &&
                      parsedUrl.searchParams.has('u')
                    ) {
                      targetUrl = parsedUrl.searchParams.get('u') || targetUrl;
                    }
                  } catch {
                    // Fallback to raw targetUrl if URL cannot be parsed
                  }

                  if (!fallbackLinkPreview) {
                    fallbackLinkPreview = {
                      url: targetUrl,
                      title: att.payload.title,
                    };
                  }
                }
                continue;
              }

              if (att.type === 'location' && att.payload?.coordinates) {
                const lat = att.payload.coordinates.lat;
                const long = att.payload.coordinates.long;
                const locText = `📍 Location: ${lat}, ${long}`;
                if (!content) {
                  content = locText;
                }
              } else if (att.payload?.url) {
                // Deduplicate if Facebook sends same URL or sticker_id multiple times (e.g. image + sticker)
                const dedupKey = att.payload.sticker_id
                  ? `sticker_${att.payload.sticker_id}`
                  : att.payload.url;
                if (seenAttachmentKeys.has(dedupKey)) {
                  continue;
                }
                seenAttachmentKeys.add(dedupKey);

                let mappedType: MessageContentType = MessageContentType.FILE;
                const attTypeLower = att.type.toLowerCase();

                if (attTypeLower === 'image' || attTypeLower === 'sticker') {
                  mappedType = MessageContentType.IMAGE;
                } else if (attTypeLower === 'video') {
                  mappedType = MessageContentType.VIDEO;
                } else if (attTypeLower === 'audio') {
                  mappedType = MessageContentType.AUDIO;
                } else if (attTypeLower === 'file') {
                  mappedType = MessageContentType.FILE;
                }

                attachments.push({
                  fileUrl: att.payload.url,
                  fileName:
                    att.payload.title ||
                    `facebook_${attTypeLower}_${msg.mid || timestamp.getTime()}`,
                  fileType: mappedType,
                  contentType: mappedType,
                });
              }
            }

            if (attachments.length > 0 && !content) {
              contentType = attachments[0].contentType;
            }
          }

          results.push({
            eventKind: 'message',
            externalContactId: senderId,
            externalMessageId,
            content,
            contentType,
            attachments: attachments.length > 0 ? attachments : undefined,
            timestamp,
            rawPayload: {
              ...(messaging as unknown as Record<string, unknown>),
              ...(fallbackLinkPreview ? { linkPreview: fallbackLinkPreview } : {}),
            },
          });
        }

        // 2. Handle Postback events (Get Started button, Persistent Menu, Inline Buttons)
        else if (messaging.postback) {
          if (!senderId) continue;

          const postback = messaging.postback;
          const externalMessageId =
            postback.mid || `fb_postback_${timestamp.getTime()}_${senderId}`;
          const content = postback.title || postback.payload || 'Button clicked';

          results.push({
            eventKind: 'message',
            externalContactId: senderId,
            externalMessageId,
            content,
            contentType: MessageContentType.TEXT,
            timestamp,
            rawPayload: messaging as unknown as Record<string, unknown>,
          });
        }

        // 3. Handle Delivery Receipts
        else if (messaging.delivery) {
          const delivery = messaging.delivery;
          const deliveryTime = delivery.watermark ? new Date(delivery.watermark) : timestamp;

          if (Array.isArray(delivery.mids) && delivery.mids.length > 0) {
            for (const mid of delivery.mids) {
              results.push({
                eventKind: 'delivery_status',
                externalContactId: senderId || 'facebook_delivery',
                externalMessageId: mid,
                contentType: MessageContentType.TEXT,
                timestamp: deliveryTime,
                rawPayload: messaging as unknown as Record<string, unknown>,
                deliveryStatusInfo: {
                  externalMessageId: mid,
                  status: DeliveryStatus.DELIVERED,
                  timestamp: deliveryTime,
                },
              });
            }
          } else if (delivery.watermark) {
            const externalMessageId = `watermark_${delivery.watermark}`;
            results.push({
              eventKind: 'delivery_status',
              externalContactId: senderId || 'facebook_delivery',
              externalMessageId,
              contentType: MessageContentType.TEXT,
              timestamp: deliveryTime,
              rawPayload: messaging as unknown as Record<string, unknown>,
              deliveryStatusInfo: {
                externalMessageId,
                status: DeliveryStatus.DELIVERED,
                timestamp: deliveryTime,
              },
            });
          }
        }

        // 4. Handle Read Receipts
        else if (messaging.read) {
          const read = messaging.read;
          const readTime = read.watermark ? new Date(read.watermark) : timestamp;
          const externalMessageId =
            read.mid ||
            (read.watermark ? `watermark_${read.watermark}` : `read_${readTime.getTime()}`);

          results.push({
            eventKind: 'delivery_status',
            externalContactId: senderId || 'facebook_read',
            externalMessageId,
            contentType: MessageContentType.TEXT,
            timestamp: readTime,
            rawPayload: messaging as unknown as Record<string, unknown>,
            deliveryStatusInfo: {
              externalMessageId,
              status: DeliveryStatus.READ,
              timestamp: readTime,
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Sends an outbound message through Facebook Messenger Send API.
   *
   * Supports:
   * - Text messages
   * - Media attachments (image, video, audio, file)
   * - Message tags (e.g. HUMAN_AGENT) for 24h window bypass if configured
   */
  async sendMessage(
    channel: ChannelContext,
    message: OutboundMessagePayload,
  ): Promise<SendMessageResult> {
    const pageAccessToken = this.extractPageAccessToken(channel.credentials);
    const recipientId = message.recipientExternalId || message.externalConversationId;

    if (!recipientId) {
      throw new Error('Recipient external ID (PSID) is required to send Facebook message');
    }

    const graphVersion =
      (channel.settings?.graphApiVersion as string) || this.defaultGraphApiVersion;
    const apiUrl = `${this.graphApiBaseUrl}/${graphVersion}/me/messages`;

    // Determine messaging type and tag
    const useHumanAgentTag =
      channel.settings?.useHumanAgentTag === true || message.metadata?.useHumanAgentTag === true;

    const messagingType = useHumanAgentTag ? 'MESSAGE_TAG' : 'RESPONSE';
    const tag = useHumanAgentTag ? 'HUMAN_AGENT' : undefined;

    // Handle outbound media attachments
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      let attachmentType = 'file';

      const fileType = attachment.fileType?.toLowerCase();
      const contentType = message.contentType;

      if (
        contentType === MessageContentType.IMAGE ||
        fileType === 'image' ||
        fileType?.endsWith('png') ||
        fileType?.endsWith('jpg') ||
        fileType?.endsWith('jpeg') ||
        fileType?.endsWith('gif') ||
        fileType?.endsWith('webp')
      ) {
        attachmentType = 'image';
      } else if (
        contentType === MessageContentType.VIDEO ||
        fileType === 'video' ||
        fileType?.endsWith('mp4') ||
        fileType?.endsWith('mov')
      ) {
        attachmentType = 'video';
      } else if (
        contentType === MessageContentType.AUDIO ||
        fileType === 'audio' ||
        fileType?.endsWith('mp3') ||
        fileType?.endsWith('ogg') ||
        fileType?.endsWith('wav')
      ) {
        attachmentType = 'audio';
      }

      const body: Record<string, unknown> = {
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: attachmentType,
            payload: {
              url: attachment.fileUrl,
              is_reusable: true,
            },
          },
        },
        messaging_type: messagingType,
        ...(tag ? { tag } : {}),
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pageAccessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as FacebookApiResponse<{
        recipient_id: string;
        message_id: string;
      }>;

      if (!response.ok || data.error || !data.message_id) {
        const errorMsg = data.error
          ? `[${data.error.code || response.status}] ${data.error.message}`
          : `${response.status} ${response.statusText}`;
        throw new Error(`Facebook API sendMessage error: ${errorMsg}`);
      }

      return {
        externalMessageId: data.message_id,
        deliveryStatus: DeliveryStatus.SENT,
        rawResponse: data,
      };
    }

    // Handle outbound text message
    const textContent = message.content || '';
    const body: Record<string, unknown> = {
      recipient: { id: recipientId },
      message: {
        text: textContent,
      },
      messaging_type: messagingType,
      ...(tag ? { tag } : {}),
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as FacebookApiResponse<{
      recipient_id: string;
      message_id: string;
    }>;

    if (!response.ok || data.error || !data.message_id) {
      const errorMsg = data.error
        ? `[${data.error.code || response.status}] ${data.error.message}`
        : `${response.status} ${response.statusText}`;
      throw new Error(`Facebook API sendMessage error: ${errorMsg}`);
    }

    return {
      externalMessageId: data.message_id,
      deliveryStatus: DeliveryStatus.SENT,
      rawResponse: data,
    };
  }

  /**
   * Fetches Facebook Page profile metadata via Graph API (/me).
   */
  async getChannelInfo(channel: ChannelContext): Promise<ChannelInfo> {
    const pageAccessToken = this.extractPageAccessToken(channel.credentials);
    const graphVersion =
      (channel.settings?.graphApiVersion as string) || this.defaultGraphApiVersion;

    const apiUrl = `${this.graphApiBaseUrl}/${graphVersion}/me?fields=id,name,picture.type(large)&access_token=${encodeURIComponent(pageAccessToken)}`;

    const response = await fetch(apiUrl);
    const data = (await response.json()) as FacebookPageProfile & FacebookApiResponse;

    if (!response.ok || data.error || !data.id) {
      const errorMsg = data.error
        ? `[${data.error.code || response.status}] ${data.error.message}`
        : `${response.status} ${response.statusText}`;
      throw new Error(`Facebook API getChannelInfo error: ${errorMsg}`);
    }

    return {
      providerAccountId: String(data.id),
      name: data.name || 'Facebook Page',
      avatarUrl: data.picture?.data?.url,
      metadata: {
        pageId: data.id,
        name: data.name,
        picture: data.picture,
      },
    };
  }

  /**
   * Fetches sender's user profile (name, avatar) from Facebook Graph API via PSID.
   */
  async fetchUserProfile(
    pageAccessToken: string,
    psid: string,
    graphVersion: string = this.defaultGraphApiVersion,
  ): Promise<InboundSenderInfo | null> {
    try {
      const apiUrl = `${this.graphApiBaseUrl}/${graphVersion}/${psid}?fields=first_name,last_name,name,profile_pic&access_token=${encodeURIComponent(pageAccessToken)}`;
      const response = await fetch(apiUrl);
      const data = (await response.json()) as FacebookUserProfile & FacebookApiResponse;

      if (!response.ok || data.error || !data.id) {
        return null;
      }

      const fullName =
        data.name || [data.first_name, data.last_name].filter(Boolean).join(' ') || undefined;

      return {
        name: fullName,
        avatarUrl: data.profile_pic,
      };
    } catch (err) {
      this.logger.debug(
        `Could not fetch Facebook user profile for PSID '${psid}': ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Subscribes the Facebook Page to Webhook events via /me/subscribed_apps.
   */
  async subscribeApps(
    pageAccessToken: string,
    fields: string[] = ['messages', 'messaging_postbacks', 'message_deliveries', 'message_reads'],
    graphVersion: string = this.defaultGraphApiVersion,
  ): Promise<{ success: boolean; description?: string }> {
    const apiUrl = `${this.graphApiBaseUrl}/${graphVersion}/me/subscribed_apps`;
    const body = {
      subscribed_fields: fields,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as FacebookApiResponse;

    if (!response.ok || data.error || data.success === false) {
      const errorMsg = data.error
        ? `[${data.error.code || response.status}] ${data.error.message}`
        : `${response.status} ${response.statusText}`;
      return {
        success: false,
        description: errorMsg,
      };
    }

    return {
      success: true,
    };
  }

  /**
   * Unsubscribes the Facebook Page from Webhook events via /me/subscribed_apps.
   */
  async unsubscribeApps(
    pageAccessToken: string,
    graphVersion: string = this.defaultGraphApiVersion,
  ): Promise<{ success: boolean; description?: string }> {
    const apiUrl = `${this.graphApiBaseUrl}/${graphVersion}/me/subscribed_apps`;

    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${pageAccessToken}`,
      },
    });

    const data = (await response.json()) as FacebookApiResponse;

    if (!response.ok || data.error || data.success === false) {
      const errorMsg = data.error
        ? `[${data.error.code || response.status}] ${data.error.message}`
        : `${response.status} ${response.statusText}`;
      return {
        success: false,
        description: errorMsg,
      };
    }

    return {
      success: true,
    };
  }

  /**
   * Sends sender action indicators (e.g. typing_on, typing_off, mark_seen).
   */
  async sendSenderAction(
    pageAccessToken: string,
    recipientId: string,
    action: 'mark_seen' | 'typing_on' | 'typing_off',
    graphVersion: string = this.defaultGraphApiVersion,
  ): Promise<boolean> {
    const apiUrl = `${this.graphApiBaseUrl}/${graphVersion}/me/messages`;
    const body = {
      recipient: { id: recipientId },
      sender_action: action,
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pageAccessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as FacebookApiResponse;
      return response.ok && !data.error && data.recipient_id !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Fetches sender's user profile (name, avatar) from Facebook Graph API via PSID.
   */
  async fetchSenderInfo(
    channel: ChannelContext,
    externalContactId: string,
  ): Promise<InboundSenderInfo | null> {
    try {
      const pageAccessToken = this.extractPageAccessToken(channel.credentials);
      const graphVersion =
        (channel.settings?.graphApiVersion as string) || this.defaultGraphApiVersion;
      return await this.fetchUserProfile(pageAccessToken, externalContactId, graphVersion);
    } catch (err) {
      this.logger.debug(
        `Failed to fetch sender profile for PSID '${externalContactId}': ${(err as Error).message}`,
      );
      return null;
    }
  }
}
