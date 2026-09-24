import * as vd from 'vietnam-divisions-js';
import { normalizeVietnameseText, type AddressHierarchyDto } from '@sales-copilot/shared-contracts';

export interface DivisionItem {
  id: string;
  name: string;
  code?: string;
}

export async function fetchProvinces(): Promise<DivisionItem[]> {
  const provinces = await (vd as any).Provinces.getAllProvince();
  return (provinces || []).map((p: any) => ({
    id: p.idProvince,
    name: p.name,
    code: p.idProvince,
  }));
}

export async function fetchDistricts(provinceNameOrId?: string): Promise<DivisionItem[]> {
  if (!provinceNameOrId) return [];
  const provinces = await (vd as any).Provinces.getAllProvince();
  const prov = (provinces || []).find(
    (p: any) => p.idProvince === provinceNameOrId || p.name === provinceNameOrId,
  );
  if (!prov) return [];

  const districts = await (vd as any).Provinces.getDistrictsByProvinceId(prov.idProvince);
  return (districts || []).map((d: any) => ({
    id: d.idDistrict,
    name: d.name,
  }));
}

export async function fetchWards(districtNameOrId?: string): Promise<DivisionItem[]> {
  if (!districtNameOrId) return [];
  const districts = await (vd as any).Districts.getAllDistricts();
  const dist = (districts || []).find(
    (d: any) => d.idDistrict === districtNameOrId || d.name === districtNameOrId,
  );
  if (!dist) return [];

  const communes = await (vd as any).Districts.getCommunesByDistrictId(dist.idDistrict);
  return (communes || []).map((c: any) => ({
    id: c.idCommune,
    name: c.name,
  }));
}

export async function parseAddressText(addressText: string): Promise<AddressHierarchyDto> {
  if (!addressText) return {};

  const [provinces, districts, communes] = await Promise.all([
    (vd as any).Provinces.getAllProvince(),
    (vd as any).Districts.getAllDistricts(),
    (vd as any).Communes.getAllCommunes(),
  ]);

  const norm = normalizeVietnameseText(addressText);

  // 1. Province (search right-to-left)
  let bestProvince: any = null;
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
  let bestDistrict: any = null;
  let dIdx = -1;
  let dEndIdx = -1;
  let dMatchLen = 0;
  let dIsFull = false;

  const candidateDistricts = bestProvince
    ? (districts as any[]).filter((d: any) => d.idProvince === bestProvince.idProvince)
    : (districts as any[]);

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
    bestProvince =
      (provinces as any[]).find((p: any) => p.idProvince === bestDistrict.idProvince) || null;
  }

  // 3. Commune/Ward
  let bestCommune: any = null;
  let cIdx = -1;
  let cEndIdx = -1;
  let cMatchLen = 0;
  let cIsFull = false;

  let candidateCommunes: any[] = [];
  if (bestDistrict) {
    candidateCommunes = (communes as any[]).filter(
      (c: any) => c.idDistrict === bestDistrict.idDistrict,
    );
  } else if (bestProvince) {
    const provinceDistrictIds = new Set(
      (districts as any[])
        .filter((d: any) => d.idProvince === bestProvince.idProvince)
        .map((d: any) => d.idDistrict),
    );
    candidateCommunes = (communes as any[]).filter((c: any) =>
      provinceDistrictIds.has(c.idDistrict),
    );
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
    bestDistrict =
      (districts as any[]).find((d: any) => d.idDistrict === bestCommune.idDistrict) || null;
  }
  if (bestDistrict && !bestProvince) {
    bestProvince =
      (provinces as any[]).find((p: any) => p.idProvince === bestDistrict.idProvince) || null;
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
