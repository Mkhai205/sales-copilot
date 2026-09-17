import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { fetchProvinces, fetchDistricts, fetchWards, parseAddressText } from '../vietnam-address';

describe('Vietnam Address Utilities (apps/web vietnam-address.ts)', () => {
  it('should fetch list of provinces', async () => {
    const provinces = await fetchProvinces();
    assert.strictEqual(provinces.length, 63);
    assert.ok(provinces.some(p => p.name === 'Thành phố Hà Nội'));
    assert.ok(provinces.some(p => p.name === 'Thành phố Hồ Chí Minh'));
  });

  it('should fetch districts for a given province name or id', async () => {
    const districtsHn = await fetchDistricts('Thành phố Hà Nội');
    assert.ok(districtsHn.length > 0);
    assert.ok(districtsHn.some(d => d.name === 'Quận Ba Đình'));
    assert.ok(districtsHn.some(d => d.name === 'Quận Hoàng Mai'));

    const empty = await fetchDistricts('');
    assert.deepStrictEqual(empty, []);
  });

  it('should fetch wards for a given district name or id', async () => {
    const wardsBaDinh = await fetchWards('Quận Ba Đình');
    assert.ok(wardsBaDinh.length > 0);
    assert.ok(wardsBaDinh.some(w => w.name === 'Phường Phúc Xá'));
    assert.ok(wardsBaDinh.some(w => w.name === 'Phường Cống Vị'));

    const empty = await fetchWards('');
    assert.deepStrictEqual(empty, []);
  });

  it('should parse 3-tier address with clean streetAddress extraction', async () => {
    const parsed = await parseAddressText(
      'Số 45 ngõ 120 Trường Chinh, Phường Phương Mai, Quận Đống Đa, Hà Nội',
    );

    assert.strictEqual(parsed.province, 'Thành phố Hà Nội');
    assert.strictEqual(parsed.district, 'Quận Đống Đa');
    assert.strictEqual(parsed.ward, 'Phường Phương Mai');
    assert.strictEqual(parsed.streetAddress, 'Số 45 ngõ 120 Trường Chinh');
  });

  it('should not duplicate ward into streetAddress when starting with administrative unit', async () => {
    const parsed = await parseAddressText('Phường Phúc Xá, Quận Ba Đình, Hà Nội');

    assert.strictEqual(parsed.province, 'Thành phố Hà Nội');
    assert.strictEqual(parsed.district, 'Quận Ba Đình');
    assert.strictEqual(parsed.ward, 'Phường Phúc Xá');
    assert.strictEqual(parsed.streetAddress, undefined);
  });

  it('should backfill district and province when only ward is provided', async () => {
    const parsed = await parseAddressText('Số 45 Lê Duẩn, Phường Bến Nghé, TP Hồ Chí Minh');

    assert.strictEqual(parsed.province, 'Thành phố Hồ Chí Minh');
    assert.strictEqual(parsed.district, 'Quận 1');
    assert.strictEqual(parsed.ward, 'Phường Bến Nghé');
    assert.strictEqual(parsed.streetAddress, 'Số 45 Lê Duẩn');
  });

  it('should handle numbered districts in HCMC', async () => {
    const parsed = await parseAddressText('123 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh');

    assert.strictEqual(parsed.province, 'Thành phố Hồ Chí Minh');
    assert.strictEqual(parsed.district, 'Quận 1');
    assert.strictEqual(parsed.streetAddress, '123 Nguyễn Huệ');
  });

  it('should handle empty or whitespace address', async () => {
    assert.deepStrictEqual(await parseAddressText(''), {});
    const emptyTrim = await parseAddressText('   ');
    assert.strictEqual(emptyTrim.streetAddress, undefined);
  });
});
