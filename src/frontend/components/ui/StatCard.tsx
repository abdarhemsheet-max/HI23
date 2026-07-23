import { cn } from '@/shared/utils';
import type { LucideIcon } from 'lucide-react';

export default function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'emerald',
  sub,
  blurred = false,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  tone?: 'emerald' | 'violet' | 'sky' | 'amber' | 'rose';
  sub?: string;
  /** وضع الخصوصية: يموّه القيمة فقط ويُبقي هيكل البطاقة والعنوان واضحين */
  blurred?: boolean;
}) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-300 border-emerald-500/20',
    violet: 'from-violet-500/20 to-purple-500/5 text-violet-300 border-violet-500/20',
    sky: 'from-sky-500/20 to-cyan-500/5 text-sky-300 border-sky-500/20',
    amber: 'from-amber-500/20 to-orange-500/5 text-amber-300 border-amber-500/20',
    rose: 'from-rose-500/20 to-pink-500/5 text-rose-300 border-rose-500/20',
  };
  return (
    <div className="glass glass-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-400">{title}</p>
          <p
            className={cn(
              'mt-1.5 text-2xl font-black text-slate-50 truncate transition-all duration-200',
              blurred && 'blur-md select-none'
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
        </div>
        <div
          className={cn(
            'shrink-0 rounded-xl border bg-gradient-to-br p-2.5',
            tones[tone]
          )}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
