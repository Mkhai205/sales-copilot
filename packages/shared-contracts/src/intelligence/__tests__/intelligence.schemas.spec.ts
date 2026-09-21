import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { AI_AUTOPILOT_QUEUE, personaToneSchema, type PersonaTone } from '../index';

describe('Shared Contracts — Intelligence Context Schemas', () => {
  describe('Constants and Enums', () => {
    it('should maintain AI_AUTOPILOT_QUEUE invariant', () => {
      assert.strictEqual(AI_AUTOPILOT_QUEUE, 'ai-autopilot');
    });

    it('should accept all valid persona tone enum values', () => {
      const validTones: PersonaTone[] = ['shop_ban', 'em_anh_chi', 'minh_ban', 'chuyen_vien'];
      for (const tone of validTones) {
        assert.strictEqual(personaToneSchema.parse(tone), tone);
      }
    });

    it('should reject invalid persona tone values', () => {
      const invalidTones = ['unknown', 'bot', 'admin', '', 123];
      for (const invalid of invalidTones) {
        assert.throws(() => {
          personaToneSchema.parse(invalid);
        });
      }
    });
  });
});
