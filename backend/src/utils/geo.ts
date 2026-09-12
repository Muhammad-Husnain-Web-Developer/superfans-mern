import type { Request } from 'express';

/**
 * Where a request came from, for the country rules the client set out.
 *
 * Laravel asks a third party for this (`Location::get($ip)`, stevebauman/location). We read it
 * from a database that ships with the process instead: the answer is wanted on every session
 * and on every post, and a lookup that costs a network round trip — and a rate limit, and an
 * outage when the other end is down — is the wrong shape for that. Measured here: 85ms once to
 * load the data, then 0.003ms a lookup, against 141MB of memory held for the life of the
 * process.
 *
 * That memory is only paid once something actually asks, which is why the import below is
 * deferred rather than taken at boot — the same bargain `geo.routes.ts` strikes with its own
 * large dataset.
 */

export interface Place {
  /** ISO-3166 alpha-2, e.g. `ES` */
  country: string;
  /** the region code inside that country, e.g. `CT` for Catalunya — null where unknown */
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

type GeoModule = typeof import('geoip-lite');
let loading: Promise<GeoModule> | null = null;

function dataset(): Promise<GeoModule> {
  loading ??= import('geoip-lite').then((m) => m.default ?? m);
  return loading;
}

/**
 * The address the visitor actually came from.
 *
 * `req.ip` is only the visitor's once Express has been told to believe our own nginx — see
 * `trust proxy` in app.ts, without which every address read `::ffff:127.0.0.1`.
 *
 * An address on this machine or on a private network tells us nothing about a country, so it
 * is reported as nothing rather than guessed at: that is a developer on localhost, a health
 * check, or a request that never crossed the internet.
 */
export function clientIp(req: Request): string | null {
  const raw = (req.ip ?? '').trim();
  if (!raw) return null;
  /* IPv4 arriving over an IPv6 socket is written `::ffff:81.34.12.7` */
  const ip = raw.startsWith('::ffff:') ? raw.slice(7) : raw;
  if (isPrivate(ip)) return null;
  return ip;
}

function isPrivate(ip: string): boolean {
  if (ip === '::1' || ip === '127.0.0.1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
  /* 172.16.0.0 – 172.31.255.255 */
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  /* IPv6 unique-local and link-local */
  if (/^f[cd]/i.test(ip) || /^fe80:/i.test(ip)) return true;
  return false;
}

let warned = false;

/**
 * Where that address is, or null when the database has nothing for it.
 *
 * Null as well when the database itself cannot be had — the package missing from a build, its
 * data unreadable, an address it chokes on. Everything that asks here treats null as "show
 * everything", so a broken lookup costs the country rules and nothing else; it must never
 * cost the WORLD feed or a post upload, which is what an exception escaping here would do.
 */
export async function placeFromIp(ip: string | null): Promise<Place | null> {
  if (!ip) return null;
  try {
    const geoip = await dataset();
    const hit = geoip.lookup(ip);
    if (!hit?.country) return null;
    return {
      country: hit.country,
      region: hit.region || null,
      city: hit.city || null,
      lat: hit.ll?.[0] ?? null,
      lng: hit.ll?.[1] ?? null,
    };
  } catch (err) {
    loading = null; /* a failed load is not kept — the next call may find it fixed */
    if (!warned) {
      warned = true;
      console.error('[geo] address lookup unavailable, country rules are off:', err);
    }
    return null;
  }
}

/** The same, straight off a request. */
export function placeFromRequest(req: Request): Promise<Place | null> {
  return placeFromIp(clientIp(req));
}
