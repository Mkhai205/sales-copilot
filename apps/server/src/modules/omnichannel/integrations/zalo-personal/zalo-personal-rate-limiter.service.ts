import { Injectable, Logger } from '@nestjs/common';
import {
  ZALO_PERSONAL_DAILY_SEND_LIMIT,
  ZALO_PERSONAL_MIN_SEND_INTERVAL_MS,
} from './zalo-personal.constants';

export class ZaloPersonalDailyLimitExceededError extends Error {
  constructor(limit: number) {
    super(
      `ZALO_PERSONAL_DAILY_LIMIT_EXCEEDED: đã vượt quá ${limit} tin nhắn gửi/ngày trên kênh Zalo cá nhân này. Vui lòng thử lại vào ngày mai.`,
    );
    this.name = 'ZaloPersonalDailyLimitExceededError';
  }
}

interface ChannelSendState {
  lastSentAt: number;
  sentToday: number;
  dayKey: string;
}

/**
 * Anti-spam guard for outbound messages on personal Zalo accounts: serializes
 * sends per channel with a minimum spacing and a daily cap. Zalo bans personal
 * accounts mainly on spam signals, so this is cheap insurance.
 *
 * `now` is injectable so tests can drive the virtual clock deterministically.
 */
@Injectable()
export class ZaloPersonalRateLimiterService {
  private readonly logger = new Logger(ZaloPersonalRateLimiterService.name);
  private readonly state = new Map<string, ChannelSendState>();

  private dayKeyFor(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
  }

  private getState(channelId: string, now: number): ChannelSendState {
    let state = this.state.get(channelId);
    const todayKey = this.dayKeyFor(now);
    if (!state || state.dayKey !== todayKey) {
      state = { lastSentAt: 0, sentToday: 0, dayKey: todayKey };
      this.state.set(channelId, state);
    }
    return state;
  }

  /**
   * Waits until the minimum spacing for the channel has elapsed, then records
   * the send. Throws ZaloPersonalDailyLimitExceededError when the daily cap is hit.
   */
  async acquire(channelId: string, now: number = Date.now()): Promise<void> {
    const state = this.getState(channelId, now);

    if (state.sentToday >= ZALO_PERSONAL_DAILY_SEND_LIMIT) {
      throw new ZaloPersonalDailyLimitExceededError(ZALO_PERSONAL_DAILY_SEND_LIMIT);
    }

    const waitMs = state.lastSentAt
      ? ZALO_PERSONAL_MIN_SEND_INTERVAL_MS - (now - state.lastSentAt)
      : 0;
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    state.lastSentAt = now;
    state.sentToday += 1;
  }
}
