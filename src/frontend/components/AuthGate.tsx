import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LogIn, AlertTriangle } from 'lucide-react';
import logoImg from '@/assets/LOGO.png';
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthStateChange, signIn } from '@/backend/config/auth';
import { isSupabaseConfigured } from '@/backend/config/supabaseClient';

/**
 * بوابة الدخول — النظام أصبح رابطاً عاماً على GitHub Pages، فكل الأقسام
 * محمية بتسجيل دخول Supabase Auth. أنشئ المستخدم الوحيد المصرَّح له من
 * Supabase Dashboard → Authentication → Users → Add user (بريد + كلمة مرور).
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | 'loading'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then(setSession);
    return onAuthStateChange(setSession);
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-300">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-black">لم يُضبط الاتصال بـ Supabase بعد</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            أضف <code dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code> و
            {' '}<code dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> في
            ملف <code dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.env</code> (انظر
            {' '}<code dir="ltr" className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.env.example</code>) ثم أعد تشغيل
            الخادم — راجع قسم «الإعداد السحابي» في README.
          </p>
        </div>
      </div>
    );
  }

  if (session === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-sm text-slate-500">جارٍ التحقق من الجلسة…</div>
      </div>
    );
  }

  if (!session) {
    const submit = async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setLoggingIn(true);
      try {
        await signIn(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول');
      } finally {
        setLoggingIn(false);
      }
    };

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <form onSubmit={submit} className="glass w-full max-w-sm p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <img src={logoImg} alt="شعار" className="h-12 w-auto rounded-xl object-contain shadow-[0_0_20px_rgba(251,146,60,0.4)]" />
            <div className="space-y-0.5">
              <h1 className="text-lg font-black">نظام حياتي</h1>
              <p className="text-xs text-slate-500">سجّل الدخول للمتابعة</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="label">البريد الإلكتروني</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            {error && <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
            <button className="btn-primary" disabled={loggingIn}>
              <LogIn size={15} /> {loggingIn ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return children;
}
