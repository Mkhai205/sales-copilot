import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  generateWebhookSecret,
  computeWebhookSignature,
  verifyWebhookSignature,
} from '../webhook-signer';

describe('WebhookSigner (HMAC-SHA256 Signing & Verification)', () => {
  const secret = 'test-signing-secret-12345678';
  const payload = {
    event: 'message.created',
    data: {
      id: 'msg_123',
      content: 'Hello World',
    },
    timestamp: 1724600000000,
  };

  it('should generate a cryptographic random hex secret of expected length', () => {
    const secret32 = generateWebhookSecret(32);
    assert.strictEqual(typeof secret32, 'string');
    assert.strictEqual(secret32.length, 64); // 32 bytes = 64 hex chars

    const secret16 = generateWebhookSecret(16);
    assert.strictEqual(secret16.length, 32); // 16 bytes = 32 hex chars

    assert.notStrictEqual(secret32, generateWebhookSecret(32));
  });

  it('should compute deterministic HMAC-SHA256 signature for object payload', () => {
    const sig1 = computeWebhookSignature(payload, secret);
    const sig2 = computeWebhookSignature(payload, secret);

    assert.strictEqual(typeof sig1, 'string');
    assert.strictEqual(sig1.length, 64);
    assert.strictEqual(sig1, sig2);
  });

  it('should compute deterministic HMAC-SHA256 signature for string payload', () => {
    const stringPayload = JSON.stringify(payload);
    const sig = computeWebhookSignature(stringPayload, secret);

    assert.strictEqual(typeof sig, 'string');
    assert.strictEqual(sig.length, 64);
  });

  it('should verify valid signature successfully (both raw hex and sha256= prefix)', () => {
    const sig = computeWebhookSignature(payload, secret);

    const isValidRaw = verifyWebhookSignature(payload, sig, secret);
    assert.strictEqual(isValidRaw, true);

    const isValidPrefixed = verifyWebhookSignature(payload, `sha256=${sig}`, secret);
    assert.strictEqual(isValidPrefixed, true);
  });

  it('should reject tampered payload', () => {
    const sig = computeWebhookSignature(payload, secret);

    const tamperedPayload = {
      ...payload,
      data: { id: 'msg_123', content: 'Tampered content' },
    };

    const isValid = verifyWebhookSignature(tamperedPayload, sig, secret);
    assert.strictEqual(isValid, false);
  });

  it('should reject signature generated with a different secret', () => {
    const sig = computeWebhookSignature(payload, secret);
    const wrongSecret = 'wrong-secret-87654321';

    const isValid = verifyWebhookSignature(payload, sig, wrongSecret);
    assert.strictEqual(isValid, false);
  });

  it('should reject invalid or malformed signature strings safely without throwing', () => {
    assert.strictEqual(verifyWebhookSignature(payload, '', secret), false);
    assert.strictEqual(verifyWebhookSignature(payload, 'not-a-hex-signature', secret), false);
    assert.strictEqual(verifyWebhookSignature(payload, 'abc', secret), false);
    assert.strictEqual(verifyWebhookSignature(payload, 'sha256=short', secret), false);
    assert.strictEqual(verifyWebhookSignature(payload, '1234', ''), false);
  });
});
