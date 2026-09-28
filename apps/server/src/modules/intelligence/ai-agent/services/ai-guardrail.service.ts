import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import {
  AI_AGENT_CONSTANTS,
  CONTENT_BLACKLIST_REGEX,
  getAiAbuseKey,
  getAiRateLimitKey,
  getAiRateLimitWarnedKey,
} from '../ai-agent.constants';

type GuardrailBlockReason =
  | 'EMPTY_CONTENT'
  | 'EMOJI_ONLY'
  | 'BLACKLISTED'
  | 'DUPLICATE_SPAM'
  | 'SHORT_SPAM'
  | 'RATE_LIMITED'
  | 'INFRA_UNAVAILABLE';

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: GuardrailBlockReason;
  shouldReply?: boolean;
  replyText?: string;
}

interface AbuseState {
  lastHash: string;
  repeatCount: number;
  shortCount: number;
}

export function isEmojiOrStickerOnly(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;

  // If text contains letters or digits (Vietnamese / Latin / digits), it's not emoji-only
  if (/[a-zA-Z0-9\u00C0-\u1EF9]/.test(trimmed)) {
    return false;
  }

  // Must contain at least one pictorial emoji
  const hasEmoji = /\p{Extended_Pictographic}/u.test(trimmed);
  if (!hasEmoji) {
    return false;
  }

  // Must only be composed of emojis, modifiers, punctuation, and whitespace
  return /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Component}\p{Punctuation}\s]+$/u.test(
    trimmed,
  );
}

@Injectable()
export class AiGuardrailService {
  private readonly logger = new Logger(AiGuardrailService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Pre-dispatch multi-tier guardrail validation:
   * Tier A: Rule-based content filtering (Empty, Emoji-only, Blacklist) - 0 Redis calls
   * Tier B: Abuse detection (Consecutive identical messages, Consecutive short messages) - 1 Redis read/write
   * Tier C: Rate limiting (Fixed-window counter with reply storm throttling) - 1-2 Redis calls
   */
  async check(params: {
    workspaceId: string;
    conversationId: string;
    messageContent: string | null | undefined;
  }): Promise<GuardrailCheckResult> {
    const { workspaceId, conversationId, messageContent } = params;

    // --- TIER A: Content Filter ---
    if (!messageContent || !messageContent.trim()) {
      return { allowed: false, reason: 'EMPTY_CONTENT' };
    }

    const trimmed = messageContent.trim();

    if (isEmojiOrStickerOnly(trimmed)) {
      return { allowed: false, reason: 'EMOJI_ONLY' };
    }

    if (CONTENT_BLACKLIST_REGEX.test(trimmed)) {
      return {
        allowed: false,
        reason: 'BLACKLISTED',
        shouldReply: true,
        replyText: AI_AGENT_CONSTANTS.BLACKLIST_REPLY_MESSAGE,
      };
    }

    // --- TIER B: Abuse Detection ---
    try {
      const abuseKey = getAiAbuseKey(workspaceId, conversationId);
      const rawState = await this.redisService.get(abuseKey);
      const state: AbuseState = rawState
        ? JSON.parse(rawState)
        : { lastHash: '', repeatCount: 0, shortCount: 0 };

      const currentHash = trimmed.toLowerCase();
      const isDuplicate = state.lastHash === currentHash;
      const newRepeatCount = isDuplicate ? (state.repeatCount || 0) + 1 : 1;

      const isShort = trimmed.length < AI_AGENT_CONSTANTS.ABUSE_SHORT_MSG_MAX_LENGTH;
      const newShortCount = isShort ? (state.shortCount || 0) + 1 : 0;

      const newState: AbuseState = {
        lastHash: currentHash,
        repeatCount: newRepeatCount,
        shortCount: newShortCount,
      };

      await this.redisService.set(
        abuseKey,
        JSON.stringify(newState),
        AI_AGENT_CONSTANTS.ABUSE_STATE_TTL_SECONDS,
      );

      if (newRepeatCount >= AI_AGENT_CONSTANTS.ABUSE_CONSECUTIVE_LIMIT) {
        return { allowed: false, reason: 'DUPLICATE_SPAM' };
      }

      if (newShortCount >= AI_AGENT_CONSTANTS.ABUSE_CONSECUTIVE_LIMIT) {
        return { allowed: false, reason: 'SHORT_SPAM' };
      }
    } catch (err) {
      // Fail CLOSED: without Redis the abuse tiers cannot be evaluated, and letting
      // messages through would grant unlimited AI usage during an outage.
      this.logger.error(
        `Redis unavailable — abuse detection failed closed for conv '${conversationId}': ${(err as Error).message}`,
      );
      return { allowed: false, reason: 'INFRA_UNAVAILABLE' };
    }

    // --- TIER C: Rate Limiting (atomic sliding window; fails CLOSED on Redis errors —
    // an outage must never grant unlimited AI usage) ---
    try {
      const rateLimitKey = getAiRateLimitKey(workspaceId, conversationId);
      const windowMs = AI_AGENT_CONSTANTS.RATE_LIMIT_WINDOW_SECONDS * 1000;
      const member = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const count = await this.redisService.incrementSlidingWindow(rateLimitKey, windowMs, member);

      if (count > AI_AGENT_CONSTANTS.RATE_LIMIT_PER_MINUTE) {
        const warnedKey = getAiRateLimitWarnedKey(workspaceId, conversationId);
        const alreadyWarned = await this.redisService.get(warnedKey);

        if (!alreadyWarned) {
          await this.redisService.set(
            warnedKey,
            '1',
            AI_AGENT_CONSTANTS.RATE_LIMIT_WARN_TTL_SECONDS,
          );
          return {
            allowed: false,
            reason: 'RATE_LIMITED',
            shouldReply: true,
            replyText: AI_AGENT_CONSTANTS.RATE_LIMIT_WARN_MESSAGE,
          };
        }

        return {
          allowed: false,
          reason: 'RATE_LIMITED',
        };
      }
    } catch (err) {
      this.logger.error(
        `Redis unavailable — rate limit failed closed for conv '${conversationId}': ${(err as Error).message}`,
      );
      return { allowed: false, reason: 'INFRA_UNAVAILABLE' };
    }

    return { allowed: true };
  }
}
