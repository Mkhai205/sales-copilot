import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { telegramChannelSchema } from '../new/channels/telegram/telegram-schema';
import { webChatChannelSchema } from '../new/channels/web-chat/web-chat-schema';

describe('New Inbox Channel Schemas Validation', () => {
  describe('Telegram Schema', () => {
    it('should validate a valid bot token', () => {
      const validData = {
        name: 'My Telegram Support',
        avatarUrl: 'https://example.com/avatar.png',
        botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz_123',
      };
      const result = telegramChannelSchema.safeParse(validData);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.botToken, validData.botToken);
        assert.strictEqual(result.data.name, validData.name);
      }
    });

    it('should automatically trim leading and trailing whitespace from bot token', () => {
      const dataWithSpaces = {
        botToken: '  123456789:ABCdefGHIjklMNOpqrsTUVwxyz_123  ',
      };
      const result = telegramChannelSchema.safeParse(dataWithSpaces);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.botToken, '123456789:ABCdefGHIjklMNOpqrsTUVwxyz_123');
      }
    });

    it('should reject whitespace-only bot token', () => {
      const result = telegramChannelSchema.safeParse({ botToken: '   ' });
      assert.strictEqual(result.success, false);
    });

    it('should reject empty bot token', () => {
      const result = telegramChannelSchema.safeParse({ botToken: '' });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.errors.some(e => e.path.includes('botToken')));
      }
    });

    it('should reject malformed bot token (missing colon prefix)', () => {
      const result = telegramChannelSchema.safeParse({
        botToken: 'invalid_token_without_id_prefix',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.errors.some(e => e.message.includes('Telegram Bot Token')));
      }
    });
    it('should reject name exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = telegramChannelSchema.safeParse({
        name: longName,
        botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz_123',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.errors.some(e => e.path.includes('name')));
      }
    });
  });

  describe('Web Chat Schema', () => {
    it('should allow valid full URL', () => {
      const result = webChatChannelSchema.safeParse({
        name: 'Store Widget',
        websiteUrl: 'https://myshop.vn',
      });
      assert.strictEqual(result.success, true);
    });

    it('should allow valid domain name', () => {
      const result = webChatChannelSchema.safeParse({
        websiteUrl: 'myshop.vn',
      });
      assert.strictEqual(result.success, true);
    });

    it('should allow localhost and localhost with port', () => {
      assert.strictEqual(webChatChannelSchema.safeParse({ websiteUrl: 'localhost' }).success, true);
      assert.strictEqual(
        webChatChannelSchema.safeParse({ websiteUrl: 'localhost:3000' }).success,
        true,
      );
      assert.strictEqual(
        webChatChannelSchema.safeParse({ websiteUrl: 'http://localhost:3000' }).success,
        true,
      );
    });

    it('should automatically trim whitespace from website URL', () => {
      const result = webChatChannelSchema.safeParse({
        websiteUrl: '  https://myshop.vn  ',
      });
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.websiteUrl, 'https://myshop.vn');
      }
    });

    it('should allow empty website URL (optional)', () => {
      assert.strictEqual(webChatChannelSchema.safeParse({ websiteUrl: '' }).success, true);
      assert.strictEqual(webChatChannelSchema.safeParse({}).success, true);
    });

    it('should reject invalid website format', () => {
      const result = webChatChannelSchema.safeParse({ websiteUrl: 'invalid url with spaces' });
      assert.strictEqual(result.success, false);
    });

    it('should reject name exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = webChatChannelSchema.safeParse({
        name: longName,
        websiteUrl: 'https://myshop.vn',
      });
      assert.strictEqual(result.success, false);
      if (!result.success) {
        assert.ok(result.error.errors.some(e => e.path.includes('name')));
      }
    });
  });

  describe('Channel Registry', () => {
    it('should correctly identify supported channel keys', async () => {
      const { isSupportedChannelKey, getChannelDefinition, SUPPORTED_CHANNELS } =
        await import('../new/channel-registry');
      assert.strictEqual(isSupportedChannelKey('web_chat'), true);
      assert.strictEqual(isSupportedChannelKey('facebook'), true);
      assert.strictEqual(isSupportedChannelKey('telegram'), true);
      assert.strictEqual(isSupportedChannelKey('zalo'), true);
      assert.strictEqual(isSupportedChannelKey('zalo_personal'), true);
      assert.strictEqual(isSupportedChannelKey('email'), false);
      assert.strictEqual(isSupportedChannelKey(''), false);
      assert.strictEqual(isSupportedChannelKey(null), false);
      assert.strictEqual(isSupportedChannelKey(undefined), false);

      assert.strictEqual(SUPPORTED_CHANNELS.length, 5);
      const def = getChannelDefinition('web_chat');
      assert.ok(def);
      assert.strictEqual(def?.title, 'Website Live Chat');
    });
  });
});
