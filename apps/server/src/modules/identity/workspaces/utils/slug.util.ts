import * as crypto from 'crypto';

/**
 * Normalizes a text string into a URL-friendly, lowercase alphanumeric slug with hyphens.
 * Handles Vietnamese diacritics and unicode normalization.
 */
export function generateSlug(text: string, maxLength = 80): string {
  if (!text || typeof text !== 'string') {
    return `workspace-${crypto.randomBytes(4).toString('hex')}`;
  }

  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
    .replace(/[đĐ]/g, 'd') // Handle Vietnamese 'đ' / 'Đ'
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumerics with hyphens
    .replace(/^-+|-+$/g, '') // Trim leading and trailing hyphens
    .slice(0, maxLength)
    .replace(/-+$/, ''); // Ensure no trailing hyphen after slice

  if (!normalized || normalized.length < 2) {
    return `workspace-${crypto.randomBytes(4).toString('hex')}`;
  }

  return normalized;
}
