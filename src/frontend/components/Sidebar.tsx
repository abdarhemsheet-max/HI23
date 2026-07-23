import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Flame,
  Briefcase,
  FileText,
  FolderOpen,
  BookOpen,
  GraduationCap,
  Sparkles,
  DatabaseBackup,
  LogOut,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { signOut } from '@/backend/config/auth';
import { downloadBackup } from '@/backend/services/backup';
import GlobalTimer from '@/frontend/components/GlobalTimer';

const NAV = [
  { href: '/', label: 'الرئيسية', short: 'الرئيسية', icon: LayoutDashboard },
  { href: '/finance', label: 'المالية', short: 'المالية', icon: Wallet },
  { href: '/habits', label: 'العادات والمهام', short: 'العادات', icon: Flame },
  { href: '/projects', label: 'الأعمال والمشاريع', short: 'الأعمال', icon: Briefcase },
  { href: '/reports', label: 'التقارير', short: 'التقارير', icon: FileText },
  { href: '/documents', label: 'أرشيف المستندات', short: 'المستندات', icon: FolderOpen },
  { href: '/quran', label: 'القرآن الكريم', short: 'القرآن', icon: BookOpen },
  { href: '/learning', label: 'التعلم والقراءة', short: 'التعلم', icon: GraduationCap },
];

export default function Sidebar() {
  const { pathname } = useLocation();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      {/* ===== سطح المكتب: شريط جانبي ثابت ===== */}
      <aside className="print-hidden fixed inset-y-0 right-0 z-40 hidden w-64 flex-col gap-2 p-4 lg:flex">
        <div className="glass flex h-full flex-col p-4">
          <div className="mb-6 flex items-center gap-3 px-2 pt-2">
            <div className="rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 p-2 text-night-900 shadow-[0_0_20px_rgba(52,211,153,0.4)]">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-base font-black leading-tight">نظام حياتي</h1>
              <p className="text-[11px] text-slate-500">عبدالرحيم أحمد شيتة</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all',
                  isActive(href)
                    ? 'bg-gradient-to-l from-emerald-500/20 to-transparent text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 border border-transparent'
                )}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-4">
            <GlobalTimer />
            <button
              onClick={() => downloadBackup()}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-slate-400 transition hover:border-emerald-500/25 hover:text-emerald-300"
            >
              <DatabaseBackup size={13} /> نسخة احتياطية فورية
            </button>
            <button
              onClick={() => signOut()}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-slate-400 transition hover:border-rose-500/25 hover:text-rose-300"
            >
              <LogOut size={13} /> تسجيل الخروج
            </button>
            <p className="px-2 text-center text-[10px] text-slate-600">
              بياناتك مخزَّنة في Supabase — مرئية لك فقط 🔒
            </p>
          </div>
        </div>
      </aside>

      {/* ===== الجوال: شريط سفلي ===== */}
      <nav className="print-hidden fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 bg-night-900/80 px-1 py-2 backdrop-blur-xl lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[9px] font-bold transition',
              isActive(href) ? 'text-emerald-300' : 'text-slate-500'
            )}
          >
            <Icon size={18} />
            {short}
          </Link>
        ))}
      </nav>
    </>
  );
}
