import { promises as dnsPromises } from 'node:dns';

/**
 * SSRF guard (Phase 4 / M4.3 finding A8): server-side fetches of user-supplied URLs
 * must never reach private, loopback, link-local or metadata addresses.
 *
 * Usage: `const url = await assertSafePublicUrl(rawUrl)` immediately before `fetch`,
 * and re-validate every redirect target (fetch with `redirect: 'manual'`).
 */

export class SsrfBlockedError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`URL blocked by SSRF guard: ${reason}`);
    this.name = 'SsrfBlockedError';
    this.reason = reason;
  }
}

/** Blocked IPv4 CIDRs: unspecified, private, CGNAT, loopback, link-local/metadata, benchmark, multicast, reserved. */
const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/** Blocked IPv6 CIDRs: unspecified, loopback, NAT64, documentation discard-only, ULA, link-local. */
const BLOCKED_IPV6_RANGES: Array<[string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['fc00::', 7],
  ['fe80::', 10],
];

interface ParsedIp {
  version: 4 | 6;
  value: bigint;
  /** IPv4-mapped (::ffff:x.x.x.x form): the embedded IPv4 as a dotted string, else null. */
  mappedV4: string | null;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

function dotted(value: number): string {
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join('.');
}

function parseIp(ip: string): ParsedIp | null {
  // Decimal-encoded IPv4 (e.g. 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(ip)) {
    const n = Number(ip);
    if (n <= 0xffffffff) {
      return { version: 4, value: BigInt(n), mappedV4: null };
    }
    return null;
  }

  // Dotted IPv4
  if (!ip.includes(':')) {
    const value = ipv4ToInt(ip);
    if (value === null) return null;
    return { version: 4, value: BigInt(value), mappedV4: null };
  }

  let addr = ip.toLowerCase();
  const zoneIdx = addr.indexOf('%');
  if (zoneIdx !== -1) addr = addr.slice(0, zoneIdx);

  // IPv4-mapped ::ffff:a.b.c.d (dotted form)
  const v4Mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (v4Mapped) {
    const v4 = ipv4ToInt(v4Mapped[1]);
    if (v4 !== null) {
      return { version: 6, value: 0xffff00000000n | BigInt(v4), mappedV4: dotted(v4) };
    }
  }

  // Generic IPv6 → 128-bit BigInt
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':').filter(Boolean) : []) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 && missing < 1) return null;
  if (halves.length === 1 && head.length !== 8) return null;
  const groups =
    halves.length === 2 ? [...head, ...Array<number>(Math.max(0, missing)).fill(0), ...tail] : head;
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const group of groups) {
    const n = parseInt(String(group), 16);
    if (Number.isNaN(n) || n < 0 || n > 0xffff) return null;
    value = (value << 16n) | BigInt(n);
  }

  // ::ffff:x.x.x.x in hex-group form carries an embedded IPv4 in the low 32 bits
  const mappedV4 = value >> 32n === 0xffffn ? dotted(Number(value & 0xffffffffn)) : null;
  return { version: 6, value, mappedV4 };
}

function isBlockedIpv4Value(value: bigint): boolean {
  for (const [base, prefix] of BLOCKED_IPV4_RANGES) {
    const baseInt = ipv4ToInt(base);
    if (baseInt === null) continue;
    const mask = (0xffffffffn ^ ((1n << BigInt(32 - prefix)) - 1n)) & 0xffffffffn;
    if ((value & mask) === (BigInt(baseInt) & mask)) return true;
  }
  return false;
}

function isBlockedIpv6Value(value: bigint): boolean {
  for (const [base, prefix] of BLOCKED_IPV6_RANGES) {
    const baseValue = parseIp(base)?.value;
    if (baseValue === undefined || baseValue === null) continue;
    const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(128 - prefix);
    if ((value & mask) === (baseValue & mask)) return true;
  }
  return false;
}

/** True when the address must never be fetched server-side. Malformed input is treated as blocked. */
export function isBlockedIp(ip: string): boolean {
  const parsed = parseIp(ip.trim());
  if (!parsed) return true;
  if (parsed.version === 4) return isBlockedIpv4Value(parsed.value);
  // IPv4-mapped IPv6 evaluates the embedded IPv4 against the v4 ranges
  if (parsed.mappedV4 !== null) {
    const v4 = ipv4ToInt(parsed.mappedV4);
    return v4 === null || isBlockedIpv4Value(BigInt(v4));
  }
  return isBlockedIpv6Value(parsed.value);
}

function isIpLiteral(host: string): boolean {
  return host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || /^\d+$/.test(host);
}

export type SafeUrlLookup = (hostname: string) => Promise<Array<{ address: string }>>;

const defaultLookup: SafeUrlLookup = hostname =>
  dnsPromises.lookup(hostname, { all: true }) as Promise<Array<{ address: string }>>;

/**
 * Validates that a user-supplied URL is safe to fetch server-side:
 * http/https only, no embedded credentials, and — after resolving every DNS
 * address for the host — no private/loopback/link-local/metadata target.
 * Returns the parsed URL on success; throws SsrfBlockedError otherwise.
 */
export async function assertSafePublicUrl(
  rawUrl: string,
  lookup: SafeUrlLookup = defaultLookup,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('invalid_url');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfBlockedError('protocol_not_allowed');
  }
  if (url.username || url.password) {
    throw new SsrfBlockedError('credentials_not_allowed');
  }

  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new SsrfBlockedError('private_host');
  }

  if (isIpLiteral(host)) {
    if (isBlockedIp(host)) throw new SsrfBlockedError('private_address');
    return url;
  }

  // Fail closed: an unresolvable host or a broken resolver must not open a fetch path
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host);
  } catch {
    throw new SsrfBlockedError('dns_resolution_failed');
  }
  if (!addresses || addresses.length === 0) {
    throw new SsrfBlockedError('dns_resolution_failed');
  }
  for (const entry of addresses) {
    if (isBlockedIp(entry.address)) throw new SsrfBlockedError('private_address');
  }

  return url;
}
