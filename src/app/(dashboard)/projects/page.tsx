'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Plus,
  Trash2,
  Briefcase,
  Infinity as InfinityIcon,
  CalendarRange,
  CheckCircle2,
  Circle,
  Building2,
  Archive,
  FileSignature,
  RotateCcw,
  ListTodo,
  FileCheck2,
} from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { fmtDateShort, todayStr, cn } from '@/shared/utils';
import type { Project, ProjectTask, WorkEntity } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import ProgressBar from '@/frontend/components/ui/ProgressBar';
import { useConfirm } from '@/frontend/hooks/useConfirm';

// Lazy load: مكتبة السحب والإفلات ثقيلة — تُحمّل فقط عند فتح تبويب «كافة المهام»
const SortableTasks = dynamic(() => import('@/frontend/components/SortableTasks'), {
  ssr: false,
  loading: () => <p className="py-8 text-center text-xs text-slate-500">جارٍ تحميل قائمة المهام…</p>,
});

const COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#22d3ee'];

type Filter = 'active' | 'finite' | 'ongoing' | 'archived' | 'all-tasks';

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(() => getCached<Project[]>('/api/crud/projects') ?? []);
  const [entities, setEntities] = useState<WorkEntity[]>(() => getCached<WorkEntity[]>('/api/crud/entities') ?? []);
  const [filter, setFilter] = useState<Filter>('active');
  const [modal, setModal] = useState<null | 'project'>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [newType, setNewType] = useState<'finite' | 'ongoing'>('finite');
  const [archived, setArchived] = useState<ProjectTask[] | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const [allTasks, setAllTasks] = useState<ProjectTask[]>(
    () => getCached<ProjectTask[]>('/api/crud/projectTasks') ?? []
  );

  const load = useCallback(async () => {
    const [p, e, t] = await Promise.all([
      api<Project[]>('/api/crud/projects'),
      api<WorkEntity[]>('/api/crud/entities'),
      api<ProjectTask[]>('/api/crud/projectTasks'),
    ]);
    if (p) setProjects(p);
    if (e) setEntities(e);
    if (t) setAllTasks(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = projects.find((p) => p.id === openId) ?? null;

  // عند فتح مشروع آخر نخفي أرشيفه السابق
  useEffect(() => {
    setArchived(null);
  }, [openId]);

  /** جلب المهام المؤرشفة (المنجزة قبل أكثر من 3 أيام) — تبقى في قاعدة البيانات */
  const loadArchived = async () => {
    if (!open) return;
    const all = await api<ProjectTask[]>('/api/crud/projectTasks');
    if (all) {
      const visible = new Set(open.tasks.map((t) => t.id));
      setArchived(all.filter((t) => t.projectId === open.id && !visible.has(t.id)));
    }
  };

  /** إجمالي المهام يشمل المؤرشفة (_count) — المهام غير المنجزة كلها ظاهرة دائماً */
  const countsOf = (p: Project) => {
    const total = p._count?.tasks ?? p.tasks.length;
    const undone = p.tasks.filter((t) => !t.isCompleted).length;
    return { total, done: total - undone };
  };

  const filtered = projects.filter((p) => {
    if (filter === 'active') return p.status === 'active';
    if (filter === 'archived') return p.status !== 'active';
    return p.status === 'active' && p.type === filter;
  });

  // ===== إجراءات =====
  const addProject = async (f: FormData) => {
    const type = String(f.get('type'));
    const ok = await api('/api/crud/projects', {
      method: 'POST',
      ok: 'أُنشئ المشروع',
      body: {
        name: f.get('name'),
        description: String(f.get('description') || ''),
        type,
        color: f.get('color'),
        startDate: String(f.get('startDate') || '') || null,
        // المشاريع المستمرة: لا يُرسل تاريخ انتهاء إطلاقاً
        endDate: type === 'finite' ? String(f.get('endDate') || '') || null : null,
        entityId: String(f.get('entityId') || '') || null,
      },
    });
    if (ok) {
      setModal(null);
      load();
    }
  };

  const addTask = async (f: FormData, projectId: string) => {
    const ok = await api('/api/crud/projectTasks', {
      method: 'POST',
      body: { title: f.get('title'), projectId },
    });
    if (ok) load();
  };

  const toggleTask = async (taskId: string, done: boolean) => {
    const ok = await api(`/api/crud/projectTasks/${taskId}`, {
      method: 'PATCH',
      body: { isCompleted: done },
    });
    if (ok) load();
  };

  /** تبديل «إدراج في التقرير الرسمي» — الخادم يرفض التفعيل لمهمة غير منجزة */
  const toggleReportFlag = async (task: ProjectTask) => {
    if (!task.isCompleted) return; // درع إضافي في الواجهة قبل حتى إرسال الطلب
    const ok = await api(`/api/projects/tasks/${task.id}/report`, {
      method: 'POST',
      body: { include: !task.includeInReport },
    });
    if (ok) load();
  };

  /** إنهاء مشروع مستمر (استقالة / إنهاء عقد) — أرشفة بدون حذف */
  const endOngoing = async (p: Project, reason: string) => {
    const confirmed = await confirm({
      title: `تأكيد ${reason}`,
      description: `سيُنقل مشروع «${p.name}» إلى الأرشيف مع كامل سجله — يمكن إعادة تفعيله لاحقاً.`,
      icon: Archive,
      confirmLabel: 'أرشفة',
    });
    if (!confirmed) return;
    const ok = await api(`/api/crud/projects/${p.id}`, {
      method: 'PATCH',
      ok: `أُرشف المشروع (${reason}) — سجله محفوظ`,
      body: { status: 'archived', endedReason: reason },
    });
    if (ok) {
      setOpenId(null);
      load();
    }
  };

  const completeFinite = async (p: Project) => {
    const ok = await api(`/api/crud/projects/${p.id}`, {
      method: 'PATCH',
      ok: '🎉 اكتمل المشروع',
      body: { status: 'done' },
    });
    if (ok) load();
  };

  const reactivate = async (p: Project) => {
    const ok = await api(`/api/crud/projects/${p.id}`, {
      method: 'PATCH',
      ok: 'أُعيد تفعيل المشروع',
      body: { status: 'active' },
    });
    if (ok) load();
  };

  const delProject = async (p: Project) => {
    const ok1 = await confirm({
      title: 'حذف المشروع نهائياً',
      description: `سيُحذف مشروع «${p.name}» وكل مهامه نهائياً. الأرشفة بديل أفضل يحفظ السجل.`,
      danger: true,
      confirmLabel: 'حذف نهائي',
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/projects/${p.id}`, { method: 'DELETE' });
    if (ok) {
      setOpenId(null);
      load();
    }
  };

  const delTask = async (task: ProjectTask) => {
    const ok1 = await confirm({
      title: 'حذف المهمة',
      description: `سيُحذف المهمة «${task.title}» نهائياً.`,
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/projectTasks/${task.id}`, { method: 'DELETE' });
    if (ok) load();
  };

  // ===== تبويب «كافة المهام»: سحب وإفلات + تحديثات متفائلة =====

  /** حفظ الترتيب الجديد — الواجهة تحدّثت فوراً، وهنا نثبّته في القاعدة */
  const reorderAll = async (orderedIds: string[]) => {
    // ترتيب متفائل للنسخة المحلية حتى لا ترتد عند إعادة التحميل
    const map = new Map(allTasks.map((t) => [t.id, t]));
    setAllTasks(orderedIds.map((id) => map.get(id)!).filter(Boolean));
    await api('/api/projects/reorder', { method: 'POST', body: { ids: orderedIds } });
  };

  /** تبديل الإنجاز مع تحديث متفائل فوري */
  const toggleAllTask = async (task: ProjectTask) => {
    const done = !task.isCompleted;
    setAllTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isCompleted: done } : t))
    );
    await api(`/api/crud/projectTasks/${task.id}`, { method: 'PATCH', body: { isCompleted: done } });
    load();
  };

  const deleteAllTask = async (task: ProjectTask) => {
    const ok = await confirm({
      title: 'حذف المهمة',
      description: `سيُحذف المهمة «${task.title}» نهائياً.`,
      danger: true,
    });
    if (!ok) return;
    setAllTasks((prev) => prev.filter((t) => t.id !== task.id));
    await api(`/api/crud/projectTasks/${task.id}`, { method: 'DELETE' });
    load();
  };

  // كافة المهام غير المنجزة من المشاريع النشطة (المرتبة يدوياً) + المنجزة حديثاً
  const activeTaskList = allTasks.filter((t) => {
    const proj = projects.find((p) => p.id === t.projectId);
    return proj?.status === 'active';
  });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'active', label: 'النشطة' },
    { id: 'finite', label: 'منتهية المدة ⏱' },
    { id: 'ongoing', label: 'مستمرة ∞' },
    { id: 'archived', label: 'الأرشيف 📦' },
    { id: 'all-tasks', label: 'كافة المهام 📋' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">الأعمال والمشاريع</h1>
          <p className="text-sm text-slate-500">مشاريع منتهية المدة وتعاقدات مستمرة — بمهام فرعية وتقدم واضح</p>
        </div>
        <button className="btn-primary" onClick={() => { setNewType('finite'); setModal('project'); }}>
          <Plus size={16} /> مشروع جديد
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold transition',
              filter === f.id
                ? 'bg-gradient-to-l from-emerald-500/25 to-teal-500/10 text-emerald-300 border border-emerald-500/25'
                : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ===== تبويب كافة المهام (سحب وإفلات) ===== */}
      {filter === 'all-tasks' ? (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="section-title">📋 كافة المهام</h3>
              <p className="text-[11px] text-slate-500">
                مهام كل المشاريع النشطة في مكان واحد — اسحب <span className="text-slate-400">⠿</span> لإعادة الترتيب حسب الأولوية
              </p>
            </div>
            <span className="chip bg-white/[0.06] text-slate-400">
              {activeTaskList.filter((t) => !t.isCompleted).length} متبقية
            </span>
          </div>
          {activeTaskList.length === 0 ? (
            <EmptyState icon={ListTodo} title="لا مهام بعد" hint="أضف مهاماً داخل مشاريعك النشطة لتظهر هنا" />
          ) : (
            <SortableTasks
              tasks={activeTaskList}
              onReorder={reorderAll}
              onToggle={toggleAllTask}
              onDelete={deleteAllTask}
            />
          )}
        </GlassCard>
      ) : filtered.length === 0 ? (
        <GlassCard>
          <EmptyState icon={Briefcase} title="لا مشاريع هنا" hint="أنشئ مشروعاً منتهي المدة أو تعاقداً مستمراً" />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const { total, done } = countsOf(p);
            const pct = total ? (done / total) * 100 : 0;
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="text-right">
                <GlassCard hover className="relative h-full overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-xl border p-2.5" style={{ color: p.color, borderColor: `${p.color}33`, background: `${p.color}11` }}>
                      <Briefcase size={18} />
                    </div>
                    <span
                      className={cn(
                        'chip',
                        p.status !== 'active'
                          ? 'bg-slate-500/15 text-slate-400'
                          : p.type === 'ongoing'
                            ? 'bg-sky-500/15 text-sky-300'
                            : 'bg-violet-500/15 text-violet-300'
                      )}
                    >
                      {p.status === 'archived' ? (
                        <><Archive size={11} /> {p.endedReason ?? 'مؤرشف'}</>
                      ) : p.status === 'done' ? (
                        <>✓ مكتمل</>
                      ) : p.type === 'ongoing' ? (
                        <><InfinityIcon size={12} /> مستمر</>
                      ) : (
                        <><CalendarRange size={11} /> منتهي المدة</>
                      )}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-black">{p.name}</h3>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">
                    {p.entity?.name ? `${p.entity.name} · ` : ''}
                    {p.type === 'finite'
                      ? `${fmtDateShort(p.startDate)}${p.endDate ? ` ← ${fmtDateShort(p.endDate)}` : ''}`
                      : `منذ ${fmtDateShort(p.startDate)} — بلا تاريخ انتهاء`}
                  </p>
                  {/* شريط التقدم العام */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-400">{done} من {total} مهمة</span>
                      <span className="font-black" style={{ color: p.color }}>{Math.round(pct)}%</span>
                    </div>
                    <ProgressBar value={pct} color={p.color} />
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== تفاصيل المشروع ===== */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.name ?? ''}>
        {open && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('chip', open.type === 'ongoing' ? 'bg-sky-500/15 text-sky-300' : 'bg-violet-500/15 text-violet-300')}>
                {open.type === 'ongoing' ? '∞ تعاقد / تعيين مستمر' : '⏱ مشروع منتهي المدة'}
              </span>
              {open.entity && (
                <span className="chip bg-white/[0.06] text-slate-300">
                  <Building2 size={11} /> {open.entity.name}
                </span>
              )}
              {open.status !== 'active' && (
                <span className="chip bg-slate-500/15 text-slate-400">
                  <Archive size={11} /> {open.endedReason ?? 'مؤرشف'}{open.endedAt ? ` — ${fmtDateShort(open.endedAt)}` : ''}
                </span>
              )}
            </div>

            {open.description && <p className="text-sm text-slate-400">{open.description}</p>}

            {/* المهام الفرعية */}
            <div>
              <p className="label">المهام الفرعية ({countsOf(open).done}/{countsOf(open).total})</p>
              <ProgressBar
                value={countsOf(open).total ? (countsOf(open).done / countsOf(open).total) * 100 : 0}
                color={open.color}
                className="mb-3"
              />
              <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                {open.tasks.map((t) => (
                  <div key={t.id} className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-white/[0.04]">
                    <button
                      onClick={() => toggleTask(t.id, !t.isCompleted)}
                      className={cn(
                        'flex flex-1 items-center gap-2.5 py-1.5 text-right text-sm font-semibold',
                        t.isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'
                      )}
                    >
                      {t.isCompleted ? (
                        <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
                      ) : (
                        <Circle size={17} className="shrink-0 text-slate-600" />
                      )}
                      {t.title}
                      {t.completedAt && (
                        <span className="text-[10px] text-slate-600">({fmtDateShort(t.completedAt)})</span>
                      )}
                    </button>
                    <button
                      onClick={() => toggleReportFlag(t)}
                      disabled={!t.isCompleted}
                      title={
                        !t.isCompleted
                          ? 'أنجز المهمة أولاً لإضافتها للتقرير'
                          : t.includeInReport
                            ? 'إزالة من التقرير الرسمي'
                            : 'إضافة للتقرير الرسمي'
                      }
                      className={cn(
                        'shrink-0 rounded-md p-1 transition',
                        t.includeInReport
                          ? 'text-sky-400 opacity-100'
                          : t.isCompleted
                            ? 'text-slate-600 opacity-0 hover:text-sky-400 group-hover:opacity-100'
                            : 'text-slate-800 opacity-0 cursor-not-allowed'
                      )}
                    >
                      <FileCheck2 size={14} />
                    </button>
                    <button className="text-slate-700 opacity-0 group-hover:opacity-100 hover:!text-rose-400" onClick={() => delTask(t)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {open.status === 'active' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    addTask(new FormData(form), open.id).then(() => form.reset());
                  }}
                  className="mt-2 flex gap-2"
                >
                  <input name="title" className="input" required placeholder="مهمة فرعية جديدة…" />
                  <button className="btn-primary !px-3.5">
                    <Plus size={15} />
                  </button>
                </form>
              )}

              {/* أرشيف المهام: المنجزة تختفي من العرض بعد 3 أيام وتبقى محفوظة */}
              <div className="mt-3 border-t border-white/[0.06] pt-2">
                {countsOf(open).total > open.tasks.length && archived === null && (
                  <button className="text-[11px] font-bold text-slate-500 hover:text-emerald-300" onClick={loadArchived}>
                    🗄 عرض الأرشيف ({countsOf(open).total - open.tasks.length} مهمة منجزة قديمة)
                  </button>
                )}
                {archived !== null && archived.length > 0 && (
                  <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                    <p className="text-[10px] font-bold text-slate-600">🗄 الأرشيف — أُنجزت قبل أكثر من 3 أيام:</p>
                    {archived.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 px-1 text-xs">
                        <span className="text-slate-500 line-through">✓ {t.title}</span>
                        {t.completedAt && (
                          <span className="text-[10px] text-slate-600">({fmtDateShort(t.completedAt)})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10px] text-slate-600">
                  المهام المنجزة تنتقل تلقائياً للأرشيف بعد 3 أيام — وتبقى محفوظة للتقارير.
                </p>
              </div>
            </div>

            {/* أزرار التحكم بالحالة */}
            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {open.status === 'active' && open.type === 'ongoing' && (
                <>
                  <button className="btn-danger" onClick={() => endOngoing(open, 'استقالة')}>
                    <FileSignature size={14} /> استقالة
                  </button>
                  <button className="btn-danger" onClick={() => endOngoing(open, 'إنهاء العقد')}>
                    <Archive size={14} /> إنهاء العقد
                  </button>
                </>
              )}
              {open.status === 'active' && open.type === 'finite' && (
                <button className="btn-primary !py-2 text-xs" onClick={() => completeFinite(open)}>
                  <CheckCircle2 size={14} /> اكتمل المشروع
                </button>
              )}
              {open.status !== 'active' && (
                <button className="btn-ghost !py-2 text-xs" onClick={() => reactivate(open)}>
                  <RotateCcw size={14} /> إعادة تفعيل
                </button>
              )}
              <button className="btn-ghost !py-2 text-xs !text-rose-300 mr-auto" onClick={() => delProject(open)}>
                <Trash2 size={14} /> حذف نهائي
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== مشروع جديد ===== */}
      <Modal open={modal === 'project'} onClose={() => setModal(null)} title="مشروع جديد">
        <form onSubmit={onForm(addProject)} className="flex flex-col gap-4">
          <div>
            <label className="label">اسم المشروع</label>
            <input name="name" className="input" required autoFocus placeholder="هوية بصرية، تعاقد شركة…" />
          </div>
          <div>
            <label className="label">الوصف (اختياري)</label>
            <input name="description" className="input" />
          </div>
          <div>
            <label className="label">نوع المشروع</label>
            <select name="type" className="input" value={newType} onChange={(e) => setNewType(e.target.value as 'finite' | 'ongoing')}>
              <option value="finite">منتهي — له مدة محددة ⏱</option>
              <option value="ongoing">مستمر — تعاقد / تعيين ∞</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">تاريخ البدء</label>
              <input name="startDate" type="date" className="input" defaultValue={todayStr()} />
            </div>
            {newType === 'finite' ? (
              <div>
                <label className="label">تاريخ الانتهاء</label>
                <input name="endDate" type="date" className="input" />
              </div>
            ) : (
              <div className="flex items-end">
                <p className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2.5 text-[11px] text-sky-200">
                  ∞ بلا تاريخ انتهاء — يُنهى بزر استقالة / إنهاء عقد
                </p>
              </div>
            )}
          </div>
          <div>
            <label className="label">جهة العمل (اختياري — تظهر في التقارير)</label>
            <select name="entityId" className="input" defaultValue="">
              <option value="">— مشروع شخصي —</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">اللون</label>
            <div className="flex gap-2">
              {COLORS.map((c, i) => (
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
          <button className="btn-primary">إنشاء المشروع</button>
        </form>
      </Modal>

      <ConfirmDialog />
    </div>
  );
}
