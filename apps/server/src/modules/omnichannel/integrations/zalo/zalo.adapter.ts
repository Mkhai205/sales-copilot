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
import {
  ZALO_CALLBACK_VERIFY_EVENT,
  ZALO_CS_WINDOW_MESSAGE_FRAGMENTS,
  ZALO_ERROR_CODES,
  ZALO_OPEN_API_BASE,
  ZALO_OA_INFO_PATH,
  ZALO_SEND_CS_MESSAGE_PATH,
  ZALO_SIGNATURE_HEADER,
  ZALO_TIMESTAMP_TOLERANCE_MS,
  ZALO_USER_INFO_PATH,
} from './zalo.constants';
import type {
  ZaloEventData,
  ZaloEventAttachment,
  ZaloOaInfoResponse,
  ZaloSendCsMessageResponse,
  ZaloTemplatePayload,
  ZaloUserInfoResponse,
  ZaloWebhookEvent,
} from './zalo.types';
import { ZaloOaTokenService } from './zalo-oa-token.service';

const MESSAGE_EVENT_NAMES = new Set([
  'user_send_text',
  'user_send_image',
  'user_send_file',
  'user_send_link',
  'user_send_sticker',
  'user_send_voice',
  'user_send_video',
  'user_send_gif',
]);
const DELIVERED_EVENT_NAMES = new Set(['user_receive_message']);
const READ_EVENT_NAMES = new Set(['oa_message_seen']);

/**
 * ChannelAdapter for Zalo Official Account (OpenAPI v3).
 *
 * Inbound: signed webhook events (reused generic `/channels/:channelId/webhook` route).
 * Outbound: Customer-Service messages (7-day interaction window) via `/oa/message/cs`.
 * Access tokens are resolved through ZaloOaTokenService, which refreshes + rotates them.
 */
@Injectable()
export class ZaloOaAdapter implements ChannelAdapter {
  private readonly logger = new Logger(ZaloOaAdapter.name);
  readonly channelType: ChannelType = ChannelType.ZALO;

  constructor(private readonly tokenService: ZaloOaTokenService) {}

  // ─── Webhook authentication ────────────────────────────────────────────────

  /**
   * POST-based URL verification: Zalo Console sends `oa_callback_verify` and expects
   * the verify token echoed back. Returns null for all other events.
   */
  handleCallbackVerification(rawBody: unknown): Record<string, unknown> | null {
    const event = this.parseEvent(rawBody);
    if (!event || event.event_name !== ZALO_CALLBACK_VERIFY_EVENT) {
      return null;
    }
    const data = this.parseEventData(event);
    const verifyToken = typeof data?.verify_token === 'string' ? data.verify_token : '';
    // Response shape pending live verification — single point of change (see implementation plan §6).
    return { code: 0, data: { verify_token: verifyToken } };
  }

  /**
   * Verifies the `X-ZEvent-Signature` MAC over the raw request body:
   * `sha256(app_id + rawBody + timestamp + oa_secret_key)`.
   * Fails closed when the channel has no OA secret configured.
   */
  verifyWebhook(
    request: WebhookVerificationRequest,
    credentials?: Record<string, unknown>,
  ): boolean {
    const oaSecretKey = credentials?.oaSecretKey;
    if (typeof oaSecretKey !== 'string' || oaSecretKey.trim().length === 0) {
      this.logger.warn('Zalo webhook verification failed: no OA Secret Key configured on channel');
      return false;
    }

    const rawBodyString = this.extractRawBodyString(request.rawBody);
    const event = this.parseEvent(rawBodyString);
    if (!event) {
      return false;
    }

    const appId =
      (typeof event.app_id === 'string' && event.app_id) ||
      (typeof credentials?.appId === 'string' ? (credentials.appId as string) : '');
    if (!appId) {
      this.logger.warn('Zalo webhook verification failed: missing app_id');
      return false;
    }

    const receivedMac = this.extractSignature(request.headers);
    if (!receivedMac) {
      return false;
    }

    const expectedMac = this.computeExpectedMac(appId, rawBodyString, event.timestamp, oaSecretKey);
    if (!expectedMac || !this.safeCompareHex(expectedMac, receivedMac)) {
      return false;
    }

    return this.isTimestampFresh(event.timestamp);
  }

  // ─── Inbound normalization ─────────────────────────────────────────────────

  /**
   * Normalizes Zalo webhook events into standard payloads. Non-message events
   * (follow/unfollow/oa_send_message) return [] — they carry no ingetable content.
   */
  parseInboundPayload(
    rawBody: unknown,
    _headers?: Record<string, string | string[] | undefined>,
  ): InboundMessagePayload[] {
    const event = this.parseEvent(rawBody);
    if (!event?.event_name) {
      return [];
    }

    const eventName = event.event_name;
    const data = this.parseEventData(event);
    if (!data) {
      return [];
    }

    if (MESSAGE_EVENT_NAMES.has(eventName)) {
      return this.parseMessageEvent(eventName, event, data);
    }
    if (DELIVERED_EVENT_NAMES.has(eventName) || READ_EVENT_NAMES.has(eventName)) {
      const status = DELIVERED_EVENT_NAMES.has(eventName)
        ? DeliveryStatus.DELIVERED
        : DeliveryStatus.READ;
      return this.parseDeliveryEvent(event, data, status);
    }

    this.logger.debug(
      `Ignoring Zalo event '${eventName}' (follow/unfollow/oa_send_message events are not ingested)`,
    );
    return [];
  }

  private parseMessageEvent(
    eventName: string,
    event: ZaloWebhookEvent,
    data: ZaloEventData,
  ): InboundMessagePayload[] {
    const senderId = data.sender?.id;
    const messageId = data.message?.msg_id || event.message_id;
    if (!senderId || !messageId) {
      this.logger.warn(`Zalo message event '${eventName}' missing sender id or msg_id, skipping`);
      return [];
    }

    const timestamp = this.parseEventTimestamp(event);
    const attachments: InboundAttachment[] = [];
    let contentType: MessageContentType = MessageContentType.TEXT;
    let content = data.message?.text || undefined;

    if (eventName === 'user_send_link') {
      content = data.message?.link || this.firstAttachmentUrl(data.message?.attachments) || content;
    } else if (eventName !== 'user_send_text') {
      // Media events (image/file/voice/sticker/video/gif)
      const parsed = this.parseMediaEvent(eventName, data);
      contentType = parsed.contentType;
      attachments.push(...parsed.attachments);
      content = parsed.content ?? content;
    }

    return [
      {
        eventKind: 'message',
        externalContactId: senderId,
        externalMessageId: messageId,
        content,
        contentType,
        attachments: attachments.length > 0 ? attachments : undefined,
        timestamp,
        rawPayload: { ...event, data } as Record<string, unknown>,
      },
    ];
  }

  private parseMediaEvent(
    eventName: string,
    data: ZaloEventData,
  ): { contentType: MessageContentType; attachments: InboundAttachment[]; content?: string } {
    const attachments = this.extractAttachments(data.message?.attachments);
    const firstUrl = attachments[0]?.fileUrl;

    if (eventName === 'user_send_image' || eventName === 'user_send_gif') {
      return { contentType: MessageContentType.IMAGE, attachments };
    }
    if (eventName === 'user_send_sticker') {
      return { contentType: MessageContentType.IMAGE, attachments };
    }
    if (eventName === 'user_send_voice') {
      return { contentType: MessageContentType.AUDIO, attachments };
    }
    if (eventName === 'user_send_video') {
      return { contentType: MessageContentType.VIDEO, attachments };
    }
    if (eventName === 'user_send_file') {
      return { contentType: MessageContentType.FILE, attachments };
    }

    // Field paths of media events are pending live verification — single point of change.
    this.logger.warn(
      `Unknown Zalo media event '${eventName}' (url: ${firstUrl ? 'found' : 'none'})`,
    );
    return { contentType: MessageContentType.FILE, attachments };
  }

  private extractAttachments(attachments?: ZaloEventAttachment[]): InboundAttachment[] {
    if (!Array.isArray(attachments)) {
      return [];
    }

    const normalized: InboundAttachment[] = [];
    for (const attachment of attachments) {
      const url = attachment?.payload?.url;
      if (!url || typeof url !== 'string') {
        continue;
      }
      normalized.push({
        fileUrl: url,
        fileName:
          typeof attachment.payload?.name === 'string' ? attachment.payload.name : undefined,
        contentType: this.mapAttachmentType(attachment.type),
        fileType: (attachment.type || 'FILE').toUpperCase(),
      });
    }
    return normalized;
  }

  private mapAttachmentType(type?: string): MessageContentType {
    switch ((type || '').toLowerCase()) {
      case 'image':
      case 'sticker':
      case 'gif':
        return MessageContentType.IMAGE;
      case 'video':
        return MessageContentType.VIDEO;
      case 'audio':
      case 'voice':
        return MessageContentType.AUDIO;
      default:
        return MessageContentType.FILE;
    }
  }

  private parseDeliveryEvent(
    event: ZaloWebhookEvent,
    data: ZaloEventData,
    status: DeliveryStatus,
  ): InboundMessagePayload[] {
    // Delivery receipts carry the OA as sender and the user as recipient; the msg ids
    // reference messages previously delivered to the user.
    const msgIds = new Set<string>();
    if (typeof data.msg_id === 'string') {
      msgIds.add(data.msg_id);
    }
    if (Array.isArray(data.msg_ids)) {
      for (const id of data.msg_ids) {
        if (typeof id === 'string') {
          msgIds.add(id);
        }
      }
    }
    if (typeof data.message?.msg_id === 'string') {
      msgIds.add(data.message.msg_id);
    }

    if (msgIds.size === 0) {
      this.logger.warn(
        `Zalo delivery event '${event.event_name}' carried no msg id, skipping (payload keys: ${Object.keys(data).join(',')})`,
      );
      return [];
    }

    const timestamp = this.parseEventTimestamp(event);
    return Array.from(msgIds).map(msgId => ({
      eventKind: 'delivery_status' as const,
      externalContactId: data.recipient?.id || data.sender?.id || '',
      externalMessageId: msgId,
      contentType: MessageContentType.TEXT,
      timestamp,
      deliveryStatusInfo: {
        externalMessageId: msgId,
        status,
        timestamp,
      },
      rawPayload: { ...event, data } as Record<string, unknown>,
    }));
  }

  // ─── Outbound (CS messages) ────────────────────────────────────────────────

  async sendMessage(
    channel: ChannelContext,
    message: OutboundMessagePayload,
  ): Promise<SendMessageResult> {
    if (!message.recipientExternalId) {
      throw new Error('Recipient user_id is required to send Zalo CS message');
    }
    const payload = this.buildCsMessagePayload(message);
    return this.deliverCsMessage(channel, payload, false);
  }

  private buildCsMessagePayload(message: OutboundMessagePayload): Record<string, unknown> {
    const recipient = { user_id: message.recipientExternalId };

    // Interactive template passthrough: metadata.zaloTemplate becomes attachment.payload
    // (template_type: buttons | list | media_list | request_user_info | promotion | ...).
    const template = message.metadata?.zaloTemplate as ZaloTemplatePayload | undefined;
    if (
      template &&
      typeof template === 'object' &&
      typeof template.template_type === 'string' &&
      template.template_type
    ) {
      return {
        recipient,
        message: {
          text: message.content || undefined,
          attachment: { type: 'template', payload: template },
        },
      };
    }

    const attachment = message.attachments?.[0];
    if (attachment?.fileUrl) {
      const type = this.resolveOutboundAttachmentType(message, attachment.fileType);
      if (type === 'file' || type === 'video') {
        // CS file/video messages require Zalo's upload API first (out of scope for this task).
        throw new Error(
          'ZALO_OUTBOUND_FILE_UNSUPPORTED: gửi file/video qua Zalo OA cần upload API riêng (chưa hỗ trợ). Vui lòng gửi link dạng tin nhắn văn bản.',
        );
      }
      return {
        recipient,
        message: {
          text: message.content || undefined,
          attachment: { type, payload: { url: attachment.fileUrl } },
        },
      };
    }

    return { recipient, message: { text: message.content || '' } };
  }

  private resolveOutboundAttachmentType(
    message: OutboundMessagePayload,
    fileType?: string,
  ): 'image' | 'audio' | 'video' | 'file' {
    const contentType = message.contentType;
    const upperFileType = fileType?.toUpperCase();
    if (contentType === MessageContentType.IMAGE || upperFileType === 'IMAGE') {
      return 'image';
    }
    if (contentType === MessageContentType.AUDIO || upperFileType === 'AUDIO') {
      return 'audio';
    }
    if (contentType === MessageContentType.VIDEO || upperFileType === 'VIDEO') {
      return 'video';
    }
    return 'file';
  }

  private async deliverCsMessage(
    channel: ChannelContext,
    payload: Record<string, unknown>,
    isRetry: boolean,
  ): Promise<SendMessageResult> {
    const accessToken = await this.tokenService.getValidAccessToken(channel);
    const response = await fetch(`${ZALO_OPEN_API_BASE}${ZALO_SEND_CS_MESSAGE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: accessToken },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => ({}))) as ZaloSendCsMessageResponse;

    if (this.isAuthError(response.status, data.error)) {
      if (isRetry) {
        throw new Error(
          `Zalo CS send failed after token refresh: [${data.error ?? response.status}] ${data.message ?? response.statusText}`,
        );
      }
      // Token rejected despite looking valid → force rotate once and retry.
      this.logger.warn(
        `Zalo rejected access token for channel '${channel.channelId}', forcing refresh`,
      );
      await this.tokenService.forceRefresh(channel);
      return this.deliverCsMessage(channel, payload, true);
    }

    if (!response.ok || (data.error !== undefined && data.error !== ZALO_ERROR_CODES.OK)) {
      throw new Error(
        `Zalo CS send failed: [${data.error ?? response.status}] ${this.describeZaloError(data.message, response.statusText)}`,
      );
    }

    return {
      externalMessageId: data.msg_id || '',
      deliveryStatus: DeliveryStatus.SENT,
      rawResponse: data,
    };
  }

  private isAuthError(status: number, errorCode?: number): boolean {
    return status === 401 || status === 403 || errorCode === ZALO_ERROR_CODES.INVALID_ACCESS_TOKEN;
  }

  private describeZaloError(message?: string, statusText?: string): string {
    const lower = (message || '').toLowerCase();
    if (ZALO_CS_WINDOW_MESSAGE_FRAGMENTS.some(fragment => lower.includes(fragment))) {
      return `CS_WINDOW_EXCEEDED (7 ngày): ${message}`;
    }
    return message || statusText || 'unknown error';
  }

  // ─── Provider info ─────────────────────────────────────────────────────────

  /**
   * Fetches the Official Account info (`GET /oa`) — used by lifecycle validation.
   */
  async getChannelInfo(channel: ChannelContext): Promise<ChannelInfo> {
    const accessToken = await this.tokenService.getValidAccessToken(channel);
    return this.getOaInfo(accessToken);
  }

  /**
   * Fetches OA info with a raw access token (used by the OAuth callback, before a
   * channel row exists to persist tokens into).
   */
  async getOaInfo(accessToken: string): Promise<ChannelInfo> {
    const data = await this.requestZaloApi<ZaloOaInfoResponse>(
      ZALO_OA_INFO_PATH,
      accessToken,
      'GET',
    );

    if (!data.name && !data.oa_id) {
      throw new Error(`Zalo OA info fetch failed: ${data.message || 'empty response'}`);
    }

    return {
      providerAccountId: data.oa_id || '',
      name: data.name || 'Zalo Official Account',
      avatarUrl: data.avatar || undefined,
      metadata: { oaId: data.oa_id },
    };
  }

  /**
   * Fetches the Zalo user profile for Contact sync (display_name, avatar).
   */
  async fetchSenderInfo(
    channel: ChannelContext,
    externalContactId: string,
  ): Promise<InboundSenderInfo | null> {
    try {
      const accessToken = await this.tokenService.getValidAccessToken(channel);
      const data = await this.requestZaloApi<ZaloUserInfoResponse>(
        ZALO_USER_INFO_PATH,
        accessToken,
        'POST',
        { user_id: externalContactId },
      );

      if (data.error !== undefined && data.error !== ZALO_ERROR_CODES.OK) {
        this.logger.warn(
          `Zalo user info fetch failed for '${externalContactId}': [${data.error}] ${data.message}`,
        );
        return null;
      }

      return {
        name: data.display_name || undefined,
        avatarUrl: data.avatar || undefined,
        username: data.user_alias || undefined,
      };
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Zalo sender info for '${externalContactId}': ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async requestZaloApi<T>(
    path: string,
    accessToken: string,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${ZALO_OPEN_API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', access_token: accessToken },
      body: body ? JSON.stringify(body) : undefined,
    });
    return (await response.json().catch(() => ({}))) as T;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * MAC over `app_id + rawBody + timestamp + oa_secret_key`. Isolated here — the exact
   * concatenation and timestamp source must be confirmed against a real OA (plan §6).
   */
  private computeExpectedMac(
    appId: string,
    rawBodyString: string,
    timestamp: string | number | undefined,
    oaSecretKey: string,
  ): string | null {
    if (timestamp === undefined || timestamp === null || timestamp === '') {
      return null;
    }
    return crypto
      .createHash('sha256')
      .update(`${appId}${rawBodyString}${String(timestamp)}${oaSecretKey}`)
      .digest('hex');
  }

  private extractSignature(headers?: Record<string, string | string[] | undefined>): string | null {
    if (!headers) {
      return null;
    }
    let value: string | string[] | undefined;
    for (const [key, headerValue] of Object.entries(headers)) {
      if (key.toLowerCase() === ZALO_SIGNATURE_HEADER) {
        value = headerValue;
        break;
      }
    }
    const resolved = Array.isArray(value) ? value[0] : value;
    if (typeof resolved !== 'string' || !resolved) {
      return null;
    }
    return resolved.replace(/^sha256=/i, '').trim();
  }

  private safeCompareHex(expected: string, received: string): boolean {
    const expectedBuffer = Buffer.from(expected.toLowerCase(), 'utf8');
    const receivedBuffer = Buffer.from(received.toLowerCase(), 'utf8');
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  private isTimestampFresh(timestamp: string | number | undefined): boolean {
    if (timestamp === undefined || timestamp === null || timestamp === '') {
      // No timestamp to check — signature itself already authenticated the payload.
      return true;
    }
    const ts = Number(timestamp);
    if (Number.isNaN(ts)) {
      return false;
    }
    return Math.abs(Date.now() - ts) <= ZALO_TIMESTAMP_TOLERANCE_MS;
  }

  private extractRawBodyString(rawBody: unknown): string {
    if (Buffer.isBuffer(rawBody)) {
      return rawBody.toString('utf8');
    }
    if (typeof rawBody === 'string') {
      return rawBody;
    }
    if (typeof rawBody === 'object' && rawBody !== null) {
      return JSON.stringify(rawBody);
    }
    return '';
  }

  private parseEvent(rawBody: unknown): ZaloWebhookEvent | null {
    if (typeof rawBody === 'string') {
      try {
        return JSON.parse(rawBody) as ZaloWebhookEvent;
      } catch {
        return null;
      }
    }
    if (typeof rawBody === 'object' && rawBody !== null) {
      return rawBody as ZaloWebhookEvent;
    }
    return null;
  }

  /**
   * Zalo's `data` field may be a JSON-encoded string or an object depending on the event.
   */
  private parseEventData(event: ZaloWebhookEvent): ZaloEventData | null {
    const { data } = event;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as ZaloEventData;
      } catch {
        return null;
      }
    }
    if (typeof data === 'object' && data !== null) {
      return data as ZaloEventData;
    }
    return null;
  }

  private parseEventTimestamp(event: ZaloWebhookEvent): Date {
    const ts = Number(event.timestamp);
    if (!Number.isNaN(ts) && ts > 0) {
      return new Date(ts);
    }
    return new Date();
  }

  private firstAttachmentUrl(attachments?: ZaloEventAttachment[]): string | undefined {
    return attachments?.find(a => typeof a?.payload?.url === 'string')?.payload?.url;
  }
}
