'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  BookOpen,
  Headphones,
  BookMarked,
  Brain,
  RotateCcw,
  History,
  CheckCircle2,
  Link2,
  Minus,
  Repeat,
  ScrollText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { todayStr, fmtDateShort, lastNDays, cn } from '@/shared/utils';
import { SURAHS } from '@/shared/quranData';
import type { HosoonDay, ShanqitiSession, QuranEntry } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import EmptyState from '@/frontend/components/ui/EmptyState';
import ProgressBar from '@/frontend/components/ui/ProgressBar';
import PomodoroTimer from '@/frontend/components/PomodoroTimer';
import QuranHeatmap from '@/frontend/components/quran/QuranHeatmap';
import MushafDashboard from '@/frontend/components/quran/MushafDashboard';
import SrsPanel from '@/frontend/components/quran/SrsPanel';
import { useConfirm } from '@/frontend/hooks/useConfirm';

type System = 'hosoon' | 'shanqiti' | 'custom' | 'srs' | 'mushaf';

const SYSTEMS: { id: System; label: string; desc: string }[] = [
  { id: 'hosoon', label: '🏰 الحصون الخمسة', desc: '5 حصون يومية بخانات إنجاز' },
  { id: 'shanqiti', label: '🔁 الطريقة الشنقيطية', desc: 'تكرار مكثف بعداد + ربط ومراجعة' },
  { id: 'custom', label: '⚙️ نظام مخصص', desc: 'إدخال حر للسورة والآيات' },
  { id: 'srs', label: '🧠 المراجعة الذكية', desc: 'النظام يقرر ما تراجعه اليوم' },
  { id: 'mushaf', label: '📖 لوحة المصحف', desc: '114 سورة — نظرة شمولية لإنجازك' },
];

const FORTS: { key: 'fort1' | 'fort2' | 'fort3' | 'fort4' | 'fort5'; label: string; desc: string; icon: LucideIcon; color: string }[] = [
  { key: 'fort1', label: 'القراءة / الاستماع', desc: 'ورد التلاوة أو الاستماع اليومي', icon: Headphones, color: '#38bdf8' },
  { key: 'fort2', label: 'التحضير', desc: 'تحضير مقطع الحفظ القادم', icon: BookMarked, color: '#a78bfa' },
  { key: 'fort3', label: 'الحفظ الجديد', desc: 'حفظ المقطع الجديد وإتقانه', icon: Brain, color: '#34d399' },
  { key: 'fort4', label: 'المراجعة القريبة', desc: 'مراجعة محفوظ آخر أسبوع', icon: RotateCcw, color: '#fbbf24' },
  { key: 'fort5', label: 'المراجعة البعيدة', desc: 'مراجعة المحفوظ القديم', icon: History, color: '#fb7185' },
];

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

export default function QuranPage() {
  const today = todayStr();
  const [system, setSystem] = useState<System>('hosoon');
  const { confirm, ConfirmDialog } = useConfirm();

  // استرجاع آخر نظام مستخدم
  useEffect(() => {
    const saved = localStorage.getItem('quran-system') as System | null;
    if (saved && SYSTEMS.some((s) => s.id === saved)) setSystem(saved);
  }, []);
  const switchSystem = (s: System) => {
    setSystem(s);
    localStorage.setItem('quran-system', s);
  };

  // ===== الحصون الخمسة =====
  const [hosoonDay, setHosoonDay] = useState<HosoonDay | null>(
    () => getCached<{ day: HosoonDay }>(`/api/hosoon?date=${today}`)?.day ?? null
  );
  const [hosoonWeek, setHosoonWeek] = useState<HosoonDay[]>(
    () => getCached<{ week: HosoonDay[] }>(`/api/hosoon?date=${today}`)?.week ?? []
  );

  const loadHosoon = useCallback(async () => {
    const data = await api<{ day: HosoonDay; week: HosoonDay[] }>(`/api/hosoon?date=${today}`);
    if (data) {
      setHosoonDay(data.day);
      setHosoonWeek(data.week);
    }
  }, [today]);

  const toggleFort = async (key: (typeof FORTS)[number]['key']) => {
    if (!hosoonDay) return;
    const value = !hosoonDay[key];
    // تحديث فوري متفائل ثم حفظ
    setHosoonDay({ ...hosoonDay, [key]: value });
    const ok = await api<HosoonDay>('/api/hosoon', {
      method: 'POST',
      body: { date: today, field: key, value },
    });
    if (ok) loadHosoon();
    else setHosoonDay(hosoonDay); // تراجع عند الفشل
  };

  // ===== الشنقيطية =====
  const [sessions, setSessions] = useState<ShanqitiSession[]>(
    () => getCached<ShanqitiSession[]>('/api/crud/shanqiti') ?? []
  );

  const loadShanqiti = useCallback(async () => {
    const data = await api<ShanqitiSession[]>('/api/crud/shanqiti');
    if (data) setSessions(data);
  }, []);

  const addSession = async (f: FormData) => {
    const ok = await api('/api/crud/shanqiti', {
      method: 'POST',
      ok: 'بدأت جلسة الحفظ — وفقك الله 🤲',
      body: { date: today, verses: f.get('verses'), targetReps: Number(f.get('targetReps')) },
    });
    if (ok) loadShanqiti();
  };

  const bumpReps = async (s: ShanqitiSession, delta: number) => {
    const next = Math.max(0, s.currentReps + delta);
    // تحديث متفائل للعداد — استجابة فورية للنقر المتكرر
    setSessions((list) => list.map((x) => (x.id === s.id ? { ...x, currentReps: next } : x)));
    await api(`/api/crud/shanqiti/${s.id}`, {
      method: 'PATCH',
      body: { currentReps: next, ...(next >= s.targetReps ? { isDone: true } : { isDone: false }) },
    });
  };

  const setSessionFlag = async (s: ShanqitiSession, field: 'linkingDone' | 'reviewDone', value: boolean) => {
    const ok = await api(`/api/crud/shanqiti/${s.id}`, { method: 'PATCH', body: { [field]: value } });
    if (ok) loadShanqiti();
  };

  const delSession = async (id: string) => {
    const ok1 = await confirm({
      title: 'حذف الجلسة',
      description: 'ستُحذف جلسة الحفظ نهائياً من السجل.',
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/shanqiti/${id}`, { method: 'DELETE' });
    if (ok) loadShanqiti();
  };

  // ===== النظام المخصص =====
  const [entries, setEntries] = useState<QuranEntry[]>(
    () => getCached<QuranEntry[]>('/api/crud/quranEntries') ?? []
  );

  const loadEntries = useCallback(async () => {
    const data = await api<QuranEntry[]>('/api/crud/quranEntries');
    if (data) setEntries(data);
  }, []);

  const addEntry = async (f: FormData) => {
    const surahNumber = Number(f.get('surahNumber')) || null;
    const surahInfo = SURAHS.find((s) => s.number === surahNumber);
    const ok = await api('/api/crud/quranEntries', {
      method: 'POST',
      ok: 'سُجّل الورد — تقبل الله',
      body: {
        date: today,
        surah: surahInfo?.name ?? '',
        surahNumber,
        fromAyah: String(f.get('fromAyah') || '') || null,
        toAyah: String(f.get('toAyah') || '') || null,
        ayahCount: Number(f.get('ayahCount') || 0),
        type: f.get('type'),
        notes: String(f.get('notes') || ''),
      },
    });
    if (ok) loadEntries();
  };

  const delEntry = async (id: string) => {
    const ok = await api(`/api/crud/quranEntries/${id}`, { method: 'DELETE' });
    if (ok) loadEntries();
  };

  useEffect(() => {
    loadHosoon();
    loadShanqiti();
    loadEntries();
  }, [loadHosoon, loadShanqiti, loadEntries]);

  const fortsDone = hosoonDay ? FORTS.filter((f) => hosoonDay[f.key]).length : 0;
  const week = lastNDays(7);
  const todaySessions = sessions.filter((s) => s.date === today);
  const oldSessions = sessions.filter((s) => s.date !== today).slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black">القرآن الكريم</h1>
        <p className="mt-1 text-sm text-slate-500">﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾ — اختر نظامك والتزم به</p>
      </header>

      {/* ===== مؤقت بومودورو للتركيز أثناء الحفظ ===== */}
      <PomodoroTimer />

      {/* ===== الخريطة الحرارية — تحفيز بصري دائم الظهور ===== */}
      <QuranHeatmap />

      {/* ===== اختيار النظام ===== */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SYSTEMS.map((s) => (
          <button
            key={s.id}
            onClick={() => switchSystem(s.id)}
            className={cn(
              'glass glass-hover p-4 text-right transition',
              system === s.id && '!border-emerald-500/40 !bg-emerald-500/[0.08]'
            )}
          >
            <p className={cn('text-sm font-black', system === s.id ? 'text-emerald-300' : 'text-slate-200')}>{s.label}</p>
            <p className="mt-1 text-[11px] text-slate-500">{s.desc}</p>
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* 1) الحصون الخمسة */}
      {/* ============================================================ */}
      {system === 'hosoon' && (
        <>
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="section-title">🏰 حصون اليوم</h3>
                <p className="text-[11px] text-slate-500">أنجز الحصون الخمسة كل يوم لتحصين حفظك</p>
              </div>
              <span className={cn('chip', fortsDone === 5 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-400')}>
                {fortsDone}/5 {fortsDone === 5 && '🎉'}
              </span>
            </div>
            <ProgressBar value={(fortsDone / 5) * 100} className="mb-5" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {FORTS.map((f) => {
                const done = hosoonDay?.[f.key] ?? false;
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFort(f.key)}
                    className={cn(
                      'glass-inset flex flex-col items-center gap-2.5 p-4 text-center transition hover:bg-white/[0.05]',
                      done && 'ring-1'
                    )}
                    style={done ? { borderColor: `${f.color}55`, background: `${f.color}14`, ['--tw-ring-color' as never]: `${f.color}44` } : undefined}
                  >
                    <div className="rounded-xl border p-2.5" style={{ color: f.color, borderColor: `${f.color}33`, background: `${f.color}11` }}>
                      <Icon size={20} />
                    </div>
                    <p className="text-xs font-black">{f.label}</p>
                    <p className="text-[10px] leading-relaxed text-slate-500">{f.desc}</p>
                    <span className={cn('chip', done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/[0.05] text-slate-500')}>
                      {done ? <><CheckCircle2 size={11} /> أُنجز</> : 'لم يُنجز'}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* سجل الأسبوع */}
          <GlassCard>
            <h3 className="section-title mb-4">📅 آخر 7 أيام</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2 text-right font-bold">اليوم</th>
                    {FORTS.map((f) => (
                      <th key={f.key} className="p-2 font-bold" style={{ color: f.color }}>{f.label.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...week].reverse().map((d) => {
                    const row = d === today ? hosoonDay : hosoonWeek.find((x) => x.date === d);
                    return (
                      <tr key={d} className={cn('border-t border-white/[0.05]', d === today && 'bg-emerald-500/[0.05]')}>
                        <td className="p-2 text-right font-bold text-slate-300">
                          {d === today ? 'اليوم' : fmtDateShort(d)}
                        </td>
                        {FORTS.map((f) => (
                          <td key={f.key} className="p-2">
                            {row?.[f.key] ? (
                              <span className="inline-block h-3 w-3 rounded-full" style={{ background: f.color }} />
                            ) : (
                              <span className="inline-block h-3 w-3 rounded-full bg-white/[0.07]" />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {/* ============================================================ */}
      {/* 2) الطريقة الشنقيطية */}
      {/* ============================================================ */}
      {system === 'shanqiti' && (
        <>
          <GlassCard>
            <h3 className="section-title mb-1">🔁 جلسة حفظ جديدة</h3>
            <p className="mb-4 text-[11px] text-slate-500">
              الطريقة الشنقيطية: تكرار المقطع عشرات المرات حتى الرسوخ، ثم ربطه بما قبله، ومراجعة محفوظ الأمس يومياً.
            </p>
            <form onSubmit={onForm(addSession)} className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <label className="label">الآيات المراد حفظها</label>
                <input name="verses" className="input" required placeholder="مثال: البقرة 1–5" />
              </div>
              <div>
                <label className="label">هدف التكرار</label>
                <select name="targetReps" className="input !w-32" defaultValue="50">
                  <option value="25">25 مرة</option>
                  <option value="50">50 مرة</option>
                  <option value="100">100 مرة</option>
                </select>
              </div>
              <button className="btn-primary">
                <Plus size={15} /> بدء الجلسة
              </button>
            </form>
          </GlassCard>

          {todaySessions.length === 0 ? (
            <GlassCard>
              <EmptyState icon={Repeat} title="لا جلسات اليوم" hint="ابدأ جلسة وكرر المقطع حتى يبلغ العداد هدفك" />
            </GlassCard>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {todaySessions.map((s) => {
                const pct = (s.currentReps / Math.max(1, s.targetReps)) * 100;
                const done = s.currentReps >= s.targetReps;
                return (
                  <GlassCard key={s.id} className={cn('group', done && 'border-emerald-500/30')}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-black">📖 {s.verses}</p>
                        <p className="text-[11px] text-slate-500">جلسة اليوم · الهدف {s.targetReps} تكراراً</p>
                      </div>
                      <button className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400" onClick={() => delSession(s.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* عداد التكرار */}
                    <div className="mt-4 flex items-center justify-center gap-4">
                      <button
                        onClick={() => bumpReps(s, -1)}
                        className="btn-ghost !rounded-full !p-3"
                        aria-label="إنقاص"
                      >
                        <Minus size={18} />
                      </button>
                      <button
                        onClick={() => bumpReps(s, +1)}
                        className={cn(
                          'flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 transition active:scale-95',
                          done
                            ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.25)]'
                            : 'border-teal-400/40 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08]'
                        )}
                        aria-label="تكرار +1"
                      >
                        <span className="text-4xl font-black tabular-nums">{s.currentReps}</span>
                        <span className="text-[10px] font-bold text-slate-500">من {s.targetReps} — اضغط للعد</span>
                      </button>
                      <div className="w-11" />
                    </div>
                    <ProgressBar value={pct} className="mt-4" color={done ? '#34d399' : '#2dd4bf'} />
                    {done && (
                      <p className="mt-2 text-center text-xs font-bold text-emerald-300">
                        ✓ بلغت الهدف — ثبّت بالربط والمراجعة
                      </p>
                    )}

                    {/* الربط والمراجعة */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSessionFlag(s, 'linkingDone', !s.linkingDone)}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition',
                          s.linkingDone
                            ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                        )}
                      >
                        <Link2 size={14} /> ربط الآيات بما قبلها {s.linkingDone && '✓'}
                      </button>
                      <button
                        onClick={() => setSessionFlag(s, 'reviewDone', !s.reviewDone)}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition',
                          s.reviewDone
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                        )}
                      >
                        <RotateCcw size={14} /> مراجعة محفوظ الأمس {s.reviewDone && '✓'}
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {oldSessions.length > 0 && (
            <GlassCard>
              <h3 className="section-title mb-3">📜 جلسات سابقة</h3>
              <div className="flex flex-col gap-2">
                {oldSessions.map((s) => (
                  <div key={s.id} className="glass-inset flex items-center justify-between gap-3 p-3 text-sm">
                    <div>
                      <p className="font-bold">{s.verses}</p>
                      <p className="text-[11px] text-slate-500">
                        {fmtDateShort(s.date)} · {s.currentReps}/{s.targetReps} تكرار
                        {s.linkingDone && ' · رُبطت'}
                        {s.reviewDone && ' · روجعت'}
                      </p>
                    </div>
                    <span className={cn('chip', s.currentReps >= s.targetReps ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>
                      {s.currentReps >= s.targetReps ? 'مكتملة ✓' : 'ناقصة'}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* 3) النظام المخصص */}
      {/* ============================================================ */}
      {system === 'custom' && (
        <>
          <GlassCard>
            <h3 className="section-title mb-1">⚙️ تسجيل ورد جديد</h3>
            <p className="mb-4 text-[11px] text-slate-500">نظام مرن — سجّل أي ورد حفظ أو مراجعة بحرية حسب مستواك</p>
            <form onSubmit={onForm(addEntry)} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div className="xl:col-span-2">
                <label className="label">السورة</label>
                <select name="surahNumber" className="input" required defaultValue="">
                  <option value="" disabled>اختر السورة…</option>
                  {SURAHS.map((s) => (
                    <option key={s.number} value={s.number}>{s.number}. {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">من آية</label>
                <input name="fromAyah" type="number" min="1" className="input" placeholder="1" />
              </div>
              <div>
                <label className="label">إلى آية</label>
                <input name="toAyah" type="number" min="1" className="input" placeholder="10" />
              </div>
              <div>
                <label className="label">نوع الورد</label>
                <select name="type" className="input" defaultValue="hifz">
                  <option value="hifz">حفظ 🧠</option>
                  <option value="murajaa">مراجعة 🔄</option>
                </select>
              </div>
              <div className="flex items-end">
                <button className="btn-primary w-full">
                  <Plus size={15} /> تسجيل
                </button>
              </div>
              <div className="sm:col-span-2 xl:col-span-6">
                <input name="notes" className="input" placeholder="ملاحظات (اختياري) — مواضع متشابهة، درجة الإتقان…" />
              </div>
            </form>
          </GlassCard>

          <GlassCard>
            <h3 className="section-title mb-3">📜 سجل الورد</h3>
            {entries.length === 0 ? (
              <EmptyState icon={ScrollText} title="لا ورد مسجل بعد" hint="سجّل أول ورد حفظ أو مراجعة" />
            ) : (
              <div className="flex flex-col gap-2">
                {entries.slice(0, 20).map((e) => (
                  <div key={e.id} className="glass-inset group flex items-center justify-between gap-3 p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('rounded-lg p-2', e.type === 'hifz' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-sky-500/10 text-sky-300')}>
                        <BookOpen size={15} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">
                          {e.surah}
                          {e.fromAyah && e.toAyah ? ` (${e.fromAyah}–${e.toAyah})` : ''}
                          <span className={cn('chip mr-2', e.type === 'hifz' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300')}>
                            {e.type === 'hifz' ? 'حفظ' : 'مراجعة'}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {e.date === today ? 'اليوم' : fmtDateShort(e.date)}
                          {e.ayahCount > 0 && ` · ${e.ayahCount} آية`}
                          {e.notes && ` · ${e.notes}`}
                        </p>
                      </div>
                    </div>
                    <button className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400" onClick={() => delEntry(e.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* ============================================================ */}
      {/* 4) المراجعة الذكية (SRS) */}
      {/* ============================================================ */}
      {system === 'srs' && <SrsPanel />}

      {/* ============================================================ */}
      {/* 5) لوحة المصحف البصرية */}
      {/* ============================================================ */}
      {system === 'mushaf' && <MushafDashboard />}

      <ConfirmDialog />
    </div>
  );
}
