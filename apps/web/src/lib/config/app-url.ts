/**
 * Application URL and BaseUrl Configuration for Sales Copilot Web.
 * Provides a unified Single Source of Truth for resolving the root application URL,
 * API base URL, and detecting local development environments.
 */

/**
 * Resolves the root application URL dynamically.
 * - In browser context: dynamically returns `window.location.origin` (or overrideOrigin if supplied)
 * - In SSR / build context: falls back to `process.env.NEXT_PUBLIC_APP_URL` or `http://localhost:3000`
 *
 * @param overrideOrigin Optional override URL to prioritize
 * @returns Fully qualified root application URL (without trailing slash)
 */
export function getAppUrl(overrideOrigin?: string): string {
  if (overrideOrigin && typeof overrideOrigin === 'string' && overrideOrigin.trim().length > 0) {
    return overrideOrigin.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '');
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}

/**
 * Detects whether an origin or URL represents a local machine (localhost / loopback IP).
 * Used to trigger informational warnings/badges for webhooks that require a public tunnel.
 *
 * @param originOrUrl Hostname, origin, or URL to inspect
 */
export function isLocalhostOrigin(originOrUrl?: string | null): boolean {
  if (!originOrUrl || typeof originOrUrl !== 'string') return false;

  try {
    const raw = originOrUrl.trim();
    const url = new URL(
      raw.startsWith('http://') || raw.startsWith('https://') ? raw : `http://${raw}`,
    );
    const host = url.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost')
    );
  } catch {
    const lower = originOrUrl.toLowerCase();
    return lower.includes('localhost') || lower.includes('127.0.0.1') || lower.includes('0.0.0.0');
  }
}
