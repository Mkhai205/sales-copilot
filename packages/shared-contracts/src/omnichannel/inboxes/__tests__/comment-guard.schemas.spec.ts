import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  COMMENT_GUARD_QUEUE,
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  commentGuardConfigSchema,
  channelSettingsSchema,
} from '../schemas';
import {
  extractVietnamesePhoneNumbers,
  normalizeVietnamesePhoneNumber,
} from '../../../common/phone';

describe('Shared Contracts — Comment Guard Schemas & Regex', () => {
  describe('Constants and Schemas', () => {
    it('should maintain COMMENT_GUARD_QUEUE and default template invariants', () => {
      assert.strictEqual(COMMENT_GUARD_QUEUE, 'comment-guard');
      assert.ok(
        typeof DEFAULT_COMMENT_GUARD_PRIVATE_REPLY === 'string' &&
          DEFAULT_COMMENT_GUARD_PRIVATE_REPLY.length > 0,
      );
      assert.ok(
        typeof DEFAULT_COMMENT_GUARD_PUBLIC_REPLY === 'string' &&
          DEFAULT_COMMENT_GUARD_PUBLIC_REPLY.length > 0,
      );
    });

    it('should validate commentGuardConfigSchema defaults', () => {
      const parsed = commentGuardConfigSchema.parse({});
      assert.strictEqual(parsed.enabled, false);
      assert.strictEqual(parsed.publicReplyEnabled, true);
      assert.strictEqual(parsed.privateReplyTemplate, undefined);
      assert.strictEqual(parsed.publicReplyTemplate, undefined);
    });

    it('should validate customized commentGuardConfigSchema', () => {
      const config = {
        enabled: true,
        publicReplyEnabled: false,
        privateReplyTemplate: 'Shop đã nhắn tin riêng ạ',
        publicReplyTemplate: 'Check inbox nha bạn',
      };
      const parsed = commentGuardConfigSchema.parse(config);
      assert.strictEqual(parsed.enabled, true);
      assert.strictEqual(parsed.publicReplyEnabled, false);
      assert.strictEqual(parsed.privateReplyTemplate, 'Shop đã nhắn tin riêng ạ');
      assert.strictEqual(parsed.publicReplyTemplate, 'Check inbox nha bạn');
    });

    it('should support channelSettingsSchema with commentGuard', () => {
      const settings = channelSettingsSchema.parse({
        commentGuard: {
          enabled: true,
        },
        otherCustomKey: 'someValue',
      });
      assert.strictEqual(settings.commentGuard?.enabled, true);
      assert.strictEqual((settings as any).otherCustomKey, 'someValue');
    });
  });

  describe('Vietnamese Phone Number Extraction Regex (DoD Requirements)', () => {
    it('should correctly extract phone numbers with all standard Vietnamese formats', () => {
      const positiveSamples: Record<string, string> = {
        'Contiguous 10 digits': '0912345678',
        'Contiguous with +84': '+84912345678',
        'Contiguous with 84': '84912345678',
        '3-3-4 with spaces': '091 234 5678',
        '3-3-4 with hyphens': '091-234-5678',
        '3-3-4 with dots': '091.234.5678',
        '098 format with dots': '098.765.4321',
        '+84 with spaces': '+84 912 345 678',
        '(+84) with spaces': '(+84) 912 345 678',
        '(+84) contiguous': '(+84)912345678',
        '(091) format': '(091) 234 5678',
        'Dots with spaces': '091. 234 . 5678',
        'Hyphens with spaces': '091 - 234 - 5678',
        'Multiple spaces': '091  234  5678',
        'In sentence text': 'Lấy em 1 áo size L màu đen 0912345678 nhé',
        'End of sentence with period': 'SĐT của em là 0912345678.',
      };

      for (const [desc, sample] of Object.entries(positiveSamples)) {
        const extracted = extractVietnamesePhoneNumbers(sample);
        assert.ok(
          extracted.length > 0,
          `Expected to extract phone number from sample "${sample}" (${desc})`,
        );
      }
    });

    it('should NOT falsely match non-phone numeric phrases (False Positive Prevention)', () => {
      const negativeSamples = [
        'mua 0 sản phẩm',
        'giá 350000đ',
        'quận 09 ship bao nhiêu',
        'ngày 09/10 shop có mở không',
        'hẹn shop 09:00 sáng',
        'mã đơn hàng 09123456789012',
        'tài khoản 091234567890',
        'mã voucher 0912345678abc',
        'order 0912345678xyz',
      ];

      for (const sample of negativeSamples) {
        const extracted = extractVietnamesePhoneNumbers(sample);
        assert.strictEqual(
          extracted.length,
          0,
          `Expected NO phone match in false-positive candidate "${sample}", but got: ${JSON.stringify(extracted)}`,
        );
      }
    });

    it('should complete regex extraction in < 5ms', () => {
      const testText =
        'Dạ em muốn mua 2 combo áo thun và quần đùi, ship về địa chỉ Quận 1 số điện thoại 091 234 5678 nhé shop!';
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        extractVietnamesePhoneNumbers(testText);
      }
      const durationPerOp = (performance.now() - start) / 100;
      assert.ok(
        durationPerOp < 5,
        `Regex extraction took ${durationPerOp.toFixed(3)}ms per op, which exceeds 5ms limit`,
      );
    });
  });

  describe('normalizeVietnamesePhoneNumber()', () => {
    it('should normalize international and formatted numbers to standard 09xxxxxxxx', () => {
      assert.strictEqual(normalizeVietnamesePhoneNumber('+84 91 234 5678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber('(+84) 912 345 678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber('(091) 234 5678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber('091. 234 . 5678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber('091-234-5678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber('098.765.4321'), '0987654321');
      assert.strictEqual(normalizeVietnamesePhoneNumber('84912345678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber('0912345678'), '0912345678');
      assert.strictEqual(normalizeVietnamesePhoneNumber(''), '');
      assert.strictEqual(normalizeVietnamesePhoneNumber(null), '');
    });
  });
});
