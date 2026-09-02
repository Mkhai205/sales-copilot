import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { pinoRedactConfig, REDACTION_CENSOR, REDACT_PATHS } from '../logging';

describe('Structured Logging & Redaction (Task 7 — Feature F-1.11.3)', () => {
  const createTestLogger = (sink: (logObj: Record<string, any>) => void) => {
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        try {
          const parsed = JSON.parse(chunk.toString());
          sink(parsed);
        } catch {
          // ignore non-json
        }
        callback();
      },
    });

    return pino({ redact: pinoRedactConfig }, stream);
  };

  const createTestPinoHttp = (sink: (logObj: Record<string, any>) => void) => {
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        try {
          const parsed = JSON.parse(chunk.toString());
          sink(parsed);
        } catch {
          // ignore non-json
        }
        callback();
      },
    });

    return pinoHttp(
      {
        redact: pinoRedactConfig,
        autoLogging: true,
        serializers: {
          req: (req: any) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
        },
      },
      stream,
    );
  };

  describe('Pino Redaction Configuration', () => {
    it('should verify standard [REDACTED] censor and key redaction paths', () => {
      assert.strictEqual(REDACTION_CENSOR, '[REDACTED]');
      assert.ok(Array.isArray(REDACT_PATHS));
      assert.ok(REDACT_PATHS.length >= 25);

      // Verify headers
      assert.ok(REDACT_PATHS.includes('req.headers.authorization'));
      assert.ok(REDACT_PATHS.includes('req.headers.cookie'));
      assert.ok(REDACT_PATHS.includes('req.headers["set-cookie"]'));
      assert.ok(REDACT_PATHS.includes('res.headers["set-cookie"]'));

      // Verify passwords & keys
      assert.ok(REDACT_PATHS.includes('password'));
      assert.ok(REDACT_PATHS.includes('*.password'));
      assert.ok(REDACT_PATHS.includes('*[*].password'));
      assert.ok(REDACT_PATHS.includes('currentPassword'));
      assert.ok(REDACT_PATHS.includes('newPassword'));
      assert.ok(REDACT_PATHS.includes('channelEncryptionKey'));

      // Verify tokens & secrets
      assert.ok(REDACT_PATHS.includes('accessToken'));
      assert.ok(REDACT_PATHS.includes('refreshToken'));
      assert.ok(REDACT_PATHS.includes('token'));
      assert.ok(REDACT_PATHS.includes('pageAccessToken'));
      assert.ok(REDACT_PATHS.includes('credentials'));
      assert.ok(REDACT_PATHS.includes('appSecret'));
      assert.ok(REDACT_PATHS.includes('webhookSecret'));
      assert.ok(REDACT_PATHS.includes('secretKey'));

      // Verify PII
      assert.ok(REDACT_PATHS.includes('email'));
      assert.ok(REDACT_PATHS.includes('phone'));
      assert.ok(REDACT_PATHS.includes('phoneNumber'));
    });
  });

  describe('Password & Secret Redaction Verification', () => {
    it('should redact top-level, nested, and array passwords to [REDACTED]', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        password: 'super_secret_plain_pass_123',
        auth: {
          currentPassword: 'old_pass_456',
          newPassword: 'new_pass_789',
          nested: {
            password: 'deep_pass_012',
          },
        },
        members: [
          { id: 'usr_1', password: 'member_pass_1' },
          { id: 'usr_2', password: 'member_pass_2' },
        ],
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.password, '[REDACTED]');
      assert.strictEqual(entry.auth.currentPassword, '[REDACTED]');
      assert.strictEqual(entry.auth.newPassword, '[REDACTED]');
      assert.strictEqual(entry.auth.nested.password, '[REDACTED]');
      assert.strictEqual(entry.members[0].password, '[REDACTED]');
      assert.strictEqual(entry.members[1].password, '[REDACTED]');
      assert.strictEqual(entry.members[0].id, 'usr_1');
    });

    it('should redact appSecret, webhookSecret, secretKey, and channelEncryptionKey', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        channelEncryptionKey: 'aes256_key_32bytes_sample_here',
        integrations: {
          fb: {
            appSecret: 'fb_secret_abc123',
          },
          webhook: {
            webhookSecret: 'wh_secret_xyz789',
            secretKey: 'custom_hmac_key_999',
          },
        },
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.channelEncryptionKey, '[REDACTED]');
      assert.strictEqual(entry.integrations.fb.appSecret, '[REDACTED]');
      assert.strictEqual(entry.integrations.webhook.webhookSecret, '[REDACTED]');
      assert.strictEqual(entry.integrations.webhook.secretKey, '[REDACTED]');
    });
  });

  describe('Token & Channel Credentials Redaction Verification', () => {
    it('should redact accessToken, refreshToken, token, and channel credentials', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
        token: 'bot_token_123456:abcdef',
        channel: {
          id: 'ch_fb_123',
          pageAccessToken: 'EAABsb...page_token',
          credentials: {
            appId: 'fb_app_123',
            token: 'fb_access_token_secret',
          },
        },
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.accessToken, '[REDACTED]');
      assert.strictEqual(entry.refreshToken, '[REDACTED]');
      assert.strictEqual(entry.token, '[REDACTED]');
      assert.strictEqual(entry.channel.pageAccessToken, '[REDACTED]');
      assert.strictEqual(entry.channel.credentials, '[REDACTED]');
      assert.strictEqual(entry.channel.id, 'ch_fb_123');
    });
  });

  describe('PII Redaction Verification', () => {
    it('should redact email, phone, and phoneNumber across objects and arrays', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        user: {
          id: 'usr_admin',
          name: 'Sales Manager',
          email: 'manager@salescopilot.vn',
          phone: '+84901234567',
        },
        customers: [
          { id: 'cnt_1', email: 'cust1@example.com', phoneNumber: '0901112222' },
          { id: 'cnt_2', email: 'cust2@example.com', phoneNumber: '0903334444' },
        ],
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.user.id, 'usr_admin');
      assert.strictEqual(entry.user.name, 'Sales Manager');
      assert.strictEqual(entry.user.email, '[REDACTED]');
      assert.strictEqual(entry.user.phone, '[REDACTED]');
      assert.strictEqual(entry.customers[0].email, '[REDACTED]');
      assert.strictEqual(entry.customers[0].phoneNumber, '[REDACTED]');
      assert.strictEqual(entry.customers[1].email, '[REDACTED]');
      assert.strictEqual(entry.customers[1].phoneNumber, '[REDACTED]');
    });
  });

  describe('HTTP Headers & Request Body Redaction via pinoHttp', () => {
    it('should redact authorization, cookie, set-cookie and sensitive request body', () => {
      const logs: Record<string, any>[] = [];
      const middleware = createTestPinoHttp(l => logs.push(l));

      const req: any = {
        headers: {
          authorization: 'Bearer jwt_secret_value_123',
          cookie: 'session_id=s%3Axyz.123; refresh_token=jwt_refresh',
          'set-cookie': 'session_id=new_s%3Aabc; HttpOnly; Path=/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'content-type': 'application/json',
          'x-request-id': 'req-test-uuid-999',
        },
        method: 'POST',
        url: '/api/v1/auth/login',
      };

      const res: any = new EventEmitter();
      res.setHeader = () => {};
      res.getHeader = () => {};
      res.statusCode = 200;

      middleware(req, res);
      req.log.info(
        {
          req,
          body: {
            email: 'agent@company.com',
            password: 'plain_user_password',
            twoFactorToken: '123456',
          },
        },
        'User login processed',
      );

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];

      // Headers redacted
      assert.strictEqual(entry.req.headers.authorization, '[REDACTED]');
      assert.strictEqual(entry.req.headers.cookie, '[REDACTED]');
      assert.strictEqual(entry.req.headers['set-cookie'], '[REDACTED]');

      // Headers preserved
      assert.strictEqual(
        entry.req.headers['user-agent'],
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      );
      assert.strictEqual(entry.req.headers['content-type'], 'application/json');
      assert.strictEqual(entry.req.headers['x-request-id'], 'req-test-uuid-999');

      // Request body sensitive fields redacted
      assert.strictEqual(entry.body.password, '[REDACTED]');
      assert.strictEqual(entry.body.email, '[REDACTED]');
      assert.strictEqual(entry.body.twoFactorToken, '123456');
    });
  });
});
