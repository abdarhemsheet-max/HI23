'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, Pause, Play, X } from 'lucide-react';
import { notify } from '@/frontend/api';
import { cn } from '@/shared/utils';

const PRESETS = [5, 10, 25]; // دقائق

/** ساعة حية + مؤقت سريع — يسكن أسفل الشريط الجانبي */
export default function GlobalTimer() {
  const [now, setNow] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState(0); // ثوانٍ
  const [running, setRunning] = useState(false);
  const endRef = useRef(0);

  // الساعة الحية (تُهيأ بعد التركيب لتفادي اختلاف SSR)
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // عدّاد المؤقت
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        notify('⏰ انتهى الوقت!', 'success');
      }
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const start = (minutes: number) => {
    endRef.current = Date.now() + minutes * 60_000;
    setRemaining(minutes * 60);
    setRunning(true);
  };
  const resume = () => {
    endRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setRemaining(0);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const active = running || remaining > 0;

  return (
    <div className="glass-inset mb-3 p-3">
      {/* الساعة */}
      <div className="text-center">
        <p className="text-xl font-black tabular-nums tracking-wider">
          {now
            ? now.toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : '—:—:—'}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {now ? now.toLocaleDateString('ar-LY', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
        </p>
      </div>

      {/* المؤقت */}
      <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
        {!active ? (
          <div className="flex items-center justify-center gap-1.5">
            <Timer size={13} className="text-slate-500" />
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => start(m)}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-300"
              >
                {m}د
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <span
              className={cn(
                'text-lg font-black tabular-nums',
                running ? 'text-emerald-300' : 'text-amber-300'
              )}
            >
              {mm}:{ss}
            </span>
            <button
              onClick={() => (running ? setRunning(false) : resume())}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-1.5 text-slate-300 hover:bg-white/10"
              aria-label={running ? 'إيقاف مؤقت' : 'استئناف'}
            >
              {running ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-white/10 bg-white/[0.05] p-1.5 text-slate-500 hover:text-rose-300"
              aria-label="إلغاء"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
