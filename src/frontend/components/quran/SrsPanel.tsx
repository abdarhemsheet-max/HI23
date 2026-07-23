'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Brain, Smile, Meh, Frown, Sparkles, CalendarClock } from 'lucide-react';
import { api, getCached, notify } from '@/frontend/api';
import { todayStr, fmtDateShort, daysUntil, cn } from '@/shared/utils';
import { SURAHS } from '@/shared/quranData';
import type { SrsCard } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import EmptyState from '@/frontend/components/ui/EmptyState';
import { useConfirm } from '@/frontend/hooks/useConfirm';

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

/**
 * نظام المراجعة الذكية (SRS): النظام — لا المستخدم — يقرر ما يُراجَع اليوم.
 * بعد كل مراجعة يقيّم المستخدم قوة حفظه (سهل/متوسط/صعب) فتُجدول المراجعة
 * القادمة تلقائياً عبر خوارزمية SM-2 مبسّطة (src/backend/srs.ts).
 */
export default function SrsPanel() {
  const today = todayStr();
  const { confirm, ConfirmDialog } = useConfirm();
  const [cards, setCards] = useState<SrsCard[]>(() => getCached<SrsCard[]>('/api/crud/srsCards') ?? []);
  const [reviewing, setReviewing] = useState<string | null>(null); // منع نقرات مزدوجة أثناء التقييم

  const load = useCallback(async () => {
    const data = await api<SrsCard[]>('/api/crud/srsCards');
    if (data) setCards(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCard = async (f: FormData) => {
    const surahNumber = String(f.get('surahNumber') || '');
    const ok = await api('/api/crud/srsCards', {
      method: 'POST',
      ok: 'أُضيفت البطاقة — ستُراجعها اليوم أول مرة',
      body: {
        label: f.get('label'),
        surahNumber: surahNumber || null,
        dueDate: today,
      },
    });
    if (ok) load();
  };

  const rate = async (card: SrsCard, rating: 'easy' | 'medium' | 'hard') => {
    setReviewing(card.id);
    const ok = await api<SrsCard>(`/api/quran/srs/${card.id}/review`, {
      method: 'POST',
      body: { rating, today },
    });
    setReviewing(null);
    if (ok) {
      const label = rating === 'easy' ? '🟢 سهل' : rating === 'medium' ? '🟡 متوسط' : '🔴 صعب';
      const days = daysUntil(ok.dueDate);
      notify(`${label} — المراجعة القادمة بعد ${days} يوم (${fmtDateShort(ok.dueDate)})`, 'success');
      load();
    }
  };

  const delCard = async (card: SrsCard) => {
    const ok1 = await confirm({
      title: 'حذف البطاقة',
      description: `سيُحذف «${card.label}» وكل سجل مراجعاته نهائياً.`,
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/srsCards/${card.id}`, { method: 'DELETE' });
    if (ok) load();
  };

  const active = cards.filter((c) => c.isActive);
  const dueCards = active.filter((c) => c.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = active
    .filter((c) => c.dueDate > today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="flex flex-col gap-4">
      {/* إضافة بطاقة جديدة */}
      <GlassCard>
        <h3 className="section-title mb-1">🧠 إضافة بطاقة للمراجعة الذكية</h3>
        <p className="mb-4 text-[11px] text-slate-500">
          سجّل وجهاً أو سورة أو مقطعاً محفوظاً — سيقرر النظام موعد مراجعته القادمة بناءً على تقييمك
        </p>
        <form onSubmit={onForm(addCard)} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="label">وصف المحفوظ</label>
            <input name="label" className="input" required placeholder="مثال: وجه 5 — البقرة 30–35" />
          </div>
          <div className="min-w-40">
            <label className="label">السورة (اختياري — لربطها بلوحة المصحف)</label>
            <select name="surahNumber" className="input">
              <option value="">— بدون ربط —</option>
              {SURAHS.map((s) => (
                <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary">
            <Plus size={15} /> إضافة
          </button>
        </form>
      </GlassCard>

      {/* بطاقات مستحقة اليوم */}
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title">📌 مستحقة اليوم</h3>
          <span className={cn('chip', dueCards.length > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300')}>
            {dueCards.length} بطاقة
          </span>
        </div>
        {dueCards.length === 0 ? (
          <EmptyState icon={Sparkles} title="لا مراجعات مستحقة اليوم 🎉" hint="أحسنت! عُد غداً أو أضف بطاقة جديدة" />
        ) : (
          <div className="flex flex-col gap-3">
            {dueCards.map((c) => (
              <div key={c.id} className="glass-inset flex flex-wrap items-center justify-between gap-3 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-300">
                    <Brain size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black">{c.label}</p>
                    <p className="text-[11px] text-slate-500">
                      {c.reviewCount === 0 ? 'أول مراجعة' : `رُوجعت ${c.reviewCount} مرة`}
                      {c.dueDate < today && <span className="text-rose-400"> · متأخرة</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={reviewing === c.id}
                    onClick={() => rate(c, 'hard')}
                    className="flex items-center gap-1 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    <Frown size={14} /> صعب
                  </button>
                  <button
                    disabled={reviewing === c.id}
                    onClick={() => rate(c, 'medium')}
                    className="flex items-center gap-1 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    <Meh size={14} /> متوسط
                  </button>
                  <button
                    disabled={reviewing === c.id}
                    onClick={() => rate(c, 'easy')}
                    className="flex items-center gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    <Smile size={14} /> سهل
                  </button>
                  <button className="text-slate-600 hover:text-rose-400" onClick={() => delCard(c)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* البطاقات القادمة */}
      {upcoming.length > 0 && (
        <GlassCard>
          <h3 className="section-title mb-3">🗓 مراجعات قادمة</h3>
          <div className="flex flex-col gap-2">
            {upcoming.map((c) => (
              <div key={c.id} className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <CalendarClock size={14} className="text-slate-500" />
                  <p className="text-sm font-semibold text-slate-300">{c.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip bg-white/[0.06] text-slate-400">
                    بعد {daysUntil(c.dueDate)} يوم — {fmtDateShort(c.dueDate)}
                  </span>
                  <button
                    className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400"
                    onClick={() => delCard(c)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <ConfirmDialog />
    </div>
  );
}
