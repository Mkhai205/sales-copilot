import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { buildQueryString, workspaceHeaders, ApiClientError } from '../api/client';

describe('Api Client Utilities (api-client.spec.ts)', () => {
  describe('buildQueryString', () => {
    it('should return empty string when params is undefined or null', () => {
      assert.strictEqual(buildQueryString(undefined), '');
      assert.strictEqual(buildQueryString(null as any), '');
    });

    it('should return empty string when params object is empty', () => {
      assert.strictEqual(buildQueryString({}), '');
    });

    it('should format simple key-value pairs', () => {
      const qs = buildQueryString({ page: 1, limit: 20 });
      assert.strictEqual(qs, '?page=1&limit=20');
    });

    it('should ignore undefined, null, and empty string values', () => {
      const qs = buildQueryString({
        page: 1,
        filter: undefined,
        category: null,
        search: '',
        valid: 'yes',
      });
      assert.strictEqual(qs, '?page=1&valid=yes');
    });

    it('should support array parameters by repeating keys', () => {
      const qs = buildQueryString({ status: ['OPEN', 'RESOLVED'] });
      assert.strictEqual(qs, '?status=OPEN&status=RESOLVED');
    });

    it('should ignore empty arrays or null/undefined items in arrays', () => {
      const emptyArrayQs = buildQueryString({ tags: [] });
      assert.strictEqual(emptyArrayQs, '');

      const filteredArrayQs = buildQueryString({
        tags: ['sale', null, undefined, '', 'featured'],
      });
      assert.strictEqual(filteredArrayQs, '?tags=sale&tags=featured');
    });

    it('should handle mixed scalars and arrays properly', () => {
      const qs = buildQueryString({
        search: 'copilot',
        status: ['ACTIVE', 'PENDING'],
        page: 2,
      });
      assert.strictEqual(qs, '?search=copilot&status=ACTIVE&status=PENDING&page=2');
    });

    it('should correctly serialize boolean and numeric values in array and scalar parameters', () => {
      const qs = buildQueryString({
        active: false,
        count: 0,
        codes: [0, 1, 2],
        flags: [true, false],
      });
      assert.strictEqual(
        qs,
        '?active=false&count=0&codes=0&codes=1&codes=2&flags=true&flags=false',
      );
    });
  });

  describe('workspaceHeaders', () => {
    it('should return header object with X-Workspace-Id when workspaceId is provided', () => {
      const headers = workspaceHeaders('ws-test-456');
      assert.deepStrictEqual(headers, { 'X-Workspace-Id': 'ws-test-456' });
    });

    it('should return empty object when workspaceId is omitted or undefined', () => {
      assert.deepStrictEqual(workspaceHeaders(undefined), {});
      assert.deepStrictEqual(workspaceHeaders(''), {});
    });
  });

  describe('ApiClientError', () => {
    it('should instantiate correctly with status and message from error payload', () => {
      const err = new ApiClientError(404, {
        code: 'NOT_FOUND',
        message: 'Order not found',
      });

      assert.strictEqual(err.name, 'ApiClientError');
      assert.strictEqual(err.status, 404);
      assert.strictEqual(err.message, 'Order not found');
      assert.deepStrictEqual(err.error, {
        code: 'NOT_FOUND',
        message: 'Order not found',
      });
      assert.ok(err instanceof Error);
    });

    it('should fallback to default message if payload has no message', () => {
      const err = new ApiClientError(500, {
        code: 'INTERNAL_SERVER_ERROR',
        message: '',
      });

      assert.strictEqual(err.status, 500);
      assert.strictEqual(err.message, 'API request failed with status 500');
    });
  });
});
