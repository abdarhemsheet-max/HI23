'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Flame,
  Target,
  CheckCircle2,
  Circle,
  ListChecks,
  Pencil,
} from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { todayStr, weekStartStr, lastNDays, calcStreak, cn } from '@/shared/utils';
import type { DailyTask, Habit, WeeklyFocus } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import ProgressBar from '@/frontend/components/ui/ProgressBar';
import { useConfirm } from '@/frontend/hooks/useConfirm';

const HABIT_ICONS = ['🔥', '📖', '🏃', '💧', '🧠', '🕌', '✍️', '💪', '🌅', '🎯'];

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

export default function HabitsPage() {
  const today = todayStr();
  const weekStart = weekStartStr();

  const [tasks, setTasks] = useState<DailyTask[]>(() => getCached<DailyTask[]>('/api/crud/dailyTasks') ?? []);
  const [habits, setHabits] = useState<Habit[]>(() => getCached<Habit[]>('/api/crud/habits') ?? []);
  const [focusList, setFocusList] = useState<WeeklyFocus[]>(() => getCached<WeeklyFocus[]>('/api/crud/weeklyFocus') ?? []);
  const [modal, setModal] = useState<null | 'task' | 'habit' | 'focus'>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const [t, h, f] = await Promise.all([
      api<DailyTask[]>('/api/crud/dailyTasks'),
      api<Habit[]>('/api/crud/habits'),
      api<WeeklyFocus[]>('/api/crud/weeklyFocus'),
    ]);
    if (t) setTasks(t);
    if (h) setHabits(h);
    if (f) setFocusList(f);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const focus = focusList.find((f) => f.weekStart === weekStart) ?? null;
  const focusDone: string[] = focus ? (JSON.parse(focus.doneDates || '[]') as string[]) : [];

  // ===== مهام اليوم =====
  const todayTasks = tasks.filter((t) => t.isActive && (t.kind === 'recurring' || t.date === today));
  const doneCount = todayTasks.filter((t) => t.logs.some((l) => l.date === today)).length;

  const toggleTask = async (t: DailyTask, done: boolean) => {
    // تحديث متفائل: الخانة تتبدّل فوراً قبل رد الخادم
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? { ...x, logs: done ? [...x.logs, { date: today }] : x.logs.filter((l) => l.date !== today) }
          : x
      )
    );
    await api('/api/toggle-log', {
      method: 'POST',
      body: { kind: 'task', id: t.id, date: today, done },
    });
    load();
  };

  const addTask = async (f: FormData) => {
    const ok = await api('/api/crud/dailyTasks', {
      method: 'POST',
      ok: 'أُضيفت المهمة',
      body: { title: f.get('title'), kind: f.get('kind'), date: today },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  // ===== العادات =====
  const checkinHabit = async (h: Habit, done: boolean) => {
    // تحديث متفائل: السلسلة والعلامة تتغيّران لحظياً
    setHabits((prev) =>
      prev.map((x) =>
        x.id === h.id
          ? { ...x, logs: done ? [...x.logs, { date: today }] : x.logs.filter((l) => l.date !== today) }
          : x
      )
    );
    await api('/api/toggle-log', {
      method: 'POST',
      ok: done ? `🔥 استمر! سلسلة «${h.name}» مشتعلة` : undefined,
      body: { kind: 'habit', id: h.id, date: today, done },
    });
    load();
  };

  const addHabit = async (f: FormData) => {
    const ok = await api('/api/crud/habits', {
      method: 'POST',
      ok: 'أُنشئت العادة — ابدأ سلسلتك اليوم!',
      body: { name: f.get('name'), icon: f.get('icon') },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  // ===== تركيز الأسبوع =====
  const saveFocus = async (f: FormData) => {
    const ok = await api('/api/crud/weeklyFocus', {
      method: 'POST',
      ok: 'ثُبّت تركيز الأسبوع 🎯',
      body: { title: f.get('title'), description: String(f.get('description') || ''), weekStart },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const toggleFocusToday = async () => {
    if (!focus) return;
    const next = focusDone.includes(today)
      ? focusDone.filter((d) => d !== today)
      : [...focusDone, today];
    const ok = await api(`/api/crud/weeklyFocus/${focus.id}`, {
      method: 'PATCH',
      body: { doneDates: next },
    });
    if (ok) load();
  };

  const del = (resource: string, label: string) => async (id: string) => {
    const ok1 = await confirm({
      title: `حذف ${label}`,
      description: `سيُحذف سجل ${label} بالكامل ولا يمكن التراجع عن هذا الإجراء.`,
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/${resource}/${id}`, { method: 'DELETE' });
    if (ok) load();
  };

  const week = lastNDays(7);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-black">العادات والمهام</h1>
        <p className="mt-1 text-sm text-slate-500">استمرارية يومية تبني إنساناً مختلفاً</p>
      </header>

      {/* ===== تركيز الأسبوع (تصميم مضغوط) ===== */}
      <GlassCard className="border-amber-500/25 bg-gradient-to-br from-amber-500/[0.1] via-transparent to-transparent !p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-2 text-amber-300">
              <Target size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-400/80">
                🎯 تركيز هذا الأسبوع
              </p>
              {focus ? (
                <>
                  <h2 className="text-base font-black leading-tight">{focus.title}</h2>
                  {focus.description && <p className="text-[11px] text-slate-400">{focus.description}</p>}
                </>
              ) : (
                <p className="text-xs text-slate-500">حدد هدفاً واحداً تلتزم به بصرامة هذا الأسبوع</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {focus && (
              <button
                onClick={toggleFocusToday}
                className={cn(
                  'btn-ghost !px-3 !py-1.5 text-xs',
                  focusDone.includes(today) && '!border-amber-500/40 !bg-amber-500/15 !text-amber-300'
                )}
              >
                {focusDone.includes(today) ? '✓ التزمت' : 'التزمت اليوم؟'}
              </button>
            )}
            <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setModal('focus')}>
              <Pencil size={12} /> {focus ? 'تغيير' : 'تحديد'}
            </button>
          </div>
        </div>
        {focus && (
          <div className="mt-3 flex items-center gap-1">
            {week.map((d) => (
              <div
                key={d}
                title={d}
                className={cn(
                  'h-2 flex-1 rounded-full',
                  focusDone.includes(d) ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-white/[0.07]'
                )}
              />
            ))}
          </div>
        )}
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ===== مهام اليوم ===== */}
        <GlassCard className="!p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black">✅ مهام اليوم</h3>
              <p className="text-[10px] text-slate-500">المتكررة تتجدد تلقائياً كل يوم</p>
            </div>
            <button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setModal('task')}>
              <Plus size={13} /> مهمة
            </button>
          </div>
          <ProgressBar value={todayTasks.length ? (doneCount / todayTasks.length) * 100 : 0} className="mb-4" />
          {todayTasks.length === 0 ? (
            <EmptyState icon={ListChecks} title="لا مهام لليوم" hint="أضف مهامك المتكررة أو مهمة لليوم فقط" />
          ) : (
            <div className="flex flex-col gap-1.5">
              {todayTasks.map((t) => {
                const done = t.logs.some((l) => l.date === today);
                return (
                  <div key={t.id} className="group flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-white/[0.04]">
                    <button
                      onClick={() => toggleTask(t, !done)}
                      className={cn(
                        'flex flex-1 items-center gap-2.5 py-1.5 text-right text-sm font-semibold transition',
                        done ? 'text-slate-500 line-through' : 'text-slate-200'
                      )}
                    >
                      {done ? (
                        <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
                      ) : (
                        <Circle size={18} className="shrink-0 text-slate-600" />
                      )}
                      {t.title}
                      {t.kind === 'once' && <span className="chip bg-sky-500/10 text-sky-300">اليوم فقط</span>}
                    </button>
                    <button
                      className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400"
                      onClick={() => del('dailyTasks', 'المهمة')(t.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* ===== العادات (Streaks) — تصميم مضغوط ===== */}
        <GlassCard className="!p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black">🔥 العادات</h3>
              <p className="text-[10px] text-slate-500">تفويت يوم يكسر السلسلة — مثل سناب شات</p>
            </div>
            <button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setModal('habit')}>
              <Plus size={13} /> عادة
            </button>
          </div>
          {habits.filter((h) => h.isActive).length === 0 ? (
            <EmptyState icon={Flame} title="لا عادات بعد" hint="قراءة، رياضة، ماء، استيقاظ مبكر…" />
          ) : (
            <div className="flex flex-col gap-2">
              {habits
                .filter((h) => h.isActive)
                .map((h) => {
                  const dates = new Set(h.logs.map((l) => l.date));
                  const streak = calcStreak(dates);
                  const doneToday = dates.has(today);
                  return (
                    <div key={h.id} className="glass-inset group flex items-center gap-2.5 p-2.5">
                      <span className="text-lg">{h.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black leading-tight">{h.name}</p>
                        {/* آخر 7 أيام — مصغّرة تحت الاسم مباشرة */}
                        <div className="mt-1 flex items-center gap-0.5">
                          {week.map((d) => (
                            <div
                              key={d}
                              title={d}
                              className={cn(
                                'h-1.5 flex-1 rounded-full',
                                dates.has(d) ? 'bg-emerald-400/90' : 'bg-white/[0.06]'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-sm font-black',
                          streak >= 30
                            ? 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300'
                            : streak >= 7
                              ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                              : streak > 0
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-white/[0.07] bg-white/[0.04] text-slate-600'
                        )}
                        title={streak > 0 ? `سلسلة ${streak} يوم` : 'ابدأ سلسلتك'}
                      >
                        <Flame size={13} /> {streak}
                      </span>
                      <button
                        onClick={() => checkinHabit(h, !doneToday)}
                        className={cn(
                          'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold transition',
                          doneToday
                            ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                            : 'btn-primary !py-1.5 !text-xs'
                        )}
                      >
                        {doneToday ? '✓' : 'إنجاز'}
                      </button>
                      <button
                        className="shrink-0 text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400"
                        onClick={() => del('habits', 'العادة')(h.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ===== النوافذ ===== */}
      <Modal open={modal === 'task'} onClose={() => setModal(null)} title="مهمة جديدة">
        <form onSubmit={onForm(addTask)} className="flex flex-col gap-4">
          <div>
            <label className="label">عنوان المهمة</label>
            <input name="title" className="input" required autoFocus placeholder="مراجعة البريد، تمارين…" />
          </div>
          <div>
            <label className="label">النوع</label>
            <select name="kind" className="input" defaultValue="recurring">
              <option value="recurring">متكررة — تتجدد كل يوم ♻️</option>
              <option value="once">لليوم فقط 📌</option>
            </select>
          </div>
          <button className="btn-primary">إضافة المهمة</button>
        </form>
      </Modal>

      <Modal open={modal === 'habit'} onClose={() => setModal(null)} title="عادة جديدة">
        <form onSubmit={onForm(addHabit)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم العادة</label>
            <input name="name" className="input" required autoFocus placeholder="قراءة 20 صفحة…" />
          </div>
          <div>
            <label className="label">الأيقونة</label>
            <select name="icon" className="input" defaultValue="🔥">
              {HABIT_ICONS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary">إنشاء العادة</button>
        </form>
      </Modal>

      <Modal open={modal === 'focus'} onClose={() => setModal(null)} title="🎯 تركيز الأسبوع">
        <form onSubmit={onForm(saveFocus)} className="flex flex-col gap-4">
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
            عادة واحدة أو هدف رئيسي واحد فقط — التزام صارم طوال الأسبوع.
          </p>
          <div>
            <label className="label">التركيز</label>
            <input name="title" className="input" required autoFocus defaultValue={focus?.title ?? ''} placeholder="الاستيقاظ 5 فجراً يومياً" />
          </div>
          <div>
            <label className="label">لماذا؟ (اختياري)</label>
            <textarea name="description" className="input" rows={2} defaultValue={focus?.description ?? ''} placeholder="الدافع وراء هذا الالتزام…" />
          </div>
          <button className="btn-primary">تثبيت التركيز</button>
        </form>
      </Modal>

      <ConfirmDialog />
    </div>
  );
}
