'use client';

// ======================================================================
// مساعد الاتصال بالـ API المحلي — درع ضد الشاشات الحمراء:
// أي فشل (شبكة، تحقق، قاعدة بيانات) يتحول إلى تنبيه لطيف (Toast)
// ويُرجع null بدلاً من رمي استثناء يُسقط الواجهة.
// ======================================================================

export type ToastType = 'success' | 'error';

type NotifyFn = (message: string, type: ToastType) => void;

let notifyFn: NotifyFn = () => {};

/** يسجله مكوّن Toaster عند التحميل */
export function registerNotify(fn: NotifyFn) {
  notifyFn = fn;
}

export function notify(message: string, type: ToastType = 'success') {
  notifyFn(message, type);
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** رسالة نجاح اختيارية تُعرض كـ Toast */
  ok?: string;
}

// ======================================================================
// كاش القراءات — سرعة التنقل بين الأقسام:
// أول زيارة تجلب من القاعدة، والعودة للقسم تعرض البيانات فوراً من
// الذاكرة ثم تُحدَّث بصمت. أي عملية كتابة تمسح الكاش كله (اتساق مضمون).
// ======================================================================
const getCache = new Map<string, unknown>();

/** آخر نسخة مخزنة من استجابة GET — للعرض الفوري قبل وصول التحديث */
export function getCached<T>(path: string): T | null {
  return (getCache.get(path) as T | undefined) ?? null;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T | null> {
  const method = opts.method ?? 'GET';
  try {
    const isForm = opts.body instanceof FormData;
    const res = await fetch(path, {
      method,
      headers: isForm || opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    let data: unknown = null;
    try {
      if (res.headers.get('content-type')?.includes('application/json')) data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg =
        (data as { error?: string } | null)?.error ?? `حدث خطأ غير متوقع (${res.status})`;
      notifyFn(msg, 'error');
      return null;
    }

    if (method === 'GET') getCache.set(path, data);
    else getCache.clear(); // كتابة = بيانات تغيرت في مكان ما → تحديث شامل

    if (opts.ok) notifyFn(opts.ok, 'success');
    return data as T;
  } catch {
    notifyFn('تعذر الاتصال بالخادم المحلي — تأكد أن النظام يعمل', 'error');
    return null;
  }
}
