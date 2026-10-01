import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Shared OAuth-callback helper: safely determines the frontend application URL for
 * redirecting back after an external provider (Facebook, Zalo, ...) authorization,
 * preventing open redirects to provider domains or unverified origins.
 */

const BLOCKED_PROVIDER_DOMAINS = ['facebook.com', 'meta.com', 'zalo.me', 'zalo.vn', 'zdn.vn'];

export function resolveFrontendUrl(
  configService: ConfigService,
  candidateOrigin?: string,
  req?: Request,
): string {
  const corsOrigins = configService.get<string[]>('CORS_ORIGIN') || [];
  const validOrigins = corsOrigins.filter(
    o => o && o !== 'null' && !o.includes('web:') && !isBlockedProviderHost(o),
  );

  // 1. Explicit candidate origin (from query param or Redis session)
  if (candidateOrigin && isValidFrontendOrigin(configService, candidateOrigin)) {
    return new URL(candidateOrigin).origin;
  }

  // 2. Request Origin header (valid frontend app)
  const originHeader = req?.headers?.origin as string | undefined;
  if (originHeader && isValidFrontendOrigin(configService, originHeader)) {
    return new URL(originHeader).origin;
  }

  // 3. Request Referer header ONLY IF NOT a provider domain
  const refererHeader = req?.headers?.referer as string | undefined;
  if (refererHeader && isValidFrontendOrigin(configService, refererHeader)) {
    return new URL(refererHeader).origin;
  }

  // 4. Domain matching with WEBHOOK_BASE_URL (single-domain setup or tunnel)
  const webhookBaseUrl = configService.get<string>('WEBHOOK_BASE_URL') || '';
  if (webhookBaseUrl) {
    try {
      const webhookOrigin = new URL(webhookBaseUrl).origin;
      const matchingOrigin = validOrigins.find(o => {
        try {
          return new URL(o).origin === webhookOrigin;
        } catch {
          return o === webhookOrigin;
        }
      });
      if (matchingOrigin) {
        return new URL(matchingOrigin).origin;
      }
      return webhookOrigin;
    } catch {
      // Invalid webhookBaseUrl URL, continue to fallbacks
    }
  }

  // 5. Prefer HTTPS origins from CORS_ORIGIN
  const httpsOrigin = validOrigins.find(o => o.startsWith('https://'));
  if (httpsOrigin) {
    return new URL(httpsOrigin).origin;
  }

  // 6. Safe fallback (first valid origin or localhost:3000)
  return (validOrigins[0] || 'http://localhost:3000').replace(/\/+$/, '');
}

export function isValidFrontendOrigin(configService: ConfigService, candidate: string): boolean {
  if (!candidate || candidate === 'null') return false;
  if (isBlockedProviderHost(candidate)) return false;

  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const normalized = u.origin;
    const webhookBaseUrl = configService.get<string>('WEBHOOK_BASE_URL') || '';
    let webhookOrigin = '';
    let webhookHostname = '';
    if (webhookBaseUrl) {
      const whUrl = new URL(webhookBaseUrl);
      webhookOrigin = whUrl.origin;
      webhookHostname = whUrl.hostname;
    }

    const corsOrigins = configService.get<string[]>('CORS_ORIGIN') || [];
    return (
      corsOrigins.some(ao => {
        try {
          return new URL(ao).origin === normalized;
        } catch {
          return ao === normalized;
        }
      }) ||
      (Boolean(webhookOrigin) && normalized === webhookOrigin) ||
      (Boolean(webhookHostname) && u.hostname === webhookHostname) ||
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1'
    );
  } catch {
    return false;
  }
}

function isBlockedProviderHost(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  return BLOCKED_PROVIDER_DOMAINS.some(domain => lower.includes(domain));
}
