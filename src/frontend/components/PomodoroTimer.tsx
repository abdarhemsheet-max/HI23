'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Brain, Coffee } from 'lucide-react';
import { notify } from '@/frontend/api';
import { todayStr, cn } from '@/shared/utils';

const FOCUS_MIN = 25;
const BREAK_MIN = 5;

/**
 * مؤقت بومودورو مدمج لجلسات حفظ القرآن —
 * 25 دقيقة تركيز ثم 5 دقائق راحة، مع عدّاد جلسات اليوم (يُحفظ محلياً).
 */
export default function PomodoroTimer() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [remaining, setRemaining] = useState(FOCUS_MIN * 60);
  const [running, setRunning] = useState(false);
  const [doneToday, setDoneToday] = useState(0);
  const endRef = useRef(0);

  const storageKey = `pomodoro-${todayStr()}`;

  useEffect(() => {
    setDoneToday(Number(localStorage.getItem(storageKey) ?? 0));
  }, [storageKey]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        if (mode === 'focus') {
          const next = doneToday + 1;
          setDoneToday(next);
          localStorage.setItem(storageKey, String(next));
          notify('🍅 أتممت جلسة تركيز — خذ 5 دقائق راحة', 'success');
          setMode('break');
          setRemaining(BREAK_MIN * 60);
        } else {
          notify('☕ انتهت الراحة — عُد للحفظ بهمّة', 'success');
          setMode('focus');
          setRemaining(FOCUS_MIN * 60);
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, [running, mode, doneToday, storageKey]);

  const toggle = () => {
    if (!running) endRef.current = Date.now() + remaining * 1000;
    setRunning(!running);
  };

  const reset = () => {
    setRunning(false);
    setRemaining((mode === 'focus' ? FOCUS_MIN : BREAK_MIN) * 60);
  };

  const switchMode = (m: 'focus' | 'break') => {
    setRunning(false);
    setMode(m);
    setRemaining((m === 'focus' ? FOCUS_MIN : BREAK_MIN) * 60);
  };

  const total = (mode === 'focus' ? FOCUS_MIN : BREAK_MIN) * 60;
  const pct = ((total - remaining) / total) * 100;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const color = mode === 'focus' ? '#34d399' : '#fbbf24';

  return (
    <div className="glass flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-4">
        {/* حلقة التقدم */}
        <div className="relative h-20 w-20">
          <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 * (1 - pct / 100)}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-base font-black tabular-nums">
            {mm}:{ss}
          </span>
        </div>
        <div>
          <p className="text-sm font-black">
            {mode === 'focus' ? '🍅 جلسة تركيز للحفظ' : '☕ استراحة قصيرة'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {FOCUS_MIN} دقيقة تركيز · {BREAK_MIN} دقائق راحة — جلسات اليوم: <b className="text-emerald-300">{doneToday}</b>
          </p>
          <div className="mt-2 flex gap-1.5">
            <button
              onClick={() => switchMode('focus')}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition',
                mode === 'focus'
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-500 hover:text-slate-300'
              )}
            >
              <Brain size={11} /> تركيز
            </button>
            <button
              onClick={() => switchMode('break')}
              className={cn(
                'flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition',
                mode === 'break'
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-500 hover:text-slate-300'
              )}
            >
              <Coffee size={11} /> راحة
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggle} className="btn-primary !px-5">
          {running ? <><Pause size={15} /> إيقاف</> : <><Play size={15} /> ابدأ</>}
        </button>
        <button onClick={reset} className="btn-ghost !p-2.5" aria-label="إعادة">
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}
