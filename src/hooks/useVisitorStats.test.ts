import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useVisitorStats,
  isVisitorStats,
  formatHourWindow,
  STATS_REFRESH_MS,
  type VisitorStats,
} from './useVisitorStats';

const sample: VisitorStats = {
  total: 1234,
  last24h: 42,
  last7d: 310,
  uniqueCountries: 37,
  uniqueCities: 210,
  topCountries: [{ country: 'Germany', count: 400, share: 32.4 }],
  topCities: [{ city: 'Berlin', country: 'Germany', count: 120 }],
  busiestHourUtc: 14,
  firstSeen: 1_700_000_000_000,
  lastSeen: 1_800_000_000_000,
};

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('isVisitorStats', () => {
  it('accepts a well-formed payload', () => {
    expect(isVisitorStats(sample)).toBe(true);
  });

  it('rejects malformed payloads', () => {
    expect(isVisitorStats(null)).toBe(false);
    expect(isVisitorStats({})).toBe(false);
    expect(isVisitorStats({ ...sample, total: '1234' })).toBe(false);
    expect(isVisitorStats({ ...sample, topCountries: 'many' })).toBe(false);
  });
});

describe('formatHourWindow', () => {
  it('renders an hour as a UTC window', () => {
    expect(formatHourWindow(14)).toBe('14:00–15:00 UTC');
  });

  it('wraps around midnight', () => {
    expect(formatHourWindow(23)).toBe('23:00–00:00 UTC');
  });

  it('zero-pads single digits', () => {
    expect(formatHourWindow(3)).toBe('03:00–04:00 UTC');
  });

  it('returns null for absent or out-of-range hours', () => {
    expect(formatHourWindow(null)).toBeNull();
    expect(formatHourWindow(24)).toBeNull();
    expect(formatHourWindow(-1)).toBeNull();
    expect(formatHourWindow(1.5)).toBeNull();
  });
});

describe('useVisitorStats', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse(sample));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('loads stats on mount', async () => {
    const { result } = renderHook(() => useVisitorStats());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stats?.total).toBe(1234);
    expect(result.current.error).toBeNull();
  });

  it('hits the stats endpoint', async () => {
    renderHook(() => useVisitorStats());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    expect(String((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]))
      .toContain('/api/visitors/stats');
  });

  it('surfaces an HTTP error without crashing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const { result } = renderHook(() => useVisitorStats());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('503');
    expect(result.current.stats).toBeNull();
  });

  it('rejects a malformed payload rather than rendering junk', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse({ total: 'lots' }));
    const { result } = renderHook(() => useVisitorStats());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/malformed/i);
    expect(result.current.stats).toBeNull();
  });

  // A blip shouldn't blank a panel the visitor is already reading.
  it('keeps the last good stats when a refresh fails', async () => {
    const { result } = renderHook(() => useVisitorStats());
    await waitFor(() => expect(result.current.stats?.total).toBe(1234));

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    await act(async () => { await result.current.refetch(); });

    expect(result.current.stats?.total).toBe(1234);
    expect(result.current.error).toBe('offline');
  });

  it('survives a rejected fetch on first load', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const { result } = renderHook(() => useVisitorStats());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBe('offline');
  });

  it('refreshes on the interval', async () => {
    vi.useFakeTimers();
    renderHook(() => useVisitorStats());
    await act(async () => { await Promise.resolve(); });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(STATS_REFRESH_MS); });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('skips refreshing while the tab is hidden', async () => {
    vi.useFakeTimers();
    renderHook(() => useVisitorStats());
    await act(async () => { await Promise.resolve(); });

    (document as unknown as { hidden: boolean }).hidden = true;
    await act(async () => { vi.advanceTimersByTime(STATS_REFRESH_MS * 3); });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('stops polling after unmount', async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useVisitorStats());
    await act(async () => { await Promise.resolve(); });

    unmount();
    await act(async () => { vi.advanceTimersByTime(STATS_REFRESH_MS * 5); });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
