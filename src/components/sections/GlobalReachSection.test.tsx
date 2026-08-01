import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalReachSection } from './GlobalReachSection';
import type { VisitorStats } from '../../hooks/useVisitorStats';

const stats: VisitorStats = {
  total: 12345,
  last24h: 42,
  last7d: 310,
  uniqueCountries: 37,
  uniqueCities: 210,
  topCountries: [
    { country: 'Germany', count: 4000, share: 32.4 },
    { country: 'United States', count: 3000, share: 24.3 },
  ],
  topCities: [{ city: 'Berlin', country: 'Germany', count: 1200 }],
  busiestHourUtc: 14,
  firstSeen: 1_700_000_000_000,
  lastSeen: 1_800_000_000_000,
};

describe('GlobalReachSection', () => {
  it('shows a loading note before any data arrives', () => {
    render(<GlobalReachSection stats={null} loading error={null} />);
    expect(screen.getByText(/loading reach data/i)).toBeDefined();
  });

  it('reports the empty case distinctly from a failure', () => {
    render(<GlobalReachSection stats={null} loading={false} error={null} />);
    expect(screen.getByText(/no visits recorded yet/i)).toBeDefined();
  });

  it('says so when reach data cannot be fetched', () => {
    render(<GlobalReachSection stats={null} loading={false} error="HTTP 503" />);
    expect(screen.getByText(/reach data unavailable/i)).toBeDefined();
  });

  it('renders the headline counters with thousands separators', () => {
    render(<GlobalReachSection stats={stats} loading={false} error={null} />);
    expect(screen.getByText('12,345')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('37')).toBeDefined();
  });

  it('lists the top countries', () => {
    render(<GlobalReachSection stats={stats} loading={false} error={null} />);
    expect(screen.getByText('Germany')).toBeDefined();
    expect(screen.getByText('United States')).toBeDefined();
  });

  it('renders the peak hour as a readable UTC window', () => {
    render(<GlobalReachSection stats={stats} loading={false} error={null} />);
    expect(screen.getByText(/14:00–15:00 UTC/)).toBeDefined();
  });

  // A background refresh failing shouldn't blank a panel someone is reading.
  it('keeps showing figures while flagging them as stale', () => {
    render(<GlobalReachSection stats={stats} loading={false} error="offline" />);
    expect(screen.getByText('12,345')).toBeDefined();
    expect(screen.getByText(/stale/i)).toBeDefined();
  });

  it('handles a stats payload with no countries yet', () => {
    const empty = { ...stats, total: 0, topCountries: [], topCities: [], busiestHourUtc: null };
    expect(() => render(<GlobalReachSection stats={empty} loading={false} error={null} />)).not.toThrow();
  });
});
