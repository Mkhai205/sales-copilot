import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createLabelSchema,
  updateLabelSchema,
  type LabelDto,
} from '@sales-copilot/shared-contracts';
import { LABEL_PRESET_COLORS, isValidHexColor } from '../constants/label-colors';

describe('Labels Management (Task 31)', () => {
  describe('createLabelSchema validation', () => {
    it('should validate valid label with defaults for color and showOnSidebar', () => {
      const payload = {
        title: 'High Priority',
      };
      const parsed = createLabelSchema.parse(payload);
      assert.strictEqual(parsed.title, 'High Priority');
      assert.strictEqual(parsed.color, '#2563eb');
      assert.strictEqual(parsed.showOnSidebar, true);
      assert.strictEqual(parsed.description, undefined);
    });

    it('should validate valid label with explicit color, description and sidebar toggle', () => {
      const payload = {
        title: 'Billing Issue',
        description: 'Payment gateway errors and invoice questions',
        color: '#ef4444',
        showOnSidebar: false,
      };
      const parsed = createLabelSchema.parse(payload);
      assert.strictEqual(parsed.title, 'Billing Issue');
      assert.strictEqual(parsed.description, 'Payment gateway errors and invoice questions');
      assert.strictEqual(parsed.color, '#ef4444');
      assert.strictEqual(parsed.showOnSidebar, false);
    });

    it('should trim label title whitespace', () => {
      const payload = {
        title: '   VIP Customer   ',
      };
      const parsed = createLabelSchema.parse(payload);
      assert.strictEqual(parsed.title, 'VIP Customer');
    });

    it('should reject empty label title', () => {
      const invalidPayload = {
        title: '   ',
      };
      assert.throws(() => createLabelSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject title exceeding 50 characters', () => {
      const invalidPayload = {
        title: 'L'.repeat(51),
      };
      assert.throws(() => createLabelSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject description exceeding 200 characters', () => {
      const invalidPayload = {
        title: 'Valid Title',
        description: 'D'.repeat(201),
      };
      assert.throws(() => createLabelSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject invalid hex color formats', () => {
      const invalidColors = ['red', '#123', '#GGGGGG', '#1234567', 'rgb(0,0,0)'];
      for (const color of invalidColors) {
        assert.throws(() => createLabelSchema.parse({ title: 'Test', color }), {
          name: 'ZodError',
        });
      }
    });
  });

  describe('updateLabelSchema validation', () => {
    it('should allow updating color only', () => {
      const payload = {
        color: '#10b981',
      };
      const parsed = updateLabelSchema.parse(payload);
      assert.strictEqual(parsed.color, '#10b981');
      assert.strictEqual(parsed.title, undefined);
    });

    it('should allow updating showOnSidebar only', () => {
      const payload = {
        showOnSidebar: false,
      };
      const parsed = updateLabelSchema.parse(payload);
      assert.strictEqual(parsed.showOnSidebar, false);
    });
  });

  describe('Color Helpers & Presets', () => {
    it('should validate 6-digit hex format correctly with isValidHexColor', () => {
      assert.strictEqual(isValidHexColor('#2563eb'), true);
      assert.strictEqual(isValidHexColor('#FFFFFF'), true);
      assert.strictEqual(isValidHexColor('#000000'), true);
      assert.strictEqual(isValidHexColor('#ef4444'), true);

      assert.strictEqual(isValidHexColor(''), false);
      assert.strictEqual(isValidHexColor(null), false);
      assert.strictEqual(isValidHexColor(undefined), false);
      assert.strictEqual(isValidHexColor('#123'), false);
      assert.strictEqual(isValidHexColor('blue'), false);
      assert.strictEqual(isValidHexColor('#1234567'), false);
    });

    it('should define 12 preset colors with valid hex codes', () => {
      assert.strictEqual(LABEL_PRESET_COLORS.length, 12);
      for (const preset of LABEL_PRESET_COLORS) {
        assert.ok(preset.name.length > 0);
        assert.strictEqual(isValidHexColor(preset.hex), true);
      }
    });
  });

  describe('Labels Search & Filter Logic', () => {
    const mockLabels: LabelDto[] = [
      {
        id: 'lbl_1',
        workspaceId: 'ws_1',
        title: 'VIP Customer',
        description: 'High ARR accounts requiring fast response',
        color: '#8b5cf6',
        showOnSidebar: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'lbl_2',
        workspaceId: 'ws_1',
        title: 'Bug Report',
        description: 'Software defects reported by users',
        color: '#ef4444',
        showOnSidebar: true,
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        id: 'lbl_3',
        workspaceId: 'ws_1',
        title: 'Billing Inquiry',
        description: 'Invoice and subscription upgrade inquiries',
        color: '#10b981',
        showOnSidebar: false,
        createdAt: '2026-01-03T00:00:00Z',
      },
    ];

    const filterLabels = (list: LabelDto[], query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return list;
      return list.filter(l => {
        const title = l.title.toLowerCase();
        const desc = l.description?.toLowerCase() || '';
        return title.includes(q) || desc.includes(q);
      });
    };

    it('should return all labels when search is empty', () => {
      const result = filterLabels(mockLabels, '');
      assert.strictEqual(result.length, 3);
    });

    it('should filter labels by title (case-insensitive)', () => {
      const result = filterLabels(mockLabels, 'vip');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'VIP Customer');
    });

    it('should filter labels by description keyword', () => {
      const result = filterLabels(mockLabels, 'subscription');
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].title, 'Billing Inquiry');
    });

    it('should return empty list when no labels match', () => {
      const result = filterLabels(mockLabels, 'nonexistent');
      assert.strictEqual(result.length, 0);
    });
  });
});
