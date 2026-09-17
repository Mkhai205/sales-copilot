import { normalizeVietnameseText } from '../../common/text';

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

export interface AddressHierarchyDto {
  streetAddress?: string;
  ward?: string;
  district?: string;
  province?: string;
}

export { normalizeVietnameseText };
