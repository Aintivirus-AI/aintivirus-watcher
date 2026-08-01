import { describe, it, expect } from 'vitest';
import {
  computeVisitorStats,
  recentVisitors,
  visitorsSince,
  parseLimit,
  type HistoricalVisitor,
} from './stats.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 7, 1, 12, 0, 0);

const visit = (over: Partial<HistoricalVisitor> = {}): HistoricalVisitor => ({
  lat: 51.5,
  lng: -0.12,
  city: 'London',
  country: 'United Kingdom',
  connectedAt: NOW,
  ...over,
});

describe('parseLimit', () => {
  it('falls back when the value is missing or unparseable', () => {
    expect(parseLimit(undefined, 500, 5000)).toBe(500);
    expect(parseLimit('abc', 500, 5000)).toBe(500);
    expect(parseLimit(null, 500, 5000)).toBe(500);
  });

  it('rejects zero and negatives', () => {
    expect(parseLimit('0', 500, 5000)).toBe(500);
    expect(parseLimit('-20', 500, 5000)).toBe(500);
  });

  // The point of the cap: a client cannot ask for the whole history again.
  it('clamps to the maximum', () => {
    expect(parseLimit('999999', 500, 5000)).toBe(5000);
  });

  it('accepts a value inside the range', () => {
    expect(parseLimit('250', 500, 5000)).toBe(250);
    expect(parseLimit(250, 500, 5000)).toBe(250);
  });

  it('floors fractional input', () => {
    expect(parseLimit('12.9', 500, 5000)).toBe(12);
  });
});

describe('recentVisitors', () => {
  const history = Array.from({ length: 10 }, (_, i) =>
    visit({ city: `city-${i}`, connectedAt: NOW + i }));

  it('returns the newest entries, which are at the end', () => {
    const out = recentVisitors(history, 3);
    expect(out.map((v) => v.city)).toEqual(['city-7', 'city-8', 'city-9']);
  });

  it('returns everything when the limit exceeds the history', () => {
    expect(recentVisitors(history, 500)).toHaveLength(10);
  });

  it('returns nothing for a non-positive limit', () => {
    expect(recentVisitors(history, 0)).toEqual([]);
    expect(recentVisitors(history, -5)).toEqual([]);
  });

  it('handles an empty history', () => {
    expect(recentVisitors([], 10)).toEqual([]);
  });
});

describe('visitorsSince', () => {
  it('keeps only entries at or after the cutoff', () => {
    const history = [
      visit({ city: 'old', connectedAt: NOW - 2 * DAY }),
      visit({ city: 'edge', connectedAt: NOW - DAY }),
      visit({ city: 'new', connectedAt: NOW }),
    ];
    expect(visitorsSince(history, NOW - DAY).map((v) => v.city)).toEqual(['edge', 'new']);
  });

  it('returns everything for a cutoff in the past', () => {
    expect(visitorsSince([visit()], 0)).toHaveLength(1);
  });
});

describe('computeVisitorStats', () => {
  it('handles an empty history without dividing by zero', () => {
    const stats = computeVisitorStats([], NOW);
    expect(stats).toMatchObject({
      total: 0,
      last24h: 0,
      last7d: 0,
      uniqueCountries: 0,
      uniqueCities: 0,
      topCountries: [],
      topCities: [],
      busiestHourUtc: null,
      firstSeen: null,
      lastSeen: null,
    });
  });

  it('counts totals and recency windows', () => {
    const stats = computeVisitorStats([
      visit({ connectedAt: NOW - 2 * HOUR }),
      visit({ connectedAt: NOW - 3 * DAY }),
      visit({ connectedAt: NOW - 20 * DAY }),
    ], NOW);

    expect(stats.total).toBe(3);
    expect(stats.last24h).toBe(1);
    expect(stats.last7d).toBe(2);
  });

  it('ranks countries by frequency and reports share', () => {
    const stats = computeVisitorStats([
      visit({ country: 'Germany' }),
      visit({ country: 'Germany' }),
      visit({ country: 'Germany' }),
      visit({ country: 'France' }),
    ], NOW);

    expect(stats.topCountries[0]).toEqual({ country: 'Germany', count: 3, share: 75 });
    expect(stats.topCountries[1]).toEqual({ country: 'France', count: 1, share: 25 });
    expect(stats.uniqueCountries).toBe(2);
  });

  it('caps the leaderboards at ten entries', () => {
    const history = Array.from({ length: 40 }, (_, i) =>
      visit({ country: `country-${i}`, city: `city-${i}` }));
    const stats = computeVisitorStats(history, NOW);

    expect(stats.topCountries).toHaveLength(10);
    expect(stats.topCities).toHaveLength(10);
    expect(stats.uniqueCountries).toBe(40);
  });

  it('treats identically named cities in different countries as distinct', () => {
    const stats = computeVisitorStats([
      visit({ city: 'Springfield', country: 'United States' }),
      visit({ city: 'Springfield', country: 'Canada' }),
    ], NOW);

    expect(stats.uniqueCities).toBe(2);
  });

  it('labels missing city/country rather than dropping the visit', () => {
    const stats = computeVisitorStats([visit({ city: '', country: '' })], NOW);

    expect(stats.total).toBe(1);
    expect(stats.topCountries[0].country).toBe('Unknown');
    expect(stats.topCities[0].city).toBe('Unknown');
  });

  it('finds the busiest UTC hour', () => {
    const at = (hour: number) => visit({ connectedAt: Date.UTC(2026, 7, 1, hour, 0, 0) });
    const stats = computeVisitorStats([at(3), at(9), at(9), at(9), at(17)], NOW);

    expect(stats.busiestHourUtc).toBe(9);
  });

  it('reports the first and last timestamps seen', () => {
    const stats = computeVisitorStats([
      visit({ connectedAt: NOW - 5 * DAY }),
      visit({ connectedAt: NOW - DAY }),
      visit({ connectedAt: NOW - 10 * DAY }),
    ], NOW);

    expect(stats.firstSeen).toBe(NOW - 10 * DAY);
    expect(stats.lastSeen).toBe(NOW - DAY);
  });

  it('breaks count ties deterministically by name', () => {
    const a = computeVisitorStats([visit({ country: 'Belgium' }), visit({ country: 'Austria' })], NOW);
    const b = computeVisitorStats([visit({ country: 'Austria' }), visit({ country: 'Belgium' })], NOW);

    expect(a.topCountries.map((c) => c.country)).toEqual(b.topCountries.map((c) => c.country));
  });

  it('stays correct on a large history', () => {
    const history = Array.from({ length: 10_000 }, (_, i) =>
      visit({ country: i % 2 === 0 ? 'A' : 'B', connectedAt: NOW - (i % 30) * DAY }));

    const stats = computeVisitorStats(history, NOW);

    expect(stats.total).toBe(10_000);
    expect(stats.uniqueCountries).toBe(2);
    expect(stats.topCountries[0].count + stats.topCountries[1].count).toBe(10_000);
  });
});
