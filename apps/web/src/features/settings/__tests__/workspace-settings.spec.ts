import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateWorkspaceSchema } from '@sales-copilot/shared-contracts';
import {
  TIMEZONE_OPTIONS,
  LANGUAGE_OPTIONS,
  getTimezoneLabel,
  getLanguageLabel,
} from '../constants/workspace-settings-options';

describe('General Workspace Settings (Task 28)', () => {
  describe('updateWorkspaceSchema validation', () => {
    it('should validate valid workspace updates', () => {
      const validPayload = {
        name: 'Acme International',
        timezone: 'Asia/Ho_Chi_Minh',
        defaultLanguage: 'vi',
      };

      const parsed = updateWorkspaceSchema.parse(validPayload);
      assert.strictEqual(parsed.name, 'Acme International');
      assert.strictEqual(parsed.timezone, 'Asia/Ho_Chi_Minh');
      assert.strictEqual(parsed.defaultLanguage, 'vi');
    });

    it('should trim whitespace from workspace name', () => {
      const payload = {
        name: '   Sales Copilot Team   ',
      };

      const parsed = updateWorkspaceSchema.parse(payload);
      assert.strictEqual(parsed.name, 'Sales Copilot Team');
    });

    it('should reject names shorter than 2 characters', () => {
      const invalidPayload = {
        name: 'A',
      };

      assert.throws(() => updateWorkspaceSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should reject names longer than 100 characters', () => {
      const invalidPayload = {
        name: 'A'.repeat(101),
      };

      assert.throws(() => updateWorkspaceSchema.parse(invalidPayload), {
        name: 'ZodError',
      });
    });

    it('should allow partial updates', () => {
      const onlyTimezone = {
        timezone: 'America/New_York',
      };
      const parsed = updateWorkspaceSchema.parse(onlyTimezone);
      assert.strictEqual(parsed.timezone, 'America/New_York');
      assert.strictEqual(parsed.name, undefined);
    });
  });

  describe('Timezone and Language Options Helper', () => {
    it('should contain predefined timezone groups and options', () => {
      assert.strictEqual(TIMEZONE_OPTIONS.length, 3);

      const groupNames = TIMEZONE_OPTIONS.map(g => g.group);
      assert.deepStrictEqual(groupNames, ['Asia & Pacific', 'Europe & Africa', 'Americas']);

      const allTzValues = TIMEZONE_OPTIONS.flatMap(g => g.options.map(o => o.value));
      assert.strictEqual(allTzValues.includes('Asia/Ho_Chi_Minh'), true);
      assert.strictEqual(allTzValues.includes('UTC'), true);
      assert.strictEqual(allTzValues.includes('America/New_York'), true);
    });

    it('should resolve human-readable timezone labels', () => {
      assert.strictEqual(getTimezoneLabel('Asia/Ho_Chi_Minh'), 'Asia/Ho_Chi_Minh (UTC+07:00)');
      assert.strictEqual(getTimezoneLabel('UTC'), 'UTC (UTC+00:00)');
      assert.strictEqual(
        getTimezoneLabel('America/New_York'),
        'America/New_York (UTC-05:00 / Eastern)',
      );
      // Fallback for custom/unlisted timezone
      assert.strictEqual(getTimezoneLabel('Custom/Timezone'), 'Custom/Timezone');
      assert.strictEqual(getTimezoneLabel(null), 'UTC (UTC+00:00)');
    });

    it('should resolve human-readable language labels', () => {
      assert.strictEqual(getLanguageLabel('en'), 'English (US)');
      assert.strictEqual(getLanguageLabel('vi'), 'Tiếng Việt (Vietnamese)');
      assert.strictEqual(getLanguageLabel('ja'), '日本語 (Japanese)');
      // Fallback
      assert.strictEqual(getLanguageLabel('custom-lang'), 'custom-lang');
      assert.strictEqual(getLanguageLabel(null), 'English (US)');
    });
  });

  describe('Form Dirty & Clean State Logic', () => {
    const initialWorkspace = {
      id: 'ws_123',
      name: 'Acme Corp',
      slug: 'acme-corp',
      billingPlan: 'PRO' as const,
      timezone: 'UTC',
      defaultLanguage: 'en',
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('should detect when form values are untouched (clean)', () => {
      const currentName = 'Acme Corp';
      const currentTimezone = 'UTC';
      const currentLanguage = 'en';

      const isDirty =
        currentName.trim() !== initialWorkspace.name ||
        currentTimezone !== initialWorkspace.timezone ||
        currentLanguage !== initialWorkspace.defaultLanguage;

      assert.strictEqual(isDirty, false);
    });

    it('should detect when name is changed (dirty)', () => {
      const currentName = 'Acme Corporation';
      const currentTimezone = 'UTC';
      const currentLanguage = 'en';

      const isDirty =
        currentName.trim() !== initialWorkspace.name ||
        currentTimezone !== initialWorkspace.timezone ||
        currentLanguage !== initialWorkspace.defaultLanguage;

      assert.strictEqual(isDirty, true);
    });

    it('should detect when timezone is changed (dirty)', () => {
      const currentName = 'Acme Corp';
      const currentTimezone = 'Asia/Ho_Chi_Minh';
      const currentLanguage = 'en';

      const isDirty =
        currentName.trim() !== initialWorkspace.name ||
        currentTimezone !== initialWorkspace.timezone ||
        currentLanguage !== initialWorkspace.defaultLanguage;

      assert.strictEqual(isDirty, true);
    });

    it('should detect when language is changed (dirty)', () => {
      const currentName = 'Acme Corp';
      const currentTimezone = 'UTC';
      const currentLanguage = 'vi';

      const isDirty =
        currentName.trim() !== initialWorkspace.name ||
        currentTimezone !== initialWorkspace.timezone ||
        currentLanguage !== initialWorkspace.defaultLanguage;

      assert.strictEqual(isDirty, true);
    });
  });
});
