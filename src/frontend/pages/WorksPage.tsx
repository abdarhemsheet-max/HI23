import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  Pin,
  Search,
  Video,
  Megaphone,
  Palette,
  Globe,
  LayoutGrid,
} from 'lucide-react';
import { api, getCached } from '@/frontend/api';
import { cn, fmtDate } from '@/shared/utils';
import { youtubeThumb } from '@/frontend/youtube';
import type { Work, WorkType, WorkEntity, Project } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import StatsGrid from '@/frontend/components/ui/StatsGrid';
import { useConfirm } from '@/frontend/hooks/useConfirm';

const TYPES: Record<
  WorkType,
  { label: string; icon: typeof Video; accent: string; tone: 'rose' | 'sky' | 'violet' | 'amber' }
> = {
  video: { label: 'فيديو', icon: Video, accent: '#fb7185', tone: 'rose' },
  post: { label: 'منشور', icon: Megaphone, accent: '#38bdf8', tone: 'sky' },
  design: { label: 'تصميم', icon: Palette, accent: '#a78bfa', tone: 'violet' },
  website: { label: 'موقع', icon: Globe, accent: '#fbbf24', tone: 'amber' },
};

const TYPE_KEYS = Object.keys(TYPES) as WorkType[];

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

/** اسم المنصة من الرابط حين يتركه المستخدم فارغاً (youtube.com → youtube) */
function platformFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.split('.')[0] || 'عام';
  } catch {
    return 'عام';
  }
}

/** غلاف البطاقة: صورة مخصصة، أو مصغّرة يوتيوب، أو تدرّج بأيقونة النوع */
function WorkCover({ work }: { work: Work }) {
  const src = work.coverUrl ?? (work.type === 'video' ? youtubeThumb(work.url) : null);
  const [failed, setFailed] = useState(false);
  const { icon: Icon, accent } = TYPES[work.type];

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={work.title}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }
  return (
    <div
      className="flex h-36 w-full items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${accent}26, transparent 70%)` }}
    >
      <Icon size={34} style={{ color: accent }} className="opacity-70" />
    </div>
  );
}

export default function WorksPage() {
  const [works, setWorks] = useState<Work[]>(() => getCached<Work[]>('/api/crud/works') ?? []);
  const [entities, setEntities] = useState<WorkEntity[]>(() => getCached<WorkEntity[]>('/api/crud/entities') ?? []);
  const [projects, setProjects] = useState<Project[]>(() => getCached<Project[]>('/api/crud/projects') ?? []);
  const [filter, setFilter] = useState<'all' | WorkType>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Work | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const [w, e, p] = await Promise.all([
      api<Work[]>('/api/crud/works'),
      api<WorkEntity[]>('/api/crud/entities'),
      api<Project[]>('/api/crud/projects'),
    ]);
    if (w) setWorks(w);
    if (e) setEntities(e);
    if (p) setProjects(p);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (work: Work) => {
    setEditing(work);
    setFormOpen(true);
  };

  const save = async (f: FormData) => {
    const url = String(f.get('url') || '').trim();
    const body = {
      title: f.get('title'),
      type: f.get('type'),
      url,
      coverUrl: String(f.get('coverUrl') || '').trim() || null,
      platform: String(f.get('platform') || '').trim() || platformFromUrl(url),
      workDate: f.get('workDate') || null,
      entityId: f.get('entityId') || null,
      projectId: f.get('projectId') || null,
      description: String(f.get('description') || ''),
    };
    const ok = editing
      ? await api(`/api/crud/works/${editing.id}`, { method: 'PATCH', ok: 'حُدِّث العمل', body })
      : await api('/api/crud/works', { method: 'POST', ok: 'أُضيف العمل إلى معرضك 🎨', body });
    if (ok) {
      setFormOpen(false);
      setEditing(null);
      load();
    }
  };

  const togglePin = async (work: Work) => {
    // تحديث متفائل: التثبيت يظهر فوراً قبل رد الخادم
    setWorks((prev) => prev.map((w) => (w.id === work.id ? { ...w, isPinned: !w.isPinned } : w)));
    await api(`/api/crud/works/${work.id}`, { method: 'PATCH', body: { isPinned: !work.isPinned } });
    load();
  };

  const remove = async (work: Work) => {
    const ok = await confirm({
      title: 'حذف العمل',
      description: `سيُحذف «${work.title}» من المعرض نهائياً. الرابط الأصلي لن يتأثر.`,
      danger: true,
    });
    if (!ok) return;
    setWorks((prev) => prev.filter((w) => w.id !== work.id));
    await api(`/api/crud/works/${work.id}`, { method: 'DELETE' });
    load();
  };

  const q = search.trim().toLowerCase();
  const visible = works.filter((w) => {
    if (filter !== 'all' && w.type !== filter) return false;
    if (!q) return true;
    return (
      w.title.toLowerCase().includes(q) ||
      w.platform.toLowerCase().includes(q) ||
      (w.description ?? '').toLowerCase().includes(q) ||
      (w.entity?.name ?? '').toLowerCase().includes(q)
    );
  });

  const countOf = (t: WorkType) => works.filter((w) => w.type === t).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">معرض أعمالي</h1>
          <p className="mt-1 text-sm text-slate-500">
            كل ما أنجزته في مكان واحد — فيديو، منشور، تصميم، أو موقع
          </p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> إضافة عمل
        </button>
      </header>

      <StatsGrid
        columns={{ lg: 4, xl: 4 }}
        stats={[
          {
            label: 'إجمالي الأعمال',
            value: works.length,
            subtitle: works.filter((w) => w.isPinned).length
              ? `${works.filter((w) => w.isPinned).length} مثبَّتة`
              : undefined,
            icon: <LayoutGrid size={18} />,
            color: 'orange' as const,
          },
          ...TYPE_KEYS.map((t) => {
            const { label, icon: Icon, tone } = TYPES[t];
            return {
              label,
              value: countOf(t),
              icon: <Icon size={18} />,
              color: tone,
            };
          }),
        ]}
      />

      {/* ===== الفلترة والبحث ===== */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'chip border transition',
            filter === 'all'
              ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
              : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
          )}
        >
          الكل ({works.length})
        </button>
        {TYPE_KEYS.map((t) => {
          const { label, icon: Icon } = TYPES[t];
          return (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                'chip border transition',
                filter === t
                  ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon size={12} /> {label} ({countOf(t)})
            </button>
          );
        })}

        <div className="relative ms-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute inset-y-0 right-3 my-auto text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالعنوان أو المنصة أو الجهة…"
            className="input !py-2 !pe-9 text-xs"
          />
        </div>
      </div>

      {/* ===== الشبكة ===== */}
      {visible.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={LayoutGrid}
            title={works.length === 0 ? 'المعرض فارغ' : 'لا نتائج مطابقة'}
            hint={
              works.length === 0
                ? 'أضف أول عمل: رابط فيديو، منشور، تصميم، أو موقع أنشأته'
                : 'جرّب كلمة بحث أخرى أو أزل الفلتر'
            }
          />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((w) => {
            const { label, icon: Icon, accent } = TYPES[w.type];
            return (
              <div
                key={w.id}
                className="glass glass-hover group flex flex-col overflow-hidden !p-0 animate-fade-up"
              >
                <div className="relative overflow-hidden">
                  {/* key يصفّر حالة «فشل تحميل الصورة» عند تغيير الغلاف بالتعديل */}
                  <WorkCover key={w.coverUrl ?? w.url} work={w} />

                  <span
                    className="chip absolute top-2 start-2 border backdrop-blur-md"
                    style={{ background: `${accent}26`, borderColor: `${accent}59`, color: accent }}
                  >
                    <Icon size={11} /> {label}
                  </span>

                  <button
                    onClick={() => togglePin(w)}
                    title={w.isPinned ? 'إلغاء التثبيت' : 'تثبيت في المقدمة'}
                    className={cn(
                      'absolute top-2 end-2 rounded-lg border p-1.5 backdrop-blur-md transition',
                      w.isPinned
                        ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                        : 'border-white/10 bg-black/40 text-slate-400 opacity-0 hover:text-amber-300 group-hover:opacity-100'
                    )}
                  >
                    <Pin size={13} className={cn(w.isPinned && 'fill-current')} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="text-sm font-black leading-snug line-clamp-2" title={w.title}>
                    {w.title}
                  </h3>

                  {w.description && (
                    <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                      {w.description}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500">
                    <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-bold">{w.platform}</span>
                    {w.entity && (
                      <span
                        className="rounded-md px-1.5 py-0.5 font-bold"
                        style={{ background: `${w.entity.brandColor}1f`, color: w.entity.brandColor }}
                      >
                        {w.entity.name}
                      </span>
                    )}
                    {w.project && (
                      <span
                        className="rounded-md px-1.5 py-0.5 font-bold"
                        style={{ background: `${w.project.color}1f`, color: w.project.color }}
                      >
                        {w.project.name}
                      </span>
                    )}
                    {w.workDate && <span>{fmtDate(w.workDate)}</span>}
                  </div>

                  <div className="flex items-center gap-1.5 border-t border-white/[0.06] pt-2.5">
                    <a
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost flex-1 !px-2 !py-1.5 text-[11px]"
                    >
                      <ExternalLink size={12} /> فتح
                    </a>
                    <button
                      onClick={() => openEdit(w)}
                      className="btn-ghost !px-2 !py-1.5 text-[11px]"
                      aria-label="تعديل"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => remove(w)}
                      className="btn-ghost !px-2 !py-1.5 text-[11px] hover:!border-rose-500/30 hover:!text-rose-300"
                      aria-label="حذف"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== نافذة الإضافة/التعديل ===== */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? 'تعديل العمل' : 'إضافة عمل جديد'}
      >
        {/* key يعيد بناء الحقول عند تبديل العمل المُحرَّر (defaultValue لا تتحدث وحدها) */}
        <form key={editing?.id ?? 'new'} onSubmit={onForm(save)} className="flex flex-col gap-4">
          <div>
            <label className="label">عنوان العمل</label>
            <input
              name="title"
              className="input"
              required
              autoFocus
              defaultValue={editing?.title ?? ''}
              placeholder="فيديو ترويجي لشركة…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">النوع</label>
              <select name="type" className="input" defaultValue={editing?.type ?? 'video'}>
                {TYPE_KEYS.map((t) => (
                  <option key={t} value={t}>
                    {TYPES[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">المنصة (اختياري)</label>
              <input
                name="platform"
                className="input"
                defaultValue={editing?.platform ?? ''}
                placeholder="تُستنتج من الرابط"
              />
            </div>
          </div>

          <div>
            <label className="label">الرابط</label>
            <input
              name="url"
              type="url"
              className="input"
              required
              dir="ltr"
              defaultValue={editing?.url ?? ''}
              placeholder="https://…"
            />
          </div>

          <div>
            <label className="label">صورة الغلاف (اختياري)</label>
            <input
              name="coverUrl"
              type="url"
              className="input"
              dir="ltr"
              defaultValue={editing?.coverUrl ?? ''}
              placeholder="روابط يوتيوب تجلب صورتها تلقائياً"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">الجهة (اختياري)</label>
              <select name="entityId" className="input" defaultValue={editing?.entityId ?? ''}>
                <option value="">— بدون —</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">المشروع (اختياري)</label>
              <select name="projectId" className="input" defaultValue={editing?.projectId ?? ''}>
                <option value="">— بدون —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">تاريخ العمل (اختياري)</label>
            <input
              name="workDate"
              type="date"
              className="input"
              defaultValue={editing?.workDate ?? ''}
            />
          </div>

          <div>
            <label className="label">وصف مختصر (اختياري)</label>
            <textarea
              name="description"
              className="input"
              rows={2}
              defaultValue={editing?.description ?? ''}
              placeholder="ما الذي أنجزته في هذا العمل…"
            />
          </div>

          <button className="btn-primary">{editing ? 'حفظ التعديلات' : 'إضافة إلى المعرض'}</button>
        </form>
      </Modal>

      <ConfirmDialog />
    </div>
  );
}
