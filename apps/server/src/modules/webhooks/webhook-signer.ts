import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random webhook secret.
 * @param byteLength Number of random bytes (default 32 -> 64 hex characters)
 */
export function generateWebhookSecret(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Computes an HMAC-SHA256 signature for a webhook payload.
 * @param payload Payload string or object
 * @param secret HMAC secret key
 * @returns Hex-encoded HMAC-SHA256 signature string
 */
export function computeWebhookSignature(
  payload: string | Record<string, unknown>,
  secret: string,
): string {
  const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(content, 'utf8').digest('hex');
}

/**
 * Verifies an HMAC-SHA256 signature against the payload and secret using constant-time comparison.
 * Supports both raw hex signatures and 'sha256=' prefixed signatures.
 *
 * @param payload Payload string or object
 * @param signature Signature received from header (e.g. X-Webhook-Signature)
 * @param secret HMAC secret key
 * @returns True if signature is valid, false otherwise
 */
export function verifyWebhookSignature(
  payload: string | Record<string, unknown>,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const cleanSignature = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length).trim()
    : signature.trim();

  const expectedSignature = computeWebhookSignature(payload, secret);

  const signatureBuffer = Buffer.from(cleanSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    signatureBuffer.length === 0 ||
    expectedBuffer.length === 0
  ) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}
