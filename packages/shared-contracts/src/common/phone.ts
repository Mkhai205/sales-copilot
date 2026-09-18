/**
 * Standard regex for matching a Vietnamese mobile phone number (single match).
 */
export const VIETNAMESE_PHONE_REGEX = /(?:\+84|0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}\b/;

/**
 * Global regex for matching and extracting Vietnamese mobile phone numbers from text strings.
 * Accurately extracts contiguous, spaced, dotted, and hyphenated Vietnamese phone formats
 * while preventing false positives on common phrases and non-phone numeric strings.
 */
export const VIETNAMESE_PHONE_EXTRACT_REGEX =
  /(?<![\w+])(?:\(\+84\)|\+84|84|\(?0)(?:[\s().-]*[35789])(?:[\s().-]*\d){8}(?![a-zA-Z\d])/g;

/**
 * Exact-match regex for validating entire string as a Vietnamese phone number.
 */
export const VIETNAMESE_PHONE_EXACT_REGEX = /^(0|\+84)[35789][0-9]{8}$/;

/**
 * Extracts all Vietnamese phone numbers from a text string.
 */
export function extractVietnamesePhoneNumbers(text?: string | null): string[] {
  if (!text) return [];
  const regex = new RegExp(VIETNAMESE_PHONE_EXTRACT_REGEX.source, 'g');
  return text.match(regex) || [];
}

/**
 * Normalizes Vietnamese phone number.
 * - Strips whitespace, hyphens, dots, parentheses, and letters.
 * - Replaces leading '+84' or '84' with '0'.
 */
export function normalizeVietnamesePhone(phone?: string | null): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-().]/g, '').trim();

  // Convert +84 or 84 prefix to standard 0
  if (cleaned.startsWith('+84')) {
    cleaned = cleaned.slice(3);
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
  } else if (cleaned.startsWith('84') && cleaned.length >= 11) {
    cleaned = cleaned.slice(2);
    if (!cleaned.startsWith('0')) {
      cleaned = '0' + cleaned;
    }
  }

  return cleaned;
}

export const normalizeVietnamesePhoneNumber = normalizeVietnamesePhone;

/**
 * Validates if the given phone string matches the standard Vietnamese 10-digit mobile number format.
 */
export function isValidVietnamesePhone(phone: string): boolean {
  const normalized = normalizeVietnamesePhone(phone);
  return /^0[35789]\d{8}$/.test(normalized);
}
