/**
 * Standard censor string replacing sensitive data in structured logs.
 */
export const REDACTION_CENSOR = '[REDACTED]';

/**
 * Property paths to redact across all log entries (root, nested, arrays, headers, body).
 */
export const REDACT_PATHS = [
  // HTTP Headers
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'res.headers["set-cookie"]',

  // Passwords & Encryption Keys
  'password',
  '*.password',
  '*.*.password',
  '*[*].password',
  'currentPassword',
  '*.currentPassword',
  'newPassword',
  '*.newPassword',
  'channelEncryptionKey',
  '*.channelEncryptionKey',

  // Authentication & Integration Tokens
  'token',
  '*.token',
  '*.*.token',
  'accessToken',
  '*.accessToken',
  '*.*.accessToken',
  '*[*].accessToken',
  'refreshToken',
  '*.refreshToken',
  '*.*.refreshToken',
  '*[*].refreshToken',
  'pageAccessToken',
  '*.pageAccessToken',
  '*.*.pageAccessToken',

  // Secrets
  'appSecret',
  '*.appSecret',
  '*.*.appSecret',
  'webhookSecret',
  '*.webhookSecret',
  '*.*.webhookSecret',
  'secretKey',
  '*.secretKey',
  '*.*.secretKey',

  // Credentials
  'credentials',
  '*.credentials',
  '*.*.credentials',
  '*[*].credentials',

  // PII (Personally Identifiable Information)
  'email',
  '*.email',
  '*.*.email',
  '*[*].email',
  'phone',
  '*.phone',
  '*.*.phone',
  '*[*].phone',
  'phoneNumber',
  '*.phoneNumber',
  '*.*.phoneNumber',
  '*[*].phoneNumber',

  // Request Body explicitly
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.credentials',
  'req.body.pageAccessToken',
  'req.body.appSecret',
  'req.body.webhookSecret',
  'req.body.secretKey',
  'req.body.email',
  'req.body.phone',
  'req.body.phoneNumber',
];

/**
 * Pino redaction options object.
 */
export const pinoRedactConfig = {
  paths: REDACT_PATHS,
  censor: REDACTION_CENSOR,
};
