import { generateSlug } from '../utils/slug.util';

describe('generateSlug (Vietnamese & Unicode Slug Normalization)', () => {
  it('should convert standard English string to lowercase hyphenated slug', () => {
    const slug = generateSlug('Acme Corporation');
    expect(slug).toBe('acme-corporation');
  });

  it('should remove Vietnamese diacritics and convert đ/Đ to d', () => {
    const slug = generateSlug('Công Ty Cổ Phần Giải Pháp Số');
    expect(slug).toBe('cong-ty-co-phan-giai-phap-so');

    const slugWithD = generateSlug('Đại Học Bách Khoa Đà Nẵng');
    expect(slugWithD).toBe('dai-hoc-bach-khoa-da-nang');
  });

  it('should strip special characters, symbols and normalize whitespace/hyphens', () => {
    const slug = generateSlug('  Sales & Marketing @ Copilot 2026! -- (#1)  ');
    expect(slug).toBe('sales-marketing-copilot-2026-1');
  });

  it('should truncate string to maxLength without leaving trailing hyphens', () => {
    const slug = generateSlug(
      'very-long-workspace-name-that-exceeds-custom-length-limit-by-a-lot',
      20,
    );
    expect(slug.length <= 20).toBe(true);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('should generate fallback random slug when input is empty or contains only non-alphanumerics', () => {
    const fallbackEmpty = generateSlug('');
    expect(fallbackEmpty.startsWith('workspace-')).toBe(true);

    const fallbackSymbols = generateSlug('!@#$%^&*()');
    expect(fallbackSymbols.startsWith('workspace-')).toBe(true);

    const fallbackNull = generateSlug(null as unknown as string);
    expect(fallbackNull.startsWith('workspace-')).toBe(true);
  });
});
