'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Save, FileDown, Archive } from 'lucide-react';
import { api, notify } from '@/frontend/api';
import { todayStr, cn } from '@/shared/utils';
import type { ManualReport, WorkEntity } from '@/shared/types';
import RichTextEditor from '@/frontend/components/ui/RichTextEditor';

export default function ManualReportEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';

  const [entities, setEntities] = useState<WorkEntity[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState('');
  const [entityId, setEntityId] = useState('');
  const [reportDate, setReportDate] = useState(todayStr());
  const [content, setContent] = useState('');
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : params.id);
  const [documentId, setDocumentId] = useState<string | null>(null);

  useEffect(() => {
    api<WorkEntity[]>('/api/crud/entities').then((d) => {
      if (d) setEntities(d);
    });
  }, []);

  useEffect(() => {
    if (isNew) return;
    api<ManualReport[]>('/api/crud/manualReports').then((list) => {
      const found = list?.find((r) => r.id === params.id);
      if (!found) {
        setNotFound(true);
      } else {
        setTitle(found.title);
        setEntityId(found.entityId ?? '');
        setReportDate(found.reportDate.slice(0, 10));
        setContent(found.content);
        setDocumentId(found.documentId);
      }
      setLoading(false);
    });
  }, [isNew, params.id]);

  const save = async (): Promise<string | null> => {
    if (!title.trim() || !entityId) {
      notify('أدخل العنوان واختر الجهة الموجّه إليها التقرير', 'error');
      return null;
    }
    setSaving(true);
    const body = { title, entityId, reportDate, content };
    const result = savedId
      ? await api<ManualReport>(`/api/crud/manualReports/${savedId}`, { method: 'PATCH', body })
      : await api<ManualReport>('/api/crud/manualReports', { method: 'POST', ok: 'حُفظ التقرير', body });
    setSaving(false);
    if (result) {
      if (!savedId) {
        setSavedId(result.id);
        router.replace(`/reports/manual/${result.id}`);
      }
      return result.id;
    }
    return null;
  };

  const exportPdf = async () => {
    setExporting(true);
    const id = await save();
    if (!id) {
      setExporting(false);
      return;
    }
    const doc = await api<{ id: string }>(`/api/reports/manual/${id}/export`, {
      method: 'POST',
      ok: '📄 صُدِّر التقرير وحُفظ في أرشيف المستندات',
    });
    setExporting(false);
    if (doc) setDocumentId(doc.id);
  };

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">جارٍ تحميل التقرير…</p>;
  }
  if (notFound) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-400">التقرير غير موجود — ربما حُذف.</p>
        <button className="btn-ghost mx-auto mt-4" onClick={() => router.push('/reports')}>
          <ArrowRight size={14} /> رجوع للتقارير
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => router.push('/reports')}>
          <ArrowRight size={14} /> رجوع للتقارير
        </button>
        <div className="flex items-center gap-2">
          {documentId && (
            <span className="chip bg-emerald-500/15 text-emerald-300">
              <Archive size={11} /> مُصدَّر في الأرشيف
            </span>
          )}
          <button className="btn-ghost !px-4 !py-2 text-xs" disabled={saving} onClick={save}>
            <Save size={14} /> {saving ? 'جارٍ الحفظ…' : 'حفظ'}
          </button>
          <button
            className={cn('btn-primary !px-4 !py-2 text-xs', exporting && 'pointer-events-none opacity-60')}
            disabled={exporting}
            onClick={exportPdf}
          >
            <FileDown size={14} /> {exporting ? 'جارٍ التصدير…' : 'حفظ وتصدير PDF'}
          </button>
        </div>
      </div>

      <div className="glass grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-2">
          <label className="label">عنوان التقرير</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="تقرير تفتيش ميداني — يوليو…"
            required
          />
        </div>
        <div>
          <label className="label">الجهة / الشركة الموجّه إليها</label>
          <select className="input" value={entityId} onChange={(e) => setEntityId(e.target.value)} required>
            <option value="" disabled>اختر الجهة…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">تاريخ التقرير</label>
          <input className="input" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
        </div>
      </div>

      <RichTextEditor content={content} onChange={setContent} />
    </div>
  );
}
