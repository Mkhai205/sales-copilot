import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { pinoRedactConfig, REDACTION_CENSOR, REDACT_PATHS } from '../logging';

describe('Sensitive Data Redaction (Task 6 — Feature F-1.11.3)', () => {
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

  it('should verify censor constant and essential paths are defined', () => {
    assert.strictEqual(REDACTION_CENSOR, '[REDACTED]');
    assert.ok(REDACT_PATHS.length > 20);
    assert.ok(REDACT_PATHS.includes('req.headers.authorization'));
    assert.ok(REDACT_PATHS.includes('req.headers.cookie'));
    assert.ok(REDACT_PATHS.includes('password'));
    assert.ok(REDACT_PATHS.includes('*.password'));
    assert.ok(REDACT_PATHS.includes('accessToken'));
    assert.ok(REDACT_PATHS.includes('credentials'));
    assert.ok(REDACT_PATHS.includes('email'));
    assert.ok(REDACT_PATHS.includes('phone'));
  });

  describe('Password & Secret Redaction', () => {
    it('should redact top-level and nested passwords to [REDACTED]', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        password: 'super_secret_plain_pass_123',
        user: {
          name: 'Alice Agent',
          password: 'nested_password_456',
          currentPassword: 'current_secret_789',
          newPassword: 'new_secret_012',
        },
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.password, '[REDACTED]');
      assert.strictEqual(entry.user.password, '[REDACTED]');
      assert.strictEqual(entry.user.currentPassword, '[REDACTED]');
      assert.strictEqual(entry.user.newPassword, '[REDACTED]');
      assert.strictEqual(entry.user.name, 'Alice Agent');
    });

    it('should redact passwords inside arrays of objects', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        users: [
          { id: 'usr_1', password: 'pass_1' },
          { id: 'usr_2', password: 'pass_2' },
        ],
      });

      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].users[0].password, '[REDACTED]');
      assert.strictEqual(logs[0].users[1].password, '[REDACTED]');
      assert.strictEqual(logs[0].users[0].id, 'usr_1');
    });

    it('should redact app secrets, webhook secrets, and encryption keys', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        channelEncryptionKey: '0123456789abcdef0123456789abcdef',
        fbConfig: {
          appSecret: 'fb_secret_key_123',
          webhookSecret: 'wh_secret_xyz',
          secretKey: 'custom_signing_key_456',
        },
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.channelEncryptionKey, '[REDACTED]');
      assert.strictEqual(entry.fbConfig.appSecret, '[REDACTED]');
      assert.strictEqual(entry.fbConfig.webhookSecret, '[REDACTED]');
      assert.strictEqual(entry.fbConfig.secretKey, '[REDACTED]');
    });
  });

  describe('Token & Credential Redaction', () => {
    it('should redact accessToken, refreshToken, token, and channel credentials', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        accessToken: 'jwt.access.token.string',
        refreshToken: 'jwt.refresh.token.string',
        channel: {
          pageAccessToken: 'EAABsb...page_token',
          credentials: {
            appId: '123456',
            token: 'telegram_bot_token:secret',
          },
        },
      });

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.accessToken, '[REDACTED]');
      assert.strictEqual(entry.refreshToken, '[REDACTED]');
      assert.strictEqual(entry.channel.pageAccessToken, '[REDACTED]');
      assert.strictEqual(entry.channel.credentials, '[REDACTED]');
    });
  });

  describe('PII (Personal Identifiable Information) Redaction', () => {
    it('should redact email, phone, and phoneNumber while preserving non-PII attributes', () => {
      const logs: Record<string, any>[] = [];
      const logger = createTestLogger(l => logs.push(l));

      logger.info({
        contact: {
          id: 'cnt_123',
          name: 'Nguyen Van A',
          email: 'nguyen.a@example.com',
          phone: '+84987654321',
          phoneNumber: '0987654321',
        },
      });

      assert.strictEqual(logs.length, 1);
      const contact = logs[0].contact;
      assert.strictEqual(contact.id, 'cnt_123');
      assert.strictEqual(contact.name, 'Nguyen Van A');
      assert.strictEqual(contact.email, '[REDACTED]');
      assert.strictEqual(contact.phone, '[REDACTED]');
      assert.strictEqual(contact.phoneNumber, '[REDACTED]');
    });
  });

  describe('HTTP Headers & Request Body Redaction via pinoHttp', () => {
    it('should redact authorization, cookie, and set-cookie headers', () => {
      const logs: Record<string, any>[] = [];
      const middleware = createTestPinoHttp(l => logs.push(l));

      const req: any = {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive',
          cookie: 'access_token=secret_jwt; refresh_token=secret_ref',
          'set-cookie': 'session=abc; Path=/',
          'user-agent': 'Mozilla/5.0 TestBrowser',
          'content-type': 'application/json',
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
            email: 'admin@sales.vn',
            password: 'myPassword123',
          },
        },
        'Login attempt',
      );

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.req.headers.authorization, '[REDACTED]');
      assert.strictEqual(entry.req.headers.cookie, '[REDACTED]');
      assert.strictEqual(entry.req.headers['set-cookie'], '[REDACTED]');
      assert.strictEqual(entry.req.headers['user-agent'], 'Mozilla/5.0 TestBrowser');
      assert.strictEqual(entry.req.headers['content-type'], 'application/json');

      assert.strictEqual(entry.body.password, '[REDACTED]');
      assert.strictEqual(entry.body.email, '[REDACTED]');
    });
  });
});
