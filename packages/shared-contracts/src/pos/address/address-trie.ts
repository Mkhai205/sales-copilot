import rawAdministrativeUnits from './vn-administrative-units.json';

export interface AdministrativeWard {
  id: string;
  name: string;
}

export interface AdministrativeDistrict {
  id: string;
  name: string;
  wards: AdministrativeWard[];
}

export interface AdministrativeProvince {
  id: string;
  name: string;
  code: string;
  districts: AdministrativeDistrict[];
}

export const ADMINISTRATIVE_UNITS: AdministrativeProvince[] =
  rawAdministrativeUnits as AdministrativeProvince[];

/**
 * Normalizes Vietnamese text by converting to lowercase, removing diacritics and symbols.
 */
export function normalizeVietnameseText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Internal Trie Node representation.
 */
class TrieNode<T> {
  children: Map<string, TrieNode<T>> = new Map();
  values: T[] = [];
  isEndOfWord: boolean = false;
}

/**
 * Prefix Trie for O(k) Vietnamese administrative unit fuzzy matching.
 */
export class AddressTrie<T> {
  private root: TrieNode<T> = new TrieNode<T>();

  /**
   * Inserts a key and associated value into the Trie.
   * Also indexes word suffixes to support multi-word phrase prefix searching (e.g. "ha noi" from "thanh pho ha noi").
   */
  public insert(key: string, value: T): void {
    const normalized = normalizeVietnameseText(key);
    if (!normalized) return;

    const words = normalized.split(' ');
    for (let i = 0; i < words.length; i++) {
      const subPhrase = words.slice(i).join(' ');
      this.insertDirect(subPhrase, value);
    }
  }

  private insertDirect(phrase: string, value: T): void {
    let current = this.root;
    for (const char of phrase) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode<T>());
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
    if (!current.values.includes(value)) {
      current.values.push(value);
    }
  }

  /**
   * Searches for values matching prefix in O(k).
   */
  public searchPrefix(prefix: string): T[] {
    const normalized = normalizeVietnameseText(prefix);
    if (!normalized) return [];

    let current = this.root;
    for (const char of normalized) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char)!;
    }

    const results: T[] = [];
    this.collectAll(current, results);
    return Array.from(new Set(results));
  }

  private collectAll(node: TrieNode<T>, results: T[]): void {
    if (node.values.length > 0) {
      results.push(...node.values);
    }
    for (const child of node.children.values()) {
      this.collectAll(child, results);
    }
  }
}

// ============================================================================
// Administrative Unit Helpers
// ============================================================================

export function getProvinces(): AdministrativeProvince[] {
  return ADMINISTRATIVE_UNITS;
}

export function getDistricts(provinceId: string): AdministrativeDistrict[] {
  const province = ADMINISTRATIVE_UNITS.find(p => p.id === provinceId || p.code === provinceId);
  return province?.districts || [];
}

export function getWards(districtId: string): AdministrativeWard[] {
  for (const province of ADMINISTRATIVE_UNITS) {
    const district = province.districts.find(d => d.id === districtId);
    if (district) {
      return district.wards || [];
    }
  }
  return [];
}

/**
 * Searches provinces matching a prefix or substring.
 */
export function searchProvinces(query: string): AdministrativeProvince[] {
  const normalizedQuery = normalizeVietnameseText(query);
  if (!normalizedQuery) return ADMINISTRATIVE_UNITS;

  return ADMINISTRATIVE_UNITS.filter(province => {
    const normalizedName = normalizeVietnameseText(province.name);
    return (
      normalizedName.includes(normalizedQuery) ||
      province.code.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Searches districts within a province or globally.
 */
export function searchDistricts(provinceId?: string, query?: string): AdministrativeDistrict[] {
  const districts = provinceId
    ? getDistricts(provinceId)
    : ADMINISTRATIVE_UNITS.flatMap(p => p.districts);

  if (!query) return districts;
  const normalizedQuery = normalizeVietnameseText(query);

  return districts.filter(d => normalizeVietnameseText(d.name).includes(normalizedQuery));
}

/**
 * Searches wards within a district.
 */
export function searchWards(districtId: string, query?: string): AdministrativeWard[] {
  const wards = getWards(districtId);
  if (!query) return wards;
  const normalizedQuery = normalizeVietnameseText(query);

  return wards.filter(w => normalizeVietnameseText(w.name).includes(normalizedQuery));
}

/**
 * Parses a freeform address string and attempts to resolve Province, District, Ward, and Street Address.
 * Uses right-to-left position matching to eliminate false positives from street names containing province names.
 */
export function parseAddressHierarchy(addressText: string): {
  province?: string;
  district?: string;
  ward?: string;
  streetAddress?: string;
} {
  if (!addressText) return {};

  const normalized = normalizeVietnameseText(addressText);
  let matchedProvince: AdministrativeProvince | undefined;
  let provinceIndex = -1;
  let provinceMatchLen = 0;

  // 1. Check provinces from right to left (highest lastIndexOf)
  for (const province of ADMINISTRATIVE_UNITS) {
    const normalizedProvince = normalizeVietnameseText(province.name);
    const shortName = normalizedProvince.replace(/^(tinh|thanh pho)\s+/, '');

    let idx = normalized.lastIndexOf(normalizedProvince);
    let matchLen = normalizedProvince.length;

    if (idx === -1 && shortName.length >= 3) {
      idx = normalized.lastIndexOf(shortName);
      matchLen = shortName.length;
    }

    if (idx > provinceIndex || (idx === provinceIndex && matchLen > provinceMatchLen)) {
      provinceIndex = idx;
      provinceMatchLen = matchLen;
      matchedProvince = province;
    }
  }

  // 2. Check districts (must appear before province)
  let matchedDistrict: AdministrativeDistrict | undefined;
  let districtIndex = -1;
  let districtMatchLen = 0;

  const districtsToCheck = matchedProvince
    ? matchedProvince.districts
    : ADMINISTRATIVE_UNITS.flatMap(p => p.districts);

  for (const district of districtsToCheck) {
    const normalizedDistrict = normalizeVietnameseText(district.name);
    const shortDistrict = normalizedDistrict.replace(/^(quan|huyen|thanh pho|thi xa)\s+/, '');

    let idx = normalized.lastIndexOf(normalizedDistrict);
    let matchLen = normalizedDistrict.length;

    if (idx === -1 && shortDistrict.length >= 2) {
      if (/^\d+$/.test(shortDistrict)) {
        const qIdx = normalized.lastIndexOf(`q ${shortDistrict}`);
        const quanIdx = normalized.lastIndexOf(`quan ${shortDistrict}`);
        if (quanIdx !== -1) {
          idx = quanIdx;
          matchLen = `quan ${shortDistrict}`.length;
        } else if (qIdx !== -1) {
          idx = qIdx;
          matchLen = `q ${shortDistrict}`.length;
        }
      } else {
        idx = normalized.lastIndexOf(shortDistrict);
        matchLen = shortDistrict.length;
      }
    }

    if (provinceIndex !== -1 && idx >= provinceIndex) {
      continue;
    }

    if (idx > districtIndex || (idx === districtIndex && matchLen > districtMatchLen)) {
      districtIndex = idx;
      districtMatchLen = matchLen;
      matchedDistrict = district;
      if (!matchedProvince) {
        matchedProvince = ADMINISTRATIVE_UNITS.find(p =>
          p.districts.some(d => d.id === district.id),
        );
      }
    }
  }

  // 3. Check wards (must appear before district)
  let matchedWard: AdministrativeWard | undefined;
  let wardIndex = -1;
  let wardMatchLen = 0;

  const wardsToCheck = matchedDistrict?.wards
    ? matchedDistrict.wards
    : matchedProvince
      ? matchedProvince.districts.flatMap(d => d.wards || [])
      : [];

  for (const ward of wardsToCheck) {
    const normalizedWard = normalizeVietnameseText(ward.name);
    const shortWard = normalizedWard.replace(/^(phuong|xa|thi tran)\s+/, '');

    let idx = normalized.lastIndexOf(normalizedWard);
    let matchLen = normalizedWard.length;

    if (idx === -1 && shortWard.length >= 2) {
      if (/^\d+$/.test(shortWard)) {
        const pIdx = normalized.lastIndexOf(`p ${shortWard}`);
        const phuongIdx = normalized.lastIndexOf(`phuong ${shortWard}`);
        if (phuongIdx !== -1) {
          idx = phuongIdx;
          matchLen = `phuong ${shortWard}`.length;
        } else if (pIdx !== -1) {
          idx = pIdx;
          matchLen = `p ${shortWard}`.length;
        }
      } else {
        idx = normalized.lastIndexOf(shortWard);
        matchLen = shortWard.length;
      }
    }

    if (districtIndex !== -1 && idx >= districtIndex) {
      continue;
    }

    if (idx > wardIndex || (idx === wardIndex && matchLen > wardMatchLen)) {
      wardIndex = idx;
      wardMatchLen = matchLen;
      matchedWard = ward;
    }
  }

  // 4. Extract street address (the part before ward/district/province)
  let streetAddress = addressText.trim();
  const validIndices = [wardIndex, districtIndex, provinceIndex].filter(i => i > 0);
  if (validIndices.length > 0) {
    const earliestMatchIdx = Math.min(...validIndices);
    // Find closest comma or delimiter before the earliest match in original text
    // Or slice up to the matched position
    const rawPrefix = addressText
      .slice(0, earliestMatchIdx)
      .replace(/[,;/-]\s*$/, '')
      .trim();
    if (rawPrefix.length > 0) {
      streetAddress = rawPrefix;
    }
  }

  return {
    province: matchedProvince?.name,
    district: matchedDistrict?.name,
    ward: matchedWard?.name,
    streetAddress,
  };
}
