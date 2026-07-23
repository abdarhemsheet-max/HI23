import { ValidationError } from '../validate';

/**
 * تحويل أي خطأ (تحقق محلي / Postgres / RPC) إلى رسالة عربية آمنة —
 * يماثل errorResponse() في الإصدار السابق المبني على Next.js API routes.
 */
export function toMessage(e: unknown): string {
  if (e instanceof ValidationError) return e.message;
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === '23505') return 'هذا السجل موجود مسبقاً (قيمة مكررة)';
  if (err?.code === '23503') return 'العنصر المرتبط غير موجود — أعد تحميل الصفحة';
  if (err?.code === 'PGRST116') return 'العنصر غير موجود — ربما حُذف مسبقاً';
  if (err?.message) return err.message;
  return 'خطأ داخلي غير متوقع';
}

/** يرمي الخطأ إن وُجد، وإلا يعيد data — يختصر فحص { data, error } من Supabase JS */
export function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
