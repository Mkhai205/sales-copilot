import { Injectable, Logger } from '@nestjs/common';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { ThreadType } from 'zca-js';
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
import { ZALO_PERSONAL_ENVELOPE_KIND } from './zalo-personal.constants';
import type { ZaloPersonalAttachment, ZaloPersonalEnvelope } from './zalo-personal.types';
import { ZaloPersonalRateLimiterService } from './zalo-personal-rate-limiter.service';
import { ZaloPersonalConnectionService } from './zalo-personal-connection.service';

/** Structural slice of a zca-js listener message this integration depends on. */
export interface ZaloListenerMessage {
  type: number;
  threadId: string;
  isSelf: boolean;
  data: {
    msgId?: string;
    /** zca-js TMessage.content — string for text, media object for attachments. */
    content?: unknown;
    attach?: string;
    uidFrom?: string;
  };
}

/**
 * Extracts attachments from the `TMessage.attach` JSON string (tolerant — Zalo shapes change).
 * The attach payload is an object keyed by media type (e.g. `{"photo":[{href,...}]}`),
 * so every array/object-valued property is scanned rather than trusting one shape.
 */
export function parseListenerAttachments(attach?: string): ZaloPersonalAttachment[] {
  if (!attach) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(attach);
  } catch {
    return [];
  }
  return collectAttachmentItems(parsed)
    .map(toAttachment)
    .filter((item): item is ZaloPersonalAttachment => item !== null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectAttachmentItems(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (!isRecord(parsed)) return [];
  const items: Record<string, unknown>[] = [];
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) {
      items.push(...value.filter(isRecord));
    } else if (isRecord(value)) {
      items.push(value);
    }
  }
  return items;
}

function toAttachment(item: Record<string, unknown>): ZaloPersonalAttachment | null {
  const nestedData = item.data as Record<string, unknown> | string | undefined;
  const urlCandidates = [
    item.href,
    item.url,
    item.thumb,
    typeof nestedData === 'object' && nestedData !== null ? nestedData.href : undefined,
    typeof nestedData === 'object' && nestedData !== null ? nestedData.url : undefined,
    typeof nestedData === 'string' && nestedData.startsWith('http') ? nestedData : undefined,
  ];
  const url = urlCandidates.find(
    candidate => typeof candidate === 'string' && candidate.startsWith('http'),
  ) as string | undefined;
  if (!url) return null;

  return {
    type: typeof item.type === 'string' ? item.type : 'unknown',
    url,
    fileName: typeof item.title === 'string' ? item.title : undefined,
  };
}

/**
 * Builds the JSON-serializable ingestion envelope from a live listener message.
 * Text lives in `TMessage.content` (string for text messages — there is no `msg`
 * field on TMessage, only on quotes). Media messages carry an object content with
 * a thumbnail URL, used as a fallback when the attach JSON yields nothing parseable.
 */
export function buildIngestEnvelope(message: ZaloListenerMessage): ZaloPersonalEnvelope | null {
  // MVP scope: 1-1 conversations only (ThreadType.User === 0).
  if (message.type !== ThreadType.User) return null;
  const msgId = message.data?.msgId;
  const threadId = message.threadId;
  if (!msgId || !threadId) return null;

  const { content } = message.data ?? {};
  const attachments = parseListenerAttachments(message.data?.attach);
  if (attachments.length === 0 && isRecord(content)) {
    const thumb = content.thumb;
    if (typeof thumb === 'string' && thumb.startsWith('http')) {
      attachments.push({ type: 'photo', url: thumb });
    }
  }

  return {
    kind: ZALO_PERSONAL_ENVELOPE_KIND,
    v: 1,
    message: {
      msgId,
      threadId,
      isSelf: Boolean(message.isSelf),
      text: typeof content === 'string' ? content.trim() : '',
      attachments,
    },
  };
}

function toInboundAttachment(attachment: ZaloPersonalAttachment): InboundAttachment | null {
  if (!attachment.url) return null;
  const lower = attachment.type.toLowerCase();
  let contentType: MessageContentType = MessageContentType.FILE;
  if (lower.includes('photo') || lower.includes('sticker') || lower.includes('gif')) {
    contentType = MessageContentType.IMAGE;
  } else if (lower.includes('voice') || lower.includes('audio')) {
    contentType = MessageContentType.AUDIO;
  } else if (lower.includes('video')) {
    contentType = MessageContentType.VIDEO;
  }
  return {
    fileUrl: attachment.url,
    fileName: attachment.fileName,
    contentType,
    fileType: contentType,
  };
}

/**
 * ChannelAdapter for personal Zalo accounts (zca-js, unofficial).
 *
 * Inbound arrives through the persistent listener inside ZaloPersonalConnectionService
 * which pushes envelopes into the standard ingestion pipeline — the HTTP webhook route
 * is not part of this channel and verifyWebhook always fails closed.
 */
@Injectable()
export class ZaloPersonalAdapter implements ChannelAdapter {
  private readonly logger = new Logger(ZaloPersonalAdapter.name);
  readonly channelType: ChannelType = ChannelType.ZALO_PERSONAL;

  constructor(
    private readonly connectionService: ZaloPersonalConnectionService,
    private readonly rateLimiter: ZaloPersonalRateLimiterService,
  ) {}

  /** No inbound HTTP webhook exists for this channel — reject everything (fail-closed). */
  verifyWebhook(
    _request: WebhookVerificationRequest,
    _credentials?: Record<string, unknown>,
  ): boolean {
    return false;
  }

  handleCallbackVerification(): Record<string, unknown> | null {
    return null;
  }

  /**
   * Maps an ingestion envelope (produced by the listener) into standard payloads.
   * Self messages never pass through here — the connection service ingests them
   * directly as outgoing messages.
   */
  parseInboundPayload(rawBody: unknown): InboundMessagePayload[] {
    if (
      !rawBody ||
      typeof rawBody !== 'object' ||
      (rawBody as Record<string, unknown>).kind !== ZALO_PERSONAL_ENVELOPE_KIND
    ) {
      return [];
    }
    const envelope = rawBody as ZaloPersonalEnvelope;
    if (envelope.message.isSelf) return [];

    const { msgId, threadId, text, attachments } = envelope.message;
    const mapped = attachments
      .map(toInboundAttachment)
      .filter((item): item is InboundAttachment => item !== null);

    const contentType: MessageContentType =
      mapped.length > 0 && !text ? mapped[0].contentType : MessageContentType.TEXT;
    const content = text || undefined;

    return [
      {
        eventKind: 'message',
        externalContactId: threadId,
        externalMessageId: msgId,
        content,
        contentType,
        attachments: mapped.length > 0 ? mapped : undefined,
        timestamp: new Date(),
        rawPayload: envelope as unknown as Record<string, unknown>,
      },
    ];
  }

  async sendMessage(
    channel: ChannelContext,
    message: OutboundMessagePayload,
  ): Promise<SendMessageResult> {
    if (!message.recipientExternalId) {
      throw new Error('Recipient user id is required to send Zalo personal message');
    }
    if (message.attachments && message.attachments.length > 0) {
      throw new Error(
        'ZALO_PERSONAL_OUTBOUND_MEDIA_UNSUPPORTED: gửi ảnh/file qua Zalo cá nhân chưa được hỗ trợ trong pha này. Vui lòng gửi dạng tin nhắn văn bản.',
      );
    }

    await this.rateLimiter.acquire(channel.channelId);
    const api = await this.connectionService.getApiForChannel(channel.channelId);
    const response = await api.sendMessage(
      message.content || '',
      message.recipientExternalId,
      ThreadType.User,
    );

    return {
      externalMessageId: response?.message?.msgId || '',
      deliveryStatus: DeliveryStatus.SENT,
      rawResponse: response,
    };
  }

  async getChannelInfo(channel: ChannelContext): Promise<ChannelInfo> {
    const api = await this.connectionService.getApiForChannel(channel.channelId);
    let ownId = '';
    try {
      ownId = String((await api.getOwnId()) ?? '');
    } catch (err) {
      this.logger.warn(`Failed to resolve ownId: ${(err as Error).message}`);
    }

    let name = 'Zalo Cá nhân';
    let avatarUrl: string | undefined;
    if (ownId) {
      const profile = await this.fetchProfile(api, ownId);
      name = profile?.name || name;
      avatarUrl = profile?.avatarUrl;
    }

    return {
      providerAccountId: ownId,
      name,
      avatarUrl,
      metadata: { ownId },
    };
  }

  async fetchSenderInfo(
    channel: ChannelContext,
    externalContactId: string,
  ): Promise<InboundSenderInfo | null> {
    try {
      const api = await this.connectionService.getApiForChannel(channel.channelId);
      const profile = await this.fetchProfile(api, externalContactId);
      if (!profile) return null;
      return { name: profile.name, avatarUrl: profile.avatarUrl };
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Zalo personal sender info for '${externalContactId}': ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Tolerant profile extraction — zca-js field names shift between versions. */
  private async fetchProfile(
    api: unknown,
    userId: string,
  ): Promise<{ name?: string; avatarUrl?: string } | null> {
    try {
      const response = (await (
        api as { getUserInfo: (ids: string[]) => Promise<Record<string, unknown>> }
      ).getUserInfo([userId])) as {
        changed_profiles?: Record<string, Record<string, unknown>>;
      };
      const profile = response?.changed_profiles?.[userId];
      if (!profile || typeof profile !== 'object') return null;
      return {
        name:
          (typeof profile.displayName === 'string' && profile.displayName) ||
          (typeof profile.name === 'string' && profile.name) ||
          undefined,
        avatarUrl: typeof profile.avatar === 'string' ? profile.avatar : undefined,
      };
    } catch {
      return null;
    }
  }
}
