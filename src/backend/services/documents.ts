import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, optId, optStr } from '../validate';
import { uploadToB2WithProgress, deleteFromB2, buildStoredFileName, getB2FileUrl } from '../config/b2Storage';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export async function listDocuments() {
  return unwrap(await supabase.from('Document').select('*').order('createdAt', { ascending: false }));
}

/** رفع ملف (FormData) مباشرة إلى B2 ثم تسجيله في القاعدة */
export async function uploadDocument(form: FormData) {
  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('لم يتم اختيار ملف');
  if (file.size === 0) throw new ValidationError('الملف فارغ');
  if (file.size > MAX_SIZE) throw new ValidationError('حجم الملف يتجاوز 100MB');

  const customRaw = form.get('name');
  const displayName =
    typeof customRaw === 'string' && customRaw.trim() !== '' ? customRaw.trim().slice(0, 200) : file.name.slice(0, 200);

  const folderIdRaw = form.get('folderId');
  const folderId = typeof folderIdRaw === 'string' && folderIdRaw !== '' ? folderIdRaw : null;
  if (folderId) {
    const { data: folder } = await supabase.from('DocFolder').select('id').eq('id', folderId).maybeSingle();
    if (!folder) throw new ValidationError('المجلد غير موجود — أعد تحميل الصفحة');
  }

  const storedName = buildStoredFileName(file.name);
  const uploaded = await uploadToB2WithProgress(file, storedName);

  return unwrap(
    await supabase
      .from('Document')
      .insert({
        name: displayName,
        fileName: uploaded.fileName,
        bzFileId: uploaded.bzFileId,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        folderId,
      })
      .select('*')
      .single()
  );
}

/** رفع ملف مع تتبع التقدّم (percentage callback) */
export async function uploadDocumentWithProgress(
  form: FormData,
  onProgress: (pct: number) => void
) {
  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('لم يتم اختيار ملف');
  if (file.size === 0) throw new ValidationError('الملف فارغ');
  if (file.size > MAX_SIZE) throw new ValidationError('حجم الملف يتجاوز 100MB');

  const customRaw = form.get('name');
  const displayName =
    typeof customRaw === 'string' && customRaw.trim() !== '' ? customRaw.trim().slice(0, 200) : file.name.slice(0, 200);

  const folderIdRaw = form.get('folderId');
  const folderId = typeof folderIdRaw === 'string' && folderIdRaw !== '' ? folderIdRaw : null;
  if (folderId) {
    const { data: folder } = await supabase.from('DocFolder').select('id').eq('id', folderId).maybeSingle();
    if (!folder) throw new ValidationError('المجلد غير موجود — أعد تحميل الصفحة');
  }

  const storedName = buildStoredFileName(file.name);
  const uploaded = await uploadToB2WithProgress(file, storedName, onProgress);

  return unwrap(
    await supabase
      .from('Document')
      .insert({
        name: displayName,
        fileName: uploaded.fileName,
        bzFileId: uploaded.bzFileId,
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        folderId,
      })
      .select('*')
      .single()
  );
}

/** إعادة تسمية أو نقل مستند لمجلد آخر */
export async function updateDocument(id: string, b: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  if (b.name !== undefined) {
    const name = optStr(b, 'name', 200);
    if (!name) throw new ValidationError('اسم الملف مطلوب');
    data.name = name;
  }
  if (b.folderId !== undefined) data.folderId = optId(b, 'folderId');
  if (Object.keys(data).length === 0) throw new ValidationError('لا توجد تعديلات صالحة');
  return unwrap(await supabase.from('Document').update(data).eq('id', id).select('*').single());
}

/** حذف السجل والملف الفعلي من B2 — فشل حذف B2 لا يُفشل العملية */
export async function deleteDocument(id: string) {
  const { data: doc } = await supabase.from('Document').select('fileName, bzFileId').eq('id', id).maybeSingle();
  if (!doc) return { ok: true };

  unwrap(await supabase.from('Document').delete().eq('id', id));
  await deleteFromB2(doc.fileName as string, doc.bzFileId as string);
  return { ok: true };
}

/** رابط معاينة/تنزيل مؤقت (7 أيام) للملف داخل عارض النظام */
export async function getDocumentFileUrl(id: string): Promise<string> {
  const doc = unwrap(await supabase.from('Document').select('fileName').eq('id', id).single()) as { fileName: string };
  return getB2FileUrl(doc.fileName);
}
