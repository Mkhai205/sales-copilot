import { AiGuardrailService, isEmojiOrStickerOnly } from '../ai-guardrail.service';
import { AI_AGENT_CONSTANTS } from '../../ai-agent.constants';

describe('AiGuardrailService', () => {
  let service: AiGuardrailService;
  let mockRedis: any;
  let redisStore: Map<string, { val: string; ttl?: number }>;
  let counters: Map<string, number>;

  const workspaceId = 'ws-test-123';
  const conversationId = 'conv-test-456';

  beforeEach(() => {
    redisStore = new Map();
    counters = new Map();

    mockRedis = {
      get: async (key: string) => {
        const item = redisStore.get(key);
        return item ? item.val : null;
      },
      set: async (key: string, val: string, ttl?: number) => {
        redisStore.set(key, { val, ttl });
      },
      incr: async (key: string) => {
        const current = (counters.get(key) || 0) + 1;
        counters.set(key, current);
        return current;
      },
      expire: async (_key: string, _ttl: number) => {
        return true;
      },
    };

    service = new AiGuardrailService(mockRedis);
  });

  describe('isEmojiOrStickerOnly helper', () => {
    it('should detect emoji-only messages', () => {
      expect(isEmojiOrStickerOnly('👍')).toBe(true);
      expect(isEmojiOrStickerOnly('❤️❤️')).toBe(true);
      expect(isEmojiOrStickerOnly('😀 🎉 🔥')).toBe(true);
      expect(isEmojiOrStickerOnly('   👍   ')).toBe(true);
    });

    it('should not flag messages containing text or numbers as emoji-only', () => {
      expect(isEmojiOrStickerOnly('áo polo giá bao nhiêu ạ? 👍')).toBe(false);
      expect(isEmojiOrStickerOnly('123')).toBe(false);
      expect(isEmojiOrStickerOnly('size L')).toBe(false);
      expect(isEmojiOrStickerOnly('?')).toBe(false);
      expect(isEmojiOrStickerOnly('shop ơi')).toBe(false);
    });
  });

  describe('Tier A: Content Filter', () => {
    it('should reject empty or null content with EMPTY_CONTENT', async () => {
      const resNull = await service.check({
        workspaceId,
        conversationId,
        messageContent: null,
      });
      expect(resNull.allowed).toBe(false);
      expect(resNull.reason).toBe('EMPTY_CONTENT');

      const resEmpty = await service.check({
        workspaceId,
        conversationId,
        messageContent: '   ',
      });
      expect(resEmpty.allowed).toBe(false);
      expect(resEmpty.reason).toBe('EMPTY_CONTENT');
    });

    it('should reject emoji-only messages with EMOJI_ONLY without reply', async () => {
      const res = await service.check({
        workspaceId,
        conversationId,
        messageContent: '👍👍👍',
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('EMOJI_ONLY');
      expect(res.shouldReply).toBeFalsy();
    });

    it('should block blacklisted extreme profanity with template reply', async () => {
      const res = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Shop làm ăn như đụ má',
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('BLACKLISTED');
      expect(res.shouldReply).toBe(true);
      expect(res.replyText).toBe(AI_AGENT_CONSTANTS.BLACKLIST_REPLY_MESSAGE);
    });

    it('should allow legitimate shopping queries without false positives', async () => {
      const res = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Shop có bán dao gọt hoa quả không?',
      });
      expect(res.allowed).toBe(true);
    });
  });

  describe('Tier B: Abuse Detection', () => {
    it('should detect 3 consecutive identical messages as DUPLICATE_SPAM', async () => {
      const check1 = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Shop còn áo không?',
      });
      expect(check1.allowed).toBe(true);

      const check2 = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Shop còn áo không?',
      });
      expect(check2.allowed).toBe(true);

      const check3 = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Shop còn áo không?',
      });
      expect(check3.allowed).toBe(false);
      expect(check3.reason).toBe('DUPLICATE_SPAM');
      expect(check3.shouldReply).toBeFalsy();
    });

    it('should detect 3 consecutive short messages as SHORT_SPAM', async () => {
      const check1 = await service.check({
        workspaceId,
        conversationId,
        messageContent: '.',
      });
      expect(check1.allowed).toBe(true);

      const check2 = await service.check({
        workspaceId,
        conversationId,
        messageContent: '?',
      });
      expect(check2.allowed).toBe(true);

      const check3 = await service.check({
        workspaceId,
        conversationId,
        messageContent: '!',
      });
      expect(check3.allowed).toBe(false);
      expect(check3.reason).toBe('SHORT_SPAM');
      expect(check3.shouldReply).toBeFalsy();
    });

    it('should reset abuse counters when a normal message arrives', async () => {
      await service.check({ workspaceId, conversationId, messageContent: 'Alo' });
      await service.check({ workspaceId, conversationId, messageContent: 'Alo' });

      // Interrupt with different message
      const checkDiff = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Tư vấn cho mình áo polo',
      });
      expect(checkDiff.allowed).toBe(true);

      // Now sending 'Alo' again is count = 1, not 3
      const checkAgain = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Alo',
      });
      expect(checkAgain.allowed).toBe(true);
    });
  });

  describe('Tier C: Rate Limiting & Reply Storm Mitigation', () => {
    it('should permit up to 5 messages per minute and block the 6th', async () => {
      for (let i = 1; i <= 5; i++) {
        const res = await service.check({
          workspaceId,
          conversationId,
          messageContent: `Tin nhắn hỏi hàng số ${i}`,
        });
        expect(res.allowed).toBe(true);
      }

      // 6th message exceeds limit -> trigger warning reply
      const res6 = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Tin nhắn hỏi hàng số 6',
      });
      expect(res6.allowed).toBe(false);
      expect(res6.reason).toBe('RATE_LIMITED');
      expect(res6.shouldReply).toBe(true);
      expect(res6.replyText).toBe(AI_AGENT_CONSTANTS.RATE_LIMIT_WARN_MESSAGE);

      // 7th message in the same window -> silent drop (preventing reply storm)
      const res7 = await service.check({
        workspaceId,
        conversationId,
        messageContent: 'Tin nhắn hỏi hàng số 7',
      });
      expect(res7.allowed).toBe(false);
      expect(res7.reason).toBe('RATE_LIMITED');
      expect(res7.shouldReply).toBeFalsy();
    });
  });
});
