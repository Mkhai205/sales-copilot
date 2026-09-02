import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * Standard allowed HTTP methods for Sales Copilot REST API.
 */
export const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

/**
 * Standard allowed request headers.
 */
export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Accept',
  'Authorization',
  'X-Requested-With',
  'X-Request-Id',
  'X-Workspace-Id',
  'X-Hub-Signature-256',
  'X-Webhook-Signature',
  'CF-Connecting-IP',
];

/**
 * Standard headers exposed to the client in cross-origin responses.
 */
export const CORS_EXPOSED_HEADERS = [
  'X-Request-Id',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
];

/**
 * Constructs a strict CorsOptions configuration object.
 *
 * @param origins - Allowed origin URL strings (e.g. ['http://localhost:3000'])
 * @returns NestJS/Express CorsOptions
 */
export function createCorsOptions(
  origins: string[] | string = ['http://localhost:3000'],
): CorsOptions {
  const allowedList = Array.isArray(origins) ? origins : [origins];

  const sanitizedOrigins = allowedList
    .map(o => (typeof o === 'string' ? o.trim() : o))
    .filter(Boolean);

  return {
    origin: sanitizedOrigins.length > 0 ? sanitizedOrigins : ['http://localhost:3000'],
    credentials: true,
    methods: CORS_ALLOWED_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    exposedHeaders: CORS_EXPOSED_HEADERS,
    maxAge: 86400, // 24 hours preflight cache
  };
}
