import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom Throttler Guard for deployments behind reverse proxies and Cloudflare Tunnel.
 * Accurately extracts the real client IP address by checking proxy headers in order:
 * 1. CF-Connecting-IP (Cloudflare)
 * 2. X-Forwarded-For (First client IP in comma-separated list)
 * 3. X-Real-IP (Standard reverse proxy)
 * 4. Express req.ips / req.ip fallback
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    // 1. Cloudflare / Cloudflare Tunnel
    const cfConnectingIp = req.headers?.['cf-connecting-ip'];
    if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
      return cfConnectingIp.trim();
    }

    // 2. Standard X-Forwarded-For header (client, proxy1, proxy2)
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
      return xForwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
      return xForwardedFor[0].split(',')[0].trim();
    }

    // 3. X-Real-IP header
    const xRealIp = req.headers?.['x-real-ip'];
    if (typeof xRealIp === 'string' && xRealIp.trim()) {
      return xRealIp.trim();
    }

    // 4. Express req.ips array (when trust proxy is enabled)
    if (Array.isArray(req.ips) && req.ips.length > 0) {
      return req.ips[0];
    }

    // 5. Direct socket connection fallback
    return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
  }
}
