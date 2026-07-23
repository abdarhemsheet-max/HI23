'use client';

import { useEffect, useState } from 'react';
import { api, getCached } from '@/frontend/api';
import { lastNDays, fmtDate } from '@/shared/utils';
import GlassCard from '@/frontend/components/ui/GlassCard';

/** ترتيب أيام الأسبوع في العمود بدءاً من السبت (يطابق بداية الأسبوع في بقية النظام) */
function weekdayIndex(day: string): number {
  const d = new Date(day + 'T00:00:00');
  return (d.getDay() + 1) % 7;
}

function levelOf(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

const LEVEL_BG = ['bg-white/[0.05]', 'bg-emerald-900/70', 'bg-emerald-700/80', 'bg-emerald-500/85', 'bg-emerald-400'];

/**
 * خريطة حرارية سنوية على طراز GitHub — كل مربع يوم، وكلما ازداد النشاط
 * القرآني في ذلك اليوم (حصون + شنقيطية + ورد مخصص + مراجعات SRS) ازداد
 * تشبّع اللون الأخضر. تحفيز بصري دائم الظهور أعلى قسم القرآن.
 */
export default function QuranHeatmap() {
  const [data, setData] = useState<Record<string, number>>(
    () => getCached<Record<string, number>>('/api/quran/heatmap') ?? {}
  );

  useEffect(() => {
    api<Record<string, number>>('/api/quran/heatmap').then((d) => {
      if (d) setData(d);
    });
  }, []);

  const days = lastNDays(371); // ~53 أسبوعاً — سنة كاملة تقريباً تنتهي باليوم
  const padded: (string | null)[] = [...Array(weekdayIndex(days[0])).fill(null), ...days];
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  const monthLabels = weeks.map((week, i) => {
    const firstReal = week.find((d): d is string => d !== null);
    if (!firstReal) return null;
    const prevReal = weeks[i - 1]?.find((d): d is string => d !== null);
    const curMonth = firstReal.slice(0, 7);
    if (!prevReal || prevReal.slice(0, 7) !== curMonth) {
      return new Date(firstReal + 'T00:00:00').toLocaleDateString('ar-LY', { month: 'short' });
    }
    return null;
  });

  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(data).filter((n) => n > 0).length;

  return (
    <GlassCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="section-title">🔥 خريطة الإنجاز السنوية</h3>
          <p className="text-[11px] text-slate-500">{activeDays} يوم نشاط · {total} إنجازاً خلال آخر سنة</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          أقل
          {LEVEL_BG.map((c, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-sm ${c}`} />
          ))}
          أكثر
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-1">
            {weeks.map((_, i) => (
              <div key={i} className="w-3 shrink-0 text-[9px] text-slate-600">
                {monthLabels[i] ?? ''}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((d, di) =>
                  d ? (
                    <div
                      key={di}
                      title={`${fmtDate(d)} — ${data[d] ?? 0} إنجاز`}
                      className={`h-3 w-3 rounded-sm transition ${LEVEL_BG[levelOf(data[d] ?? 0)]}`}
                    />
                  ) : (
                    <div key={di} className="h-3 w-3" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
