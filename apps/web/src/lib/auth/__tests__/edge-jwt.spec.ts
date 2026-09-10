import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { decodeJwtPayload, isTokenExpired, isSuperAdmin } from '../edge-jwt';

describe('Edge JWT Helper (apps/web/src/lib/auth/edge-jwt.ts)', () => {
  describe('decodeJwtPayload', () => {
    it('should decode a valid JWT with standard base64 payload', () => {
      const payloadObj = {
        sub: 'usr_123',
        email: 'admin@salescopilot.io',
        role: 'SUPER_ADMIN',
      };
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
      const signature = 'dummy_signature';
      const token = `${header}.${payload}.${signature}`;

      const decoded = decodeJwtPayload(token);
      assert.deepStrictEqual(decoded, payloadObj);
    });

    it('should decode base64url payload with unpadded and URL-safe characters', () => {
      const payloadObj = {
        sub: 'usr_abc_xyz',
        email: 'test+user@domain.com',
        role: 'SUPER_ADMIN',
        customData: 'value-with-dash_and_underscore',
      };
      const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      // Base64url encode without padding
      const payload = Buffer.from(JSON.stringify(payloadObj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const token = `${header}.${payload}.sig`;

      const decoded = decodeJwtPayload(token);
      assert.deepStrictEqual(decoded, payloadObj);
    });

    it('should handle UTF-8 unicode strings in payload', () => {
      const payloadObj = {
        sub: 'usr_vi',
        name: 'Nguyễn Văn A',
        shop: 'Cửa hàng Đồ gia dụng',
      };
      const header = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const token = `${header}.${payload}.sig`;

      const decoded = decodeJwtPayload(token);
      assert.deepStrictEqual(decoded, payloadObj);
    });

    it('should return null for non-string or empty inputs', () => {
      assert.strictEqual(decodeJwtPayload(''), null);
      assert.strictEqual(decodeJwtPayload(null as any), null);
      assert.strictEqual(decodeJwtPayload(undefined as any), null);
    });

    it('should return null for malformed tokens without 3 parts', () => {
      assert.strictEqual(decodeJwtPayload('single-part-token'), null);
      assert.strictEqual(decodeJwtPayload('part1.part2'), null);
      assert.strictEqual(decodeJwtPayload('part1.part2.part3.part4'), null);
    });

    it('should return null if payload is not valid JSON', () => {
      const header = 'eyJhbGciOiJIUzI1NiJ9';
      const badPayload = Buffer.from('this is not json').toString('base64');
      const token = `${header}.${badPayload}.sig`;

      assert.strictEqual(decodeJwtPayload(token), null);
    });

    it('should return null if payload decodes to non-object JSON (primitive or array)', () => {
      const header = 'eyJhbGciOiJIUzI1NiJ9';
      const primitives = ['"just a string"', '12345', 'true', '[1, 2, 3]', 'null'];
      for (const prim of primitives) {
        const payload = Buffer.from(prim).toString('base64');
        const token = `${header}.${payload}.sig`;
        assert.strictEqual(decodeJwtPayload(token), null, `Expected null for payload: ${prim}`);
      }
    });
  });

  describe('isTokenExpired', () => {
    it('should return false if token expires far in the future', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      assert.strictEqual(isTokenExpired({ exp: futureExp }), false);
    });

    it('should return true if token is already expired', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      assert.strictEqual(isTokenExpired({ exp: pastExp }), true);
    });

    it('should return true if token expires within clockSkewMs window (5 seconds default)', () => {
      const soonExp = Math.floor(Date.now() / 1000) + 3; // 3 seconds from now (< 5s skew)
      assert.strictEqual(isTokenExpired({ exp: soonExp }), true);
    });

    it('should return true if payload is null, undefined, or missing exp', () => {
      assert.strictEqual(isTokenExpired(null), true);
      assert.strictEqual(isTokenExpired(undefined), true);
      assert.strictEqual(isTokenExpired({}), true);
      assert.strictEqual(isTokenExpired({ exp: undefined }), true);
    });

    it('should return true if exp is NaN, Infinity, zero or negative', () => {
      assert.strictEqual(isTokenExpired({ exp: NaN }), true);
      assert.strictEqual(isTokenExpired({ exp: Infinity }), true);
      assert.strictEqual(isTokenExpired({ exp: -Infinity }), true);
      assert.strictEqual(isTokenExpired({ exp: 0 }), true);
      assert.strictEqual(isTokenExpired({ exp: -100 }), true);
    });
  });

  describe('isSuperAdmin', () => {
    it('should return true for role === SUPER_ADMIN', () => {
      assert.strictEqual(isSuperAdmin({ role: 'SUPER_ADMIN' }), true);
    });

    it('should return false for other roles or missing role', () => {
      assert.strictEqual(isSuperAdmin({ role: 'USER' }), false);
      assert.strictEqual(isSuperAdmin({ role: 'AGENT' }), false);
      assert.strictEqual(isSuperAdmin({ role: 'ADMIN' }), false);
      assert.strictEqual(isSuperAdmin({ role: undefined }), false);
      assert.strictEqual(isSuperAdmin(null), false);
      assert.strictEqual(isSuperAdmin(undefined), false);
    });
  });
});
