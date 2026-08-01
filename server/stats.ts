/**
 * Aggregations over the visitor history.
 *
 * `/api/visitors/history` previously returned the entire in-memory history —
 * up to 10,000 entries — unbounded and unauthenticated, on every page load.
 * Most consumers only want either a recent slice (the globe) or a summary
 * (counters), so both are served here instead of shipping the whole array.
 */

export interface HistoricalVisitor {
  lat: number;
  lng: number;
  city: string;
  country: string;
  connectedAt: number;
}

export interface VisitorStats {
  total: number;
  last24h: number;
  last7d: number;
  uniqueCountries: number;
  uniqueCities: number;
  topCountries: Array<{ country: string; count: number; share: number }>;
  topCities: Array<{ city: string; country: string; count: number }>;
  busiestHourUtc: number | null;
  firstSeen: number | null;
  lastSeen: number | null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const UNKNOWN = 'Unknown';

/** Entries are appended in connection order, so the newest live at the end. */
export function recentVisitors(
  history: readonly HistoricalVisitor[],
  limit: number,
): HistoricalVisitor[] {
  if (limit <= 0) return [];
  return history.slice(Math.max(0, history.length - limit));
}

export function visitorsSince(
  history: readonly HistoricalVisitor[],
  since: number,
): HistoricalVisitor[] {
  return history.filter((v) => v.connectedAt >= since);
}

/**
 * Clamp a caller-supplied `limit` query param into something safe to serve.
 * Anything unparseable falls back to the default rather than erroring.
 */
export function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

export function computeVisitorStats(
  history: readonly HistoricalVisitor[],
  now: number = Date.now(),
): VisitorStats {
  const countries = new Map<string, number>();
  const cities = new Map<string, { city: string; country: string; count: number }>();
  const hours = new Array<number>(24).fill(0);

  let last24h = 0;
  let last7d = 0;
  let firstSeen: number | null = null;
  let lastSeen: number | null = null;

  for (const visit of history) {
    const country = visit.country || UNKNOWN;
    countries.set(country, (countries.get(country) ?? 0) + 1);

    const city = visit.city || UNKNOWN;
    const cityKey = `${city}|${country}`;
    const existing = cities.get(cityKey);
    if (existing) existing.count++;
    else cities.set(cityKey, { city, country, count: 1 });

    const age = now - visit.connectedAt;
    if (age <= DAY_MS) last24h++;
    if (age <= 7 * DAY_MS) last7d++;

    // Guard against malformed timestamps producing an out-of-range index.
    const hour = new Date(visit.connectedAt).getUTCHours();
    if (Number.isInteger(hour) && hour >= 0 && hour < 24) hours[hour]++;

    if (firstSeen === null || visit.connectedAt < firstSeen) firstSeen = visit.connectedAt;
    if (lastSeen === null || visit.connectedAt > lastSeen) lastSeen = visit.connectedAt;
  }

  const total = history.length;

  const topCountries = [...countries.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([country, count]) => ({
      country,
      count,
      share: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

  const topCities = [...cities.values()]
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
    .slice(0, 10);

  const busiestHourUtc = total > 0 ? hours.indexOf(Math.max(...hours)) : null;

  return {
    total,
    last24h,
    last7d,
    uniqueCountries: countries.size,
    uniqueCities: cities.size,
    topCountries,
    topCities,
    busiestHourUtc,
    firstSeen,
    lastSeen,
  };
}
