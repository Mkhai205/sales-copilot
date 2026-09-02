import type { HelmetOptions } from 'helmet';

/**
 * Centralized Helmet security headers configuration for Sales Copilot API.
 *
 * Enforces:
 * - Content-Security-Policy (CSP): Strict directives restricting script, style, and media sources
 * - Strict-Transport-Security (HSTS): 1-year max-age with subdomains and preload
 * - X-Frame-Options: SAMEORIGIN (prevents clickjacking attacks)
 * - X-Content-Type-Options: nosniff (prevents MIME-type confusion attacks)
 * - Cross-Origin-Resource-Policy: cross-origin (allows cross-origin resource access for frontend)
 */
export const HELMET_CONFIG: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline permitted for Swagger UI
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'sameorigin',
  },
  noSniff: true,
};
