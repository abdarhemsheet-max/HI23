import { Component, type ReactNode } from 'react';
import { RefreshCcw, Home, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * درع الأخطاء العام — يحل محل error.tsx/global-error.tsx الخاصين بـ Next.js.
 * أي خطأ غير متوقع في أي صفحة يظهر هنا كواجهة ودّية بدل الشاشة الحمراء.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="glass w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-4 w-fit rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-300">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-lg font-black">حدث خطأ غير متوقع</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              لا تقلق — بياناتك محفوظة في Supabase وليست في هذا الجهاز. جرّب إعادة المحاولة،
              وإن تكرر الخطأ أعد تحميل الصفحة.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button className="btn-primary" onClick={() => this.setState({ error: null })}>
                <RefreshCcw size={15} /> إعادة المحاولة
              </button>
              <a href="#/" className="btn-ghost" onClick={() => this.setState({ error: null })}>
                <Home size={15} /> الرئيسية
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
