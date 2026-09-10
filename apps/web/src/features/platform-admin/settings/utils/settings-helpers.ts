import type { SystemSettingItemDto } from '@sales-copilot/shared-contracts';

/**
 * Converts a list of settings into a key-value Map for fast lookups.
 */
export function mapSettingsToMap(settings?: SystemSettingItemDto[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (!settings) return map;
  for (const s of settings) {
    map.set(s.key, s.value);
  }
  return map;
}

/**
 * Retrieves a typed setting value from settings list with a fallback.
 */
export function getSettingValue<T>(
  settings: SystemSettingItemDto[] | undefined,
  key: string,
  fallback: T,
): T {
  if (!settings) return fallback;
  const found = settings.find(s => s.key === key);
  if (!found || found.value === undefined || found.value === null) {
    return fallback;
  }
  return found.value as T;
}

/**
 * Safely parses an unknown setting value into a boolean.
 */
export function parseSettingBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

/**
 * Safely parses an unknown setting value into a number.
 */
export function parseSettingNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Safely parses an unknown setting value into a string.
 */
export function parseSettingString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return fallback;
  return String(value);
}
