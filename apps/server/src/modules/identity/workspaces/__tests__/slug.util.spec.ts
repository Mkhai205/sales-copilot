import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { generateSlug } from '../utils/slug.util';

describe('generateSlug (Vietnamese & Unicode Slug Normalization)', () => {
  it('should convert standard English string to lowercase hyphenated slug', () => {
    const slug = generateSlug('Acme Corporation');
    assert.strictEqual(slug, 'acme-corporation');
  });

  it('should remove Vietnamese diacritics and convert đ/Đ to d', () => {
    const slug = generateSlug('Công Ty Cổ Phần Giải Pháp Số');
    assert.strictEqual(slug, 'cong-ty-co-phan-giai-phap-so');

    const slugWithD = generateSlug('Đại Học Bách Khoa Đà Nẵng');
    assert.strictEqual(slugWithD, 'dai-hoc-bach-khoa-da-nang');
  });

  it('should strip special characters, symbols and normalize whitespace/hyphens', () => {
    const slug = generateSlug('  Sales & Marketing @ Copilot 2026! -- (#1)  ');
    assert.strictEqual(slug, 'sales-marketing-copilot-2026-1');
  });

  it('should truncate string to maxLength without leaving trailing hyphens', () => {
    const slug = generateSlug(
      'very-long-workspace-name-that-exceeds-custom-length-limit-by-a-lot',
      20,
    );
    assert.strictEqual(slug.length <= 20, true);
    assert.strictEqual(slug.endsWith('-'), false);
  });

  it('should generate fallback random slug when input is empty or contains only non-alphanumerics', () => {
    const fallbackEmpty = generateSlug('');
    assert.strictEqual(fallbackEmpty.startsWith('workspace-'), true);

    const fallbackSymbols = generateSlug('!@#$%^&*()');
    assert.strictEqual(fallbackSymbols.startsWith('workspace-'), true);

    const fallbackNull = generateSlug(null as unknown as string);
    assert.strictEqual(fallbackNull.startsWith('workspace-'), true);
  });
});
