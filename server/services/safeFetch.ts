/**
 * Server-side request forgery (SSRF) protected HTTP fetcher for URL previews.
 *
 * Defences:
 *  1. Only http/https, default ports (80/443), no embedded credentials.
 *  2. Hostnames like `localhost`, `*.local`, `*.internal` and single-label
 *     names are rejected outright.
 *  3. Every DNS answer is checked against a blocklist of private, loopback,
 *     link-local (incl. cloud metadata 169.254.169.254), CGNAT, multicast and
 *     reserved ranges for both IPv4 and IPv6.
 *  4. The connection is *pinned* to the address we validated (custom `lookup`)
 *     so a DNS-rebinding attacker can't swap in an internal IP between the
 *     check and the connect.
 *  5. Redirects are followed manually (max 4) and each hop is re-validated.
 *  6. Hard limits on total time and response size.
 */
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import type { Readable } from 'node:stream';

export class UnsafeUrlError extends Error {}

// Separate lists: Node applies IPv4-mapped IPv6 rules (::ffff:0:0/96) to plain
// IPv4 addresses, which would otherwise block every IPv4 destination.
const v4BlockList = new net.BlockList();
const v6BlockList = new net.BlockList();
const V4_BLOCKS: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const V6_BLOCKS: Array<[string, number]> = [
  ['::', 96], // unspecified, loopback, IPv4-compatible
  ['::ffff:0:0', 96], // IPv4-mapped
  ['64:ff9b::', 96], // NAT64
  ['64:ff9b:1::', 48],
  ['100::', 64], // discard
  ['2001::', 23], // IETF protocol assignments (Teredo, etc.)
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // site-local (deprecated)
  ['ff00::', 8], // multicast
];
for (const [addr, prefix] of V4_BLOCKS) v4BlockList.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of V6_BLOCKS) v6BlockList.addSubnet(addr, prefix, 'ipv6');

export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return v4BlockList.check(ip, 'ipv4');
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return true;
    return v6BlockList.check(ip, 'ipv6');
  }
  return true;
}

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet', '.corp'];

/** Validate the URL shape; throws UnsafeUrlError for anything we refuse to fetch. */
export function assertSafeUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('That does not look like a valid link.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeUrlError('Only http and https links are supported.');
  if (url.username || url.password) throw new UnsafeUrlError('Links with embedded credentials are not supported.');
  if (url.port && url.port !== '80' && url.port !== '443') throw new UnsafeUrlError('Links on non-standard ports are not supported.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) throw new UnsafeUrlError('That link has no host.');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError('That address is not allowed.');
    return url;
  }
  if (host === 'localhost' || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s)) || !host.includes('.')) {
    throw new UnsafeUrlError('That address is not allowed.');
  }
  return url;
}

async function resolveSafe(hostname: string): Promise<{ address: string; family: number }> {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError('That address is not allowed.');
    return { address: host, family: net.isIP(host) };
  }
  let answers: Array<{ address: string; family: number }>;
  try {
    answers = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('We could not find that website.');
  }
  if (!answers.length) throw new UnsafeUrlError('We could not find that website.');
  // Reject if *any* answer is internal, so round-robin tricks can't sneak through.
  if (answers.some((a) => isBlockedAddress(a.address))) throw new UnsafeUrlError('That address is not allowed.');
  return answers[0];
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 WishfulPreview/1.0',
  accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  'accept-language': 'en-US,en;q=0.8',
  'accept-encoding': 'gzip, deflate, br',
};

/** What Chrome sends for a typed-in address — some stores only answer requests that look like this. */
export const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'accept-encoding': 'gzip, deflate, br',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
};

function requestOnce(
  url: URL,
  pinned: { address: string; family: number },
  deadline: number,
  maxBytes: number,
  headers: Record<string, string>,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const remaining = Math.max(1, deadline - Date.now());
    const req = mod.request(
      url,
      {
        method: 'GET',
        headers,
        timeout: remaining,
        // Pin the socket to the pre-validated address (DNS-rebinding defence).
        lookup: ((_host: string, opts: { all?: boolean }, cb: (...args: unknown[]) => void) => {
          if (opts?.all) cb(null, [{ address: pinned.address, family: pinned.family }]);
          else cb(null, pinned.address, pinned.family);
        }) as unknown as net.LookupFunction,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
          return;
        }
        let stream: Readable = res;
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

        const chunks: Buffer[] = [];
        let size = 0;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks) });
        };
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            // Enough for metadata extraction; stop downloading.
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - maxBytes))));
            finish();
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', finish);
        stream.on('error', (err) => (done ? undefined : reject(err)));
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function decodeBody(body: Buffer, contentType: string): string {
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase();
  if (charset && charset !== 'utf-8' && charset !== 'utf8') {
    try {
      return new TextDecoder(charset).decode(body);
    } catch {
      /* fall through to utf-8 */
    }
  }
  return new TextDecoder('utf-8').decode(body);
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { timeoutMs = 8000, maxBytes = 1_500_000, maxRedirects = 4, headers = DEFAULT_HEADERS } = options;
  const deadline = Date.now() + timeoutMs;
  let url = assertSafeUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const pinned = await resolveSafe(url.hostname);
    const res = await requestOnce(url, pinned, deadline, maxBytes, headers);
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.location;
      if (!location) throw new Error('Redirect without location');
      url = assertSafeUrl(new URL(location, url));
      continue;
    }
    const contentType = String(res.headers['content-type'] || '');
    return { url: url.toString(), status: res.status, contentType, body: decodeBody(res.body, contentType) };
  }
  throw new Error('Too many redirects');
}
