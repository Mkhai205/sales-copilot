import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SystemSettingCategory,
  SystemSettingItemDto,
  updateSystemSettingSchema,
  querySystemSettingsSchema,
} from '@sales-copilot/shared-contracts';
import {
  mapSettingsToMap,
  getSettingValue,
  parseSettingBoolean,
  parseSettingNumber,
  parseSettingString,
} from '../utils/settings-helpers';

describe('System Settings Helpers & Schema Validation (Feature 2)', () => {
  const mockSettings: SystemSettingItemDto[] = [
    {
      key: 'feature.pos_vietqr_enabled',
      value: true,
      category: SystemSettingCategory.FEATURE_FLAGS,
      description: 'VietQR pos',
      isEncrypted: false,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      key: 'llm.temperature_default',
      value: 0.35,
      category: SystemSettingCategory.AI,
      description: 'Temp',
      isEncrypted: false,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      key: 'system.banner_message',
      value: 'Maintenance at 01:00',
      category: SystemSettingCategory.SYSTEM,
      description: 'Banner',
      isEncrypted: false,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  describe('mapSettingsToMap', () => {
    it('should map settings array to Map correctly', () => {
      const map = mapSettingsToMap(mockSettings);
      assert.strictEqual(map.get('feature.pos_vietqr_enabled'), true);
      assert.strictEqual(map.get('llm.temperature_default'), 0.35);
      assert.strictEqual(map.get('system.banner_message'), 'Maintenance at 01:00');
    });

    it('should handle undefined or empty list', () => {
      const map = mapSettingsToMap(undefined);
      assert.strictEqual(map.size, 0);
    });
  });

  describe('getSettingValue', () => {
    it('should return found value when key exists', () => {
      const val = getSettingValue(mockSettings, 'feature.pos_vietqr_enabled', false);
      assert.strictEqual(val, true);
    });

    it('should return fallback when key is not found', () => {
      const val = getSettingValue(mockSettings, 'non.existent.key', 'fallback_123');
      assert.strictEqual(val, 'fallback_123');
    });

    it('should return fallback when settings list is undefined', () => {
      const val = getSettingValue(undefined, 'feature.pos_vietqr_enabled', false);
      assert.strictEqual(val, false);
    });
  });

  describe('parseSettingBoolean', () => {
    it('should parse boolean values directly', () => {
      assert.strictEqual(parseSettingBoolean(true), true);
      assert.strictEqual(parseSettingBoolean(false), false);
    });

    it('should parse string representations', () => {
      assert.strictEqual(parseSettingBoolean('true'), true);
      assert.strictEqual(parseSettingBoolean('false'), false);
      assert.strictEqual(parseSettingBoolean(1), true);
      assert.strictEqual(parseSettingBoolean(0), false);
    });

    it('should return fallback for unexpected values', () => {
      assert.strictEqual(parseSettingBoolean(null, true), true);
      assert.strictEqual(parseSettingBoolean(undefined, false), false);
      assert.strictEqual(parseSettingBoolean('random_string', false), false);
    });
  });

  describe('parseSettingNumber', () => {
    it('should return numeric value directly', () => {
      assert.strictEqual(parseSettingNumber(0.45), 0.45);
      assert.strictEqual(parseSettingNumber(100), 100);
    });

    it('should parse valid number strings', () => {
      assert.strictEqual(parseSettingNumber('2048'), 2048);
      assert.strictEqual(parseSettingNumber('0.7'), 0.7);
    });

    it('should return fallback on NaN or invalid strings', () => {
      assert.strictEqual(parseSettingNumber('not_a_number', 42), 42);
      assert.strictEqual(parseSettingNumber(null, 500), 500);
    });
  });

  describe('parseSettingString', () => {
    it('should return string directly', () => {
      assert.strictEqual(parseSettingString('gemini-2.5-flash'), 'gemini-2.5-flash');
    });

    it('should convert numbers/booleans to string', () => {
      assert.strictEqual(parseSettingString(123), '123');
      assert.strictEqual(parseSettingString(true), 'true');
    });

    it('should return fallback for null or undefined', () => {
      assert.strictEqual(parseSettingString(null, 'default_str'), 'default_str');
      assert.strictEqual(parseSettingString(undefined, 'default_str'), 'default_str');
    });
  });

  describe('Shared Contracts Schema Validation', () => {
    it('should validate query schema with valid category', () => {
      const parsed = querySystemSettingsSchema.parse({
        category: SystemSettingCategory.FEATURE_FLAGS,
      });
      assert.strictEqual(parsed.category, SystemSettingCategory.FEATURE_FLAGS);
    });

    it('should validate empty query schema', () => {
      const parsed = querySystemSettingsSchema.parse({});
      assert.strictEqual(parsed.category, undefined);
    });

    it('should validate update schema with boolean, number or string value', () => {
      const boolUpdate = updateSystemSettingSchema.parse({ value: false });
      assert.strictEqual(boolUpdate.value, false);

      const numUpdate = updateSystemSettingSchema.parse({
        value: 0.5,
        description: 'New temp',
      });
      assert.strictEqual(numUpdate.value, 0.5);
      assert.strictEqual(numUpdate.description, 'New temp');
    });
  });
});
