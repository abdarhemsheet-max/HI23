import type { LucideIcon } from 'lucide-react';

export default function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-slate-500">
        <Icon size={28} />
      </div>
      <p className="text-sm font-bold text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-600">{hint}</p>}
    </div>
  );
}
