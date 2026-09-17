import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  normalizeVietnameseText,
  normalizeVietnamesePhone,
  isValidVietnamesePhone,
  VIETNAMESE_PHONE_REGEX,
  VIETNAMESE_PHONE_EXTRACT_REGEX,
  VIETNAMESE_PHONE_EXACT_REGEX,
} from '../index';

describe('Shared Contracts — Common Utilities', () => {
  describe('normalizeVietnameseText', () => {
    it('should remove Vietnamese diacritics and convert to lowercase', () => {
      const input = 'Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam';
      const result = normalizeVietnameseText(input);
      assert.strictEqual(result, 'cong hoa xa hoi chu nghia viet nam');
    });

    it('should replace đ and Đ with d', () => {
      const input = 'Đường Đinh Tiên Hoàng, Phường Đa Kao';
      const result = normalizeVietnameseText(input);
      assert.strictEqual(result, 'duong dinh tien hoang phuong da kao');
    });

    it('should replace special characters and punctuation with spaces', () => {
      const input = 'Áo thun (Cotton 100%!) - Giá: 199.000đ';
      const result = normalizeVietnameseText(input);
      assert.strictEqual(result, 'ao thun cotton 100 gia 199 000d');
    });

    it('should collapse multiple consecutive spaces and trim whitespace', () => {
      const input = '   Hồ    Chí   Minh   ';
      const result = normalizeVietnameseText(input);
      assert.strictEqual(result, 'ho chi minh');
    });

    it('should handle empty or falsy strings gracefully', () => {
      assert.strictEqual(normalizeVietnameseText(''), '');
      assert.strictEqual(normalizeVietnameseText(null as unknown as string), '');
      assert.strictEqual(normalizeVietnameseText(undefined as unknown as string), '');
    });
  });

  describe('Vietnamese Phone Utilities', () => {
    describe('normalizeVietnamesePhone', () => {
      it('should convert +84 prefix to standard 0', () => {
        assert.strictEqual(normalizeVietnamesePhone('+84912345678'), '0912345678');
        assert.strictEqual(normalizeVietnamesePhone('+84389123456'), '0389123456');
      });

      it('should convert 84 prefix (without plus) to 0 when length >= 11', () => {
        assert.strictEqual(normalizeVietnamesePhone('84912345678'), '0912345678');
      });

      it('should strip spaces, hyphens, dots, and parentheses', () => {
        assert.strictEqual(normalizeVietnamesePhone('(091) 234-5678'), '0912345678');
        assert.strictEqual(normalizeVietnamesePhone('091.234.5678'), '0912345678');
        assert.strictEqual(normalizeVietnamesePhone('091 234 5678'), '0912345678');
        assert.strictEqual(normalizeVietnamesePhone('+84 (091) 234-5678'), '0912345678');
      });

      it('should return empty string for empty or falsy input', () => {
        assert.strictEqual(normalizeVietnamesePhone(''), '');
        assert.strictEqual(normalizeVietnamesePhone(null as unknown as string), '');
      });
    });

    describe('isValidVietnamesePhone', () => {
      it('should validate valid Vietnamese 10-digit mobile numbers across prefixes', () => {
        // Viettel: 032-039, 086, 096-098
        assert.strictEqual(isValidVietnamesePhone('0381234567'), true);
        assert.strictEqual(isValidVietnamesePhone('0981234567'), true);
        assert.strictEqual(isValidVietnamesePhone('+84981234567'), true);

        // Vinaphone: 081-085, 088, 091, 094
        assert.strictEqual(isValidVietnamesePhone('0912345678'), true);
        assert.strictEqual(isValidVietnamesePhone('0832345678'), true);

        // Mobifone: 070, 076-079, 089, 090, 093
        assert.strictEqual(isValidVietnamesePhone('0903123456'), true);
        assert.strictEqual(isValidVietnamesePhone('0793123456'), true);

        // Vietnamobile: 052, 056, 058, 092
        assert.strictEqual(isValidVietnamesePhone('0561234567'), true);
        assert.strictEqual(isValidVietnamesePhone('0921234567'), true);
      });

      it('should reject invalid phone numbers', () => {
        assert.strictEqual(isValidVietnamesePhone('0123456789'), false); // Old 11-digit prefix
        assert.strictEqual(isValidVietnamesePhone('091234567'), false); // 9 digits
        assert.strictEqual(isValidVietnamesePhone('09123456789'), false); // 11 digits
        assert.strictEqual(isValidVietnamesePhone('abc1234567'), false); // Letters
        assert.strictEqual(isValidVietnamesePhone(''), false); // Empty
      });
    });

    describe('Regex Patterns', () => {
      it('VIETNAMESE_PHONE_REGEX should test single phone string', () => {
        assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0912345678'), true);
        assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0123456789'), false);
      });

      it('VIETNAMESE_PHONE_EXTRACT_REGEX should extract all valid phone numbers in text', () => {
        const text = 'Khách gọi 0912345678 hoặc hotline +84987654321 để đặt hàng';
        const matches = text.match(VIETNAMESE_PHONE_EXTRACT_REGEX);
        assert.strictEqual(matches?.length, 2);
        assert.strictEqual(matches?.[0], '0912345678');
        assert.strictEqual(matches?.[1], '+84987654321');
      });

      it('VIETNAMESE_PHONE_EXACT_REGEX should match exact 10-digit format', () => {
        assert.strictEqual(VIETNAMESE_PHONE_EXACT_REGEX.test('0912345678'), true);
        assert.strictEqual(VIETNAMESE_PHONE_EXACT_REGEX.test('+84912345678'), true);
        assert.strictEqual(VIETNAMESE_PHONE_EXACT_REGEX.test('Text 0912345678'), false);
      });
    });
  });
});
