import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { ChannelAdapter } from '../channel-adapter.interface';
import {
  ChannelContext,
  ChannelInfo,
  InboundAttachment,
  InboundMessagePayload,
  OutboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from '../channel-adapter.types';

export interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  file_size?: number;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated?: boolean;
  is_video?: boolean;
  emoji?: string;
  file_size?: number;
}

export interface TelegramLocation {
  longitude: number;
  latitude: number;
}

export interface TelegramVenue {
  location: TelegramLocation;
  title: string;
  address: string;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  video?: TelegramVideo;
  audio?: TelegramAudio;
  voice?: TelegramVoice;
  video_note?: TelegramVideoNote;
  sticker?: TelegramSticker;
  location?: TelegramLocation;
  venue?: TelegramVenue;
  contact?: TelegramContact;
  reply_to_message?: TelegramMessage;
  business_connection_id?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
  chat_instance?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  business_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

@Injectable()
export class TelegramAdapter implements ChannelAdapter {
  private readonly logger = new Logger(TelegramAdapter.name);
  readonly channelType: ChannelType = ChannelType.TELEGRAM;

  private readonly telegramApiBaseUrl = 'https://api.telegram.org';

  /**
   * Helper to extract bot token from channel credentials.
   */
  private extractBotToken(credentials?: Record<string, unknown>): string {
    const token =
      credentials?.botToken ||
      credentials?.bot_token ||
      credentials?.token ||
      credentials?.accessToken;
    if (!token || typeof token !== 'string') {
      throw new Error('Telegram bot token is missing in channel credentials');
    }
    return token;
  }

  /**
   * Verifies incoming webhook request authentication.
   *
   * Checks the native 'X-Telegram-Bot-Api-Secret-Token' header if configured,
   * or allows pass-through URL-based routing verified by WebhooksService.
   */
  verifyWebhook(
    request: WebhookVerificationRequest,
    credentials?: Record<string, unknown>,
  ): boolean {
    const configuredSecret =
      credentials?.webhookSecret || credentials?.secret_token || credentials?.secretToken;

    // Security Invariant: Channels must configure a webhook secret to prevent unauthenticated injection
    if (
      !configuredSecret ||
      typeof configuredSecret !== 'string' ||
      configuredSecret.trim().length === 0
    ) {
      this.logger.warn(
        'Telegram webhook verification failed: No webhook secret token configured on channel',
      );
      return false;
    }

    const secretHeader =
      request.headers['x-telegram-bot-api-secret-token'] ||
      request.headers['X-Telegram-Bot-Api-Secret-Token'];

    const secretTokenValue = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

    if (!secretTokenValue || typeof secretTokenValue !== 'string') {
      return false;
    }

    // Security Invariant: Constant-time comparison to prevent timing attacks
    const expectedBuffer = Buffer.from(configuredSecret, 'utf8');
    const receivedBuffer = Buffer.from(secretTokenValue, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /**
   * Normalizes Telegram updates (messages, media, callback queries) into standard InboundMessagePayload array.
   */
  parseInboundPayload(
    rawBody: unknown,
    _headers?: Record<string, string | string[] | undefined>,
  ): InboundMessagePayload[] {
    let update: TelegramUpdate;

    if (typeof rawBody === 'string') {
      try {
        update = JSON.parse(rawBody);
      } catch (err) {
        this.logger.warn(
          `Failed to parse Telegram webhook payload JSON: ${(err as Error).message}`,
        );
        return [];
      }
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      update = rawBody as TelegramUpdate;
    } else {
      return [];
    }

    // 1. Handle callback_query (inline keyboard button clicks)
    if (update.callback_query) {
      const cq = update.callback_query;
      const from = cq.from;
      if (!from) return [];

      const fullName =
        [from.first_name, from.last_name].filter(Boolean).join(' ') ||
        from.username ||
        `User ${from.id}`;
      const timestamp = cq.message?.date ? new Date(cq.message.date * 1000) : new Date();

      return [
        {
          eventKind: 'message',
          externalContactId: String(from.id),
          externalMessageId: String(cq.id),
          content: cq.data || '',
          contentType: MessageContentType.TEXT,
          senderInfo: {
            name: fullName,
            username: from.username,
          },
          timestamp,
          rawPayload: update as unknown as Record<string, unknown>,
        },
      ];
    }

    // 2. Extract message object (regular message, business message, or edited message)
    const message = update.message || update.business_message || update.edited_message;
    if (!message) {
      return [];
    }

    // Chatwoot & Sales Copilot only support private direct chats (ignore group / channel messages)
    if (message.chat && message.chat.type !== 'private') {
      this.logger.debug(
        `Ignoring non-private Telegram message from chat type: ${message.chat.type}`,
      );
      return [];
    }

    const from = message.from;
    if (!from) {
      return [];
    }

    const externalContactId = String(from.id);
    const externalMessageId = String(message.message_id);
    const timestamp = message.date ? new Date(message.date * 1000) : new Date();
    const fullName =
      [from.first_name, from.last_name].filter(Boolean).join(' ') ||
      from.username ||
      `User ${from.id}`;

    let contentType = MessageContentType.TEXT;
    let content: string | undefined = message.text || undefined;
    const attachments: InboundAttachment[] = [];

    // Parse photos (select highest resolution photo)
    if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
      contentType = MessageContentType.IMAGE;
      const highestResPhoto = message.photo[message.photo.length - 1];
      attachments.push({
        fileUrl: highestResPhoto.file_id,
        fileName: `photo_${highestResPhoto.file_id}.jpg`,
        fileType: 'IMAGE',
        fileSize: highestResPhoto.file_size,
        contentType: MessageContentType.IMAGE,
      });
      content = message.caption || undefined;
    }
    // Parse video
    else if (message.video) {
      contentType = MessageContentType.VIDEO;
      attachments.push({
        fileUrl: message.video.file_id,
        fileName: message.video.file_name || `video_${message.video.file_id}.mp4`,
        fileType: 'VIDEO',
        fileSize: message.video.file_size,
        contentType: MessageContentType.VIDEO,
      });
      content = message.caption || undefined;
    }
    // Parse audio
    else if (message.audio) {
      contentType = MessageContentType.AUDIO;
      attachments.push({
        fileUrl: message.audio.file_id,
        fileName: message.audio.file_name || `audio_${message.audio.file_id}.mp3`,
        fileType: 'AUDIO',
        fileSize: message.audio.file_size,
        contentType: MessageContentType.AUDIO,
      });
      content = message.caption || undefined;
    }
    // Parse voice message
    else if (message.voice) {
      contentType = MessageContentType.AUDIO;
      attachments.push({
        fileUrl: message.voice.file_id,
        fileName: `voice_${message.voice.file_id}.ogg`,
        fileType: 'AUDIO',
        fileSize: message.voice.file_size,
        contentType: MessageContentType.AUDIO,
      });
      content = message.caption || undefined;
    }
    // Parse video note
    else if (message.video_note) {
      contentType = MessageContentType.VIDEO;
      attachments.push({
        fileUrl: message.video_note.file_id,
        fileName: `video_note_${message.video_note.file_id}.mp4`,
        fileType: 'VIDEO',
        fileSize: message.video_note.file_size,
        contentType: MessageContentType.VIDEO,
      });
    }
    // Parse documents / general files
    else if (message.document) {
      contentType = MessageContentType.FILE;
      attachments.push({
        fileUrl: message.document.file_id,
        fileName: message.document.file_name || `document_${message.document.file_id}`,
        fileType: 'FILE',
        fileSize: message.document.file_size,
        contentType: MessageContentType.FILE,
      });
      content = message.caption || undefined;
    }
    // Parse stickers
    else if (message.sticker) {
      contentType = MessageContentType.IMAGE;
      attachments.push({
        fileUrl: message.sticker.file_id,
        fileName: `sticker_${message.sticker.file_id}.webp`,
        fileType: 'IMAGE',
        fileSize: message.sticker.file_size,
        contentType: MessageContentType.IMAGE,
      });
      content = message.sticker.emoji || undefined;
    }
    // Parse locations
    else if (message.location) {
      contentType = MessageContentType.TEXT;
      content = `📍 Location: ${message.location.latitude}, ${message.location.longitude}`;
    }
    // Parse venues
    else if (message.venue) {
      contentType = MessageContentType.TEXT;
      const venueParts = [message.venue.title, message.venue.address].filter(Boolean).join(' - ');
      content = `📍 ${venueParts} (${message.venue.location.latitude}, ${message.venue.location.longitude})`;
    }
    // Parse contacts
    else if (message.contact) {
      contentType = MessageContentType.TEXT;
      const contactName = [message.contact.first_name, message.contact.last_name]
        .filter(Boolean)
        .join(' ');
      content = `👤 Contact: ${contactName} (${message.contact.phone_number})`;
    }

    return [
      {
        eventKind: 'message',
        externalContactId,
        externalMessageId,
        content,
        contentType,
        attachments: attachments.length > 0 ? attachments : undefined,
        senderInfo: {
          name: fullName,
          username: from.username,
        },
        timestamp,
        rawPayload: update as unknown as Record<string, unknown>,
      },
    ];
  }

  /**
   * Sends an outbound message through the Telegram Bot API.
   */
  async sendMessage(
    channel: ChannelContext,
    message: OutboundMessagePayload,
  ): Promise<SendMessageResult> {
    const botToken = this.extractBotToken(channel.credentials);
    const chatId = message.recipientExternalId || message.externalConversationId;

    if (!chatId) {
      throw new Error('Recipient chat ID is required to send Telegram message');
    }

    const apiUrl = `${this.telegramApiBaseUrl}/bot${botToken}`;

    // Handle outbound media attachments
    if (message.attachments && message.attachments.length > 0) {
      const attachment = message.attachments[0];
      const caption = message.content || undefined;

      let endpoint = 'sendDocument';
      let payloadKey = 'document';

      const fileType = attachment.fileType?.toUpperCase();
      const contentType = message.contentType;

      if (contentType === MessageContentType.IMAGE || fileType === 'IMAGE') {
        endpoint = 'sendPhoto';
        payloadKey = 'photo';
      } else if (contentType === MessageContentType.VIDEO || fileType === 'VIDEO') {
        endpoint = 'sendVideo';
        payloadKey = 'video';
      } else if (contentType === MessageContentType.AUDIO || fileType === 'AUDIO') {
        endpoint = 'sendAudio';
        payloadKey = 'audio';
      }

      const body: Record<string, unknown> = {
        chat_id: chatId,
        [payloadKey]: attachment.fileUrl,
      };

      if (caption) {
        body.caption = caption;
      }

      const response = await fetch(`${apiUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as TelegramApiResponse<TelegramMessage>;

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(
          `Telegram API ${endpoint} error: [${data.error_code || response.status}] ${data.description || response.statusText}`,
        );
      }

      return {
        externalMessageId: String(data.result.message_id),
        deliveryStatus: DeliveryStatus.SENT,
        rawResponse: data,
      };
    }

    // Text message delivery
    const textContent = message.content || '';

    // First attempt: with HTML parse mode
    const textBody: Record<string, unknown> = {
      chat_id: chatId,
      text: textContent,
      parse_mode: 'HTML',
    };

    let response = await fetch(`${apiUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(textBody),
    });

    let data = (await response.json()) as TelegramApiResponse<TelegramMessage>;

    // Fallback: If HTML entity parsing fails (e.g. unescaped '<' or '&'), retry as plain text
    if (
      !data.ok &&
      data.description &&
      data.description.toLowerCase().includes("can't parse entities")
    ) {
      delete textBody.parse_mode;
      response = await fetch(`${apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(textBody),
      });
      data = (await response.json()) as TelegramApiResponse<TelegramMessage>;
    }

    if (!response.ok || !data.ok || !data.result) {
      throw new Error(
        `Telegram API sendMessage error: [${data.error_code || response.status}] ${data.description || response.statusText}`,
      );
    }

    return {
      externalMessageId: String(data.result.message_id),
      deliveryStatus: DeliveryStatus.SENT,
      rawResponse: data,
    };
  }

  /**
   * Fetches Telegram bot profile and channel info via /getMe and /getUserProfilePhotos.
   */
  async getChannelInfo(channel: ChannelContext): Promise<ChannelInfo> {
    const botToken = this.extractBotToken(channel.credentials);
    const apiUrl = `${this.telegramApiBaseUrl}/bot${botToken}`;

    const response = await fetch(`${apiUrl}/getMe`);
    const data = (await response.json()) as TelegramApiResponse<TelegramUser>;

    if (!response.ok || !data.ok || !data.result) {
      throw new Error(
        `Telegram API getMe error: [${data.error_code || response.status}] ${data.description || response.statusText}`,
      );
    }

    const bot = data.result;
    let avatarUrl: string | undefined;

    // Retrieve bot avatar photo if available
    try {
      const photosRes = await fetch(`${apiUrl}/getUserProfilePhotos?user_id=${bot.id}&limit=1`);
      const photosData = (await photosRes.json()) as TelegramApiResponse<{
        total_count: number;
        photos: TelegramPhotoSize[][];
      }>;

      if (
        photosData.ok &&
        photosData.result &&
        photosData.result.photos.length > 0 &&
        photosData.result.photos[0].length > 0
      ) {
        const photo = photosData.result.photos[0][photosData.result.photos[0].length - 1];
        const filePath = await this.getTelegramFileUrl(botToken, photo.file_id);
        if (filePath) {
          avatarUrl = filePath;
        }
      }
    } catch (photoErr) {
      this.logger.debug(`Could not fetch bot profile photos: ${(photoErr as Error).message}`);
    }

    return {
      providerAccountId: String(bot.id),
      name: bot.first_name || bot.username || 'Telegram Bot',
      avatarUrl,
      metadata: {
        id: bot.id,
        username: bot.username,
        firstName: bot.first_name,
        lastName: bot.last_name,
        isBot: bot.is_bot,
        canJoinGroups: bot.can_join_groups,
        canReadAllGroupMessages: bot.can_read_all_group_messages,
        supportsInlineQueries: bot.supports_inline_queries,
      },
    };
  }

  /**
   * Resolves a Telegram file_id into a public direct download URL.
   */
  async getTelegramFileUrl(botToken: string, fileId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.telegramApiBaseUrl}/bot${botToken}/getFile?file_id=${fileId}`,
      );
      const data = (await response.json()) as TelegramApiResponse<{ file_path: string }>;

      if (!response.ok || !data.ok || !data.result?.file_path) {
        return null;
      }

      return `${this.telegramApiBaseUrl}/file/bot${botToken}/${data.result.file_path}`;
    } catch {
      return null;
    }
  }

  /**
   * Configures a Telegram webhook endpoint URL for the bot.
   */
  async setWebhook(
    botToken: string,
    webhookUrl: string,
    secretToken?: string,
  ): Promise<{ ok: boolean; description?: string }> {
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
    };

    if (secretToken) {
      body.secret_token = secretToken;
    }

    const response = await fetch(`${this.telegramApiBaseUrl}/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TelegramApiResponse<boolean>;
    return {
      ok: Boolean(data.ok),
      description: data.description,
    };
  }

  /**
   * Removes webhook configuration for the Telegram bot.
   */
  async deleteWebhook(botToken: string): Promise<{ ok: boolean; description?: string }> {
    const response = await fetch(`${this.telegramApiBaseUrl}/bot${botToken}/deleteWebhook`, {
      method: 'POST',
    });

    const data = (await response.json()) as TelegramApiResponse<boolean>;
    return {
      ok: Boolean(data.ok),
      description: data.description,
    };
  }

  /**
   * Retrieves current webhook status from Telegram.
   */
  async getWebhookInfo(botToken: string): Promise<Record<string, unknown> | null> {
    const response = await fetch(`${this.telegramApiBaseUrl}/bot${botToken}/getWebhookInfo`);
    const data = (await response.json()) as TelegramApiResponse<Record<string, unknown>>;
    return data.ok && data.result ? data.result : null;
  }
}
