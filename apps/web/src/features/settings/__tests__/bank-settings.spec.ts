import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { workspacePaymentSettingsSchema } from '@sales-copilot/shared-contracts';
import { VIETNAM_BANKS } from '../bank/constants/vietnam-banks';
import { bankApi } from '../bank/api/bank';

describe('Bank & Payment Settings (Epic 4.3 / Phase 3)', () => {
  let originalFetch: typeof globalThis.fetch;
  const workspaceId = 'ws_bank_test_123';

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('workspacePaymentSettingsSchema validation', () => {
    it('should validate valid payment settings payload', () => {
      const validPayload = {
        bankBin: '970422',
        bankCode: 'MB',
        bankName: 'MBBank',
        accountNumber: '103888325398',
        accountName: 'NGUYEN VAN A',
        webhookSecret: 'sec_1234567890abcdef',
      };

      const parsed = workspacePaymentSettingsSchema.parse(validPayload);
      assert.strictEqual(parsed.bankBin, '970422');
      assert.strictEqual(parsed.bankCode, 'MB');
      assert.strictEqual(parsed.accountNumber, '103888325398');
      assert.strictEqual(parsed.accountName, 'NGUYEN VAN A');
      assert.strictEqual(parsed.webhookSecret, 'sec_1234567890abcdef');
    });

    it('should accept valid payload without optional webhookSecret, bankCode, and bankName', () => {
      const minimalPayload = {
        bankBin: '970436',
        accountNumber: '0071000123456',
        accountName: 'CONG TY TNHH KAKA',
      };

      const parsed = workspacePaymentSettingsSchema.parse(minimalPayload);
      assert.strictEqual(parsed.bankBin, '970436');
      assert.strictEqual(parsed.accountNumber, '0071000123456');
      assert.strictEqual(parsed.accountName, 'CONG TY TNHH KAKA');
      assert.strictEqual(parsed.webhookSecret, undefined);
    });

    it('should reject payload with empty bankBin', () => {
      const invalid = {
        bankBin: '',
        accountNumber: '123456789',
        accountName: 'TRAN VAN B',
      };

      assert.throws(() => workspacePaymentSettingsSchema.parse(invalid), {
        name: 'ZodError',
      });
    });

    it('should reject payload with empty accountNumber', () => {
      const invalid = {
        bankBin: '970422',
        accountNumber: '',
        accountName: 'TRAN VAN B',
      };

      assert.throws(() => workspacePaymentSettingsSchema.parse(invalid), {
        name: 'ZodError',
      });
    });

    it('should reject payload with empty accountName', () => {
      const invalid = {
        bankBin: '970422',
        accountNumber: '123456789',
        accountName: '',
      };

      assert.throws(() => workspacePaymentSettingsSchema.parse(invalid), {
        name: 'ZodError',
      });
    });
  });

  describe('Vietnam Banks NAPAS Constants', () => {
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

    it('should correctly detect VietinBank special case prefixes for SEVQR auto-reconciliation', () => {
      const isVietinBank = (bankBin: string, bankCode: string, bankName: string) =>
        bankBin === '970415' ||
        bankCode.toUpperCase() === 'CTG' ||
        bankCode.toUpperCase() === 'ICB' ||
        bankName.toLowerCase().includes('vietin');

      assert.strictEqual(isVietinBank('970415', 'CTG', 'VietinBank'), true);
      assert.strictEqual(isVietinBank('970422', 'MB', 'MBBank'), false);
      assert.strictEqual(isVietinBank('970436', 'VCB', 'Vietcombank'), false);
      assert.strictEqual(isVietinBank('', 'ICB', 'Ngân hàng Công thương'), true);
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

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = url.toString();
        requestedMethod = init?.method || '';
        requestedBody = (init?.body as string) || '';
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
      assert.strictEqual(res.data.bankBin, '970415');
      assert.strictEqual(res.data.accountNumber, '109988776655');
    });
  });
});
