import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface DataSectionProps {
  title: string;
  icon: ReactNode;
  iconColor?: string;
  children: ReactNode;
  delay?: number;
  className?: string;
  badge?: ReactNode;
}

export function DataSection({
  title,
  icon,
  children,
  delay = 0,
  className = '',
  badge,
}: DataSectionProps) {
  return (
    <div className="mb-8">
      <motion.div
        className={`rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden ${className}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <span className="text-white/40">{icon}</span>
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-white/60">
              {title}
            </h3>
          </div>
          {badge && <div>{badge}</div>}
        </div>
        <div className="px-4 py-3">{children}</div>
      </motion.div>
    </div>
  );
}

interface DataRowProps {
  label: string;
  value: string | number | null | undefined | boolean;
  valueColor?: string;
  suffix?: string;
  showBoolean?: boolean;
  icon?: ReactNode;
  dimmed?: boolean; // For uncertain/inferred values
}

export function DataRow({
  label,
  value,
  valueColor = 'text-white/80',
  suffix = '',
  showBoolean = false,
  icon,
  dimmed = false,
}: DataRowProps) {
  let displayValue: string;
  let finalColor = valueColor;
  
  if (value === null || value === undefined) {
    displayValue = '—';
    finalColor = 'text-white/30';
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
    if (showBoolean || value) {
      finalColor = value ? 'text-emerald-400/80' : 'text-white/30';
    }
  } else {
    displayValue = String(value) + suffix;
    // Check for "unknown" or "cannot determine" values
    const valueLower = displayValue.toLowerCase();
    if (valueLower.includes('unknown') || valueLower.includes('cannot determine') || valueLower.includes('insufficient')) {
      finalColor = 'text-white/30';
    }
  }
  
  // Apply dimming if requested (for lower confidence values)
  if (dimmed) {
    finalColor = 'text-white/40 italic';
  }

  return (
    <div className="flex justify-between items-start py-3 border-b border-white/[0.03] last:border-0 gap-3">
      <span className={`text-[12px] flex items-center gap-2 shrink-0 ${dimmed ? 'text-white/30' : 'text-white/40'}`}>
        {icon && <span className="opacity-50">{icon}</span>}
        {label}
      </span>
      <span className={`font-mono text-[12px] ${finalColor} text-right`}>
        {displayValue}
      </span>
    </div>
  );
}

interface StatusRowProps {
  label: string;
  detected: boolean;
  detectedText?: string;
  notDetectedText?: string;
  alertOnDetect?: boolean;
}

export function StatusRow({
  label,
  detected,
  detectedText = 'Yes',
  notDetectedText = 'No',
  alertOnDetect = false,
}: StatusRowProps) {
  const color = detected
    ? alertOnDetect
      ? 'text-rose-400/80'
      : 'text-emerald-400/80'
    : 'text-white/30';

  const dotColor = detected
    ? alertOnDetect
      ? 'bg-rose-400'
      : 'bg-emerald-400'
    : 'bg-white/20';

  return (
    <div className="flex justify-between items-center py-3 border-b border-white/[0.03] last:border-0 gap-3">
      <span className="text-white/40 text-[12px]">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <span className={`font-mono text-[12px] ${color}`}>
          {detected ? detectedText : notDetectedText}
        </span>
      </div>
    </div>
  );
}

interface PercentRowProps {
  label: string;
  value: number;
  detected?: boolean;
  suffix?: string;
}

export function PercentRow({ label, value, detected, suffix = '%' }: PercentRowProps) {
  const displayText = detected !== undefined 
    ? `${detected ? 'Yes' : 'No'} (${value}${suffix})`
    : `${value}${suffix}`;

  const color = detected !== undefined
    ? detected
      ? 'text-emerald-400/80'
      : 'text-white/30'
    : value >= 70
      ? 'text-emerald-400/80'
      : value >= 40
        ? 'text-amber-400/80'
        : 'text-rose-400/80';

  return (
    <div className="flex justify-between items-center py-3 border-b border-white/[0.03] last:border-0 gap-3">
      <span className="text-white/40 text-[12px]">{label}</span>
      <span className={`font-mono text-[12px] ${color}`}>{displayText}</span>
    </div>
  );
}

interface ScoreRingProps {
  value: number;
  label: string;
  size?: number;
  color?: 'cyan' | 'red' | 'green' | 'purple' | 'yellow';
}

export function ScoreRing({ value, label, size = 72, color = 'cyan' }: ScoreRingProps) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  const colorMap = {
    cyan: { stroke: '#22d3ee', text: 'text-cyan-400' },
    red: { stroke: '#f87171', text: 'text-rose-400' },
    green: { stroke: '#4ade80', text: 'text-emerald-400' },
    purple: { stroke: '#a78bfa', text: 'text-violet-400' },
    yellow: { stroke: '#facc15', text: 'text-amber-400' },
  };

  const colors = colorMap[color];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle 
            cx={size / 2} cy={size / 2} r={radius} 
            fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" 
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={colors.stroke} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono text-sm font-semibold ${colors.text}`}>{value}%</span>
        </div>
      </div>
      <span className="text-white/30 text-[10px] uppercase tracking-wider mt-2">{label}</span>
    </div>
  );
}

interface InsightCardProps {
  insight: string;
  index: number;
}

export function InsightCard({ insight, index }: InsightCardProps) {
  return (
    <motion.div
      className="p-3 rounded-lg bg-white/[0.02] border border-white/5"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="flex items-start gap-3">
        <span className="text-violet-400/70 font-mono text-[10px] bg-violet-500/10 px-2 py-1 rounded shrink-0">
          #{index + 1}
        </span>
        <p className="text-white/60 text-[12px] leading-relaxed">{insight}</p>
      </div>
    </motion.div>
  );
}

interface TagListProps {
  tags: string[];
  color?: 'cyan' | 'purple' | 'green';
}

export function TagList({ tags, color = 'cyan' }: TagListProps) {
  const colorMap = {
    cyan: 'bg-cyan-500/10 text-cyan-400/80 border-cyan-500/20',
    purple: 'bg-violet-500/10 text-violet-400/80 border-violet-500/20',
    green: 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20',
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.03 }}
          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${colorMap[color]}`}
        >
          {tag}
        </motion.span>
      ))}
    </div>
  );
}
