import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { VIETNAM_BANKS, isVietinBank, findBankByBin } from '../constants/vietnam-banks';
import { bankApi } from '../api/bank';

describe('Bank & Payment Settings (Epic 4.3 / Phase 3)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_bank_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Vietnam Banks NAPAS Constants & Helpers', () => {
    it('should contain a list of supported Vietnam banks', () => {
      assert.ok(VIETNAM_BANKS.length > 20);
    });

    it('every bank item should have required fields (bin, code, shortName, name)', () => {
      for (const bank of VIETNAM_BANKS) {
        assert.ok(typeof bank.bin === 'string' && bank.bin.length >= 6);
        assert.ok(typeof bank.code === 'string' && bank.code.length >= 2);
        assert.ok(typeof bank.shortName === 'string' && bank.shortName.length > 0);
        assert.ok(typeof bank.name === 'string' && bank.name.length > 0);
      }
    });

    it('should correctly detect VietinBank via exported isVietinBank helper', () => {
      assert.strictEqual(isVietinBank('970415', 'CTG', 'VietinBank'), true);
      assert.strictEqual(isVietinBank('970422', 'MB', 'MBBank'), false);
      assert.strictEqual(isVietinBank('970436', 'VCB', 'Vietcombank'), false);
      assert.strictEqual(isVietinBank(null, 'ICB', 'Ngân hàng Công thương'), true);
      assert.strictEqual(isVietinBank(undefined, undefined, undefined), false);
    });

    it('should find bank by BIN via findBankByBin helper', () => {
      const vcb = findBankByBin('970436');
      assert.ok(vcb);
      assert.strictEqual(vcb?.shortName, 'Vietcombank');

      const nonExistent = findBankByBin('000000');
      assert.strictEqual(nonExistent, undefined);

      assert.strictEqual(findBankByBin(null), undefined);
    });
  });

  describe('bankApi Client Methods', () => {
    it('getBankConfig() should perform GET to /workspaces/current/bank with workspaceId header', async () => {
      let requestedUrl = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              bankBin: '970422',
              accountNumber: '12345678',
              accountName: 'NGUYEN VAN A',
            },
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const res = await bankApi.getBankConfig(workspaceId);
      assert.ok(requestedUrl.includes('/workspaces/current/bank'));
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.bankBin, '970422');
    });

    it('updateBankConfig() should perform PATCH with body to /workspaces/current/bank', async () => {
      let requestedUrl = '';
      let requestedMethod = '';
      let requestedBody = '';
      let requestedHeaders: any = {};

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedBody = (init?.body as string) || '';
        requestedHeaders = init?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: JSON.parse(requestedBody),
          }),
        } as Response;
      }) as typeof globalThis.fetch;

      const payload = {
        bankBin: '970415',
        bankCode: 'CTG',
        bankName: 'VietinBank',
        accountNumber: '109988776655',
        accountName: 'HOANG KIM',
      };

      const res = await bankApi.updateBankConfig(workspaceId, payload);
      assert.ok(requestedUrl.includes('/workspaces/current/bank'));
      assert.strictEqual(requestedMethod, 'PATCH');
      assert.strictEqual(
        requestedHeaders['X-Workspace-Id'] || requestedHeaders['x-workspace-id'],
        workspaceId,
      );
      assert.strictEqual(res.data.bankBin, '970415');
      assert.strictEqual(res.data.accountNumber, '109988776655');
    });
  });
});
