import { Injectable, Logger } from '@nestjs/common';
import {
  ChannelType,
  DeliveryStatus,
  FileType,
  MessageContentType,
} from '@sales-copilot/shared-contracts';
import { imageSize } from 'image-size';
import { ThreadType } from 'zca-js';
import { ChannelAdapter } from '../channel-adapter.interface';
import {
  ChannelContext,
  ChannelInfo,
  InboundAttachment,
  InboundMessagePayload,
  InboundSenderInfo,
  OutboundAttachment,
  OutboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from '../channel-adapter.types';
import { ZALO_PERSONAL_ENVELOPE_KIND } from './zalo-personal.constants';
import type { ZaloPersonalAttachment, ZaloPersonalEnvelope } from './zalo-personal.types';
import { ZaloPersonalRateLimiterService } from './zalo-personal-rate-limiter.service';
import { ZaloPersonalConnectionService } from './zalo-personal-connection.service';

/** Attachment source shape for zca-js uploadAttachment (Buffer input). */
interface ZaloAttachmentSource {
  data: Buffer;
  filename: string;
  metadata: { totalSize: number; width?: number; height?: number };
}

/** Structural slice of a zca-js listener message this integration depends on. */
export interface ZaloListenerMessage {
  type: number;
  threadId: string;
  isSelf: boolean;
  data: {
    msgId?: string;
    /** zca-js TMessage.msgType (e.g. 'chat.text', 'chat.image', 'chat.video.new', 'chat.file'). */
    msgType?: string;
    /** zca-js TMessage.content — string for text, media object for attachments. */
    content?: unknown;
    attach?: string;
    uidFrom?: string;
  };
}

/** Object fields scanned for attachment URLs, in preference order. */
const URL_FIELDS = ['href', 'url', 'fileUrl', 'rawUrl', 'normalUrl', 'thumb', 'thumbUrl'] as const;

/** How deep the attach hunt may descend before giving up (Zalo nesting drifts). */
const MAX_HUNT_DEPTH = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function firstHttpUrl(record: Record<string, unknown>): string | undefined {
  for (const field of URL_FIELDS) {
    const candidate = record[field];
    if (typeof candidate === 'string' && candidate.startsWith('http')) return candidate;
  }
  const nested = record.data;
  if (typeof nested === 'string' && nested.startsWith('http')) return nested;
  if (isRecord(nested)) return firstHttpUrl(nested);
  return undefined;
}

/**
 * Collects attachment candidate objects from arbitrary Zalo JSON shapes.
 * The attach payload is keyed by media type (e.g. `{"photo":[...]}`) but the
 * nesting shifts between Zalo builds, so arrays and objects are hunted
 * recursively (depth-capped) with the media-type key as a type hint.
 */
function collectAttachmentItems(
  parsed: unknown,
  depth = 0,
  typeHint?: string,
): Record<string, unknown>[] {
  if (depth > MAX_HUNT_DEPTH) return [];
  if (Array.isArray(parsed)) {
    return parsed
      .filter(isRecord)
      .map(item =>
        typeHint !== undefined && item.type === undefined ? { type: typeHint, ...item } : item,
      );
  }
  if (!isRecord(parsed)) return [];

  const items: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    const hint = typeHint ?? key;
    if (Array.isArray(value)) {
      items.push(...collectAttachmentItems(value, depth + 1, hint));
    } else if (isRecord(value)) {
      const nested = collectAttachmentItems(value, depth + 1, hint);
      items.push(...(nested.length > 0 ? nested : [{ ...value, type: value.type ?? hint }]));
    }
  }
  return items;
}

function toAttachment(item: Record<string, unknown>): ZaloPersonalAttachment | null {
  const url = firstHttpUrl(item);
  if (!url) return null;
  return {
    type: typeof item.type === 'string' && item.type ? item.type : 'unknown',
    url,
    fileName: typeof item.title === 'string' && item.title.trim() ? item.title : undefined,
  };
}

function huntAttachments(parsed: unknown): ZaloPersonalAttachment[] {
  const items = collectAttachmentItems(parsed);
  // A single-attachment record (e.g. the content object itself carrying a thumb)
  // never yields nested items — treat the record itself as the candidate.
  if (items.length === 0 && isRecord(parsed) && firstHttpUrl(parsed)) {
    items.push(parsed);
  }
  const attachments = items
    .map(toAttachment)
    .filter((item): item is ZaloPersonalAttachment => item !== null);

  const seen = new Set<string>();
  return attachments.filter(att => {
    if (!att.url || seen.has(att.url)) return false;
    seen.add(att.url);
    return true;
  });
}

export function parseListenerAttachments(attach?: string): ZaloPersonalAttachment[] {
  if (!attach) return [];
  return huntAttachments(tryParseJson(attach));
}

/**
 * Builds the JSON-serializable ingestion envelope from a live listener message.
 * Text lives in `TMessage.content` (string for text messages — there is no `msg`
 * field on TMessage, only on quotes). `rawAttach`/`rawContent` are preserved so
 * future Zalo shape drift stays diagnosable from persisted channel events.
 */
export function buildIngestEnvelope(message: ZaloListenerMessage): ZaloPersonalEnvelope | null {
  // MVP scope: 1-1 conversations only (ThreadType.User === 0).
  if (message.type !== ThreadType.User) return null;
  const msgId = message.data?.msgId;
  const threadId = message.threadId;
  if (!msgId || !threadId) return null;

  const { content, attach, msgType } = message.data ?? {};
  let attachments = parseListenerAttachments(attach);
  if (attachments.length === 0 && isRecord(content)) {
    // Media content objects may carry the URL inside their `params` JSON string
    // or directly on the object (e.g. a video/image poster thumb).
    attachments = huntAttachments(tryParseJson(content.params));
    if (attachments.length === 0) attachments = huntAttachments(content);
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
      ...(msgType ? { msgType } : {}),
      ...(attach ? { rawAttach: attach } : {}),
      ...(isRecord(content) ? { rawContent: content } : {}),
      ...(msgType === 'chat.sticker' ? { stickerId: extractStickerId(content) } : {}),
    },
  };
}

/**
 * Sticker messages carry no media URL — only a sticker id (field name drifts
 * between `stickerId` and `id`). The connection service resolves it to an
 * image URL through the sticker API.
 */
function extractStickerId(content: unknown): number | undefined {
  const candidates =
    typeof content === 'number'
      ? [content]
      : isRecord(content)
        ? [
            content.stickerId,
            content.id,
            isRecord(content.data) ? content.data.stickerId : undefined,
          ]
        : [];
  for (const candidate of candidates) {
    const id = typeof candidate === 'number' ? candidate : Number(candidate);
    if (Number.isFinite(id) && id > 0) return id;
  }
  return undefined;
}

/** zca-js msgType → standard content type; authoritative over attachment-type guesses. */
function contentTypeFromMsgType(msgType?: string): MessageContentType | undefined {
  const lower = (msgType ?? '').toLowerCase();
  if (!lower) return undefined;
  if (lower.includes('video')) return MessageContentType.VIDEO;
  if (lower.includes('voice') || lower.includes('audio')) return MessageContentType.AUDIO;
  if (lower.includes('file')) return MessageContentType.FILE;
  if (
    lower.includes('image') ||
    lower.includes('photo') ||
    lower.includes('sticker') ||
    lower.includes('gif')
  ) {
    return MessageContentType.IMAGE;
  }
  return undefined;
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

    const { msgId, threadId, text, attachments, msgType } = envelope.message;
    const mapped = attachments
      .map(toInboundAttachment)
      .filter((item): item is InboundAttachment => item !== null);

    const msgContentType = contentTypeFromMsgType(msgType);
    const contentType: MessageContentType = text
      ? MessageContentType.TEXT
      : (msgContentType ?? mapped[0]?.contentType ?? MessageContentType.FILE);

    // Real payloads carry useless attachment types (e.g. video items typed "")
    // while msgType is reliable — propagate the authoritative type onto them.
    const typedAttachments = msgContentType
      ? mapped.map(att => ({ ...att, contentType: msgContentType, fileType: msgContentType }))
      : mapped;

    return [
      {
        eventKind: 'message',
        externalContactId: threadId,
        externalMessageId: msgId,
        content: text || undefined,
        contentType,
        attachments: typedAttachments.length > 0 ? typedAttachments : undefined,
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

    await this.rateLimiter.acquire(channel.channelId);
    const api = await this.connectionService.getApiForChannel(channel.channelId);

    const attachments = message.attachments ?? [];
    if (attachments.length > 0) {
      const sources: ZaloAttachmentSource[] = [];
      for (const attachment of attachments) {
        sources.push(await this.toZaloAttachmentSource(attachment));
      }

      // zca-js routes this itself: a single image carries `msg` as its caption,
      // other media and text go out as separate Zalo messages.
      const response = await api.sendMessage(
        { msg: message.content || '', attachments: sources },
        message.recipientExternalId,
        ThreadType.User,
      );

      return {
        externalMessageId: response?.message?.msgId || response?.attachment?.[0]?.msgId || '',
        deliveryStatus: DeliveryStatus.SENT,
        rawResponse: response,
      };
    }

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

  /** Downloads the attachment bytes and shapes them for zca-js uploadAttachment. */
  private async toZaloAttachmentSource(att: OutboundAttachment): Promise<ZaloAttachmentSource> {
    if (!att.fileUrl) {
      throw new Error('ZALO_PERSONAL_ATTACHMENT_URL_REQUIRED: attachment has no fileUrl');
    }

    const response = await fetch(att.fileUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download attachment '${att.fileName || att.fileUrl}': HTTP ${response.status}`,
      );
    }
    const data = Buffer.from(await response.arrayBuffer());

    const metadata: ZaloAttachmentSource['metadata'] = { totalSize: data.length };
    if (this.isImageLike(att)) {
      // Zalo expects image dimensions; parsed straight from the bytes so no
      // imageMetadataGetter is needed on the zca-js client.
      try {
        const { width, height } = imageSize(data);
        metadata.width = width;
        metadata.height = height;
      } catch {
        // unparseable header — Zalo receives the upload without dimensions
      }
    }

    return { data, filename: att.fileName || `attachment-${Date.now()}`, metadata };
  }

  private isImageLike(att: OutboundAttachment): boolean {
    if (att.fileType) return att.fileType === FileType.IMAGE;
    return /\.(png|jpe?g|webp|gif)$/i.test(att.fileName || '');
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
