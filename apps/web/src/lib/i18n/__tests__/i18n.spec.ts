import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { isValidLocale, DEFAULT_LOCALE, SUPPORTED_LOCALES, LOCALES_META } from '../config';
import { formatRelativeTime } from '../format-date';

function getDeepKeys(obj: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(getDeepKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

describe('i18n Configuration and Dictionaries', () => {
  it('has valid default and supported locales', () => {
    assert.strictEqual(DEFAULT_LOCALE, 'vi');
    assert.deepStrictEqual(SUPPORTED_LOCALES, ['vi', 'en']);
    assert.strictEqual(isValidLocale('vi'), true);
    assert.strictEqual(isValidLocale('en'), true);
    assert.strictEqual(isValidLocale('fr'), false);
    assert.strictEqual(isValidLocale(null), false);
    assert.strictEqual(isValidLocale(123), false);
  });

  it('has valid metadata for all supported locales', () => {
    for (const loc of SUPPORTED_LOCALES) {
      const meta = LOCALES_META[loc];
      assert.ok(meta);
      assert.strictEqual(meta.code, loc);
      assert.ok(meta.nativeLabel.length > 0);
      assert.ok(meta.flag.length > 0);
    }
  });

  it('has 100% dictionary key parity between Vietnamese (vi) and English (en)', () => {
    const viKeys = getDeepKeys(vi).sort();
    const enKeys = getDeepKeys(en).sort();

    assert.deepStrictEqual(
      viKeys,
      enKeys,
      'Keys in vi.ts and en.ts must match exactly without missing or extraneous keys',
    );
  });

  it('translates essential sections without empty strings', () => {
    const viKeys = getDeepKeys(vi);
    for (const keyPath of viKeys) {
      const parts = keyPath.split('.');
      let currentVi: any = vi;
      let currentEn: any = en;
      for (const p of parts) {
        currentVi = currentVi[p];
        currentEn = currentEn[p];
      }
      assert.strictEqual(typeof currentVi, 'string', `vi.${keyPath} must be string`);
      assert.strictEqual(typeof currentEn, 'string', `en.${keyPath} must be string`);
      assert.ok(currentVi.length > 0, `vi.${keyPath} must not be empty`);
      assert.ok(currentEn.length > 0, `en.${keyPath} must not be empty`);
    }
  });

  it('formats relative time according to active locale', () => {
    const pastDate = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago

    const viTime = formatRelativeTime(pastDate, 'vi');
    const enTime = formatRelativeTime(pastDate, 'en');

    assert.ok(viTime.includes('phút'), `viTime (${viTime}) should contain 'phút'`);
    assert.ok(
      enTime.toLowerCase().includes('minute') || enTime.includes('m'),
      `enTime (${enTime}) should contain 'minute' or 'm'`,
    );
  });
});
