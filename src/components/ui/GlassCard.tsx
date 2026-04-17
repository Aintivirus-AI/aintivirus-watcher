import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  glow?: boolean;
  glowColor?: 'cyan' | 'red' | 'purple' | 'green';
  className?: string;
  noPadding?: boolean;
  variant?: 'default' | 'elevated' | 'subtle';
}

export function GlassCard({ 
  children, 
  glow = false, 
  glowColor = 'cyan',
  className = '',
  noPadding = false,
  variant = 'default',
  ...motionProps 
}: GlassCardProps) {
  const glowStyles = {
    cyan: 'shadow-[0_0_30px_rgba(0,240,255,0.12),0_0_60px_rgba(0,240,255,0.06)] border-cyber-cyan/20',
    red: 'shadow-[0_0_30px_rgba(255,45,85,0.12),0_0_60px_rgba(255,45,85,0.06)] border-cyber-red/20',
    purple: 'shadow-[0_0_30px_rgba(191,90,242,0.12),0_0_60px_rgba(191,90,242,0.06)] border-cyber-purple/20',
    green: 'shadow-[0_0_30px_rgba(0,255,157,0.12),0_0_60px_rgba(0,255,157,0.06)] border-cyber-green/20',
  };

  const variantStyles = {
    default: '',
    elevated: 'shadow-[0_8px_40px_rgba(0,0,0,0.5)]',
    subtle: 'bg-cyber-bg-light/30',
  };

  return (
    <motion.div
      className={`
        glass-card
        ${glow ? glowStyles[glowColor] : ''}
        ${variantStyles[variant]}
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ 
  children, 
  icon,
  badge,
  className = '' 
}: { 
  children: ReactNode; 
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2.5">
        {icon && (
          <span className="text-cyber-cyan p-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/15">
            {icon}
          </span>
        )}
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-cyber-cyan">
          {children}
        </h3>
      </div>
      {badge && badge}
    </div>
  );
}

export function StatRow({ 
  label, 
  value, 
  valueColor = 'text-cyber-text',
  icon,
}: { 
  label: string; 
  value: string | number | null | undefined;
  valueColor?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="data-row flex justify-between items-center py-2 border-b border-cyber-glass-border/30 last:border-0 group">
      <span className="text-cyber-text-dim text-[13px] flex items-center gap-2">
        {icon && <span className="opacity-50 group-hover:opacity-100 transition-opacity">{icon}</span>}
        {label}
      </span>
      <span className={`font-mono text-[13px] ${valueColor} transition-colors`}>
        {value ?? '—'}
      </span>
    </div>
  );
}
