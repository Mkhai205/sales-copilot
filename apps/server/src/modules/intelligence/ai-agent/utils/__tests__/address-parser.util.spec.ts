import {
  ensureDivisionsLoaded,
  parseAddressHierarchyWithDivisions,
  type DivisionProvince,
  type DivisionDistrict,
  type DivisionCommune,
} from '../address-parser.util';

describe('AddressParserUtil (vietnam-divisions-js Address Parser)', () => {
  let provinces: DivisionProvince[];
  let districts: DivisionDistrict[];
  let communes: DivisionCommune[];

  beforeAll(async () => {
    const divisions = await ensureDivisionsLoaded();
    provinces = divisions.provinces;
    districts = divisions.districts;
    communes = divisions.communes;
  });

  it('should load all 63 provinces and division datasets', () => {
    expect(provinces.length).toBe(63);
    expect(districts.length > 600).toBeTruthy();
    expect(communes.length > 9000).toBeTruthy();
  });

  it('should parse 3-level address and extract clean streetAddress', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Số 45 ngõ 120 Trường Chinh, Phường Phương Mai, Quận Đống Đa, Hà Nội',
      provinces,
      districts,
      communes,
    );

    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Đống Đa');
    expect(result.ward).toBe('Phường Phương Mai');
    expect(result.streetAddress).toBe('Số 45 ngõ 120 Trường Chinh');
  });

  it('should not duplicate ward or district into streetAddress when address starts with an administrative unit', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Phường Phúc Xá, Quận Ba Đình, Hà Nội',
      provinces,
      districts,
      communes,
    );

    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Ba Đình');
    expect(result.ward).toBe('Phường Phúc Xá');
    expect(result.streetAddress).toBe(undefined);
  });

  it('should backfill district and province when only ward and province are provided', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Số 45 Lê Duẩn, Phường Bến Nghé, TP Hồ Chí Minh',
      provinces,
      districts,
      communes,
    );

    expect(result.province).toBe('Thành phố Hồ Chí Minh');
    expect(result.district).toBe('Quận 1');
    expect(result.ward).toBe('Phường Bến Nghé');
    expect(result.streetAddress).toBe('Số 45 Lê Duẩn');
  });

  it('should backfill province when only district is provided', () => {
    const result = parseAddressHierarchyWithDivisions(
      '18 Tam Trinh, Quận Hoàng Mai',
      provinces,
      districts,
      communes,
    );

    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Hoàng Mai');
    expect(result.streetAddress).toBe('18 Tam Trinh');
  });

  it('should correctly disambiguate when street name coincides with a district or province name', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Đường Ba Đình, Phường Cống Vị, Quận Ba Đình, Hà Nội',
      provinces,
      districts,
      communes,
    );

    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Ba Đình');
    expect(result.ward).toBe('Phường Cống Vị');
    expect(result.streetAddress).toBe('Đường Ba Đình');
  });

  it('should handle numbered districts and wards in HCMC', () => {
    const result = parseAddressHierarchyWithDivisions(
      '123 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh',
      provinces,
      districts,
      communes,
    );

    expect(result.province).toBe('Thành phố Hồ Chí Minh');
    expect(result.district).toBe('Quận 1');
    expect(result.streetAddress).toBe('123 Nguyễn Huệ');
  });

  it('should safely handle empty, whitespace, or non-address inputs', () => {
    expect(parseAddressHierarchyWithDivisions('', provinces, districts, communes)).toEqual({});
    expect(
      parseAddressHierarchyWithDivisions('   ', provinces, districts, communes).streetAddress,
    ).toBe(undefined);
    const nonAddress = parseAddressHierarchyWithDivisions(
      'Xin chào shop mình muốn mua đồ',
      provinces,
      districts,
      communes,
    );
    expect(nonAddress.province).toBe(undefined);
    expect(nonAddress.district).toBe(undefined);
    expect(nonAddress.ward).toBe(undefined);
    expect(nonAddress.streetAddress).toBe('Xin chào shop mình muốn mua đồ');
  });

  it('should execute parsing in less than 15ms (deterministic tier-1 SLA)', () => {
    const start = performance.now();
    parseAddressHierarchyWithDivisions(
      'Số 45 ngõ 120 Trường Chinh, Phường Phương Mai, Quận Đống Đa, Hà Nội',
      provinces,
      districts,
      communes,
    );
    const duration = performance.now() - start;
    expect(duration < 15).toBeTruthy();
  });
});
