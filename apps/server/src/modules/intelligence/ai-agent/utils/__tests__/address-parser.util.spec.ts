import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';
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

  before(async () => {
    const divisions = await ensureDivisionsLoaded();
    provinces = divisions.provinces;
    districts = divisions.districts;
    communes = divisions.communes;
  });

  it('should load all 63 provinces and division datasets', () => {
    assert.strictEqual(provinces.length, 63);
    assert.ok(districts.length > 600);
    assert.ok(communes.length > 9000);
  });

  it('should parse 3-level address and extract clean streetAddress', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Số 45 ngõ 120 Trường Chinh, Phường Phương Mai, Quận Đống Đa, Hà Nội',
      provinces,
      districts,
      communes,
    );

    assert.strictEqual(result.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.district, 'Quận Đống Đa');
    assert.strictEqual(result.ward, 'Phường Phương Mai');
    assert.strictEqual(result.streetAddress, 'Số 45 ngõ 120 Trường Chinh');
  });

  it('should not duplicate ward or district into streetAddress when address starts with an administrative unit', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Phường Phúc Xá, Quận Ba Đình, Hà Nội',
      provinces,
      districts,
      communes,
    );

    assert.strictEqual(result.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.district, 'Quận Ba Đình');
    assert.strictEqual(result.ward, 'Phường Phúc Xá');
    assert.strictEqual(result.streetAddress, undefined);
  });

  it('should backfill district and province when only ward and province are provided', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Số 45 Lê Duẩn, Phường Bến Nghé, TP Hồ Chí Minh',
      provinces,
      districts,
      communes,
    );

    assert.strictEqual(result.province, 'Thành phố Hồ Chí Minh');
    assert.strictEqual(result.district, 'Quận 1');
    assert.strictEqual(result.ward, 'Phường Bến Nghé');
    assert.strictEqual(result.streetAddress, 'Số 45 Lê Duẩn');
  });

  it('should backfill province when only district is provided', () => {
    const result = parseAddressHierarchyWithDivisions(
      '18 Tam Trinh, Quận Hoàng Mai',
      provinces,
      districts,
      communes,
    );

    assert.strictEqual(result.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.district, 'Quận Hoàng Mai');
    assert.strictEqual(result.streetAddress, '18 Tam Trinh');
  });

  it('should correctly disambiguate when street name coincides with a district or province name', () => {
    const result = parseAddressHierarchyWithDivisions(
      'Đường Ba Đình, Phường Cống Vị, Quận Ba Đình, Hà Nội',
      provinces,
      districts,
      communes,
    );

    assert.strictEqual(result.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.district, 'Quận Ba Đình');
    assert.strictEqual(result.ward, 'Phường Cống Vị');
    assert.strictEqual(result.streetAddress, 'Đường Ba Đình');
  });

  it('should handle numbered districts and wards in HCMC', () => {
    const result = parseAddressHierarchyWithDivisions(
      '123 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh',
      provinces,
      districts,
      communes,
    );

    assert.strictEqual(result.province, 'Thành phố Hồ Chí Minh');
    assert.strictEqual(result.district, 'Quận 1');
    assert.strictEqual(result.streetAddress, '123 Nguyễn Huệ');
  });

  it('should safely handle empty, whitespace, or non-address inputs', () => {
    assert.deepStrictEqual(
      parseAddressHierarchyWithDivisions('', provinces, districts, communes),
      {},
    );
    assert.strictEqual(
      parseAddressHierarchyWithDivisions('   ', provinces, districts, communes).streetAddress,
      undefined,
    );
    const nonAddress = parseAddressHierarchyWithDivisions(
      'Xin chào shop mình muốn mua đồ',
      provinces,
      districts,
      communes,
    );
    assert.strictEqual(nonAddress.province, undefined);
    assert.strictEqual(nonAddress.district, undefined);
    assert.strictEqual(nonAddress.ward, undefined);
    assert.strictEqual(nonAddress.streetAddress, 'Xin chào shop mình muốn mua đồ');
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
    assert.ok(duration < 15, `Expected < 15ms, took ${duration}ms`);
  });
});
