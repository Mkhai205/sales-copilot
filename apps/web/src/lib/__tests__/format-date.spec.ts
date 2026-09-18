import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { formatRelativeTime, formatConversationTimestamp } from '../format-date';

describe('format-date utilities (Vietnamese locale)', () => {
  describe('formatRelativeTime', () => {
    it('formats relative time in Vietnamese for minutes ago', () => {
      const pastDate = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const relative = formatRelativeTime(pastDate);
      assert.ok(
        relative.includes('phút'),
        `Expected relative time to include 'phút', got: ${relative}`,
      );
    });

    it('formats relative time in Vietnamese for hours ago', () => {
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const relative = formatRelativeTime(pastDate);
      assert.ok(
        relative.includes('giờ'),
        `Expected relative time to include 'giờ', got: ${relative}`,
      );
    });

    it('returns empty string for empty or invalid inputs', () => {
      assert.strictEqual(formatRelativeTime(''), '');
      assert.strictEqual(formatRelativeTime(null as any), '');
      assert.strictEqual(formatRelativeTime(undefined as any), '');
      assert.strictEqual(formatRelativeTime('not-a-date'), '');
    });
  });

  describe('formatConversationTimestamp', () => {
    it('formats today timestamp as HH:mm', () => {
      const today = new Date();
      const formatted = formatConversationTimestamp(today);
      assert.match(formatted, /^\d{2}:\d{2}$/);
    });

    it('formats yesterday timestamp as "Hôm qua"', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // Ensure it is strictly yesterday by adjusting date
      yesterday.setDate(yesterday.getDate());
      const now = new Date();
      const targetYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        12,
        0,
        0,
      );
      const formatted = formatConversationTimestamp(targetYesterday);
      assert.strictEqual(formatted, 'Hôm qua');
    });

    it('formats older timestamp as dd/MM/yyyy', () => {
      const olderDate = new Date(2025, 0, 15, 10, 30, 0); // Jan 15, 2025
      const formatted = formatConversationTimestamp(olderDate);
      assert.strictEqual(formatted, '15/01/2025');
    });

    it('returns empty string for empty or invalid inputs', () => {
      assert.strictEqual(formatConversationTimestamp(''), '');
      assert.strictEqual(formatConversationTimestamp(null as any), '');
      assert.strictEqual(formatConversationTimestamp(undefined as any), '');
      assert.strictEqual(formatConversationTimestamp('invalid-date'), '');
    });
  });
});
