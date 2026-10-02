import fc from 'fast-check';
import { sanitizeVietnameseUnaccented } from '../vietqr.service';

// EMVCo Tag 59 payload: uppercase, unaccented, alphanumeric+space, max 25 chars.
const arbitraryText = fc.string({ minLength: 0, maxLength: 80 });

fc.configureGlobal({ numRuns: 200 });

describe('sanitizeVietnameseUnaccented (property-based)', () => {
  it('is idempotent', () => {
    fc.assert(
      fc.property(arbitraryText, text => {
        expect(sanitizeVietnameseUnaccented(sanitizeVietnameseUnaccented(text))).toBe(
          sanitizeVietnameseUnaccented(text),
        );
      }),
    );
  });

  it('only emits uppercase alphanumerics and spaces within the 25-char default limit', () => {
    fc.assert(
      fc.property(arbitraryText, text => {
        const out = sanitizeVietnameseUnaccented(text);
        expect(out.length).toBeLessThanOrEqual(25);
        expect(out).toMatch(/^[A-Z0-9 ]*$/);
      }),
    );
  });

  it('maps đ/Đ to d/D instead of dropping them', () => {
    fc.assert(
      fc.property(arbitraryText, text => {
        const out = sanitizeVietnameseUnaccented(`đ${text}Đ`);
        expect(out).toContain('D');
      }),
    );
  });
});
