'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  FolderOpen,
  Folder,
  FileText,
  FileImage,
  File as FileIcon,
  Upload,
  Eye,
  Download,
  X,
} from 'lucide-react';
import { api, getCached, notify } from '@/frontend/api';
import { fmtDateShort, cn } from '@/shared/utils';
import type { DocFolder, Document } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import { useConfirm } from '@/frontend/hooks/useConfirm';

const FOLDER_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

interface StagedFile {
  file: File;
  name: string; // اسم معروض قابل للتعديل
  folderId: string; // '' = بدون مجلد
}

export default function DocumentsPage() {
  const [folders, setFolders] = useState<DocFolder[]>(() => getCached<DocFolder[]>('/api/crud/folders') ?? []);
  const [docs, setDocs] = useState<Document[]>(() => getCached<Document[]>('/api/documents') ?? []);
  const [activeFolder, setActiveFolder] = useState<string | 'all'>('all');
  const [modal, setModal] = useState<null | 'folder'>(null);
  const [viewer, setViewer] = useState<Document | null>(null);
  const [uploading, setUploading] = useState(false);
  const [staged, setStaged] = useState<StagedFile[] | null>(null); // ملفات بانتظار تأكيد الاسم/المجلد
  const fileInput = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const [f, d] = await Promise.all([
      api<DocFolder[]>('/api/crud/folders'),
      api<Document[]>('/api/documents'),
    ]);
    if (f) setFolders(f);
    if (d) setDocs(d);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addFolder = async (f: FormData) => {
    const ok = await api('/api/crud/folders', {
      method: 'POST',
      ok: 'أُنشئ المجلد',
      body: { name: f.get('name'), color: f.get('color') },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  /** عند اختيار ملفات: لا نرفع فوراً — نجهّزها في نافذة لتعديل الاسم والمجلد */
  const stageFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const defaultFolder = activeFolder !== 'all' ? activeFolder : '';
    setStaged(
      Array.from(files).map((file) => ({
        file,
        name: file.name.replace(/\.[^.]+$/, ''), // بدون الامتداد للعرض
        folderId: defaultFolder,
      }))
    );
    if (fileInput.current) fileInput.current.value = '';
  };

  /** رفع الملفات المجهّزة بأسمائها ومجلداتها المختارة */
  const confirmUpload = async () => {
    if (!staged || staged.length === 0) return;
    setUploading(true);
    let done = 0;
    for (const s of staged) {
      const form = new FormData();
      form.append('file', s.file);
      const finalName = s.name.trim() || s.file.name;
      form.append('name', finalName);
      if (s.folderId) form.append('folderId', s.folderId);
      const ok = await api('/api/documents', { method: 'POST', body: form });
      if (ok) done++;
    }
    setUploading(false);
    setStaged(null);
    if (done > 0) notify(`رُفع ${done} ملف بنجاح 📁`, 'success');
    load();
  };

  const updateStaged = (idx: number, patch: Partial<StagedFile>) => {
    setStaged((prev) => (prev ? prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)) : prev));
  };
  const removeStaged = (idx: number) => {
    setStaged((prev) => {
      const next = prev ? prev.filter((_, i) => i !== idx) : null;
      return next && next.length > 0 ? next : null;
    });
  };

  const delDoc = async (d: Document) => {
    const ok = await confirm({
      title: 'تأكيد الحذف',
      description: `سيُحذف الملف «${d.name}» نهائياً من الأرشيف والقرص ولا يمكن استرجاعه.`,
      danger: true,
    });
    if (!ok) return;
    const res = await api(`/api/documents/${d.id}`, { method: 'DELETE' });
    if (res) {
      if (viewer?.id === d.id) setViewer(null);
      load();
    }
  };

  const delFolder = async (id: string) => {
    const ok = await confirm({
      title: 'حذف المجلد',
      description: 'ستُحذف المجلد، وتبقى ملفاته محفوظة بدون تصنيف.',
    });
    if (!ok) return;
    const res = await api(`/api/crud/folders/${id}`, { method: 'DELETE' });
    if (res) {
      if (activeFolder === id) setActiveFolder('all');
      load();
    }
  };

  const isPdf = (d: Document) => d.mimeType.includes('pdf');
  const isImage = (d: Document) => d.mimeType.startsWith('image/');
  const canPreview = (d: Document) => isPdf(d) || isImage(d);

  const visible = docs.filter((d) => activeFolder === 'all' || d.folderId === activeFolder);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">أرشيف المستندات</h1>
          <p className="text-sm text-slate-500">مستنداتك الشخصية والمهنية — تُقرأ داخل النظام مباشرة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setModal('folder')}>
            <Folder size={15} /> مجلد جديد
          </button>
          <button
            className={cn('btn-primary', uploading && 'pointer-events-none opacity-60')}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} /> {uploading ? 'جارٍ الرفع…' : 'رفع ملفات'}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => stageFiles(e.target.files)}
          />
        </div>
      </header>

      {/* ===== المجلدات ===== */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFolder('all')}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition',
            activeFolder === 'all'
              ? 'bg-gradient-to-l from-emerald-500/25 to-teal-500/10 text-emerald-300 border border-emerald-500/25'
              : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08]'
          )}
        >
          <FolderOpen size={14} /> الكل ({docs.length})
        </button>
        {folders.map((f) => (
          <div key={f.id} className="group relative">
            <button
              onClick={() => setActiveFolder(f.id)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition border',
                activeFolder === f.id
                  ? 'text-white'
                  : 'bg-white/[0.04] text-slate-400 border-white/[0.07] hover:bg-white/[0.08]'
              )}
              style={
                activeFolder === f.id
                  ? { background: `${f.color}22`, borderColor: `${f.color}55`, color: f.color }
                  : undefined
              }
            >
              <Folder size={14} style={{ color: f.color }} />
              {f.name} ({f._count?.documents ?? 0})
            </button>
            <button
              onClick={() => delFolder(f.id)}
              className="absolute -left-1.5 -top-1.5 hidden rounded-full bg-rose-500/90 p-0.5 text-white group-hover:block"
              aria-label="حذف المجلد"
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* ===== الملفات ===== */}
      {visible.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={FolderOpen}
            title="لا مستندات هنا"
            hint="ارفع عقوداً، شهادات، هويات، أو أي ملفات PDF وصور"
          />
        </GlassCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((d) => {
            const folder = folders.find((f) => f.id === d.folderId);
            return (
              <GlassCard key={d.id} hover className="group !p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'shrink-0 rounded-xl border p-2.5',
                      isPdf(d)
                        ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                        : isImage(d)
                          ? 'border-sky-500/20 bg-sky-500/10 text-sky-300'
                          : 'border-white/10 bg-white/[0.05] text-slate-400'
                    )}
                  >
                    {isPdf(d) ? <FileText size={20} /> : isImage(d) ? <FileImage size={20} /> : <FileIcon size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black" title={d.name}>{d.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {fmtSize(d.size)} · {fmtDateShort(d.createdAt)}
                      {folder && (
                        <span style={{ color: folder.color }}> · {folder.name}</span>
                      )}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2">
                      {canPreview(d) ? (
                        <button className="btn-ghost !px-3 !py-1.5 text-[11px]" onClick={() => setViewer(d)}>
                          <Eye size={12} /> {isPdf(d) ? 'قراءة PDF' : 'عرض'}
                        </button>
                      ) : (
                        <a href={`/api/documents/${d.id}/file`} download={d.name} className="btn-ghost !px-3 !py-1.5 text-[11px]">
                          <Download size={12} /> تنزيل
                        </a>
                      )}
                      <button
                        className="text-slate-700 opacity-0 transition group-hover:opacity-100 hover:!text-rose-400"
                        onClick={() => delDoc(d)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* ===== عارض PDF / الصور داخل النظام ===== */}
      {viewer && (
        <div className="print-hidden fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md p-3 lg:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="truncate text-sm font-black text-white">
              {isPdf(viewer) ? '📄' : '🖼'} {viewer.name}
            </p>
            <div className="flex items-center gap-2">
              <a href={`/api/documents/${viewer.id}/file`} download={viewer.name} className="btn-ghost !px-3 !py-1.5 text-[11px]">
                <Download size={12} /> تنزيل
              </a>
              <button className="btn-ghost !p-2" onClick={() => setViewer(null)} aria-label="إغلاق">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="glass flex-1 overflow-hidden !rounded-xl bg-white/95">
            {isPdf(viewer) ? (
              <iframe
                src={`/api/documents/${viewer.id}/file#toolbar=1`}
                title={viewer.name}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/documents/${viewer.id}/file`} alt={viewer.name} className="max-h-full max-w-full rounded-lg object-contain" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== مجلد جديد ===== */}
      <Modal open={modal === 'folder'} onClose={() => setModal(null)} title="مجلد جديد">
        <form onSubmit={onForm(addFolder)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم المجلد</label>
            <input name="name" className="input" required autoFocus placeholder="مستندات رسمية، عقود، شهادات…" />
          </div>
          <div>
            <label className="label">اللون</label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map((c, i) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" />
                  <span
                    className="block h-8 w-8 rounded-lg border-2 border-transparent transition peer-checked:border-white/70 peer-checked:scale-110"
                    style={{ background: c }}
                  />
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary">إنشاء المجلد</button>
        </form>
      </Modal>

      {/* ===== نافذة تجهيز الرفع: تعديل الاسم واختيار المجلد ===== */}
      <Modal
        open={staged !== null}
        onClose={() => !uploading && setStaged(null)}
        title={`رفع ${staged?.length ?? 0} ملف`}
      >
        <div className="flex flex-col gap-3">
          <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200">
            عدّل اسم كل ملف وحدد المجلد قبل الحفظ.
          </p>
          <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto">
            {staged?.map((s, i) => (
              <div key={i} className="glass-inset flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] text-slate-500" dir="ltr" title={s.file.name}>
                    📄 {s.file.name} · {fmtSize(s.file.size)}
                  </p>
                  {staged.length > 1 && (
                    <button className="text-slate-600 hover:text-rose-400" onClick={() => removeStaged(i)} aria-label="إزالة">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div>
                  <label className="label !mb-1">اسم الملف المعروض</label>
                  <input
                    className="input !py-2 text-sm"
                    value={s.name}
                    onChange={(e) => updateStaged(i, { name: e.target.value })}
                    placeholder="اسم واضح للملف…"
                  />
                </div>
                <div>
                  <label className="label !mb-1">المجلد</label>
                  <select
                    className="input !py-2 text-sm"
                    value={s.folderId}
                    onChange={(e) => updateStaged(i, { folderId: e.target.value })}
                  >
                    <option value="">— بدون مجلد —</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setStaged(null)} disabled={uploading}>
              إلغاء
            </button>
            <button
              className={cn('btn-primary flex-1', uploading && 'pointer-events-none opacity-60')}
              onClick={confirmUpload}
              disabled={uploading}
            >
              <Upload size={15} /> {uploading ? 'جارٍ الرفع…' : 'رفع الملفات'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog />
    </div>
  );
}
