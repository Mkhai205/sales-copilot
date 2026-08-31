import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChannelType,
  createInboxSchema,
  updateInboxSchema,
  addInboxMemberSchema,
  type InboxDto,
} from '@sales-copilot/shared-contracts';
import { SUPPORTED_CHANNELS } from '../constants/inbox-channels';

describe('Inboxes & Channels Management (Task 33)', () => {
  describe('createInboxSchema validation across channel types', () => {
    it('should validate valid Web Chat inbox creation', () => {
      const payload = {
        name: 'Website Live Support',
        channelType: ChannelType.WEB_CHAT,
        greetingMessage: 'Hello! Welcome to our website.',
        isAutoAssignmentEnabled: true,
        settings: {
          widgetColor: '#2563eb',
          websiteUrl: 'https://example.com',
        },
      };
      const parsed = createInboxSchema.parse(payload);
      assert.strictEqual(parsed.name, 'Website Live Support');
      assert.strictEqual(parsed.channelType, ChannelType.WEB_CHAT);
      assert.strictEqual(parsed.isAutoAssignmentEnabled, true);
    });

    it('should validate valid Telegram inbox creation', () => {
      const payload = {
        name: 'Telegram Bot',
        channelType: ChannelType.TELEGRAM,
        channelCredentials: {
          botToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
        },
      };
      const parsed = createInboxSchema.parse(payload);
      assert.strictEqual(parsed.channelType, ChannelType.TELEGRAM);
      assert.strictEqual(
        (parsed.channelCredentials as any).botToken,
        '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      );
    });

    it('should validate valid Facebook Messenger inbox creation', () => {
      const payload = {
        name: 'Facebook Support',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        channelCredentials: {
          pageId: '1029384756',
          pageAccessToken: 'EAA...',
          appSecret: 'secret123',
        },
      };
      const parsed = createInboxSchema.parse(payload);
      assert.strictEqual(parsed.channelType, ChannelType.FACEBOOK_MESSENGER);
    });

    it('should validate valid Email inbox creation', () => {
      const payload = {
        name: 'Support Mailbox',
        channelType: ChannelType.EMAIL,
        channelCredentials: {
          emailAddress: 'support@company.com',
          smtpHost: 'smtp.mailgun.org',
          smtpPort: 587,
        },
      };
      const parsed = createInboxSchema.parse(payload);
      assert.strictEqual(parsed.channelType, ChannelType.EMAIL);
    });

    it('should validate valid Zalo OA inbox creation', () => {
      const payload = {
        name: 'Zalo OA Customer Care',
        channelType: ChannelType.ZALO,
        channelCredentials: {
          oaId: '987654321',
          appId: '12345',
          secretKey: 'zaloSecret',
        },
      };
      const parsed = createInboxSchema.parse(payload);
      assert.strictEqual(parsed.channelType, ChannelType.ZALO);
    });

    it('should reject empty inbox name', () => {
      const invalidPayload = {
        name: '',
        channelType: ChannelType.WEB_CHAT,
      };
      assert.throws(() => createInboxSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject name exceeding 100 characters', () => {
      const invalidPayload = {
        name: 'N'.repeat(101),
        channelType: ChannelType.WEB_CHAT,
      };
      assert.throws(() => createInboxSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });
  });

  describe('updateInboxSchema validation', () => {
    it('should allow partial update of name and autoAssignment only', () => {
      const payload = {
        name: 'Updated Inbox Name',
        isAutoAssignmentEnabled: true,
      };
      const parsed = updateInboxSchema.parse(payload);
      assert.strictEqual(parsed.name, 'Updated Inbox Name');
      assert.strictEqual(parsed.isAutoAssignmentEnabled, true);
    });
  });

  describe('addInboxMemberSchema validation', () => {
    it('should validate valid userId', () => {
      const payload = {
        userId: 'usr_123456',
      };
      const parsed = addInboxMemberSchema.parse(payload);
      assert.strictEqual(parsed.userId, 'usr_123456');
    });

    it('should reject empty userId', () => {
      assert.throws(() => addInboxMemberSchema.parse({ userId: '' }), {
        name: 'ZodError',
      });
    });
  });

  describe('SUPPORTED_CHANNELS Constants', () => {
    it('should contain all 5 channels: WEB_CHAT, FACEBOOK, TELEGRAM, EMAIL, ZALO', () => {
      assert.strictEqual(SUPPORTED_CHANNELS.length, 5);
      const types = SUPPORTED_CHANNELS.map(c => c.type);
      assert.ok(types.includes(ChannelType.WEB_CHAT));
      assert.ok(types.includes(ChannelType.FACEBOOK_MESSENGER));
      assert.ok(types.includes(ChannelType.TELEGRAM));
      assert.ok(types.includes(ChannelType.EMAIL));
      assert.ok(types.includes(ChannelType.ZALO));
    });
  });

  describe('Inboxes Search & Filter Logic', () => {
    const mockInboxes: InboxDto[] = [
      {
        id: 'inbox_1',
        workspaceId: 'ws_1',
        name: 'Website Live Support',
        channelType: ChannelType.WEB_CHAT,
        greetingMessage: 'Welcome!',
        settings: {},
        isAutoAssignmentEnabled: true,
        memberCount: 3,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'inbox_2',
        workspaceId: 'ws_1',
        name: 'Facebook Fanpage',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        settings: {},
        isAutoAssignmentEnabled: false,
        memberCount: 2,
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'inbox_3',
        workspaceId: 'ws_1',
        name: 'Telegram Support Bot',
        channelType: ChannelType.TELEGRAM,
        settings: {},
        isAutoAssignmentEnabled: true,
        memberCount: 1,
        createdAt: '2026-01-03T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
      },
    ];

    const filterInboxes = (list: InboxDto[], search: string, channel: string) => {
      const q = search.trim().toLowerCase();
      return list.filter(i => {
        const name = i.name.toLowerCase();
        const matchesSearch = !q || name.includes(q);
        const matchesChannel = channel === 'ALL' || i.channelType === channel;
        return matchesSearch && matchesChannel;
      });
    };

    it('should return all inboxes when search is empty and channel is ALL', () => {
      const result = filterInboxes(mockInboxes, '', 'ALL');
      assert.strictEqual(result.length, 3);
    });

    it('should filter inboxes by name search', () => {
      const result = filterInboxes(mockInboxes, 'telegram', 'ALL');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].channelType, ChannelType.TELEGRAM);
    });

    it('should filter inboxes by channel type', () => {
      const result = filterInboxes(mockInboxes, '', ChannelType.WEB_CHAT);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Website Live Support');
    });

    it('should combine search query and channel filter', () => {
      const result = filterInboxes(mockInboxes, 'support', ChannelType.WEB_CHAT);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].name, 'Website Live Support');
    });
  });

  describe('Credential Masking Diffing Logic', () => {
    it('should only send non-empty credentials', () => {
      const formCredentials: Record<string, string> = {
        botToken: '   ',
        pageAccessToken: 'new_token_123',
        appSecret: '',
      };

      const cleanCredentials: Record<string, string> = {};
      for (const [k, v] of Object.entries(formCredentials)) {
        if (v && v.trim()) {
          cleanCredentials[k] = v.trim();
        }
      }

      assert.deepStrictEqual(cleanCredentials, {
        pageAccessToken: 'new_token_123',
      });
    });
  });
});
