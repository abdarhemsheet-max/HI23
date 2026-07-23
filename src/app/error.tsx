'use client';

import { RefreshCcw, Home, AlertTriangle } from 'lucide-react';

/**
 * درع الأخطاء العام — أي خطأ غير متوقع في أي صفحة يظهر هنا
 * كواجهة ودّية قابلة للاسترداد بدلاً من الشاشة الحمراء.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 w-fit rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-300">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-lg font-black">حدث خطأ غير متوقع</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          لا تقلق — بياناتك سليمة ومحفوظة محلياً. جرّب إعادة المحاولة، وإن تكرر الخطأ أغلق النافذة وشغّل النظام من جديد عبر START.bat.
        </p>
        {error?.digest && (
          <p className="mt-2 text-[10px] text-slate-600" dir="ltr">رمز الخطأ: {error.digest}</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => reset()}>
            <RefreshCcw size={15} /> إعادة المحاولة
          </button>
          <a href="/" className="btn-ghost">
            <Home size={15} /> الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}
