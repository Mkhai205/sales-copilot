import { CarrierNetwork } from './pos-enums';

/**
 * Prefix map for Vietnamese telecom operators.
 * 3-digit prefixes after normalizing to standard 10-digit format starting with 0.
 */
const VIETTEL_PREFIXES = new Set([
  '086',
  '096',
  '097',
  '098',
  '032',
  '033',
  '034',
  '035',
  '036',
  '037',
  '038',
  '039',
]);

const VINAPHONE_PREFIXES = new Set(['088', '091', '094', '081', '082', '083', '084', '085']);

const MOBIFONE_PREFIXES = new Set(['089', '090', '093', '070', '079', '077', '076', '078']);

const VIETNAMOBILE_PREFIXES = new Set(['092', '056', '058', '052']);

const GMOBILE_PREFIXES = new Set(['099', '059']);

const ITEL_PREFIXES = new Set(['087']);

const WINTEL_PREFIXES = new Set(['055']);

/**
 * Normalizes Vietnamese phone number.
 * - Strips whitespace, hyphens, dots, parentheses, and letters.
 * - Replaces leading '+84' or '84' with '0'.
 */
export function normalizeVietnamesePhone(phone: string): string {
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

/**
 * Validates if the given phone string matches the standard Vietnamese 10-digit mobile number format.
 */
export function isValidVietnamesePhone(phone: string): boolean {
  const normalized = normalizeVietnamesePhone(phone);
  return /^0[35789]\d{8}$/.test(normalized);
}

/**
 * Detects the carrier network of a Vietnamese phone number.
 * Returns CarrierNetwork enum value.
 */
export function detectCarrierNetwork(phone: string): CarrierNetwork {
  const normalized = normalizeVietnamesePhone(phone);
  if (normalized.length < 3) {
    return CarrierNetwork.OTHER;
  }

  const prefix3 = normalized.slice(0, 3);

  if (VIETTEL_PREFIXES.has(prefix3)) {
    return CarrierNetwork.VIETTEL;
  }
  if (VINAPHONE_PREFIXES.has(prefix3)) {
    return CarrierNetwork.VINAPHONE;
  }
  if (MOBIFONE_PREFIXES.has(prefix3)) {
    return CarrierNetwork.MOBIFONE;
  }
  if (VIETNAMOBILE_PREFIXES.has(prefix3)) {
    return CarrierNetwork.VIETNAMOBILE;
  }
  if (GMOBILE_PREFIXES.has(prefix3)) {
    return CarrierNetwork.GMOBILE;
  }
  if (ITEL_PREFIXES.has(prefix3)) {
    return CarrierNetwork.ITEL;
  }
  if (WINTEL_PREFIXES.has(prefix3)) {
    return CarrierNetwork.WINTEL;
  }

  return CarrierNetwork.OTHER;
}
