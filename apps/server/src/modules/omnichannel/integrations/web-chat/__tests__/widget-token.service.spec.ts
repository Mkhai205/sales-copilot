import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WidgetTokenPayload, WidgetTokenService } from '../widget-token.service';

describe('WidgetTokenService (Visitor JWT Token Issuance & Verification)', () => {
  let service: WidgetTokenService;
  let mockConfigService: any;
  let mockJwtService: any;

  const mockPayload: WidgetTokenPayload = {
    contactId: 'cont_123',
    workspaceId: 'ws_abc',
    channelId: 'chan_xyz',
    inboxId: 'inbox_789',
    externalContactId: 'anon_visitor_001',
    widgetToken: 'wt_token_sample',
    identifier: 'ident_user',
  };

  beforeEach(() => {
    mockConfigService = {
      get: (key: string, defaultValue?: any) => {
        if (key === 'WIDGET_TOKEN_SECRET') return 'test_widget_secret_key_12345';
        if (key === 'WIDGET_TOKEN_EXPIRY_DAYS') return 180;
        return defaultValue;
      },
    };

    service = new WidgetTokenService(mockConfigService as ConfigService);
  });

  describe('generateToken() & verifyToken()', () => {
    it('should generate a valid JWT token and verify it accurately', () => {
      const token = service.generateToken(mockPayload);

      assert.strictEqual(typeof token, 'string');
      assert.ok(token.split('.').length === 3);

      const decoded = service.verifyToken(token);

      assert.strictEqual(decoded.contactId, mockPayload.contactId);
      assert.strictEqual(decoded.workspaceId, mockPayload.workspaceId);
      assert.strictEqual(decoded.channelId, mockPayload.channelId);
      assert.strictEqual(decoded.inboxId, mockPayload.inboxId);
      assert.strictEqual(decoded.externalContactId, mockPayload.externalContactId);
      assert.strictEqual(decoded.widgetToken, mockPayload.widgetToken);
      assert.strictEqual(decoded.identifier, mockPayload.identifier);
    });

    it('should support Bearer prefix during verification', () => {
      const token = service.generateToken(mockPayload);
      const decoded = service.verifyToken(`Bearer ${token}`);

      assert.strictEqual(decoded.contactId, mockPayload.contactId);
    });

    it('should work with JwtService if injected', () => {
      mockJwtService = new JwtService();
      const serviceWithJwt = new WidgetTokenService(
        mockConfigService as ConfigService,
        mockJwtService,
      );

      const token = serviceWithJwt.generateToken(mockPayload);
      const decoded = serviceWithJwt.verifyToken(token);

      assert.strictEqual(decoded.contactId, mockPayload.contactId);
    });

    it('should support configurable expiration via WIDGET_TOKEN_EXPIRY_SECONDS', () => {
      const customConfig: any = {
        get: (key: string, defaultValue?: any) => {
          if (key === 'WIDGET_TOKEN_EXPIRY_SECONDS') return 3600;
          return defaultValue;
        },
      };

      const customService = new WidgetTokenService(customConfig as ConfigService);
      const token = customService.generateToken(mockPayload);
      const decoded = customService.verifyToken(token);
      assert.strictEqual(decoded.contactId, mockPayload.contactId);
    });

    it('should throw UnauthorizedException when token is missing or empty', () => {
      assert.throws(() => service.verifyToken(''), {
        name: 'UnauthorizedException',
      });
      assert.throws(() => service.verifyToken(undefined), {
        name: 'UnauthorizedException',
      });
    });

    it('should throw UnauthorizedException when token signature is invalid', () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid_signature';

      assert.throws(() => service.verifyToken(invalidToken), {
        name: 'UnauthorizedException',
      });
    });

    it('should throw UnauthorizedException when token is expired', () => {
      // Generate token expiring immediately (-10 seconds)
      const token = service.generateToken(mockPayload, -10);

      assert.throws(() => service.verifyToken(token), {
        name: 'UnauthorizedException',
      });
    });
  });

  describe('extractToken()', () => {
    it('should extract token from Authorization Bearer header', () => {
      const headers = { authorization: 'Bearer token_from_bearer' };
      const extracted = service.extractToken(headers);

      assert.strictEqual(extracted, 'token_from_bearer');
    });

    it('should extract token from x-auth-token header', () => {
      const headers = { 'x-auth-token': 'token_from_x_auth' };
      const extracted = service.extractToken(headers);

      assert.strictEqual(extracted, 'token_from_x_auth');
    });

    it('should extract token from query parameters', () => {
      const query = { token: 'token_from_query' };
      const extracted = service.extractToken({}, query);

      assert.strictEqual(extracted, 'token_from_query');
    });

    it('should extract cw_conversation token from query parameters', () => {
      const query = { cw_conversation: 'token_from_cw' };
      const extracted = service.extractToken({}, query);

      assert.strictEqual(extracted, 'token_from_cw');
    });

    it('should return undefined when no token is present', () => {
      const extracted = service.extractToken({}, {});
      assert.strictEqual(extracted, undefined);
    });
  });

  describe('HMAC identity verification (setUser)', () => {
    const identifier = 'user_identifier_123';
    const secret = 'super_secret_hmac_key_456';

    it('should generate valid HMAC-SHA256 signature', () => {
      const signature = service.generateHmacSignature(identifier, secret);
      assert.strictEqual(signature.length, 64);
      assert.match(signature, /^[0-9a-f]+$/);
    });

    it('should return true for matching signature', () => {
      const signature = service.generateHmacSignature(identifier, secret);
      assert.strictEqual(service.verifyHmacSignature(identifier, signature, secret), true);
    });

    it('should strip sha256= prefix during verification', () => {
      const signature = service.generateHmacSignature(identifier, secret);
      assert.strictEqual(
        service.verifyHmacSignature(identifier, `sha256=${signature}`, secret),
        true,
      );
    });

    it('should return false for mismatched signature or secret', () => {
      const signature = service.generateHmacSignature(identifier, secret);
      assert.strictEqual(service.verifyHmacSignature(identifier, 'invalid_sig', secret), false);
      assert.strictEqual(service.verifyHmacSignature(identifier, signature, 'wrong_secret'), false);
      assert.strictEqual(service.verifyHmacSignature('different_user', signature, secret), false);
    });

    it('should return false when arguments are missing or empty', () => {
      assert.strictEqual(service.verifyHmacSignature('', 'sig', secret), false);
      assert.strictEqual(service.verifyHmacSignature(identifier, '', secret), false);
      assert.strictEqual(service.verifyHmacSignature(identifier, 'sig', ''), false);
    });
  });
});
