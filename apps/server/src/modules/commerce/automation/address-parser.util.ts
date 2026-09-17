import * as vd from 'vietnam-divisions-js';
import { normalizeVietnameseText, type AddressHierarchyDto } from '@sales-copilot/shared-contracts';

export interface DivisionProvince {
  idProvince: string;
  name: string;
}

export interface DivisionDistrict {
  idDistrict: string;
  idProvince: string;
  name: string;
}

export interface DivisionCommune {
  idCommune: string;
  idDistrict: string;
  name: string;
}

let cachedProvinces: DivisionProvince[] | null = null;
let cachedDistricts: DivisionDistrict[] | null = null;
let cachedCommunes: DivisionCommune[] | null = null;
let loadPromise: Promise<void> | null = null;

export async function ensureDivisionsLoaded(): Promise<{
  provinces: DivisionProvince[];
  districts: DivisionDistrict[];
  communes: DivisionCommune[];
}> {
  if (cachedProvinces && cachedDistricts && cachedCommunes) {
    return {
      provinces: cachedProvinces,
      districts: cachedDistricts,
      communes: cachedCommunes,
    };
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const [provinces, districts, communes] = await Promise.all([
        (vd as any).Provinces.getAllProvince(),
        (vd as any).Districts.getAllDistricts(),
        (vd as any).Communes.getAllCommunes(),
      ]);
      cachedProvinces = provinces;
      cachedDistricts = districts;
      cachedCommunes = communes;
    })();
  }

  await loadPromise;
  return {
    provinces: cachedProvinces!,
    districts: cachedDistricts!,
    communes: cachedCommunes!,
  };
}

export function parseAddressHierarchyWithDivisions(
  addressText: string,
  provinces: DivisionProvince[],
  districts: DivisionDistrict[],
  communes: DivisionCommune[],
): AddressHierarchyDto {
  if (!addressText) return {};
  const norm = normalizeVietnameseText(addressText);

  // 1. Province (search right-to-left)
  let bestProvince: DivisionProvince | null = null;
  let pIdx = -1;
  let pEndIdx = -1;
  let pMatchLen = 0;
  let pIsFull = false;

  for (const p of provinces) {
    const pNorm = normalizeVietnameseText(p.name);
    const short = pNorm.replace(/^(thanh pho|tinh)\s+/, '');
    let idx = norm.lastIndexOf(pNorm);
    let len = pNorm.length;
    let isFull = true;

    if (idx === -1 && short.length >= 3) {
      idx = norm.lastIndexOf(short);
      len = short.length;
      isFull = false;
    }

    if (idx !== -1) {
      const end = idx + len;
      if (end > pEndIdx || (end === pEndIdx && ((isFull && !pIsFull) || len > pMatchLen))) {
        pIdx = idx;
        pEndIdx = end;
        pMatchLen = len;
        pIsFull = isFull;
        bestProvince = p;
      }
    }
  }

  // 2. District
  let bestDistrict: DivisionDistrict | null = null;
  let dIdx = -1;
  let dEndIdx = -1;
  let dMatchLen = 0;
  let dIsFull = false;

  const candidateDistricts = bestProvince
    ? districts.filter(d => d.idProvince === bestProvince!.idProvince)
    : districts;

  for (const d of candidateDistricts) {
    const dNorm = normalizeVietnameseText(d.name);
    const short = dNorm.replace(/^(quan|huyen|thanh pho|thi xa)\s+/, '');
    let idx = norm.lastIndexOf(dNorm);
    let len = dNorm.length;
    let isFull = true;

    if (idx === -1 && short.length >= 2) {
      if (/^\d+$/.test(short)) {
        const qIdx = norm.lastIndexOf('quan ' + short);
        const qShortIdx = norm.lastIndexOf('q ' + short);
        if (qIdx !== -1) {
          idx = qIdx;
          len = ('quan ' + short).length;
          isFull = true;
        } else if (qShortIdx !== -1) {
          idx = qShortIdx;
          len = ('q ' + short).length;
          isFull = true;
        }
      } else {
        idx = norm.lastIndexOf(short);
        len = short.length;
        isFull = false;
      }
    }

    if (pIdx !== -1 && idx >= pIdx) continue;

    if (idx !== -1) {
      const end = idx + len;
      if (end > dEndIdx || (end === dEndIdx && ((isFull && !dIsFull) || len > dMatchLen))) {
        dIdx = idx;
        dEndIdx = end;
        dMatchLen = len;
        dIsFull = isFull;
        bestDistrict = d;
      }
    }
  }

  if (bestDistrict && !bestProvince) {
    bestProvince = provinces.find(p => p.idProvince === bestDistrict!.idProvince) || null;
  }

  // 3. Commune/Ward
  let bestCommune: DivisionCommune | null = null;
  let cIdx = -1;
  let cEndIdx = -1;
  let cMatchLen = 0;
  let cIsFull = false;

  let candidateCommunes: DivisionCommune[] = [];
  if (bestDistrict) {
    candidateCommunes = communes.filter(c => c.idDistrict === bestDistrict!.idDistrict);
  } else if (bestProvince) {
    const provinceDistrictIds = new Set(
      districts.filter(d => d.idProvince === bestProvince!.idProvince).map(d => d.idDistrict),
    );
    candidateCommunes = communes.filter(c => provinceDistrictIds.has(c.idDistrict));
  }

  for (const c of candidateCommunes) {
    const cNorm = normalizeVietnameseText(c.name);
    const short = cNorm.replace(/^(phuong|xa|thi tran)\s+/, '');
    let idx = norm.lastIndexOf(cNorm);
    let len = cNorm.length;
    let isFull = true;

    if (idx === -1 && short.length >= 2) {
      if (/^\d+$/.test(short)) {
        const pSubIdx = norm.lastIndexOf('phuong ' + short);
        const pShortIdx = norm.lastIndexOf('p ' + short);
        if (pSubIdx !== -1) {
          idx = pSubIdx;
          len = ('phuong ' + short).length;
          isFull = true;
        } else if (pShortIdx !== -1) {
          idx = pShortIdx;
          len = ('p ' + short).length;
          isFull = true;
        }
      } else {
        idx = norm.lastIndexOf(short);
        len = short.length;
        isFull = false;
      }
    }

    if (dIdx !== -1 && idx >= dIdx) continue;
    if (pIdx !== -1 && idx >= pIdx) continue;

    if (idx !== -1) {
      const end = idx + len;
      if (end > cEndIdx || (end === cEndIdx && ((isFull && !cIsFull) || len > cMatchLen))) {
        cIdx = idx;
        cEndIdx = end;
        cMatchLen = len;
        cIsFull = isFull;
        bestCommune = c;
      }
    }
  }

  if (!bestDistrict && bestCommune) {
    bestDistrict = districts.find(d => d.idDistrict === bestCommune!.idDistrict) || null;
  }
  if (bestDistrict && !bestProvince) {
    bestProvince = provinces.find(p => p.idProvince === bestDistrict!.idProvince) || null;
  }

  // 4. Street address
  let streetAddress: string | undefined = undefined;
  const matchedIndices = [cIdx, dIdx, pIdx].filter(i => i >= 0);
  if (matchedIndices.length > 0) {
    const earliest = Math.min(...matchedIndices);
    if (earliest > 0) {
      const rawPrefix = addressText
        .slice(0, earliest)
        .replace(/[,;/-]\s*$/, '')
        .trim();
      if (rawPrefix.length > 0) {
        streetAddress = rawPrefix;
      }
    }
  } else if (addressText.trim().length > 0) {
    streetAddress = addressText.trim();
  }

  return {
    province: bestProvince?.name,
    district: bestDistrict?.name,
    ward: bestCommune?.name,
    streetAddress,
  };
}
