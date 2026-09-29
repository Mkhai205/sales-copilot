import { LinkPreviewService } from '../link-preview.service';
import { assertSafePublicUrl } from '../../../../common/utils/ssrf-guard';

// The SSRF guard resolves real DNS — mock it as a passthrough for unit tests.
jest.mock('../../../../common/utils/ssrf-guard', () => ({
  assertSafePublicUrl: jest.fn(async (raw: string) => new URL(raw)),
}));

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

  describe('SSRF guard (A8)', () => {
    it('does not fetch private/metadata URLs and returns a fallback preview', async () => {
      const fetchSpy = jest.fn();
      globalThis.fetch = fetchSpy as any;

      jest
        .mocked(assertSafePublicUrl)
        .mockRejectedValueOnce(new Error('URL blocked by SSRF guard: private_address'));

      const res = await service.getPreview('http://169.254.169.254/latest/meta-data/');

      // Guard rejected the URL before any request left the server
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.url).toBe('http://169.254.169.254/latest/meta-data/');
      expect(res.title).toBe(undefined);
    });

    it('follows public redirects that re-validate safely', async () => {
      const responses = [
        new Response('', { status: 301, headers: { location: 'https://example.com/final' } }),
        new Response(
          '<html><head><meta property="og:title" content="Redirected" /></head></html>',
          { status: 200, headers: { 'content-type': 'text/html' } },
        ),
      ];
      let calls = 0;
      globalThis.fetch = (async () => responses[calls++]) as any;
      jest.mocked(assertSafePublicUrl).mockResolvedValue(new URL('https://example.com/final'));

      const res = await service.getPreview('https://example.com/redirecting');

      expect(calls).toBe(2);
      expect(res.title).toBe('Redirected');
    });
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
