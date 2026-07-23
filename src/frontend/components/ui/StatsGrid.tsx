import { cn } from '@/shared/utils';

export interface StatCard {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { direction: 'up' | 'down'; value: string };
  color?: 'orange' | 'violet' | 'sky' | 'amber' | 'rose';
}

const colorMap = {
  orange: { bg: 'from-orange-500/20 to-orange-500/5', border: 'border-orange-500/20', icon: 'text-orange-300', glow: 'shadow-orange-500/10' },
  violet: { bg: 'from-violet-500/20 to-violet-500/5', border: 'border-violet-500/20', icon: 'text-violet-300', glow: 'shadow-violet-500/10' },
  sky: { bg: 'from-sky-500/20 to-sky-500/5', border: 'border-sky-500/20', icon: 'text-sky-300', glow: 'shadow-sky-500/10' },
  amber: { bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-500/20', icon: 'text-amber-300', glow: 'shadow-amber-500/10' },
  rose: { bg: 'from-rose-500/20 to-rose-500/5', border: 'border-rose-500/20', icon: 'text-rose-300', glow: 'shadow-rose-500/10' },
};

function StatCard({ label, value, subtitle, icon, trend, color = 'orange' }: StatCard) {
  const c = colorMap[color];
  return (
    <div className={cn(
      'group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300',
      'bg-white/[0.04] hover:bg-white/[0.07]',
      c.border,
      'hover:border-white/[0.14] hover:-translate-y-0.5',
      c.glow, 'shadow-[0_8px_32px_rgba(0,0,0,0.35)]',
    )}>
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500', c.bg)} />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-slate-100 truncate">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 truncate">{subtitle}</p>}
          {trend && (
            <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', trend.direction === 'up' ? 'bg-orange-500/10 text-orange-300' : 'bg-rose-500/10 text-rose-300')}>
              <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
        <div className={cn('shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border', c.border, c.icon)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export interface StatsGridProps {
  stats: StatCard[];
  columns?: { base?: number; sm?: number; md?: number; lg?: number; xl?: number };
  className?: string;
}

export default function StatsGrid({ stats, columns, className }: StatsGridProps) {
  const cols = {
    'grid-cols-1': true,
    'sm:grid-cols-2': !columns?.sm || columns.sm === 2,
    'md:grid-cols-3': columns?.md === 3,
    'lg:grid-cols-3': !columns?.lg || columns.lg === 3,
    'lg:grid-cols-4': columns?.lg === 4,
    'xl:grid-cols-4': columns?.xl === 4,
  };

  return (
    <div className={cn('grid gap-3', cols, className)}>
      {stats.map((stat, i) => <StatCard key={i} {...stat} />)}
    </div>
  );
}