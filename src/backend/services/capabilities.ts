// ======================================================================
// كشف قدرات القاعدة — هل شُغّل ترحيل المالية (finance_real_life) بعد؟
//
// الموقع يُنشر تلقائياً عند كل push، بينما ترحيل SQL خطوة يدوية في لوحة
// Supabase. لذا قد يسبق الكودُ القاعدةَ لبعض الوقت. هذا الملف يفحص ذلك
// مرة واحدة ويُخزّن النتيجة، فتعمل الخدمات بالصيغة القديمة بدل أن تفشل،
// وتعرض الواجهة تنبيهاً بالخطوة الناقصة بدل رسالة خطأ غامضة.
//
// بعد تشغيل الترحيل يمكن حذف هذا الملف واستدعاءاته بأمان.
// ======================================================================

import { supabase } from '../config/supabaseClient';

/** الجدول غير موجود في مخطط PostgREST — أوضح إشارة إلى قاعدة لم تُرحَّل */
const TABLE_MISSING = 'PGRST205';

let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

/**
 * هل القاعدة مُرحَّلة؟ يُفحص مرة واحدة لكل جلسة عبر وجود جدول "Budget".
 * أي خطأ آخر (شبكة مثلاً) يُعتبر "مُرحَّلة" حتى لا نُعطّل الميزات بلا سبب.
 */
export async function financeSchemaReady(): Promise<boolean> {
  if (cached !== null) return cached;
  if (!inflight) {
    inflight = (async () => {
      const { error } = await supabase.from('Budget').select('id').limit(1);
      const ready = (error as { code?: string } | null)?.code !== TABLE_MISSING;
      cached = ready;
      inflight = null;
      return ready;
    })();
  }
  return inflight;
}

/** آخر نتيجة معروفة دون انتظار — للمسارات المتزامنة (تعريفات موارد CRUD) */
export function financeSchemaReadySync(): boolean {
  return cached ?? true;
}
