import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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

/**
 * Configuration options for pre-chat form.
 */
export interface PreChatFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select' | string;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  values?: string[];
  regexPattern?: string;
  regexCue?: string;
}

export interface PreChatFormOptions {
  preChatMessage?: string;
  requireEmail?: boolean;
  preChatFields?: PreChatFormField[];
}

/**
 * Web Chat widget metadata and visual customization configuration.
 */
export interface WebChatWidgetConfig {
  widgetToken?: string;
  websiteUrl?: string;
  widgetColor?: string;
  welcomeTitle?: string;
  welcomeTagline?: string;
  greetingMessage?: string;
  replyTime?: 'in_a_few_minutes' | 'in_a_few_hours' | 'in_a_day' | string;
  preChatFormEnabled?: boolean;
  preChatFormOptions?: PreChatFormOptions;
  allowedDomains?: string;
  hmacMandatory?: boolean;
  [key: string]: unknown;
}

/**
 * Raw inbound payload received from the widget SDK or WebSocket client.
 */
export interface WebChatRawInboundPayload {
  eventKind?: 'message' | 'delivery_status';
  externalContactId?: string;
  contactToken?: string;
  visitorId?: string;
  identifier?: string;
  externalMessageId?: string;
  messageId?: string;
  tempId?: string;
  content?: string;
  contentType?: MessageContentType | string;
  attachments?: Array<{
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    contentType?: MessageContentType | string;
  }>;
  senderInfo?: InboundSenderInfo;
  timestamp?: string | number | Date;
  deliveryStatusInfo?: {
    externalMessageId: string;
    status: DeliveryStatus;
    timestamp?: string | number | Date;
    errorMessage?: string;
  };
  rawPayload?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Event payload emitted when an outbound agent message is dispatched to a Web Chat visitor.
 */
export interface WebChatOutboundEventPayload {
  workspaceId: string;
  channelId: string;
  inboxId: string;
  recipientExternalId: string;
  message: OutboundMessagePayload;
  sentAt: Date;
}

/**
 * Implementation of ChannelAdapter for the Web Chat Widget channel (ChannelType.WEB_CHAT).
 *
 * Unlike third-party channels (Facebook, Telegram), Web Chat does not communicate with external
 * webhook providers. Instead, it handles client-side WebSocket connections and REST widget requests,
 * validating widget tokens and HMAC identity signatures, and broadcasting outbound messages to visitors.
 */
@Injectable()
export class WebChatAdapter implements ChannelAdapter {
  readonly channelType = ChannelType.WEB_CHAT;
  private readonly logger = new Logger(WebChatAdapter.name);

  constructor(@Optional() private readonly eventEmitter?: EventEmitter2) {}

  /**
   * Verifies incoming webhook or REST widget request authentication.
   * Checks widget/website token from headers, query, or body against channel credentials.
   * Also verifies HMAC signature if provided.
   */
  verifyWebhook(
    request: WebhookVerificationRequest,
    credentials?: Record<string, unknown>,
  ): boolean {
    const configuredToken =
      (credentials?.widgetToken as string) ||
      (credentials?.website_token as string) ||
      (credentials?.token as string) ||
      request.webhookSecret;

    // 1. Extract token from request (header, query, params, or body)
    const tokenFromHeader = this.extractTokenFromHeaders(request.headers);
    const tokenFromQuery = this.extractTokenFromQuery(request.query);
    const tokenFromBody = this.extractTokenFromBody(request.rawBody);

    const providedToken = tokenFromHeader || tokenFromQuery || tokenFromBody;

    // If channel has a configured token, verify matching token
    if (configuredToken) {
      if (!providedToken) {
        this.logger.warn('WebChat verification failed: no widget token provided in request');
        return false;
      }

      if (providedToken !== configuredToken) {
        this.logger.warn('WebChat verification failed: widget token mismatch');
        return false;
      }
    }

    // 2. Optional HMAC signature verification if hmacSecret is configured
    const hmacSecret =
      (credentials?.hmacSecret as string) ||
      (credentials?.hmac_secret as string) ||
      (credentials?.hmacToken as string) ||
      (credentials?.hmac_token as string);

    const hmacMandatory = Boolean(
      credentials?.hmacMandatory ?? credentials?.hmac_mandatory ?? false,
    );

    const signatureHeader = this.getHeaderValue(
      request.headers,
      'x-signature-sha256',
      'x-hub-signature-256',
      'x-widget-signature',
    );

    if (hmacSecret) {
      const identifier =
        (request.query?.identifier as string) ||
        (request.params?.identifier as string) ||
        (typeof request.rawBody === 'object' && request.rawBody !== null
          ? (request.rawBody as any).identifier
          : undefined);

      if (signatureHeader && identifier) {
        const cleanSignature = signatureHeader.replace(/^sha256=/i, '');
        const isValidHmac = this.verifyHmacSignature(identifier, cleanSignature, hmacSecret);
        if (!isValidHmac) {
          this.logger.warn(`WebChat HMAC verification failed for identifier '${identifier}'`);
          return false;
        }
      } else if (hmacMandatory && !signatureHeader) {
        this.logger.warn('WebChat verification failed: HMAC signature is mandatory but missing');
        return false;
      }
    }

    return true;
  }

  /**
   * Normalizes incoming widget message payloads into standard internal InboundMessagePayload array.
   */
  parseInboundPayload(
    rawBody: unknown,
    _headers?: Record<string, string | string[] | undefined>,
  ): InboundMessagePayload[] {
    if (!rawBody || typeof rawBody !== 'object') {
      return [];
    }

    // Handle array of payloads or single payload
    // eslint-disable-next-line no-useless-assignment
    let rawItems: WebChatRawInboundPayload[] = [];

    if (Array.isArray(rawBody)) {
      rawItems = rawBody as WebChatRawInboundPayload[];
    } else {
      const objBody = rawBody as Record<string, any>;
      if (Array.isArray(objBody.messages)) {
        rawItems = objBody.messages;
      } else if (Array.isArray(objBody.events)) {
        rawItems = objBody.events;
      } else if (objBody.data && typeof objBody.data === 'object') {
        rawItems = Array.isArray(objBody.data) ? objBody.data : [objBody.data];
      } else {
        rawItems = [objBody as WebChatRawInboundPayload];
      }
    }

    const results: InboundMessagePayload[] = [];

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;

      const eventKind = item.eventKind === 'delivery_status' ? 'delivery_status' : 'message';

      // 1. Handle delivery status receipt events
      if (eventKind === 'delivery_status') {
        const statusInfo = item.deliveryStatusInfo;
        const externalMessageId =
          statusInfo?.externalMessageId ||
          item.externalMessageId ||
          item.messageId ||
          (item as any).mid;

        if (externalMessageId) {
          results.push({
            eventKind: 'delivery_status',
            externalContactId:
              item.externalContactId ||
              item.contactToken ||
              item.visitorId ||
              item.identifier ||
              'anonymous_visitor',
            externalMessageId,
            contentType: MessageContentType.TEXT,
            timestamp: this.normalizeTimestamp(statusInfo?.timestamp || item.timestamp),
            deliveryStatusInfo: {
              externalMessageId,
              status: statusInfo?.status || DeliveryStatus.DELIVERED,
              timestamp: this.normalizeTimestamp(statusInfo?.timestamp || item.timestamp),
              errorMessage: statusInfo?.errorMessage,
            },
            rawPayload: item.rawPayload || (item as Record<string, unknown>),
          });
        }
        continue;
      }

      // 2. Handle normal message events
      const externalContactId =
        item.externalContactId ||
        item.contactToken ||
        item.visitorId ||
        item.identifier ||
        (item.senderInfo?.username
          ? `user_${item.senderInfo.username}`
          : `anon_${crypto.randomUUID().slice(0, 8)}`);

      const externalMessageId =
        item.externalMessageId ||
        item.messageId ||
        item.tempId ||
        (item as any).id ||
        `msg_${crypto.randomUUID()}`;

      const content = typeof item.content === 'string' ? item.content : undefined;

      // Normalize attachments
      const attachments = this.normalizeAttachments(item.attachments);

      // Determine content type
      let contentType = this.normalizeContentType(item.contentType);
      if (contentType === MessageContentType.TEXT && attachments.length > 0 && !content) {
        contentType = attachments[0].contentType;
      }

      // Extract sender info
      const senderInfo: InboundSenderInfo | undefined = item.senderInfo
        ? {
            name: item.senderInfo.name,
            email: item.senderInfo.email,
            phoneNumber: item.senderInfo.phoneNumber,
            avatarUrl: item.senderInfo.avatarUrl,
            username: item.senderInfo.username,
          }
        : undefined;

      results.push({
        eventKind: 'message',
        externalContactId,
        externalMessageId,
        content,
        contentType,
        attachments: attachments.length > 0 ? attachments : undefined,
        senderInfo,
        timestamp: this.normalizeTimestamp(item.timestamp),
        rawPayload: item.rawPayload || (item as Record<string, unknown>),
      });
    }

    return results;
  }

  /**
   * Sends an outbound agent message to the Web Chat visitor.
   * Emits an internal event via EventEmitter2 for the WebChatGateway to push through Socket.IO.
   */
  async sendMessage(
    channel: ChannelContext,
    message: OutboundMessagePayload,
  ): Promise<SendMessageResult> {
    const externalMessageId =
      message.externalConversationId ||
      (message.metadata?.externalMessageId as string) ||
      `web_${crypto.randomUUID()}`;

    const sentAt = new Date();

    const outboundEvent: WebChatOutboundEventPayload = {
      workspaceId: channel.workspaceId,
      channelId: channel.channelId,
      inboxId: channel.inboxId,
      recipientExternalId: message.recipientExternalId,
      message,
      sentAt,
    };

    if (this.eventEmitter) {
      try {
        this.eventEmitter.emit('widget.outbound_message', outboundEvent);
        this.eventEmitter.emit('widget:message', outboundEvent);
      } catch (err) {
        this.logger.warn(`Failed to emit widget outbound message event: ${(err as Error).message}`);
      }
    }

    return {
      externalMessageId,
      deliveryStatus: DeliveryStatus.SENT,
      rawResponse: {
        channelId: channel.channelId,
        recipientExternalId: message.recipientExternalId,
        sentAt: sentAt.toISOString(),
      },
    };
  }

  /**
   * Retrieves Web Chat widget configuration and presentation metadata.
   */
  async getChannelInfo(channel: ChannelContext): Promise<ChannelInfo> {
    const settings = (channel.settings as Record<string, unknown>) || {};
    const credentials = (channel.credentials as Record<string, unknown>) || {};

    const widgetToken =
      (credentials.widgetToken as string) ||
      (credentials.website_token as string) ||
      channel.providerAccountId ||
      '';

    const widgetColor = (settings.widgetColor as string) || '#1f93ff';
    const welcomeTitle = (settings.welcomeTitle as string) || 'Welcome to our live chat';
    const welcomeTagline = (settings.welcomeTagline as string) || 'How can we help you today?';
    const greetingMessage =
      (settings.greetingMessage as string) ||
      (settings.welcomeMessage as string) ||
      'Hi! Let us know if you have any questions.';
    const websiteUrl = (settings.websiteUrl as string) || '';
    const replyTime = (settings.replyTime as string) || 'in_a_few_minutes';
    const preChatFormEnabled = Boolean(settings.preChatFormEnabled ?? false);
    const allowedDomains = (settings.allowedDomains as string) || '*';
    const hmacMandatory = Boolean(settings.hmacMandatory ?? false);

    const defaultPreChatFields: PreChatFormField[] = [
      {
        name: 'emailAddress',
        label: 'Email Address',
        type: 'email',
        required: true,
        enabled: true,
        placeholder: 'you@example.com',
      },
      {
        name: 'fullName',
        label: 'Full Name',
        type: 'text',
        required: false,
        enabled: true,
        placeholder: 'Your name',
      },
      {
        name: 'phoneNumber',
        label: 'Phone Number',
        type: 'phone',
        required: false,
        enabled: false,
        placeholder: '+1234567890',
      },
    ];

    const preChatFormOptions: PreChatFormOptions =
      (settings.preChatFormOptions as PreChatFormOptions) || {
        preChatMessage: 'Please share your details before starting the chat.',
        requireEmail: true,
        preChatFields: defaultPreChatFields,
      };

    const widgetConfig: WebChatWidgetConfig = {
      widgetToken,
      websiteUrl,
      widgetColor,
      welcomeTitle,
      welcomeTagline,
      greetingMessage,
      replyTime,
      preChatFormEnabled,
      preChatFormOptions,
      allowedDomains,
      hmacMandatory,
      ...settings,
    };

    return {
      providerAccountId: widgetToken || channel.providerAccountId || undefined,
      name: (settings.name as string) || (settings.websiteName as string) || welcomeTitle,
      avatarUrl:
        (settings.avatarUrl as string) || (settings.widgetAvatarUrl as string) || undefined,
      metadata: widgetConfig as Record<string, unknown>,
    };
  }

  /**
   * Generates a cryptographically secure random widget token for channel creation.
   */
  generateWidgetToken(bytes = 20): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Computes an HMAC-SHA256 signature for user verification (identifying logged-in users).
   */
  generateHmacSignature(identifier: string, hmacSecret: string): string {
    return crypto.createHmac('sha256', hmacSecret).update(identifier).digest('hex');
  }

  /**
   * Timing-safe verification of user HMAC-SHA256 signature.
   */
  verifyHmacSignature(identifier: string, signature: string, hmacSecret: string): boolean {
    if (!identifier || !signature || !hmacSecret) {
      return false;
    }

    try {
      const expectedSignature = this.generateHmacSignature(identifier, hmacSecret);
      const providedBuffer = Buffer.from(signature.toLowerCase(), 'utf8');
      const expectedBuffer = Buffer.from(expectedSignature.toLowerCase(), 'utf8');

      if (providedBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Generates the embeddable JavaScript snippet for embedding the widget on websites.
   */
  buildEmbedScript(websiteToken: string, baseUrl = 'https://app.salescopilot.com'): string {
    const sanitizedBaseUrl = baseUrl.replace(/\/+$/, '');
    return `<script>
  (function(d,t) {
    var BASE_URL = "${sanitizedBaseUrl}";
    var g = d.createElement(t), s = d.getElementsByTagName(t)[0];
    g.src = BASE_URL + "/widget/sdk.js";
    g.async = true;
    s.parentNode.insertBefore(g, s);
    g.onload = function() {
      window.SalesCopilotWidget.init({
        websiteToken: '${websiteToken}',
        baseUrl: BASE_URL
      });
    };
  })(document, "script");
</script>`;
  }

  // --- Private Helper Methods ---

  private extractTokenFromHeaders(
    headers?: Record<string, string | string[] | undefined>,
  ): string | undefined {
    if (!headers) return undefined;

    const directToken = this.getHeaderValue(
      headers,
      'x-widget-token',
      'x-website-token',
      'x-channel-token',
    );
    if (directToken) return directToken;

    const authHeader = this.getHeaderValue(headers, 'authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.slice(7).trim();
    }

    return undefined;
  }

  private extractTokenFromQuery(
    query?: Record<string, string | string[] | undefined>,
  ): string | undefined {
    if (!query) return undefined;

    const candidate =
      query.widget_token ||
      query.website_token ||
      query.widgetToken ||
      query.websiteToken ||
      query.token;

    if (Array.isArray(candidate)) {
      return candidate[0];
    }
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private extractTokenFromBody(rawBody?: unknown): string | undefined {
    if (!rawBody || typeof rawBody !== 'object') return undefined;

    const body = rawBody as Record<string, unknown>;
    const candidate =
      body.widget_token ||
      body.website_token ||
      body.widgetToken ||
      body.websiteToken ||
      body.token;

    return typeof candidate === 'string' ? candidate : undefined;
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    ...keys: string[]
  ): string | undefined {
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      for (const [headerKey, headerVal] of Object.entries(headers)) {
        if (headerKey.toLowerCase() === lowerKey) {
          if (Array.isArray(headerVal)) {
            return headerVal[0];
          }
          return headerVal;
        }
      }
    }
    return undefined;
  }

  private normalizeTimestamp(rawTimestamp?: string | number | Date): Date {
    if (!rawTimestamp) return new Date();
    if (rawTimestamp instanceof Date) return rawTimestamp;
    if (typeof rawTimestamp === 'number') {
      // Check if unix timestamp in seconds
      return rawTimestamp < 1e11 ? new Date(rawTimestamp * 1000) : new Date(rawTimestamp);
    }
    const parsed = new Date(rawTimestamp);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private normalizeContentType(rawType?: string): MessageContentType {
    if (!rawType) return MessageContentType.TEXT;
    const upper = String(rawType).toUpperCase();
    if (upper in MessageContentType) {
      return upper as MessageContentType;
    }
    if (upper.includes('IMAGE')) return MessageContentType.IMAGE;
    if (upper.includes('VIDEO')) return MessageContentType.VIDEO;
    if (upper.includes('AUDIO')) return MessageContentType.AUDIO;
    if (upper.includes('FILE') || upper.includes('DOCUMENT') || upper.includes('PDF')) {
      return MessageContentType.FILE;
    }
    return MessageContentType.TEXT;
  }

  private normalizeAttachments(
    rawAttachments?: WebChatRawInboundPayload['attachments'],
  ): InboundAttachment[] {
    if (!Array.isArray(rawAttachments)) return [];

    return rawAttachments
      .filter(att => att && typeof att === 'object' && typeof att.fileUrl === 'string')
      .map(att => ({
        fileUrl: att.fileUrl,
        fileName: att.fileName,
        fileType: att.fileType,
        fileSize: typeof att.fileSize === 'number' ? att.fileSize : undefined,
        contentType: this.normalizeContentType(att.contentType),
      }));
  }
}
