import Sidebar from '@/frontend/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* توهجات خلفية عائمة (Glassmorphism ambience) */}
      <div className="print-hidden pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px] animate-float-slow" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px] animate-float-slow [animation-delay:-7s]" />
      </div>

      <Sidebar />
      <main className="print-area px-4 pb-24 pt-6 lg:pb-10 lg:pr-72 lg:pl-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
