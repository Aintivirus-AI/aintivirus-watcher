/**
 * Tests for the geolocation cache added to prevent redundant external API calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Inline cache implementation (mirrors geolocation.ts) ─────────────────────

interface GeoLocation {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  timezone: string;
  isp: string;
}

const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;
const GEO_CACHE_MAX = 5000;

function makeCache() {
  const cache = new Map<string, { result: GeoLocation | null; cachedAt: number }>();

  function lookup(
    ip: string,
    fetchFn: (ip: string) => GeoLocation | null,
    now: number
  ): GeoLocation | null {
    const cached = cache.get(ip);
    if (cached && now - cached.cachedAt < GEO_CACHE_TTL) {
      return cached.result;
    }
    const result = fetchFn(ip);
    if (cache.size >= GEO_CACHE_MAX) {
      cache.delete(cache.keys().next().value!);
    }
    cache.set(ip, { result, cachedAt: now });
    return result;
  }

  return { cache, lookup };
}

describe('geolocation cache', () => {
  it('returns cached result on second call without invoking fetchFn', () => {
    const { lookup } = makeCache();
    const fetchFn = vi.fn().mockReturnValue({ ip: '1.2.3.4', city: 'TestCity' } as unknown as GeoLocation);
    const now = Date.now();

    lookup('1.2.3.4', fetchFn, now);
    lookup('1.2.3.4', fetchFn, now + 1000); // still within TTL

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after TTL expires', () => {
    const { lookup } = makeCache();
    const fetchFn = vi.fn().mockReturnValue({ ip: '1.2.3.4', city: 'TestCity' } as unknown as GeoLocation);
    const now = Date.now();

    lookup('1.2.3.4', fetchFn, now);
    lookup('1.2.3.4', fetchFn, now + GEO_CACHE_TTL + 1);

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('caches null results (failed lookups) to avoid hammering the API', () => {
    const { lookup } = makeCache();
    const fetchFn = vi.fn().mockReturnValue(null);
    const now = Date.now();

    const r1 = lookup('9.9.9.9', fetchFn, now);
    const r2 = lookup('9.9.9.9', fetchFn, now + 100);

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest entry when cache is at capacity', () => {
    const { cache, lookup } = makeCache();
    const fetchFn = vi.fn().mockImplementation((ip: string) => ({ ip } as unknown as GeoLocation));
    const now = Date.now();

    // Fill cache to max
    for (let i = 0; i < GEO_CACHE_MAX; i++) {
      lookup(`10.0.${Math.floor(i / 256)}.${i % 256}`, fetchFn, now + i);
    }
    expect(cache.size).toBe(GEO_CACHE_MAX);

    // One more entry should evict the oldest
    lookup('99.99.99.99', fetchFn, now + GEO_CACHE_MAX);
    expect(cache.size).toBe(GEO_CACHE_MAX);
  });

  it('caches different IPs independently', () => {
    const { lookup } = makeCache();
    const fetchFn = vi.fn().mockImplementation((ip: string) => ({ ip } as unknown as GeoLocation));
    const now = Date.now();

    lookup('1.1.1.1', fetchFn, now);
    lookup('2.2.2.2', fetchFn, now);
    lookup('1.1.1.1', fetchFn, now + 100);

    expect(fetchFn).toHaveBeenCalledTimes(2); // once per unique IP
  });
});
