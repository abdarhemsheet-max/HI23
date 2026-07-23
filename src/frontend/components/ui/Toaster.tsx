'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { registerNotify, type ToastType } from '@/frontend/api';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 1;

/** نظام تنبيهات لطيف — بديل الشاشات الحمراء عند أي خطأ */
export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    registerNotify((message, type) => {
      const id = nextId++;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="print-hidden fixed bottom-20 left-1/2 z-[100] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2 lg:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass animate-fade-up flex items-center gap-3 p-3.5 text-sm font-bold ${
            t.type === 'error'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {t.type === 'error' ? (
            <AlertTriangle size={17} className="shrink-0 text-rose-300" />
          ) : (
            <CheckCircle2 size={17} className="shrink-0 text-emerald-300" />
          )}
          <p className="flex-1 leading-relaxed">{t.message}</p>
          <button
            onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
            className="text-slate-500 hover:text-white"
            aria-label="إغلاق"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
