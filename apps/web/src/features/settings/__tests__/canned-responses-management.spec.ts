import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCannedResponseSchema,
  updateCannedResponseSchema,
  type CannedResponseDto,
} from '@sales-copilot/shared-contracts';

describe('Canned Responses Management (Task 32)', () => {
  describe('createCannedResponseSchema validation', () => {
    it('should validate valid canned response with shortcode and content', () => {
      const payload = {
        shortCode: 'greeting',
        content: 'Hello! How can I help you today?',
      };
      const parsed = createCannedResponseSchema.parse(payload);
      assert.strictEqual(parsed.shortCode, 'greeting');
      assert.strictEqual(parsed.content, 'Hello! How can I help you today?');
    });

    it('should reject empty shortcode', () => {
      const invalidPayload = {
        shortCode: '',
        content: 'Valid content',
      };
      assert.throws(() => createCannedResponseSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject shortcode exceeding 50 characters', () => {
      const invalidPayload = {
        shortCode: 's'.repeat(51),
        content: 'Valid content',
      };
      assert.throws(() => createCannedResponseSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject empty content', () => {
      const invalidPayload = {
        shortCode: 'pricing',
        content: '',
      };
      assert.throws(() => createCannedResponseSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });
  });

  describe('updateCannedResponseSchema validation', () => {
    it('should allow partial update of content only', () => {
      const payload = {
        content: 'Updated response template body.',
      };
      const parsed = updateCannedResponseSchema.parse(payload);
      assert.strictEqual(parsed.content, 'Updated response template body.');
      assert.strictEqual(parsed.shortCode, undefined);
    });

    it('should allow partial update of shortcode only', () => {
      const payload = {
        shortCode: 'new_code',
      };
      const parsed = updateCannedResponseSchema.parse(payload);
      assert.strictEqual(parsed.shortCode, 'new_code');
      assert.strictEqual(parsed.content, undefined);
    });
  });

  describe('Shortcode Normalization Logic', () => {
    const normalizeShortCode = (val: string) => {
      return val.trim().replace(/^\/+/, '');
    };

    it('should strip leading slashes typed by users', () => {
      assert.strictEqual(normalizeShortCode('/hello'), 'hello');
      assert.strictEqual(normalizeShortCode('//welcome'), 'welcome');
      assert.strictEqual(normalizeShortCode('pricing'), 'pricing');
    });

    it('should trim surrounding whitespace', () => {
      assert.strictEqual(normalizeShortCode('   /refund_policy   '), 'refund_policy');
    });
  });

  describe('Canned Responses Search & Filter Logic', () => {
    const mockResponses: CannedResponseDto[] = [
      {
        id: 'cr_1',
        workspaceId: 'ws_1',
        shortCode: 'greeting',
        content: 'Hello! Thank you for reaching out to Sales Copilot support.',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cr_2',
        workspaceId: 'ws_1',
        shortCode: 'pricing',
        content: 'Our Pro plan starts at $49/seat/month with unlimited channels.',
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'cr_3',
        workspaceId: 'ws_1',
        shortCode: 'refund',
        content: 'We offer a 30-day money-back guarantee on all annual plans.',
        createdAt: '2026-01-03T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
      },
    ];

    const filterResponses = (list: CannedResponseDto[], query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return list;
      return list.filter(r => {
        const code = r.shortCode.toLowerCase();
        const content = r.content.toLowerCase();
        return code.includes(q) || content.includes(q);
      });
    };

    it('should return all responses when query is empty', () => {
      const result = filterResponses(mockResponses, '');
      assert.strictEqual(result.length, 3);
    });

    it('should filter by shortcode (case-insensitive)', () => {
      const result = filterResponses(mockResponses, 'GREET');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].shortCode, 'greeting');
    });

    it('should filter by message content keyword', () => {
      const result = filterResponses(mockResponses, 'guarantee');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].shortCode, 'refund');
    });

    it('should return empty array when no matches found', () => {
      const result = filterResponses(mockResponses, 'nonexistent query');
      assert.strictEqual(result.length, 0);
    });
  });
});
