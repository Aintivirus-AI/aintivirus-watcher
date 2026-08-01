import { Globe2, MapPin, Clock, Users } from 'lucide-react';
import { DataSection } from '../ui/DataSection';
import { formatHourWindow, type VisitorStats } from '../../hooks/useVisitorStats';

interface GlobalReachSectionProps {
  stats: VisitorStats | null;
  loading: boolean;
  error: string | null;
  delay?: number;
}

const nf = new Intl.NumberFormat('en-US');

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-white/[0.02] border border-white/5 px-3.5 py-3">
      <span className="text-[9px] font-display uppercase tracking-[0.18em] text-white/35">{label}</span>
      <span className="text-cyber-cyan font-mono text-[15px] leading-none">{value}</span>
      {hint && <span className="text-[9px] font-mono text-white/25">{hint}</span>}
    </div>
  );
}

/** Horizontal share bar for a single country row. */
function CountryBar({ country, count, share }: { country: string; count: number; share: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-[38%] shrink-0 truncate text-[11px] text-white/65" title={country}>
        {country}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyber-cyan/70 to-cyber-cyan/30"
          style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
        />
      </div>
      <span className="w-[52px] shrink-0 text-right font-mono text-[10px] text-white/40">
        {nf.format(count)}
      </span>
    </div>
  );
}

/**
 * Aggregate reach of the tracker itself — the counterpart to the live globe.
 * Served pre-aggregated by /api/visitors/stats so the client never has to pull
 * the full history down just to count it.
 */
export function GlobalReachSection({ stats, loading, error, delay = 0 }: GlobalReachSectionProps) {
  const busiest = formatHourWindow(stats?.busiestHourUtc ?? null);

  return (
    <DataSection
      title="Global Reach"
      icon={<Globe2 size={13} />}
      delay={delay}
      badge={
        stats ? (
          <span className="font-mono text-[9px] text-white/25">
            {nf.format(stats.total)} tracked
          </span>
        ) : null
      }
    >
      {loading && !stats && (
        <p className="py-3 text-center font-mono text-[10px] text-white/25">Loading reach data…</p>
      )}

      {!loading && !stats && (
        <p className="py-3 text-center font-mono text-[10px] text-white/25">
          {error ? 'Reach data unavailable' : 'No visits recorded yet'}
        </p>
      )}

      {stats && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Stat label="Total" value={nf.format(stats.total)} hint="all time" />
            <Stat label="24 hours" value={nf.format(stats.last24h)} hint="recent visits" />
            <Stat label="Countries" value={nf.format(stats.uniqueCountries)} hint={`${nf.format(stats.uniqueCities)} cities`} />
            <Stat label="7 days" value={nf.format(stats.last7d)} hint="rolling week" />
          </div>

          {stats.topCountries.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-[9px] font-display uppercase tracking-[0.18em] text-white/35">
                <MapPin size={10} /> Top countries
              </span>
              <div className="flex flex-col gap-2.5">
                {stats.topCountries.slice(0, 5).map((c) => (
                  <CountryBar key={c.country} country={c.country} count={c.count} share={c.share} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/5 pt-4">
            {busiest && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/35">
                <Clock size={10} className="text-cyber-cyan/40" />
                Peak {busiest}
              </span>
            )}
            {stats.topCities[0] && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/35">
                <Users size={10} className="text-cyber-cyan/40" />
                Busiest city {stats.topCities[0].city}
              </span>
            )}
            {error && (
              <span className="font-mono text-[10px] text-cyber-red/50">stale — {error}</span>
            )}
          </div>
        </div>
      )}
    </DataSection>
  );
}
