'use client';

import { useEffect, useState } from 'react';
import { api, getCached } from '@/frontend/api';
import { cn } from '@/shared/utils';
import { SURAHS } from '@/shared/quranData';
import GlassCard from '@/frontend/components/ui/GlassCard';
import ProgressBar from '@/frontend/components/ui/ProgressBar';

/**
 * لوحة مصحف بصرية: 114 بطاقة تمثل سور القرآن، تمتلئ تدريجياً (تعبئة من
 * الأسفل) بمجرد تسجيل آيات محفوظة منها عبر النظام المخصص (type=hifz).
 * نظرة شمولية وفورية على ما أُنجز من المصحف كاملاً.
 */
export default function MushafDashboard() {
  const [progress, setProgress] = useState<Record<number, number>>(
    () => getCached<Record<number, number>>('/api/quran/mushaf') ?? {}
  );

  useEffect(() => {
    api<Record<number, number>>('/api/quran/mushaf').then((d) => {
      if (d) setProgress(d);
    });
  }, []);

  const totalAyahs = SURAHS.reduce((a, s) => a + s.totalAyahs, 0);
  const memorizedTotal = SURAHS.reduce((a, s) => a + Math.min(s.totalAyahs, progress[s.number] ?? 0), 0);
  const completedSurahs = SURAHS.filter((s) => (progress[s.number] ?? 0) >= s.totalAyahs).length;
  const overallPct = totalAyahs ? (memorizedTotal / totalAyahs) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <GlassCard>
        <h3 className="section-title">📖 لوحة المصحف</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          {completedSurahs} سورة مكتملة · {memorizedTotal} من {totalAyahs} آية ({Math.round(overallPct)}%) — التقدم يُحتسب تلقائياً من الورد المسجَّل في «النظام المخصص»
        </p>
        <ProgressBar value={overallPct} className="mt-3" color="#34d399" />
      </GlassCard>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 xl:grid-cols-9">
        {SURAHS.map((s) => {
          const done = Math.min(s.totalAyahs, progress[s.number] ?? 0);
          const pct = s.totalAyahs ? (done / s.totalAyahs) * 100 : 0;
          const complete = pct >= 100;
          return (
            <div
              key={s.number}
              title={`${s.number}. ${s.name} — ${done}/${s.totalAyahs} آية (${Math.round(pct)}%)`}
              className={cn(
                'glass-inset relative flex flex-col items-center justify-center gap-1 overflow-hidden p-2.5 text-center transition',
                complete && 'ring-1 ring-emerald-400/50'
              )}
            >
              <div
                className="absolute inset-x-0 bottom-0 bg-emerald-500/25 transition-all duration-500"
                style={{ height: `${pct}%` }}
              />
              <span className="relative z-10 text-[9px] font-bold text-slate-500">{s.number}</span>
              <span className={cn('relative z-10 text-xs font-black', complete ? 'text-emerald-300' : 'text-slate-200')}>
                {s.name}
              </span>
              <span className="relative z-10 text-[9px] text-slate-500">
                {done}/{s.totalAyahs}
              </span>
              {complete && <span className="relative z-10 text-[10px] text-emerald-300">✓</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
