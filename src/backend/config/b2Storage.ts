// ======================================================================
// اتصال بـ Backblaze B2 عبر Supabase Edge Functions (تتولّى المصادقة
// من الخادم فترفع/تنزّل بلا مشاكل CORS). قيم B2_SECRET مخزَّنة كـ
// secrets في Supabase Edge Functions — غير مرئية للزائر.
//
// روابط الرفع نفسها (pod-*.backblaze.com) تعود مع CORS headers بعد
// إعداد corsRules على bucket مستوى B2 (أُنجز).
// ======================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : 'https://yruoooslxppvsoqdbgxc.supabase.co/functions/v1';

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('أضف بيانات Supabase (VITE_SUPABASE_*) في ملف .env');
  }
}

export interface B2UploadResult {
  fileName: string; // مفتاح التخزين داخل الحاوية
  bzFileId: string;
  size: number;
  mimeType: string;
}

/** يبني اسم تخزين آمناً: uuid + الامتداد الأصلي فقط */
export function buildStoredFileName(originalName: string): string {
  const ext = (originalName.match(/\.[^./\\]+$/)?.[0] ?? '').toLowerCase().replace(/[^.\w]/g, '').slice(0, 10);
  return 'abdarhemsh-' + crypto.randomUUID() + ext;
}

/** رفع ملف عبر Edge Function — يتولّى auth + upload للبكت مباشرة */
export async function uploadToB2(file: File, storedName: string): Promise<B2UploadResult> {
  assertConfigured();

  const form = new FormData();
  form.append('file', file);
  form.append('fileName', storedName);

  const res = await fetch(`${FUNCTIONS_URL}/b2-upload`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'فشل رفع الملف عبر الخادم');
  }

  const result = await res.json();
  if (!result.upload) throw new Error('استجابة غير متوقعة من خادم الرفع');

  return {
    fileName: result.upload.fileName,
    bzFileId: result.upload.fileId,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

/** حذف ملف نهائياً من B2 */
export async function deleteFromB2(fileName: string, bzFileId: string): Promise<void> {
  if (!fileName || !bzFileId) return;
  assertConfigured();

  await fetch(`${FUNCTIONS_URL}/b2-delete`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName, fileId: bzFileId }),
  }).catch(() => {});
}

const downloadUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** يولّد رابط تنزيل/معاينة مؤقت (صالح ساعة) عبر Edge Function */
export async function getB2FileUrl(fileName: string): Promise<string> {
  const cached = downloadUrlCache.get(fileName);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  assertConfigured();

  const res = await fetch(`${FUNCTIONS_URL}/b2-download`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filePath: fileName }),
  });

  // نقرأ جسم الاستجابة دائماً — حتى عند الفشل — لأن b2-download يُعيد سبب
  // الفشل الحقيقي القادم من B2 (مثل صلاحيات المفتاح أو عدم تطابق البادئة)
  // بدل إخفائه خلف رسالة عامة لا تُشخَّص.
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.downloadUrl) {
    console.error('[b2-download] فشل تجهيز الرابط:', fileName, data);
    throw new Error(data?.error || 'تعذّر تجهيز رابط الملف');
  }

  downloadUrlCache.set(fileName, { url: data.downloadUrl, expiresAt: Date.now() + 55 * 60 * 1000 });
  return data.downloadUrl;
}
