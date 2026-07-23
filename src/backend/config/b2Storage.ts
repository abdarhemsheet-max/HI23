// ======================================================================
// اتصال مباشر من المتصفح بـ Backblaze B2 — لا مجلد API ولا خادم وسيط.
// كل الرفع/الحذف/التنزيل يمر عبر REST API الخام لـ B2 (fetch عادي).
//
// أمان: مفتاح B2 مرئي في حزمة الواجهة (اختيار مقصود — راجع محادثة الهجرة).
// لتقليل الضرر: اجعل هذا المفتاح Application Key مقيّداً بحاوية واحدة فقط
// من B2 Dashboard → Application Keys → Add a New Application Key.
// روابط التنزيل نفسها ليست عامة دائماً: نولّد Download Authorization
// مؤقتة (صالحة أسبوعاً) لكل ملف بدل جعل الحاوية كلها Public.
// ======================================================================

const KEY_ID = import.meta.env.VITE_B2_KEY_ID;
const APP_KEY = import.meta.env.VITE_B2_APPLICATION_KEY;
const BUCKET_ID = import.meta.env.VITE_B2_BUCKET_ID;
const BUCKET_NAME = import.meta.env.VITE_B2_BUCKET_NAME;

function assertConfigured() {
  if (!KEY_ID || !APP_KEY || !BUCKET_ID || !BUCKET_NAME) {
    throw new Error('أضف بيانات Backblaze B2 (VITE_B2_*) في ملف .env قبل رفع الملفات');
  }
}

interface B2Auth {
  apiUrl: string;
  downloadUrl: string;
  authorizationToken: string;
  expiresAt: number; // Date.now() + مهلة أمان — التوكن الفعلي صالح 24 ساعة
}

let authCache: B2Auth | null = null;

async function authorize(): Promise<B2Auth> {
  assertConfigured();
  if (authCache && authCache.expiresAt > Date.now()) return authCache;

  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: 'Basic ' + btoa(`${KEY_ID}:${APP_KEY}`) },
  });
  if (!res.ok) throw new Error('تعذّر الاتصال بـ Backblaze B2 — تحقق من المفاتيح');
  const data = await res.json();
  authCache = {
    apiUrl: data.apiUrl,
    downloadUrl: data.downloadUrl,
    authorizationToken: data.authorizationToken,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };
  return authCache;
}

async function sha1Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
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
  return crypto.randomUUID() + ext;
}

/** رفع ملف مباشرة من المتصفح إلى B2 */
export async function uploadToB2(file: File, storedName: string): Promise<B2UploadResult> {
  const auth = await authorize();

  const uploadUrlRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: BUCKET_ID }),
  });
  if (!uploadUrlRes.ok) throw new Error('تعذّر تجهيز الرفع إلى B2');
  const { uploadUrl, authorizationToken } = await uploadUrlRes.json();

  const buffer = await file.arrayBuffer();
  const sha1 = await sha1Hex(buffer);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(storedName),
      'Content-Type': file.type || 'b2/x-auto',
      'X-Bz-Content-Sha1': sha1,
    },
    body: buffer,
  });
  if (!uploadRes.ok) throw new Error('فشل رفع الملف إلى B2');
  const uploaded = await uploadRes.json();

  return {
    fileName: storedName,
    bzFileId: uploaded.fileId,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

/** حذف ملف نهائياً من B2 */
export async function deleteFromB2(fileName: string, bzFileId: string): Promise<void> {
  if (!fileName || !bzFileId) return;
  const auth = await authorize();
  await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileId: bzFileId }),
  }).catch(() => {}); // فشل الحذف من B2 لا يجب أن يوقف حذف السجل من القاعدة
}

const downloadUrlCache = new Map<string, { url: string; expiresAt: number }>();

/** يولّد رابط تنزيل/معاينة مؤقت (صالح 7 أيام) لملف محدد داخل الحاوية */
export async function getB2FileUrl(fileName: string): Promise<string> {
  const cached = downloadUrlCache.get(fileName);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const auth = await authorize();
  const VALID_SECONDS = 7 * 24 * 60 * 60;
  const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: BUCKET_ID, fileNamePrefix: fileName, validDurationInSeconds: VALID_SECONDS }),
  });
  if (!res.ok) throw new Error('تعذّر تجهيز رابط الملف');
  const { authorizationToken } = await res.json();

  const url = `${auth.downloadUrl}/file/${BUCKET_NAME}/${encodeURIComponent(fileName)}?Authorization=${authorizationToken}`;
  downloadUrlCache.set(fileName, { url, expiresAt: Date.now() + (VALID_SECONDS - 300) * 1000 });
  return url;
}
