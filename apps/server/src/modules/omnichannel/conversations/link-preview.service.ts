import { Injectable, Logger } from '@nestjs/common';

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
  private readonly cache = new Map<string, { data: LinkPreviewData; expiresAt: number }>();
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Scrapes Open Graph / HTML metadata for a given URL.
   */
  async getPreview(rawUrl: string): Promise<LinkPreviewData> {
    const trimmed = rawUrl.trim();
    if (!trimmed || (!trimmed.startsWith('http://') && !trimmed.startsWith('https://'))) {
      return { url: trimmed };
    }

    // Check in-memory cache
    const cached = this.cache.get(trimmed);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
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
        this.cache.set(trimmed, { data: fallback, expiresAt: Date.now() + this.ttlMs });
        return fallback;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        const fallback = { url: trimmed, siteName: hostname };
        this.cache.set(trimmed, { data: fallback, expiresAt: Date.now() + this.ttlMs });
        return fallback;
      }

      // Read max 128KB to prevent heavy memory usage on large pages
      const text = await this.readPartialHtml(response, 128 * 1024);
      const preview = this.parseOpenGraph(text, trimmed, hostname);

      this.cache.set(trimmed, { data: preview, expiresAt: Date.now() + this.ttlMs });
      return preview;
    } catch (err) {
      this.logger.debug(`Could not scrape preview for '${trimmed}': ${(err as Error).message}`);
      const fallback = { url: trimmed, siteName: hostname };
      this.cache.set(trimmed, { data: fallback, expiresAt: Date.now() + 60 * 1000 }); // Retry faster on error
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
