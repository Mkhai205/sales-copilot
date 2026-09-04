import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { LinkPreviewService } from '../link-preview.service';

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    service = new LinkPreviewService();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return raw url for non-http/https strings', async () => {
    const res = await service.getPreview('not-a-url');
    assert.strictEqual(res.url, 'not-a-url');
    assert.strictEqual(res.title, undefined);
  });

  it('should extract og:title, og:description, og:image, and og:site_name', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Giá Vàng Hôm Nay - Cập Nhật 24/7" />
          <meta property="og:description" content="Bảng giá vàng SJC, 9999, DOJI mới nhất" />
          <meta property="og:image" content="https://giavang.org/static/gold-thumbnail.png" />
          <meta property="og:site_name" content="Giá Vàng Việt Nam" />
        </head>
        <body>
          <h1>Nội dung trang</h1>
        </body>
      </html>
    `;

    globalThis.fetch = async () =>
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

    const preview = await service.getPreview('https://giavang.org/gia-vang-sjc');
    assert.strictEqual(preview.url, 'https://giavang.org/gia-vang-sjc');
    assert.strictEqual(preview.title, 'Giá Vàng Hôm Nay - Cập Nhật 24/7');
    assert.strictEqual(preview.description, 'Bảng giá vàng SJC, 9999, DOJI mới nhất');
    assert.strictEqual(preview.image, 'https://giavang.org/static/gold-thumbnail.png');
    assert.strictEqual(preview.siteName, 'Giá Vàng Việt Nam');
  });

  it('should fallback to standard <title> and meta description when OG tags are absent', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Standard Page Title</title>
          <meta name="description" content="Standard page description text" />
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body>
          <p>Hello world</p>
        </body>
      </html>
    `;

    globalThis.fetch = async () =>
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });

    const preview = await service.getPreview('https://example.com/page');
    assert.strictEqual(preview.title, 'Standard Page Title');
    assert.strictEqual(preview.description, 'Standard page description text');
    assert.strictEqual(preview.image, 'https://example.com/favicon.ico');
    assert.strictEqual(preview.siteName, 'example.com');
  });

  it('should decode HTML entities in title and description', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Gold &amp; Silver &quot;Prices&quot; &#039;Today&#039;" />
          <meta property="og:description" content="&lt;New&gt; update on 24k gold" />
        </head>
      </html>
    `;

    globalThis.fetch = async () =>
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });

    const preview = await service.getPreview('https://example.com/entities');
    assert.strictEqual(preview.title, `Gold & Silver "Prices" 'Today'`);
    assert.strictEqual(preview.description, '<New> update on 24k gold');
  });

  it('should handle fetch errors gracefully and return siteName fallback', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network timeout');
    };

    const preview = await service.getPreview('https://timeout-site.org/news');
    assert.strictEqual(preview.url, 'https://timeout-site.org/news');
    assert.strictEqual(preview.siteName, 'timeout-site.org');
    assert.strictEqual(preview.title, undefined);
  });

  it('should cache previews and avoid subsequent fetch calls', async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response('<title>Cached Title</title>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    };

    const res1 = await service.getPreview('https://cache-test.com');
    const res2 = await service.getPreview('https://cache-test.com');

    assert.strictEqual(callCount, 1);
    assert.strictEqual(res1.title, 'Cached Title');
    assert.strictEqual(res2.title, 'Cached Title');
  });
});
