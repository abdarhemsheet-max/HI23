'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Printer, Archive } from 'lucide-react';
import { api } from '@/frontend/api';
import { fmtDate } from '@/shared/utils';
import type { Report, ReportTaskSnapshot, WorkEntity } from '@/shared/types';
import { parseSnapshot } from '@/shared/types';

export default function ReportViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [entities, setEntities] = useState<WorkEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [reports, ents] = await Promise.all([
        api<Report[]>('/api/crud/reports'),
        api<WorkEntity[]>('/api/crud/entities'),
      ]);
      if (reports) setReport(reports.find((r) => r.id === id) ?? null);
      if (ents) setEntities(ents);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <p className="py-20 text-center text-sm text-slate-500">جارٍ تحميل التقرير…</p>;
  }
  if (!report) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-slate-400">التقرير غير موجود — ربما حُذف.</p>
        <button className="btn-ghost mx-auto mt-4" onClick={() => router.push('/reports')}>
          <ArrowRight size={14} /> رجوع للأرشيف
        </button>
      </div>
    );
  }

  const entity = report.entity ?? entities.find((e) => e.id === report.entityId) ?? null;
  const brand = entity?.brandColor ?? '#38bdf8';
  const snapshot = parseSnapshot(report.tasksSnapshot);

  // تجميع المهام حسب المشروع
  const grouped = snapshot.reduce<Record<string, ReportTaskSnapshot[]>>((acc, t) => {
    (acc[t.project_name] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      {/* شريط الأدوات — يختفي عند الطباعة */}
      <div className="print-hidden flex items-center justify-between gap-3">
        <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => router.push('/reports')}>
          <ArrowRight size={14} /> رجوع للأرشيف
        </button>
        <div className="flex items-center gap-2">
          <span className="chip bg-emerald-500/15 text-emerald-300">
            <Archive size={11} /> معتمد ومؤرشف
          </span>
          <button className="btn-primary !px-4 !py-2 text-xs" onClick={() => window.print()}>
            <Printer size={14} /> تصدير PDF
          </button>
        </div>
      </div>

      {/* ===== جسم التقرير (منطقة الطباعة) ===== */}
      <div className="overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl print:rounded-none print:shadow-none">
        {/* ترويسة بهوية الجهة */}
        <div className="p-8 text-white" style={{ background: brand }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold opacity-80">تقرير إنجاز رسمي</p>
              <h1 className="mt-1 text-2xl font-black">{report.title}</h1>
              <p className="mt-2 text-sm opacity-90">
                {entity?.name && <b>{entity.name} · </b>}
                الفترة: {fmtDate(report.periodStart)} — {fmtDate(report.periodEnd)}
              </p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 text-2xl font-black">
              {entity?.name?.charAt(0) ?? '؟'}
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* معلومات المنفّذ */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 text-sm">
            <div>
              <p className="font-black">المنفّذ: عبدالرحيم أحمد شيتة</p>
              {report.project?.name && <p className="text-slate-600">المشروع: {report.project.name}</p>}
              {entity?.contactInfo && <p className="text-slate-500">{entity.contactInfo}</p>}
            </div>
            <div className="text-left text-slate-500">
              <p>تاريخ الاعتماد: {fmtDate(report.archivedAt)}</p>
              <p className="text-xs">إجمالي الإنجازات: {snapshot.length}</p>
            </div>
          </div>

          {/* الإنجازات مجمعة حسب المشروع */}
          {snapshot.length === 0 ? (
            <p className="py-10 text-center text-slate-400">لا توجد مهام منجزة خلال هذه الفترة.</p>
          ) : (
            Object.entries(grouped).map(([projectName, items]) => (
              <div key={projectName} className="mb-6">
                <h2 className="mb-3 border-r-4 pr-3 text-base font-black" style={{ borderColor: brand }}>
                  {projectName || 'مهام عامة'}
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-right text-xs text-slate-600">
                      <th className="w-10 border border-slate-200 p-2">#</th>
                      <th className="border border-slate-200 p-2">المهمة المنجزة</th>
                      <th className="w-36 border border-slate-200 p-2">تاريخ الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t, i) => (
                      <tr key={i}>
                        <td className="border border-slate-200 p-2 text-center text-slate-500">{i + 1}</td>
                        <td className="border border-slate-200 p-2 font-semibold">{t.title}</td>
                        <td className="border border-slate-200 p-2 text-slate-500">{fmtDate(t.completed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}

          {/* التوقيع */}
          <div className="mt-12 flex justify-between text-sm">
            <div className="text-center">
              <p className="mb-10 font-bold text-slate-600">توقيع المنفّذ</p>
              <p className="border-t border-slate-300 px-8 pt-2 font-black">عبدالرحيم أحمد شيتة</p>
            </div>
            <div className="text-center">
              <p className="mb-10 font-bold text-slate-600">ختم / اعتماد الجهة</p>
              <p className="border-t border-slate-300 px-8 pt-2 font-black">{entity?.name ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* تذييل */}
        <div className="px-8 py-3 text-center text-[11px] text-white" style={{ background: brand }}>
          أُنشئ هذا التقرير واعتُمد وأُرشف تلقائياً عبر «نظام حياتي» — {fmtDate(report.createdAt)}
        </div>
      </div>

      <p className="print-hidden text-center text-xs text-slate-500">
        💡 اضغط «تصدير PDF» ثم اختر «حفظ كـ PDF» من نافذة الطباعة — يدعم العربية بشكل كامل.
      </p>
    </div>
  );
}
