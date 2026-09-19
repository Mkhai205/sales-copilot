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
    expect(res.url).toBe('not-a-url');
    expect(res.title).toBe(undefined);
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
    expect(preview.url).toBe('https://giavang.org/gia-vang-sjc');
    expect(preview.title).toBe('Giá Vàng Hôm Nay - Cập Nhật 24/7');
    expect(preview.description).toBe('Bảng giá vàng SJC, 9999, DOJI mới nhất');
    expect(preview.image).toBe('https://giavang.org/static/gold-thumbnail.png');
    expect(preview.siteName).toBe('Giá Vàng Việt Nam');
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
    expect(preview.title).toBe('Standard Page Title');
    expect(preview.description).toBe('Standard page description text');
    expect(preview.image).toBe('https://example.com/favicon.ico');
    expect(preview.siteName).toBe('example.com');
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
    expect(preview.title).toBe(`Gold & Silver "Prices" 'Today'`);
    expect(preview.description).toBe('<New> update on 24k gold');
  });

  it('should handle fetch errors gracefully and return siteName fallback', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network timeout');
    };

    const preview = await service.getPreview('https://timeout-site.org/news');
    expect(preview.url).toBe('https://timeout-site.org/news');
    expect(preview.siteName).toBe('timeout-site.org');
    expect(preview.title).toBe(undefined);
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

    expect(callCount).toBe(1);
    expect(res1.title).toBe('Cached Title');
    expect(res2.title).toBe('Cached Title');
  });
});
