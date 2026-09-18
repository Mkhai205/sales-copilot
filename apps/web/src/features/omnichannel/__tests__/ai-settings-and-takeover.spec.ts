import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  inboxAiCommercePolicyConfigSchema,
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  type ConversationResponseDto,
  type MessageResponseDto,
  SenderType,
  MessageType,
  DeliveryStatus,
} from '@sales-copilot/shared-contracts';
import { updateConversationInList } from '../../../lib/socket/cache-helpers';
import type { ApiResponse } from '../../../lib/api/client';
import type { InfiniteData } from '@tanstack/react-query';

describe('Epic 3.4 — AI Settings UI & Conversational Controls', () => {
  describe('inboxAiCommercePolicyConfigSchema', () => {
    it('should validate valid AI commerce policy with all fields', () => {
      const payload = {
        enabled: true,
        personaTone: 'em_anh_chi',
        customInstructions: 'Tư vấn nhiệt tình, ưu tiên gợi ý sản phẩm bán chạy',
        maxDiscountPercent: 15,
        maxDiscountVnd: 50000,
      };
      const parsed = inboxAiCommercePolicyConfigSchema.parse(payload);
      assert.strictEqual(parsed.enabled, true);
      assert.strictEqual(parsed.personaTone, 'em_anh_chi');
      assert.strictEqual(
        parsed.customInstructions,
        'Tư vấn nhiệt tình, ưu tiên gợi ý sản phẩm bán chạy',
      );
      assert.strictEqual(parsed.maxDiscountPercent, 15);
      assert.strictEqual(parsed.maxDiscountVnd, 50000);
    });

    it('should have default enabled = false when omitted', () => {
      const parsed = inboxAiCommercePolicyConfigSchema.parse({});
      assert.strictEqual(parsed.enabled, false);
      assert.strictEqual(parsed.personaTone, undefined);
      assert.strictEqual(parsed.customInstructions, undefined);
      assert.strictEqual(parsed.maxDiscountPercent, undefined);
      assert.strictEqual(parsed.maxDiscountVnd, undefined);
    });

    it('should reject maxDiscountPercent greater than 100', () => {
      assert.throws(
        () => inboxAiCommercePolicyConfigSchema.parse({ maxDiscountPercent: 101 }),
        /Number must be less than or equal to 100/,
      );
    });

    it('should reject maxDiscountPercent less than 0', () => {
      assert.throws(
        () => inboxAiCommercePolicyConfigSchema.parse({ maxDiscountPercent: -1 }),
        /Number must be greater than or equal to 0/,
      );
    });

    it('should reject maxDiscountVnd less than 0', () => {
      assert.throws(
        () => inboxAiCommercePolicyConfigSchema.parse({ maxDiscountVnd: -5000 }),
        /Number must be greater than or equal to 0/,
      );
    });

    it('should reject customInstructions exceeding 2000 characters', () => {
      const longText = 'A'.repeat(2001);
      assert.throws(
        () => inboxAiCommercePolicyConfigSchema.parse({ customInstructions: longText }),
        /String must contain at most 2000 character/,
      );
    });

    it('should allow customInstructions exactly 2000 characters', () => {
      const text2000 = 'B'.repeat(2000);
      const parsed = inboxAiCommercePolicyConfigSchema.parse({ customInstructions: text2000 });
      assert.strictEqual(parsed.customInstructions?.length, 2000);
    });

    it('should strip obsolete defaultWarehouseId and defaultBankAccountId fields cleanly', () => {
      const legacyPayload = {
        enabled: true,
        defaultWarehouseId: 'wh_123',
        defaultBankAccountId: 'bank_456',
      };
      const parsed: any = inboxAiCommercePolicyConfigSchema.parse(legacyPayload);
      assert.strictEqual(parsed.enabled, true);
      assert.strictEqual(parsed.defaultWarehouseId, undefined);
      assert.strictEqual(parsed.defaultBankAccountId, undefined);
    });
  });

  describe('Bank Configuration Validation for AI Autopilot Toggle', () => {
    const isBankConfigured = (activeBank: any) =>
      Boolean(
        (activeBank?.bankBin || activeBank?.bankName || activeBank?.bankId) &&
        (activeBank?.accountNumber || activeBank?.accountNo),
      );

    it('should allow enabling when bankBin and accountNumber are present', () => {
      const bank = { bankBin: '970422', accountNumber: '0123456789' };
      assert.strictEqual(isBankConfigured(bank), true);
    });

    it('should allow enabling when bankName and accountNo are present (alternative naming)', () => {
      const bank = { bankName: 'MBBank', accountNo: '9876543210' };
      assert.strictEqual(isBankConfigured(bank), true);
    });

    it('should block enabling when accountNumber is missing', () => {
      const bank = { bankBin: '970422' };
      assert.strictEqual(isBankConfigured(bank), false);
    });

    it('should block enabling when bank name/bin/id is missing', () => {
      const bank = { accountNumber: '0123456789' };
      assert.strictEqual(isBankConfigured(bank), false);
    });

    it('should block enabling when activeBank is null or undefined', () => {
      assert.strictEqual(isBankConfigured(null), false);
      assert.strictEqual(isBankConfigured(undefined), false);
      assert.strictEqual(isBankConfigured({}), false);
    });
  });

  describe('Takeover Flow & Cache Updates', () => {
    it('should optimistically update conversation in list cache to isAiPaused = true', () => {
      const initialList: InfiniteData<ApiResponse<ConversationResponseDto[]>> = {
        pageParams: [1],
        pages: [
          {
            success: true,
            data: [
              {
                id: 'conv_1',
                displayId: 101,
                workspaceId: 'ws_1',
                inboxId: 'inbox_1',
                contactId: 'contact_1',
                status: 'OPEN' as any,
                priority: 'LOW' as any,
                unreadMessagesCount: 0,
                lastActivityAt: '2026-09-18T10:00:00Z',
                createdAt: '2026-09-18T09:00:00Z',
                updatedAt: '2026-09-18T10:00:00Z',
                isAiPaused: false,
              },
            ],
            meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
          },
        ],
      };

      const updated = updateConversationInList(initialList, 'conv_1', prev => ({
        ...prev,
        isAiPaused: true,
      }));

      assert.strictEqual(updated?.pages[0]?.data[0]?.isAiPaused, true);
    });
  });

  describe('Message AI Identifier & Metadata Robustness', () => {
    const isAiGeneratedMessage = (message: MessageResponseDto): boolean => {
      if (!message.metadata) return false;
      if (typeof message.metadata === 'object') {
        return (message.metadata as any).isAiGenerated === true;
      }
      if (typeof message.metadata === 'string') {
        try {
          return JSON.parse(message.metadata)?.isAiGenerated === true;
        } catch {
          return false;
        }
      }
      return false;
    };

    it('should identify AI message with object metadata { isAiGenerated: true }', () => {
      const msg: MessageResponseDto = {
        id: 'msg_1',
        conversationId: 'conv_1',
        workspaceId: 'ws_1',
        senderType: SenderType.SYSTEM,
        messageType: MessageType.OUTGOING,
        contentType: 'TEXT' as any,
        isPrivate: false,
        deliveryStatus: DeliveryStatus.SENT,
        createdAt: '2026-09-18T10:00:00Z',
        metadata: { isAiGenerated: true, aiSteps: 2 },
      };
      assert.strictEqual(isAiGeneratedMessage(msg), true);
    });

    it('should safely identify AI message when metadata is serialized JSON string', () => {
      const msg: any = {
        id: 'msg_2',
        conversationId: 'conv_1',
        workspaceId: 'ws_1',
        senderType: SenderType.SYSTEM,
        messageType: MessageType.OUTGOING,
        contentType: 'TEXT',
        isPrivate: false,
        deliveryStatus: DeliveryStatus.SENT,
        createdAt: '2026-09-18T10:00:00Z',
        metadata: JSON.stringify({ isAiGenerated: true }),
      };
      assert.strictEqual(isAiGeneratedMessage(msg), true);
    });

    it('should return false for human agent messages without isAiGenerated metadata', () => {
      const msg: MessageResponseDto = {
        id: 'msg_3',
        conversationId: 'conv_1',
        workspaceId: 'ws_1',
        senderType: SenderType.USER,
        messageType: MessageType.OUTGOING,
        contentType: 'TEXT' as any,
        isPrivate: false,
        deliveryStatus: DeliveryStatus.SENT,
        createdAt: '2026-09-18T10:00:00Z',
        metadata: {},
      };
      assert.strictEqual(isAiGeneratedMessage(msg), false);
    });

    it('should return false when metadata is null or undefined or malformed', () => {
      const msgNoMeta: any = { id: 'msg_4', metadata: null };
      const msgMalformed: any = { id: 'msg_5', metadata: '{ not valid json }' };
      assert.strictEqual(isAiGeneratedMessage(msgNoMeta), false);
      assert.strictEqual(isAiGeneratedMessage(msgMalformed), false);
    });
  });

  describe('Comment Guard Templates', () => {
    it('should have non-empty default private and public reply templates', () => {
      assert.ok(DEFAULT_COMMENT_GUARD_PRIVATE_REPLY.length > 0);
      assert.ok(DEFAULT_COMMENT_GUARD_PUBLIC_REPLY.length > 0);
      assert.ok(DEFAULT_COMMENT_GUARD_PRIVATE_REPLY.includes('tin nhắn'));
    });
  });
});
