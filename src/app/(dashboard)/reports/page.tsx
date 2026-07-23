'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, FileText, Building2, Archive, Eye, Zap, Pencil, FilePlus2, FileDown } from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { fmtDateShort, todayStr, cn } from '@/shared/utils';
import type { Project, Report, WorkEntity, ManualReport } from '@/shared/types';
import { parseSnapshot } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import { useConfirm } from '@/frontend/hooks/useConfirm';

type Tab = 'auto' | 'manual';

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('auto');
  const [reports, setReports] = useState<Report[]>(() => getCached<Report[]>('/api/crud/reports') ?? []);
  const [manualReports, setManualReports] = useState<ManualReport[]>(
    () => getCached<ManualReport[]>('/api/crud/manualReports') ?? []
  );
  const [entities, setEntities] = useState<WorkEntity[]>(() => getCached<WorkEntity[]>('/api/crud/entities') ?? []);
  const [projects, setProjects] = useState<Project[]>(() => getCached<Project[]>('/api/crud/projects') ?? []);
  const [modal, setModal] = useState<null | 'entity' | 'report'>(null);
  const [creating, setCreating] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const [r, m, e, p] = await Promise.all([
      api<Report[]>('/api/crud/reports'),
      api<ManualReport[]>('/api/crud/manualReports'),
      api<WorkEntity[]>('/api/crud/entities'),
      api<Project[]>('/api/crud/projects'),
    ]);
    if (r) setReports(r);
    if (m) setManualReports(m);
    if (e) setEntities(e);
    if (p) setProjects(p);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addEntity = async (f: FormData) => {
    const ok = await api('/api/crud/entities', {
      method: 'POST',
      ok: 'أُضيفت جهة العمل',
      body: {
        name: f.get('name'),
        brandColor: f.get('brandColor'),
        contactInfo: String(f.get('contactInfo') || ''),
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  /**
   * القاعدة الصارمة: اختيار المشروع والمدة → جلب تلقائي للمهام المنجزة
   * → اعتماد وأرشفة فوريان — لا خطوة مراجعة يدوية.
   */
  const createReport = async (f: FormData) => {
    setCreating(true);
    const rep = await api<Report>('/api/reports/generate', {
      method: 'POST',
      ok: '⚡ اعتُمد التقرير وأُرشف فوراً',
      body: {
        projectId: f.get('projectId'),
        title: String(f.get('title') || ''),
        periodStart: f.get('periodStart'),
        periodEnd: f.get('periodEnd'),
      },
    });
    setCreating(false);
    if (rep) {
      setModal(null);
      load();
    }
  };

  const deleteReport = async (id: string) => {
    const ok1 = await confirm({
      title: 'حذف التقرير',
      description: 'سيُحذف التقرير نهائياً من الأرشيف.',
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/reports/${id}`, { method: 'DELETE' });
    if (ok) load();
  };

  const deleteEntity = async (id: string) => {
    const ok1 = await confirm({
      title: 'حذف جهة العمل',
      description: 'ستُحذف الجهة، وتبقى تقاريرها ومشاريعها محفوظة بدون جهة مرتبطة.',
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/entities/${id}`, { method: 'DELETE' });
    if (ok) load();
  };

  const deleteManualReport = async (r: ManualReport) => {
    const ok1 = await confirm({
      title: 'حذف التقرير اليدوي',
      description: `سيُحذف «${r.title}» نهائياً. (ملف PDF المُصدَّر — إن وُجد — يبقى في أرشيف المستندات)`,
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/manualReports/${r.id}`, { method: 'DELETE' });
    if (ok) load();
  };

  const monthStart = todayStr().slice(0, 8) + '01';
  const entityOf = (id: string | null) => entities.find((e) => e.id === id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">التقارير</h1>
          <p className="text-sm text-slate-500">تقارير مؤتمتة من الأعمال، وتقارير يدوية حرة — لكل جهة عمل بهويتها الخاصة</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setModal('entity')}>
            <Building2 size={15} /> جهة عمل
          </button>
          {tab === 'auto' ? (
            <button className="btn-primary" onClick={() => setModal('report')}>
              <Plus size={16} /> تقرير جديد
            </button>
          ) : (
            <Link href="/reports/manual/new" className="btn-primary">
              <FilePlus2 size={16} /> تقرير يدوي جديد
            </Link>
          )}
        </div>
      </header>

      {/* التبويبات */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'auto', label: '⚡ التقارير المؤتمتة' },
            { id: 'manual', label: '📝 التقارير اليدوية' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold transition',
              tab === t.id
                ? 'bg-gradient-to-l from-emerald-500/25 to-teal-500/10 text-emerald-300 border border-emerald-500/25'
                : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* جهات العمل — مشتركة بين التبويبين */}
      {entities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entities.map((e) => (
            <div
              key={e.id}
              className="glass flex items-center gap-2 px-3 py-2 text-xs font-bold"
              style={{ borderColor: `${e.brandColor}44` }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.brandColor }} />
              {e.name}
              <button className="text-slate-600 hover:text-rose-400" onClick={() => deleteEntity(e.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================ */}
      {/* التبويب الأول: التقارير المؤتمتة */}
      {/* ============================================================ */}
      {tab === 'auto' && (
        <>
          {/* قاعدة الاعتماد الفوري — صارمة ولا استثناء لها */}
          <div className="glass flex items-center gap-3 border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <Zap size={18} className="shrink-0 text-emerald-300" />
            <p className="text-xs text-emerald-200/90">
              <b>اعتماد فوري:</b> بمجرد إنشاء التقرير تُسحب تلقائياً المهام المنجزة والمُعلَّمة
              صراحةً «للتقرير الرسمي» فقط، ويُعتمد ويُؤرشف مباشرة — <b>لا توجد ولن توجد خطوة مراجعة يدوية</b> في هذا التبويب.
            </p>
          </div>

          <GlassCard>
            <h3 className="section-title mb-4">📁 أرشيف التقارير المؤتمتة</h3>
            {reports.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="لا تقارير بعد"
                hint="أضف جهة عمل أولاً، ثم أنشئ تقريرك — سيُعتمد فوراً"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {reports.map((r) => {
                  const ent = r.entity ?? entityOf(r.entityId);
                  const count = parseSnapshot(r.tasksSnapshot).length;
                  const brand = ent?.brandColor ?? '#38bdf8';
                  return (
                    <div key={r.id} className="glass-inset flex flex-wrap items-center justify-between gap-3 p-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="shrink-0 rounded-xl border p-2.5"
                          style={{ color: brand, borderColor: `${brand}33`, background: `${brand}11` }}
                        >
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black">{r.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {r.project?.name && <>💼 {r.project.name} · </>}
                            {ent?.name && <>{ent.name} · </>}
                            {fmtDateShort(r.periodStart)} ← {fmtDateShort(r.periodEnd)} · {count} إنجاز
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="chip bg-emerald-500/15 text-emerald-300">
                          <Archive size={11} /> مؤرشف ✓
                        </span>
                        <Link href={`/reports/${r.id}`} className="btn-ghost !px-3 !py-1.5 text-[11px]">
                          <Eye size={13} /> عرض / PDF
                        </Link>
                        <button className="text-slate-600 hover:text-rose-400" onClick={() => deleteReport(r.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}

      {/* ============================================================ */}
      {/* التبويب الثاني: التقارير اليدوية — مساحة حرة */}
      {/* ============================================================ */}
      {tab === 'manual' && (
        <GlassCard>
          <h3 className="section-title mb-4">📝 التقارير اليدوية</h3>
          {manualReports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="لا تقارير يدوية بعد"
              hint="تقييمات هيكلية، تفتيش ميداني، ملخصات اجتماعات… محرر نصوص حر"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {manualReports.map((r) => {
                const ent = r.entity ?? entityOf(r.entityId);
                const brand = ent?.brandColor ?? '#a78bfa';
                return (
                  <div key={r.id} className="glass-inset flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="shrink-0 rounded-xl border p-2.5"
                        style={{ color: brand, borderColor: `${brand}33`, background: `${brand}11` }}
                      >
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{r.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {ent?.name && <>{ent.name} · </>}
                          {fmtDateShort(r.reportDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.documentId && (
                        <span className="chip bg-emerald-500/15 text-emerald-300">
                          <FileDown size={11} /> مُصدَّر
                        </span>
                      )}
                      <Link href={`/reports/manual/${r.id}`} className="btn-ghost !px-3 !py-1.5 text-[11px]">
                        <Pencil size={13} /> فتح / تعديل
                      </Link>
                      <button className="text-slate-600 hover:text-rose-400" onClick={() => deleteManualReport(r)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {/* ===== نافذة جهة عمل ===== */}
      <Modal open={modal === 'entity'} onClose={() => setModal(null)} title="جهة عمل جديدة">
        <form onSubmit={onForm(addEntity)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم الشركة / الجهة</label>
            <input name="name" className="input" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">لون الهوية</label>
              <input name="brandColor" type="color" defaultValue="#38bdf8" className="input h-11 cursor-pointer p-1.5" />
            </div>
            <div>
              <label className="label">بيانات التواصل</label>
              <input name="contactInfo" className="input" placeholder="هاتف، بريد…" />
            </div>
          </div>
          <button className="btn-primary">إضافة الجهة</button>
        </form>
      </Modal>

      {/* ===== نافذة تقرير جديد ===== */}
      <Modal open={modal === 'report'} onClose={() => setModal(null)} title="⚡ تقرير إنجاز جديد">
        {projects.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              لا مشاريع بعد — أنشئ مشروعاً في قسم «الأعمال والمشاريع» وأنجز فيه مهاماً، ثم عُد لإصدار التقرير.
            </p>
          </div>
        ) : (
          <form onSubmit={onForm(createReport)} className="flex flex-col gap-4">
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              اختر المشروع والمدة — ستُجلب تلقائياً المهام <b>المنجزة</b> والمُعلَّمة
              <span className="text-sky-300"> «للتقرير» </span>
              فقط ضمن هذه الفترة (يشمل المؤرشف)، ثم <b>يُعتمد التقرير ويُؤرشف فوراً</b>.
            </p>
            <div>
              <label className="label">المشروع</label>
              <select name="projectId" className="input" required>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.entity?.name ? ` — ${p.entity.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">عنوان التقرير (اختياري)</label>
              <input name="title" className="input" placeholder="تقرير إنجاز شهر يوليو…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">من</label>
                <input name="periodStart" type="date" className="input" required defaultValue={monthStart} />
              </div>
              <div>
                <label className="label">إلى</label>
                <input name="periodEnd" type="date" className="input" required defaultValue={todayStr()} />
              </div>
            </div>
            <button className={cn('btn-primary', creating && 'pointer-events-none opacity-60')} disabled={creating}>
              <Zap size={15} /> {creating ? 'جارٍ الإنشاء…' : 'إنشاء واعتماد وأرشفة فورية'}
            </button>
          </form>
        )}
      </Modal>

      <ConfirmDialog />
    </div>
  );
}
