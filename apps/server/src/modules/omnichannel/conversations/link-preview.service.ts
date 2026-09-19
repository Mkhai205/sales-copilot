import { Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/redis/redis.service';

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly REDIS_PREFIX = 'link_preview:';
  private readonly REDIS_TTL_SEC = 24 * 60 * 60; // 24 hours
  private readonly MAX_LRU_ENTRIES = 500;
  private readonly lruCache = new Map<string, { data: LinkPreviewData; expiresAt: number }>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(@Optional() private readonly redisService?: RedisService) {}

  private getFromLru(key: string): LinkPreviewData | null {
    const entry = this.lruCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.lruCache.delete(key);
      return null;
    }
    // Refresh LRU order
    this.lruCache.delete(key);
    this.lruCache.set(key, entry);
    return entry.data;
  }

  private setInLru(key: string, data: LinkPreviewData, ttlMs: number): void {
    if (this.lruCache.size >= this.MAX_LRU_ENTRIES) {
      const oldestKey = this.lruCache.keys().next().value;
      if (oldestKey) {
        this.lruCache.delete(oldestKey);
      }
    }
    this.lruCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  private async getCached(url: string): Promise<LinkPreviewData | null> {
    if (this.redisService?.getClient()) {
      try {
        const raw = await this.redisService.get(`${this.REDIS_PREFIX}${url}`);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        this.logger.debug(`Redis get error: ${(err as Error).message}`);
      }
    }
    return this.getFromLru(url);
  }

  private async setCached(url: string, data: LinkPreviewData, ttlMs = this.ttlMs): Promise<void> {
    this.setInLru(url, data, ttlMs);
    if (this.redisService?.getClient()) {
      try {
        const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
        await this.redisService.set(`${this.REDIS_PREFIX}${url}`, JSON.stringify(data), ttlSec);
      } catch (err) {
        this.logger.debug(`Redis set error: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Scrapes Open Graph / HTML metadata for a given URL.
   */
  async getPreview(rawUrl: string): Promise<LinkPreviewData> {
    const trimmed = rawUrl.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
      return { url: trimmed };
    }

    // Check cache (Redis or LRU fallback)
    const cached = await this.getCached(trimmed);
    if (cached) {
      return cached;
    }

    let hostname: string;
    try {
      hostname = new URL(trimmed).hostname.replace(/^www\./, '');
    } catch {
      return { url: trimmed };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(trimmed, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SalesCopilot/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const fallback = { url: trimmed, siteName: hostname };
        await this.setCached(trimmed, fallback);
        return fallback;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        const fallback = { url: trimmed, siteName: hostname };
        await this.setCached(trimmed, fallback);
        return fallback;
      }

      // Read max 128KB to prevent heavy memory usage on large pages
      const text = await this.readPartialHtml(response, 128 * 1024);
      const preview = this.parseOpenGraph(text, trimmed, hostname);

      await this.setCached(trimmed, preview);
      return preview;
    } catch (err) {
      this.logger.debug(`Could not scrape preview for '${trimmed}': ${(err as Error).message}`);
      const fallback = { url: trimmed, siteName: hostname };
      await this.setCached(trimmed, fallback, 60 * 1000); // Retry faster on error
      return fallback;
    }
  }

  private async readPartialHtml(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) {
      return await response.text();
    }

    const reader = response.body.getReader();
    let accumulated = '';
    let bytesRead = 0;
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;

      accumulated += decoder.decode(value, { stream: true });
      bytesRead += value.length;

      if (bytesRead >= maxBytes || accumulated.includes('</head>')) {
        reader.cancel().catch(() => {});
        break;
      }
    }

    return accumulated;
  }

  private parseOpenGraph(html: string, originalUrl: string, defaultHost: string): LinkPreviewData {
    let title: string | undefined;
    let image: string | undefined;

    // Helper regex matcher
    const getMeta = (prop: string, isName = false) => {
      const attr = isName ? 'name' : 'property';
      const regex = new RegExp(
        `<meta[^>]*${attr}=["'](?:og:)?${prop}["'][^>]*content=["']([^"']*)["']`,
        'i',
      );
      const match = html.match(regex);
      if (match && match[1]) return this.decodeHtmlEntities(match[1].trim());

      // Try alternate order: content first, then property
      const altRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["'](?:og:)?${prop}["']`,
        'i',
      );
      const altMatch = html.match(altRegex);
      if (altMatch && altMatch[1]) return this.decodeHtmlEntities(altMatch[1].trim());

      return undefined;
    };

    // 1. Title: og:title -> <title>
    title = getMeta('title') || getMeta('title', true);
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = this.decodeHtmlEntities(titleMatch[1].trim());
      }
    }

    // 2. Description: og:description -> meta description
    const description = getMeta('description') || getMeta('description', true);

    // 3. Image: og:image -> link rel="image_src"
    image = getMeta('image');
    if (!image) {
      const linkImgMatch = html.match(
        /<link[^>]*rel=["'](?:image_src|icon)["'][^>]*href=["']([^"']*)["']/i,
      );
      if (linkImgMatch && linkImgMatch[1]) {
        image = linkImgMatch[1].trim();
      }
    }

    // Resolve relative image URL to absolute URL
    if (image) {
      try {
        image = new URL(image, originalUrl).href;
      } catch {
        // Fallback to relative image path
      }
    }

    // 4. Site name: og:site_name -> fallback host
    const siteName = getMeta('site_name') || defaultHost;

    return {
      url: originalUrl,
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      siteName: siteName || undefined,
    };
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }
}
