import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import * as crypto from 'crypto';
import { PaymentWebhooksGuard } from '../payment-webhooks.guard';
import { PaymentWebhooksController } from '../payment-webhooks.controller';

describe('PaymentWebhooks (SePay & Casso Webhook Controller & Guard)', () => {
  const wsId = 'ws-test-webhooks-123';
  const secretKey = 'my_super_secret_webhook_key';

  describe('PaymentWebhooksGuard', () => {
    let guard: PaymentWebhooksGuard;
    let mockPrismaService: any;
    let mockCredentialService: any;
    let clientMock: any;

    beforeEach(() => {
      clientMock = {
        workspace: {
          findUnique: async (args: any) => {
            if (args.where.id === wsId) {
              return {
                id: wsId,
                settings: {
                  paymentSettings: {
                    webhookSecret: secretKey,
                  },
                },
              };
            }
            return null;
          },
        },
      };

      mockPrismaService = {
        getClient: () => clientMock,
      };

      mockCredentialService = {
        decrypt: (val: string) => ({ secret: val }),
      };

      guard = new PaymentWebhooksGuard(mockPrismaService, mockCredentialService);
    });

    const createMockContext = (params: any, headers: any, body: any = {}) =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({
            params,
            headers,
            body,
            rawBody: JSON.stringify(body),
          }),
        }),
      }) as any;

    it('should allow access when Secure-Token matches webhook secret', async () => {
      const ctx = createMockContext(
        { workspaceId: wsId, gateway: 'sepay' },
        { 'secure-token': secretKey },
      );
      const allowed = await guard.canActivate(ctx);
      assert.strictEqual(allowed, true);
    });

    it('should allow access when x-api-key matches webhook secret', async () => {
      const ctx = createMockContext(
        { workspaceId: wsId, gateway: 'casso' },
        { 'x-api-key': secretKey },
      );
      const allowed = await guard.canActivate(ctx);
      assert.strictEqual(allowed, true);
    });

    it('should allow access when Authorization: Apikey matches secret', async () => {
      const ctx = createMockContext(
        { workspaceId: wsId, gateway: 'sepay' },
        { authorization: `Apikey ${secretKey}` },
      );
      const allowed = await guard.canActivate(ctx);
      assert.strictEqual(allowed, true);
    });

    it('should allow access when HMAC SHA256 signature is valid', async () => {
      const body = { id: 101, amount: 50000 };
      const rawBody = JSON.stringify(body);
      const hmac = crypto.createHmac('sha256', secretKey).update(rawBody).digest('hex');

      const ctx = createMockContext(
        { workspaceId: wsId, gateway: 'sepay' },
        { 'x-signature': hmac },
        body,
      );
      const allowed = await guard.canActivate(ctx);
      assert.strictEqual(allowed, true);
    });

    it('should allow access when rawBody is a Buffer and signature has sha256= prefix and uppercase hex', async () => {
      const body = { id: 102, amount: 150000 };
      const rawBodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
      const hmac = crypto.createHmac('sha256', secretKey).update(rawBodyBuffer).digest('hex');

      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({
            params: { workspaceId: wsId, gateway: 'sepay' },
            headers: { 'x-sepay-signature': `sha256=${hmac.toUpperCase()}` },
            body,
            rawBody: rawBodyBuffer,
          }),
        }),
      } as any;

      const allowed = await guard.canActivate(ctx);
      assert.strictEqual(allowed, true);
    });

    it('should reject when secret is incorrect (401 Unauthorized)', async () => {
      const ctx = createMockContext(
        { workspaceId: wsId, gateway: 'sepay' },
        { 'secure-token': 'wrong_secret' },
      );
      await assert.rejects(
        async () => {
          await guard.canActivate(ctx);
        },
        (err: any) => {
          assert.strictEqual(err.name, 'UnauthorizedException');
          assert.strictEqual(err.response?.code, 'INVALID_PAYMENT_WEBHOOK_SIGNATURE');
          return true;
        },
      );
    });

    it('should reject when workspace has no configured webhook secret', async () => {
      clientMock.workspace.findUnique = async () => ({
        id: wsId,
        settings: {},
      });

      const ctx = createMockContext(
        { workspaceId: wsId, gateway: 'sepay' },
        { 'secure-token': secretKey },
      );
      await assert.rejects(
        async () => {
          await guard.canActivate(ctx);
        },
        (err: any) => {
          assert.strictEqual(err.name, 'UnauthorizedException');
          assert.strictEqual(err.response?.code, 'PAYMENT_WEBHOOK_UNCONFIGURED');
          return true;
        },
      );
    });
  });

  describe('PaymentWebhooksController', () => {
    let controller: PaymentWebhooksController;
    let mockQueue: any;
    let enqueuedJobs: Array<{ name: string; data: any; opts: any }>;

    beforeEach(() => {
      enqueuedJobs = [];
      mockQueue = {
        add: async (name: string, data: any, opts: any) => {
          enqueuedJobs.push({ name, data, opts });
          return { id: opts?.jobId || 'job-id' };
        },
      };

      controller = new PaymentWebhooksController(mockQueue);
    });

    it('should fast-ACK and enqueue SePay payload with code: null', async () => {
      const sePayPayload = {
        id: 92704,
        gateway: 'MBBank',
        transactionDate: '2026-09-09 10:30:00',
        accountNumber: '0987654321',
        code: null, // SePay specific bug: code is null
        content: 'ORD 1004 thanh toan giay the thao',
        transferType: 'in',
        transferAmount: 450000,
        accumulated: 450000,
        referenceCode: 'FT262529182312',
      };

      const res = await controller.handleWebhook(wsId, 'sepay', sePayPayload);

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.queued, true);
      assert.strictEqual(res.count, 1);

      assert.strictEqual(enqueuedJobs.length, 1);
      const job = enqueuedJobs[0];
      assert.strictEqual(job.name, 'reconcile');
      assert.strictEqual(job.opts.jobId, 'sepay:92704');
      assert.strictEqual(job.data.workspaceId, wsId);
      assert.strictEqual(job.data.gateway, 'sepay');
      assert.strictEqual(job.data.amount, 450000);
      assert.strictEqual(job.data.accountNumber, '0987654321');
      assert.strictEqual(job.data.transferContent, 'ORD 1004 thanh toan giay the thao');
    });

    it('should fast-ACK and enqueue Casso array payload { error: 0, data: [...] }', async () => {
      const cassoPayload = {
        error: 0,
        messages: 'Ok',
        data: [
          {
            id: 8812,
            tid: 'CASSO_TID_001',
            description: 'DH 1005 chuyen khoan',
            amount: 250000,
            bank_sub_acc_id: '11223344',
            bankName: 'VCB',
            when: '2026-09-09 11:00:00',
          },
          {
            id: 8813,
            tid: 'CASSO_TID_002',
            description: 'SO 1006 thanh toan',
            amount: 300000,
            bank_sub_acc_id: '11223344',
            bankName: 'VCB',
            when: '2026-09-09 11:05:00',
          },
        ],
      };

      const res = await controller.handleWebhook(wsId, 'casso', cassoPayload);

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.queued, true);
      assert.strictEqual(res.count, 2);

      assert.strictEqual(enqueuedJobs.length, 2);
      assert.strictEqual(enqueuedJobs[0].opts.jobId, 'casso:8812');
      assert.strictEqual(enqueuedJobs[0].data.amount, 250000);
      assert.strictEqual(enqueuedJobs[1].opts.jobId, 'casso:8813');
      assert.strictEqual(enqueuedJobs[1].data.amount, 300000);
    });

    it('should skip outgoing/debit transfer items (transferType === "out")', async () => {
      const outgoingPayload = {
        id: 99999,
        transferType: 'out',
        transferAmount: 100000,
        content: 'ORD 1004 Rut tien ngan hang',
      };

      const res = await controller.handleWebhook(wsId, 'sepay', outgoingPayload);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 0);
      assert.strictEqual(enqueuedJobs.length, 0);
    });

    it('should skip items with non-positive amount (amount <= 0)', async () => {
      const zeroAmountPayload = {
        id: 99998,
        transferType: 'in',
        transferAmount: 0,
        content: 'ORD 1004',
      };

      const res = await controller.handleWebhook(wsId, 'sepay', zeroAmountPayload);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.count, 0);
      assert.strictEqual(enqueuedJobs.length, 0);
    });
  });
});
