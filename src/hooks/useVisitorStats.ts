/**
 * Aggregate visitor statistics from `/api/visitors/stats`.
 *
 * The globe already streams individual coordinates; this is the summary view —
 * reach, spread and timing — which the server computes so the client doesn't
 * have to pull the whole history down to count it.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface CountryStat {
  country: string;
  count: number;
  share: number;
}

export interface CityStat {
  city: string;
  country: string;
  count: number;
}

export interface VisitorStats {
  total: number;
  last24h: number;
  last7d: number;
  uniqueCountries: number;
  uniqueCities: number;
  topCountries: CountryStat[];
  topCities: CityStat[];
  busiestHourUtc: number | null;
  firstSeen: number | null;
  lastSeen: number | null;
}

const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:3001';
  return '';
};

/** Refresh cadence. Slow on purpose — these are cumulative counters. */
export const STATS_REFRESH_MS = 60_000;

export function isVisitorStats(v: unknown): v is VisitorStats {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.total === 'number' &&
    typeof s.uniqueCountries === 'number' &&
    Array.isArray(s.topCountries) &&
    Array.isArray(s.topCities)
  );
}

/** "14:00–15:00 UTC", or null when there's no data yet. */
export function formatHourWindow(hour: number | null): string | null {
  if (hour === null || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  const pad = (h: number) => String(h).padStart(2, '0');
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00 UTC`;
}

export function useVisitorStats() {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/visitors/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      if (cancelled.current) return;

      if (!isVisitorStats(data)) throw new Error('Malformed stats payload');
      setStats(data);
      setError(null);
    } catch (err) {
      if (cancelled.current) return;
      // Keep the last good numbers on screen rather than blanking the panel.
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      if (!cancelled.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    fetchStats();

    const id = setInterval(() => {
      // Nothing to refresh for a tab nobody is looking at.
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchStats();
    }, STATS_REFRESH_MS);

    return () => {
      cancelled.current = true;
      clearInterval(id);
    };
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
