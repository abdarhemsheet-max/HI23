'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wallet as WalletIcon,
  TrendingUp,
  TrendingDown,
  Hourglass,
  Flame,
  Target,
  Briefcase,
  BookOpen,
  GraduationCap,
  CalendarClock,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { fmtMoney, fmtDate, calcStreak, daysUntil, cn } from '@/shared/utils';
import { usePrivacyMode } from '@/frontend/hooks/usePrivacyMode';
import PrivacyToggleButton from '@/frontend/components/ui/PrivacyToggleButton';
import type {
  Wallet,
  Transaction,
  Debt,
  Subscription,
  DailyTask,
  Habit,
  WeeklyFocus,
  Project,
  HosoonDay,
  LearningItem,
} from '@/shared/types';
import StatCard from '@/frontend/components/ui/StatCard';
import GlassCard from '@/frontend/components/ui/GlassCard';
import ProgressBar from '@/frontend/components/ui/ProgressBar';

interface Summary {
  today: string;
  wallets: Wallet[];
  monthTxns: Transaction[];
  pendingTxns: Transaction[];
  debts: Debt[];
  subscriptions: Subscription[];
  tasks: DailyTask[];
  habits: Habit[];
  focus: WeeklyFocus | null;
  projects: Project[];
  hosoonToday: HosoonDay | null;
  learning: LearningItem[];
}

export default function HomePage() {
  // العرض الفوري من الكاش ثم التحديث بصمت — لا شاشة فارغة عند التنقل
  const [s, setS] = useState<Summary | null>(() => getCached<Summary>('/api/summary'));
  const { showBalances, togglePrivacy } = usePrivacyMode();

  const load = useCallback(async () => {
    const data = await api<Summary>('/api/summary');
    if (data) setS(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTask = async (task: DailyTask, done: boolean) => {
    if (!s) return;
    await api('/api/toggle-log', {
      method: 'POST',
      body: { kind: 'task', id: task.id, date: s.today, done },
    });
    load();
  };

  // ===== حسابات =====
  const totalBalance = s?.wallets.reduce((a, w) => a + w.balance, 0) ?? 0;
  const income = s?.monthTxns.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0) ?? 0;
  const expenses = s?.monthTxns.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0) ?? 0;
  const pending = s?.pendingTxns.reduce((a, t) => a + t.amount, 0) ?? 0;

  const todayTasks = (s?.tasks ?? []).filter(
    (t) => t.kind === 'recurring' || t.date === s?.today
  );
  const doneTasks = todayTasks.filter((t) => t.logs.some((l) => l.date === s?.today));

  const topHabits = (s?.habits ?? [])
    .map((h) => ({ ...h, streak: calcStreak(new Set(h.logs.map((l) => l.date))) }))
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 4);

  const hosoonDone = s?.hosoonToday
    ? [s.hosoonToday.fort1, s.hosoonToday.fort2, s.hosoonToday.fort3, s.hosoonToday.fort4, s.hosoonToday.fort5].filter(Boolean).length
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">
            أهلاً عبدالرحيم <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">{fmtDate(new Date())} — كل شيء تحت السيطرة</p>
        </div>
        <PrivacyToggleButton visible={showBalances} onToggle={togglePrivacy} />
      </header>

      {/* ===== بطاقات مالية سريعة ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="الرصيد الإجمالي" value={s ? fmtMoney(totalBalance) : '…'} icon={WalletIcon} tone="emerald" sub={`${s?.wallets.length ?? 0} محفظة`} blurred={!showBalances} />
        <StatCard title="دخل هذا الشهر" value={s ? fmtMoney(income) : '…'} icon={TrendingUp} tone="sky" blurred={!showBalances} />
        <StatCard title="مصروفات الشهر" value={s ? fmtMoney(expenses) : '…'} icon={TrendingDown} tone="rose" blurred={!showBalances} />
        <StatCard title="أرباح معلقة" value={s ? fmtMoney(pending) : '…'} icon={Hourglass} tone="amber" sub="بانتظار التحصيل" blurred={!showBalances} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* ===== تركيز الأسبوع ===== */}
        <GlassCard className="border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-transparent lg:col-span-2 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-2.5 text-amber-300">
                <Target size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-amber-400/80">🎯 تركيز هذا الأسبوع — التزام صارم</p>
                {s?.focus ? (
                  <p className="text-lg font-black">{s.focus.title}</p>
                ) : (
                  <p className="text-sm text-slate-500">لم تحدد تركيز الأسبوع بعد</p>
                )}
              </div>
            </div>
            <Link href="/habits" className="btn-ghost !px-3 !py-1.5 text-xs">
              {s?.focus ? 'التفاصيل' : 'حدده الآن'}
            </Link>
          </div>
        </GlassCard>

        {/* ===== مهام اليوم ===== */}
        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="section-title">✅ مهام اليوم</h3>
            <span className="chip bg-white/[0.06] text-slate-400">
              {doneTasks.length}/{todayTasks.length}
            </span>
          </div>
          <ProgressBar value={todayTasks.length ? (doneTasks.length / todayTasks.length) * 100 : 0} className="mb-4" />
          <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
            {todayTasks.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">لا مهام — أضفها من قسم العادات</p>
            )}
            {todayTasks.slice(0, 8).map((t) => {
              const done = t.logs.some((l) => l.date === s?.today);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTask(t, !done)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-right text-sm font-semibold transition',
                    done ? 'text-slate-500 line-through' : 'text-slate-200 hover:bg-white/[0.05]'
                  )}
                >
                  {done ? <CheckCircle2 size={17} className="shrink-0 text-emerald-400" /> : <Circle size={17} className="shrink-0 text-slate-600" />}
                  {t.title}
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* ===== أقوى العادات ===== */}
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">🔥 سلاسل العادات</h3>
            <Link href="/habits" className="text-xs font-bold text-emerald-400 hover:underline">الكل</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {topHabits.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">أنشئ أول عادة وابدأ السلسلة</p>
            )}
            {topHabits.map((h) => (
              <div key={h.id} className="glass-inset flex items-center justify-between px-3.5 py-2.5">
                <span className="text-sm font-bold">{h.icon} {h.name}</span>
                <span className={cn('flex items-center gap-1 text-sm font-black', h.streak > 0 ? 'text-orange-400' : 'text-slate-600')}>
                  <Flame size={15} /> {h.streak}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* ===== ورد اليوم + التعلم ===== */}
        <div className="flex flex-col gap-4">
          <GlassCard className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="section-title">📖 ورد اليوم</h3>
              <Link href="/quran" className="text-xs font-bold text-emerald-400 hover:underline">فتح</Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-300">
                <BookOpen size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black">{hosoonDone} من 5 حصون</p>
                <ProgressBar value={(hosoonDone / 5) * 100} className="mt-1.5" />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="section-title">🎓 أتعلم الآن</h3>
              <Link href="/learning" className="text-xs font-bold text-emerald-400 hover:underline">الكل</Link>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {(s?.learning ?? []).length === 0 && (
                <p className="py-3 text-center text-xs text-slate-600">لا كورسات أو كتب قيد التقدم</p>
              )}
              {(s?.learning ?? []).map((l) => (
                <div key={l.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold">
                      <GraduationCap size={13} className="text-violet-300" /> {l.title}
                    </span>
                    <span className="text-slate-500">{Math.round((l.doneUnits / Math.max(1, l.totalUnits)) * 100)}%</span>
                  </div>
                  <ProgressBar value={(l.doneUnits / Math.max(1, l.totalUnits)) * 100} color="#a78bfa" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ===== المشاريع النشطة ===== */}
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">💼 مشاريع نشطة</h3>
            <Link href="/projects" className="text-xs font-bold text-emerald-400 hover:underline">الكل</Link>
          </div>
          <div className="flex flex-col gap-3">
            {(s?.projects ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">لا مشاريع نشطة حالياً</p>
            )}
            {(s?.projects ?? []).slice(0, 4).map((p) => {
              const total = p.tasks.length;
              const done = p.tasks.filter((t) => t.isCompleted).length;
              return (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Briefcase size={13} style={{ color: p.color }} /> {p.name}
                    </span>
                    <span className="text-slate-500">{done}/{total}</span>
                  </div>
                  <ProgressBar value={total ? (done / total) * 100 : 0} color={p.color} />
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* ===== تجديدات قريبة ===== */}
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="section-title">⏰ تجديدات قادمة</h3>
            <Link href="/finance" className="text-xs font-bold text-emerald-400 hover:underline">الاشتراكات</Link>
          </div>
          <div className="flex flex-col gap-2">
            {(s?.subscriptions ?? []).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">لا اشتراكات نشطة</p>
            )}
            {(s?.subscriptions ?? []).map((sub) => {
              const days = daysUntil(sub.nextRenewal);
              return (
                <div key={sub.id} className="glass-inset flex items-center justify-between px-3.5 py-2.5 text-sm">
                  <span className="flex items-center gap-2 font-bold">
                    <CalendarClock size={14} className="text-sky-300" /> {sub.name}
                  </span>
                  <span className={cn('chip', days <= 3 ? 'bg-rose-500/15 text-rose-300' : days <= 7 ? 'bg-amber-500/15 text-amber-300' : 'bg-white/[0.06] text-slate-400')}>
                    {days < 0 ? 'متأخر!' : days === 0 ? 'اليوم' : `بعد ${days} يوم`}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
