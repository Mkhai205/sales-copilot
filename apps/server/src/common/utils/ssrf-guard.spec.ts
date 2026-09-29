import { describe, it, jest } from '@jest/globals';
import { assertSafePublicUrl, isBlockedIp, SsrfBlockedError } from './ssrf-guard';

describe('isBlockedIp (SSRF address guard)', () => {
  const blocked = [
    '127.0.0.1',
    '127.8.8.8',
    '10.1.2.3',
    '192.168.1.1',
    '172.16.5.4',
    '172.31.255.255',
    '169.254.169.254', // cloud metadata
    '0.0.0.0',
    '100.64.0.1', // CGNAT
    '198.18.0.1', // benchmark
    '224.0.0.1',
    '240.0.0.1',
    '::1',
    '::', // unspecified
    'fe80::1', // link-local
    'fc00::1', // ULA
    'fd12:3456::1', // ULA
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:10.0.0.5',
    '64:ff9b::7f00:1', // NAT64-embedded loopback
    '2130706433', // decimal-encoded 127.0.0.1
  ];

  const allowed = [
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1', // just outside 172.16/12
    '192.169.0.1', // just outside 192.168/16
    '9.9.9.9',
    '2606:4700::1111', // public IPv6
    '2a00:1450:4001:81b::200e',
  ];

  it.each(blocked)('blocks %s', ip => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(allowed)('allows %s', ip => {
    expect(isBlockedIp(ip)).toBe(false);
  });

  it('treats malformed addresses as blocked', () => {
    expect(isBlockedIp('not-an-ip')).toBe(true);
    expect(isBlockedIp('999.999.999.999')).toBe(true);
    expect(isBlockedIp('1:2:3')).toBe(true);
  });
});

describe('assertSafePublicUrl (SSRF URL guard)', () => {
  it('allows a public https URL whose DNS resolves to public addresses', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '93.184.216.34' }]);
    const url = await assertSafePublicUrl('https://example.com/some/page', lookup);
    expect(url.hostname).toBe('example.com');
    expect(lookup).toHaveBeenCalledWith('example.com');
  });

  it('blocks when DNS resolves to a private address (DNS rebinding / internal host)', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '10.0.0.1' }]);
    await expect(assertSafePublicUrl('https://internal.example.com', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it('blocks when any resolved address is private (multi-address host)', async () => {
    const lookup = jest
      .fn()
      .mockResolvedValue([{ address: '93.184.216.34' }, { address: '192.168.0.10' }]);
    await expect(assertSafePublicUrl('https://example.com', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it('blocks literal private IPs without DNS lookup', async () => {
    const lookup = jest.fn();
    await expect(
      assertSafePublicUrl('http://169.254.169.254/latest/meta-data/', lookup),
    ).rejects.toThrow(SsrfBlockedError);
    await expect(assertSafePublicUrl('http://[::1]:8080/', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('blocks localhost hostnames and decimal-encoded loopback', async () => {
    const lookup = jest.fn().mockResolvedValue([{ address: '8.8.8.8' }]);
    await expect(assertSafePublicUrl('http://localhost:3000', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(assertSafePublicUrl('http://api.localhost/v1', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(assertSafePublicUrl('http://2130706433/', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('blocks non-http protocols and embedded credentials', async () => {
    await expect(assertSafePublicUrl('file:///etc/passwd')).rejects.toThrow(SsrfBlockedError);
    await expect(assertSafePublicUrl('gopher://internal.example.com')).rejects.toThrow(
      SsrfBlockedError,
    );
    await expect(assertSafePublicUrl('https://user:pass@example.com')).rejects.toThrow(
      SsrfBlockedError,
    );
  });

  it('blocks when DNS resolution fails', async () => {
    const lookup = jest.fn().mockRejectedValue(new Error('NXDOMAIN'));
    await expect(assertSafePublicUrl('https://does-not-exist.example.com', lookup)).rejects.toThrow(
      SsrfBlockedError,
    );
  });
});
