import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ChannelType,
  createInboxSchema,
  updateInboxSchema,
  addInboxMemberSchema,
  dayScheduleSchema,
  inboxWorkingHoursConfigSchema,
  inboxAutoAssignmentConfigSchema,
  inboxWebWidgetConfigSchema,
  inboxAiCommercePolicyConfigSchema,
  inboxSettingsSchema,
  type InboxDto,
  type InboxDetailDto,
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

    it('should allow updating settings with workingHours, autoAssignment, webWidget, and aiCommercePolicy', () => {
      const payload = {
        settings: {
          greetingMessage: 'Xin chào!',
          allowMessagesAfterResolved: true,
          workingHours: {
            enabled: true,
            timezone: 'Asia/Ho_Chi_Minh',
            schedule: [{ dayOfWeek: 1, open: true, openTime: '08:30', closeTime: '18:00' }],
            awayMessage: 'Hiện tại chúng tôi đang ngoài giờ làm việc.',
          },
          autoAssignment: {
            enabled: true,
            strategy: 'ROUND_ROBIN',
            maxConcurrentChats: 5,
          },
          webWidget: {
            widgetColor: '#0ea5e9',
            allowedDomains: ['https://shop.com'],
            hmacMandatory: true,
            preChatForm: {
              enabled: true,
              requireName: true,
              requireEmail: true,
            },
          },
          aiCommercePolicy: {
            mode: 'COPILOT_ASSIST',
            maxDiscountPercent: 15,
            maxDiscountVnd: 150000,
            personaTone: 'shop_ban',
            defaultWarehouseId: 'wh_hcm',
            defaultBankAccountId: 'bank_vietqr',
          },
        },
      };
      const parsed = updateInboxSchema.parse(payload);
      assert.deepStrictEqual(parsed.settings, payload.settings);
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

  describe('InboxSettings Zod Schemas validation', () => {
    it('should validate dayScheduleSchema for days 0-6', () => {
      const validSunday = dayScheduleSchema.parse({ dayOfWeek: 0, open: false });
      assert.strictEqual(validSunday.dayOfWeek, 0);
      assert.strictEqual(validSunday.open, false);

      const validMonday = dayScheduleSchema.parse({
        dayOfWeek: 1,
        open: true,
        openTime: '08:30',
        closeTime: '17:30',
      });
      assert.strictEqual(validMonday.dayOfWeek, 1);
      assert.strictEqual(validMonday.openTime, '08:30');

      assert.throws(() => dayScheduleSchema.parse({ dayOfWeek: 7, open: true }));
      assert.throws(() => dayScheduleSchema.parse({ dayOfWeek: -1, open: true }));
    });

    it('should validate inboxWorkingHoursConfigSchema', () => {
      const valid = inboxWorkingHoursConfigSchema.parse({
        enabled: true,
        timezone: 'Asia/Ho_Chi_Minh',
        schedule: [{ dayOfWeek: 1, open: true, openTime: '08:30', closeTime: '17:30' }],
        awayMessage: 'Ngoai gio lam viec',
      });
      assert.strictEqual(valid.timezone, 'Asia/Ho_Chi_Minh');
      assert.strictEqual(valid.schedule.length, 1);
    });

    it('should validate inboxWebWidgetConfigSchema', () => {
      const valid = inboxWebWidgetConfigSchema.parse({
        widgetColor: '#2563eb',
        allowedDomains: ['https://shop.vn'],
        hmacMandatory: true,
        hmacSecret: 'sec_test_123',
        preChatForm: {
          enabled: true,
          requireName: true,
          requireEmail: true,
          requirePhone: false,
        },
      });
      assert.strictEqual(valid.widgetColor, '#2563eb');
      assert.strictEqual(valid.hmacMandatory, true);
      assert.strictEqual(valid.preChatForm?.requirePhone, false);
    });

    it('should validate inboxAutoAssignmentConfigSchema', () => {
      const valid = inboxAutoAssignmentConfigSchema.parse({
        enabled: true,
        strategy: 'ROUND_ROBIN',
        maxConcurrentChats: 10,
      });
      assert.strictEqual(valid.strategy, 'ROUND_ROBIN');
      assert.strictEqual(valid.maxConcurrentChats, 10);

      assert.throws(() =>
        inboxAutoAssignmentConfigSchema.parse({
          enabled: true,
          strategy: 'INVALID_STRATEGY',
        }),
      );
    });

    it('should validate inboxAiCommercePolicyConfigSchema', () => {
      const valid = inboxAiCommercePolicyConfigSchema.parse({
        mode: 'COPILOT_ASSIST',
        maxDiscountPercent: 20,
        maxDiscountVnd: 200000,
        personaTone: 'shop_ban',
      });
      assert.strictEqual(valid.mode, 'COPILOT_ASSIST');
      assert.strictEqual(valid.maxDiscountPercent, 20);

      // Rejects discount percentage > 100
      assert.throws(() =>
        inboxAiCommercePolicyConfigSchema.parse({
          mode: 'COPILOT_ASSIST',
          maxDiscountPercent: 120,
        }),
      );

      // Rejects invalid mode
      assert.throws(() =>
        inboxAiCommercePolicyConfigSchema.parse({
          mode: 'UNSUPPORTED_MODE',
        }),
      );
    });

    it('should validate and parse full inboxSettingsSchema with pass-through fields', () => {
      const payload = {
        greetingMessage: 'Xin chào bạn!',
        allowMessagesAfterResolved: true,
        workingHours: {
          enabled: true,
          timezone: 'Asia/Ho_Chi_Minh',
          schedule: [{ dayOfWeek: 1, open: true, openTime: '08:00', closeTime: '17:00' }],
        },
        autoAssignment: {
          enabled: true,
          strategy: 'ROUND_ROBIN' as const,
          maxConcurrentChats: 5,
        },
        webWidget: {
          widgetColor: '#2563eb',
          allowedDomains: ['https://shop.vn'],
          hmacMandatory: true,
          hmacSecret: 'sec_12345678',
        },
        aiCommercePolicy: {
          mode: 'AUTOPILOT_24_7' as const,
          maxDiscountPercent: 10,
          maxDiscountVnd: 50000,
        },
        customFieldExtra: 'extra_value',
      };

      const parsed = inboxSettingsSchema.parse(payload);
      assert.strictEqual(parsed.greetingMessage, 'Xin chào bạn!');
      assert.strictEqual((parsed as any).customFieldExtra, 'extra_value');
    });
  });

  describe('Business Hours & Discount Validation Logic', () => {
    it('should reject schedule if openTime is after or equal to closeTime', () => {
      const validateSchedule = (
        schedule: { open: boolean; openTime?: string; closeTime?: string }[],
      ) => {
        for (const day of schedule) {
          if (day.open) {
            if (!day.openTime || !day.closeTime) return false;
            if (day.openTime >= day.closeTime) return false;
          }
        }
        return true;
      };

      assert.strictEqual(
        validateSchedule([{ open: true, openTime: '08:00', closeTime: '17:00' }]),
        true,
      );
      assert.strictEqual(
        validateSchedule([{ open: true, openTime: '18:00', closeTime: '08:00' }]),
        false,
      );
      assert.strictEqual(
        validateSchedule([{ open: true, openTime: '12:00', closeTime: '12:00' }]),
        false,
      );
      assert.strictEqual(
        validateSchedule([{ open: false, openTime: '18:00', closeTime: '08:00' }]),
        true,
      );
    });

    it('should validate avatarUrl with standard URL constructor and http/https protocol', () => {
      const isValidUrl = (url: string) => {
        if (!url.trim()) return true;
        try {
          const parsed = new URL(url.trim());
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      };

      assert.strictEqual(isValidUrl(''), true);
      assert.strictEqual(isValidUrl('https://example.com/avatar.png'), true);
      assert.strictEqual(isValidUrl('http://example.com/avatar.png'), true);
      assert.strictEqual(isValidUrl('invalid-url-string'), false);
      assert.strictEqual(isValidUrl('javascript:alert(1)'), false);
      assert.strictEqual(isValidUrl('ftp://example.com/file'), false);
    });

    it('should correctly normalize schedule when day is toggled open with missing times', () => {
      const DAYS_OF_WEEK = [
        { dayOfWeek: 1, label: 'Thứ hai' },
        { dayOfWeek: 2, label: 'Thứ ba' },
        { dayOfWeek: 3, label: 'Thứ tư' },
        { dayOfWeek: 4, label: 'Thứ năm' },
        { dayOfWeek: 5, label: 'Thứ sáu' },
        { dayOfWeek: 6, label: 'Thứ bảy' },
        { dayOfWeek: 0, label: 'Chủ nhật' },
      ];

      const normalizeSchedule = (
        existingList?: {
          dayOfWeek: number;
          open: boolean;
          openTime?: string;
          closeTime?: string;
        }[],
      ) => {
        return DAYS_OF_WEEK.map(d => {
          const found = existingList?.find(s => s.dayOfWeek === d.dayOfWeek);
          if (found) {
            return {
              dayOfWeek: d.dayOfWeek,
              open: Boolean(found.open),
              openTime: found.openTime || (found.open ? '08:30' : undefined),
              closeTime: found.closeTime || (found.open ? '18:00' : undefined),
            };
          }
          return {
            dayOfWeek: d.dayOfWeek,
            open: false,
            openTime: '08:30',
            closeTime: '18:00',
          };
        });
      };

      // Day 0 was closed without openTime/closeTime, then toggled open
      const rawSchedule = [{ dayOfWeek: 0, open: true }];
      const normalized = normalizeSchedule(rawSchedule);
      const sunday = normalized.find(s => s.dayOfWeek === 0);
      assert.strictEqual(sunday?.open, true);
      assert.strictEqual(sunday?.openTime, '08:30');
      assert.strictEqual(sunday?.closeTime, '18:00');
    });

    it('should sanitize tab parameter and fallback to general for invalid tab names', () => {
      const VALID_INBOX_TABS = [
        'general',
        'collaborators',
        'configuration',
        'business-hours',
        'ai-commerce',
      ] as const;
      const sanitizeTab = (tab?: string) => {
        if (tab && VALID_INBOX_TABS.includes(tab as any)) {
          return tab;
        }
        return 'general';
      };

      assert.strictEqual(sanitizeTab('configuration'), 'configuration');
      assert.strictEqual(sanitizeTab('ai-commerce'), 'ai-commerce');
      assert.strictEqual(sanitizeTab('unknown_tab'), 'general');
      assert.strictEqual(sanitizeTab(undefined), 'general');
      assert.strictEqual(sanitizeTab(''), 'general');
    });
  });

  describe('React Query Cache Safety (Fix old.map is not a function crash)', () => {
    it('should safely update inboxes list without crashing on InboxDetailDto object', () => {
      const listCache: InboxDto[] = [
        {
          id: 'inbox_1',
          workspaceId: 'ws_1',
          name: 'Old Name',
          channelType: ChannelType.WEB_CHAT,
          settings: {},
          isAutoAssignmentEnabled: false,
          memberCount: 2,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const detailCache: InboxDetailDto = {
        id: 'inbox_1',
        workspaceId: 'ws_1',
        name: 'Old Name',
        channelType: ChannelType.WEB_CHAT,
        settings: {},
        isAutoAssignmentEnabled: false,
        memberCount: 2,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const updatedInbox = {
        ...detailCache,
        name: 'New Name',
      };

      // Safe list updater: only executes on Array
      const updateListCache = (old: InboxDto[] | undefined) => {
        if (!old || !Array.isArray(old)) return old;
        return old.map(i => (i.id === updatedInbox.id ? (updatedInbox as unknown as InboxDto) : i));
      };

      const safeDetailUpdater = (old: InboxDetailDto | undefined) => {
        return old ? { ...old, ...updatedInbox } : updatedInbox;
      };

      const updatedList = updateListCache(listCache);
      assert.strictEqual(updatedList?.[0].name, 'New Name');

      // Calling updateListCache with single detail object must not crash with TypeError
      assert.doesNotThrow(() => {
        const result = updateListCache(detailCache as any);
        assert.deepStrictEqual(result, detailCache);
      });

      const updatedDetail = safeDetailUpdater(detailCache);
      assert.strictEqual(updatedDetail.name, 'New Name');
    });

    it('should safely handle members cache updaters when cache is non-array or undefined', () => {
      const newMember = {
        id: 'mem_1',
        inboxId: 'inbox_1',
        userId: 'user_1',
        user: { id: 'user_1', email: 'a@b.com', name: 'User A' },
        createdAt: '2026-01-01T00:00:00Z',
      };

      const safeAddMember = (old: any) => {
        if (!old || !Array.isArray(old)) return [newMember];
        if (old.some((m: any) => m.userId === newMember.userId)) return old;
        return [...old, newMember];
      };

      const safeRemoveMember = (old: any, userId: string) => {
        if (!old || !Array.isArray(old)) return old;
        return old.filter((m: any) => m.userId !== userId);
      };

      // Should not throw on non-array object
      assert.doesNotThrow(() => {
        const res = safeAddMember({ corrupt: true });
        assert.deepStrictEqual(res, [newMember]);
      });

      assert.doesNotThrow(() => {
        const res = safeRemoveMember({ corrupt: true }, 'user_1');
        assert.deepStrictEqual(res, { corrupt: true });
      });
    });
  });
});
