import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  GraduationCap,
  BookOpen,
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Minus,
  Youtube,
  ExternalLink,
  ListVideo,
  Trophy,
  Sparkles,
  Zap,
  X,
  Maximize2,
} from 'lucide-react';
import { api, getCached, notify } from '@/frontend/api';
import { cn } from '@/shared/utils';
import { youtubeThumb, isYouTube, youtubeVideoId } from '@/frontend/youtube';
import type { LearningItem, LearningLesson } from '@/shared/types';
import GlassCard from '@/frontend/components/ui/GlassCard';
import Modal from '@/frontend/components/ui/Modal';
import EmptyState from '@/frontend/components/ui/EmptyState';
import ProgressBar from '@/frontend/components/ui/ProgressBar';
import StatCard from '@/frontend/components/ui/StatCard';
import { useConfirm } from '@/frontend/hooks/useConfirm';
import LessonNotesEditor from '@/frontend/components/LessonNotesEditor';

type Filter = 'all' | 'course' | 'book' | 'done';

const MILESTONES = [25, 50, 75];

/** لقب المستوى حسب عدد الإنجازات المكتملة — طابع الألعاب */
function levelOf(completed: number): { title: string; icon: string } {
  if (completed >= 6) return { title: 'أسطورة التعلم', icon: '👑' };
  if (completed >= 3) return { title: 'نهم للمعرفة', icon: '🚀' };
  if (completed >= 1) return { title: 'مثابر', icon: '💪' };
  return { title: 'البداية', icon: '🌱' };
}

const onForm =
  (fn: (f: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fn(new FormData(e.currentTarget));
  };

const pctOf = (i: LearningItem) => (i.totalUnits > 0 ? (i.doneUnits / i.totalUnits) * 100 : 0);

export default function LearningPage() {
  const [items, setItems] = useState<LearningItem[]>(() => getCached<LearningItem[]>('/api/crud/learning') ?? []);
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [theaterItem, setTheaterItem] = useState<LearningItem | null>(null);
  const [theaterLesson, setTheaterLesson] = useState<LearningLesson | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const data = await api<LearningItem[]>('/api/crud/learning');
    if (data) setItems(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = items.find((i) => i.id === openId) ?? null;

  // ===== إضافة كورس/كتاب (مع لصق قائمة الدروس دفعة واحدة) =====
  const addItem = async (f: FormData) => {
    const lessonsRaw = String(f.get('lessons') || '').trim();
    const lessonTitles = lessonsRaw
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[).\-–:]?\s*/, '').trim()) // إزالة الترقيم من قوائم يوتيوب
      .filter(Boolean);

    const item = await api<LearningItem>('/api/crud/learning', {
      method: 'POST',
      body: {
        title: f.get('title'),
        kind: f.get('kind'),
        category: String(f.get('category') || ''),
        url: String(f.get('url') || ''),
        channel: String(f.get('channel') || ''),
        totalUnits: lessonTitles.length > 0 ? lessonTitles.length : Number(f.get('totalUnits') || 1),
        notes: String(f.get('notes') || ''),
      },
    });
    if (!item) return;

    if (lessonTitles.length > 0) {
      await api('/api/learning/lessons', {
        method: 'POST',
        body: { itemId: item.id, titles: lessonTitles },
      });
    }
    notify(`🚀 أُضيف «${item.title}» — رحلة تعلم موفقة!`, 'success');
    setModal(false);
    load();
  };

  // ===== إنجاز درس + إشارات الإنجاز (Gamification) =====
  const toggleLesson = async (item: LearningItem, lesson: LearningLesson) => {
    const before = pctOf(item);
    const ok = await api(`/api/learning/lessons/${lesson.id}`, {
      method: 'PATCH',
      body: { isDone: !lesson.isDone },
    });
    if (!ok) return;

    if (!lesson.isDone) {
      const doneAfter = item.lessons.filter((l) => l.isDone).length + 1;
      const after = (doneAfter / item.lessons.length) * 100;
      if (after >= 100) {
        notify(`🏆 مبروك! أتممت «${item.title}» بالكامل — إنجاز يستحق الاحتفال!`, 'success');
      } else {
        const crossed = MILESTONES.find((m) => before < m && after >= m);
        if (crossed) notify(`🎖 تجاوزت ${crossed}% في «${item.title}» — استمر!`, 'success');
      }
    }
    load();
  };

  const addLessonsBulk = async (f: FormData) => {
    if (!open) return;
    const titles = String(f.get('bulk') || '')
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[).\-–:]?\s*/, '').trim())
      .filter(Boolean);
    const ok = await api('/api/learning/lessons', {
      method: 'POST',
      ok: `أُضيف ${titles.length} درساً 📚`,
      body: { itemId: open.id, titles },
    });
    if (ok) {
      setBulkOpen(false);
      load();
    }
  };

  const addLessonSingle = async (f: FormData, form: HTMLFormElement) => {
    if (!open) return;
    const ok = await api('/api/learning/lessons', {
      method: 'POST',
      body: { itemId: open.id, titles: [String(f.get('title'))] },
    });
    if (ok) {
      form.reset();
      load();
    }
  };

  const delLesson = async (id: string) => {
    const ok = await api(`/api/learning/lessons/${id}`, { method: 'DELETE' });
    if (ok) load();
  };

  // ===== عدّاد يدوي (كتب / كورسات بدون قائمة دروس) =====
  const bump = async (item: LearningItem, delta: number) => {
    const next = Math.min(item.totalUnits, Math.max(0, item.doneUnits + delta));
    const finished = next >= item.totalUnits;
    const ok = await api(`/api/crud/learning/${item.id}`, {
      method: 'PATCH',
      ok: finished ? `🏆 مبروك! أتممت «${item.title}» بالكامل!` : undefined,
      body: { doneUnits: next, status: finished ? 'done' : 'in_progress' },
    });
    if (ok) load();
  };

  const setStatus = async (item: LearningItem, status: LearningItem['status']) => {
    const ok = await api(`/api/crud/learning/${item.id}`, { method: 'PATCH', body: { status } });
    if (ok) load();
  };

  const del = async (item: LearningItem) => {
    const ok1 = await confirm({
      title: 'تأكيد الحذف',
      description: `سيُحذف «${item.title}» مع جميع دروسه المسجّلة نهائياً.`,
      danger: true,
    });
    if (!ok1) return;
    const ok = await api(`/api/crud/learning/${item.id}`, { method: 'DELETE' });
    if (ok) {
      if (openId === item.id) setOpenId(null);
      load();
    }
  };

  // ===== وضع التركيز المسرحي =====
  const openTheater = (item: LearningItem, lesson?: LearningLesson) => {
    setTheaterItem(item);
    setTheaterLesson(lesson ?? null);
    setOpenId(null);
  };

  const closeTheater = () => {
    setTheaterItem(null);
    setTheaterLesson(null);
    load();
  };

  const theaterNextLesson = () => {
    if (!theaterItem) return;
    const lessons = theaterItem.lessons;
    if (lessons.length === 0) return;
    const idx = theaterLesson ? lessons.findIndex((l) => l.id === theaterLesson.id) : -1;
    const next = lessons[idx + 1] ?? lessons[0];
    setTheaterLesson(next);
  };

  const theaterPrevLesson = () => {
    if (!theaterItem) return;
    const lessons = theaterItem.lessons;
    if (lessons.length === 0) return;
    const idx = theaterLesson ? lessons.findIndex((l) => l.id === theaterLesson.id) : 1;
    const prev = lessons[idx - 1] ?? lessons[lessons.length - 1];
    setTheaterLesson(prev);
  };

  // ===== إحصائيات وطابع الألعاب =====
  const inProgress = items.filter((i) => i.status === 'in_progress');
  const completed = items.filter((i) => i.status === 'done');
  const totalDoneUnits = items.reduce((a, i) => a + i.doneUnits, 0);
  const xp = totalDoneUnits * 10;
  const level = levelOf(completed.length);

  const filtered = items.filter((i) => {
    if (filter === 'all') return i.status !== 'done';
    if (filter === 'done') return i.status === 'done';
    return i.kind === filter && i.status !== 'done';
  });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'قيد التقدم' },
    { id: 'course', label: 'الكورسات 🎓' },
    { id: 'book', label: 'الكتب 📚' },
    { id: 'done', label: `المكتملة 🏆 (${completed.length})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">التعلم والقراءة</h1>
          <p className="text-sm text-slate-500">تتبع احترافي لكورسات يوتيوب والكتب — درساً بدرس</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip border border-amber-500/25 bg-amber-500/10 !px-3 !py-1.5 text-amber-300">
            {level.icon} المستوى: {level.title}
          </span>
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} /> كورس / كتاب
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="قيد الدراسة الآن" value={String(inProgress.length)} icon={Play} tone="violet" />
        <StatCard title="دروس وصفحات منجزة" value={String(totalDoneUnits)} icon={CheckCircle2} tone="sky" />
        <StatCard title="أُتم بالكامل" value={String(completed.length)} icon={Trophy} tone="amber" sub={`${level.icon} ${level.title}`} />
        <StatCard title="نقاط الخبرة" value={`${xp} XP`} icon={Zap} tone="orange" sub="كل إنجاز = 10 نقاط" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold transition',
              filter === f.id
                ? 'bg-gradient-to-l from-orange-500/25 to-orange-500/10 text-orange-300 border border-orange-500/25'
                : 'bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={GraduationCap}
            title="لا عناصر هنا"
            hint="الصق رابط كورس يوتيوب وقائمة دروسه — وابدأ رحلتك"
          />
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const pct = pctOf(item);
            const isBook = item.kind === 'book';
            const color = item.status === 'done' ? '#fbbf24' : isBook ? '#38bdf8' : '#a78bfa';
            const unit = isBook ? 'صفحة' : 'درس';
            const thumb = youtubeThumb(item.url);
            const yt = isYouTube(item.url);
            const nextLesson = item.lessons.find((l) => !l.isDone);
            return (
              <GlassCard key={item.id} hover className="group relative overflow-hidden !p-0">
                {/* ===== الغلاف / الصورة المصغرة ===== */}
                <div className="relative h-36 w-full overflow-hidden">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${color}33, ${color}0d)` }}
                    >
                      {isBook ? <BookOpen size={40} style={{ color }} /> : <GraduationCap size={40} style={{ color }} />}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-night-900/90 via-transparent to-transparent" />
                  {/* شارات */}
                  <div className="absolute right-2.5 top-2.5 flex gap-1.5">
                    {yt && (
                      <span className="chip bg-red-600/90 text-white">
                        <Youtube size={11} /> يوتيوب
                      </span>
                    )}
                    <span className={cn('chip backdrop-blur', isBook ? 'bg-sky-500/70 text-white' : 'bg-violet-500/70 text-white')}>
                      {isBook ? '📚 كتاب' : '🎓 كورس'}
                    </span>
                  </div>
                  {item.status === 'done' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-night-900/50 backdrop-blur-[2px]">
                      <span className="flex items-center gap-2 rounded-2xl border border-amber-400/50 bg-amber-500/20 px-4 py-2 text-sm font-black text-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
                        <Trophy size={17} /> مكتمل 🎉
                      </span>
                    </div>
                  )}
                  {/* زر متابعة المشاهدة */}
                  {item.url && item.status !== 'done' && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-xl bg-orange-500/90 px-3 py-1.5 text-[11px] font-black text-night-900 opacity-0 shadow-lg transition group-hover:opacity-100"
                    >
                      <Play size={12} /> متابعة المشاهدة
                    </a>
                  )}
                </div>

                {/* ===== المحتوى ===== */}
                <div className="p-4">
                  <h3 className="line-clamp-1 text-sm font-black" title={item.title}>{item.title}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {item.channel && <span className="font-bold text-slate-400">{item.channel} · </span>}
                    {item.category}
                  </p>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-400">
                        {item.doneUnits} / {item.totalUnits} {unit}
                      </span>
                      <span className="font-black" style={{ color }}>{Math.round(pct)}%</span>
                    </div>
                    <ProgressBar value={pct} color={color} />
                  </div>

                  {nextLesson && item.status !== 'done' && (
                    <p className="mt-2.5 line-clamp-1 text-[11px] text-slate-500">
                      <span className="font-bold text-orange-400">▶ التالي:</span> {nextLesson.title}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {item.lessons.length > 0 ? (
                        <button className="btn-ghost !px-3 !py-1.5 text-[11px]" onClick={() => setOpenId(item.id)}>
                          <ListVideo size={13} /> الدروس ({item.lessons.filter((l) => l.isDone).length}/{item.lessons.length})
                        </button>
                      ) : (
                        <>
                          <button className="btn-ghost !p-1.5" onClick={() => bump(item, -1)} aria-label="إنقاص">
                            <Minus size={13} />
                          </button>
                          <button className="btn-primary !px-2.5 !py-1.5 text-[11px]" onClick={() => bump(item, +1)}>
                            <Plus size={13} /> {unit}
                          </button>
                          <button className="btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={() => setOpenId(item.id)}>
                            <ListVideo size={13} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                      {item.status === 'in_progress' ? (
                        <button className="text-slate-500 hover:text-amber-300" title="إيقاف مؤقت" onClick={() => setStatus(item, 'paused')}>
                          <Pause size={14} />
                        </button>
                      ) : item.status === 'paused' ? (
                        <button className="text-slate-500 hover:text-orange-300" title="استئناف" onClick={() => setStatus(item, 'in_progress')}>
                          <Play size={14} />
                        </button>
                      ) : null}
                      <button className="text-slate-500 hover:text-orange-300" title="وضع التركيز" onClick={() => openTheater(item)}>
                        <Maximize2 size={14} />
                      </button>
                      <button className="text-slate-500 hover:text-rose-400" onClick={() => del(item)}>
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

      {/* ============ نافذة الدروس ============ */}
      <Modal open={!!open} onClose={() => { setOpenId(null); setBulkOpen(false); }} title={open?.title ?? ''}>
        {open && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {isYouTube(open.url) && (
                <span className="chip bg-red-600/80 text-white"><Youtube size={11} /> يوتيوب</span>
              )}
              {open.channel && <span className="chip bg-white/[0.06] text-slate-300">{open.channel}</span>}
              {open.url && (
                <a href={open.url} target="_blank" rel="noreferrer" className="chip border border-orange-500/25 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20">
                  <ExternalLink size={11} /> فتح الكورس
                </a>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-400">{open.doneUnits} / {open.totalUnits}</span>
                <span className="font-black text-orange-300">{Math.round(pctOf(open))}%</span>
              </div>
              <ProgressBar value={pctOf(open)} color={open.status === 'done' ? '#fbbf24' : '#f97316'} />
            </div>

            {/* قائمة الدروس */}
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {open.lessons.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-600">
                  لا دروس بعد — الصق قائمة الدروس دفعة واحدة من الأسفل 👇
                </p>
              )}
              {open.lessons.map((l, idx) => (
                <div key={l.id} className="group flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-white/[0.04]">
                  <button
                    onClick={() => toggleLesson(open, l)}
                    className={cn(
                      'flex flex-1 items-center gap-2.5 py-1.5 text-right text-sm font-semibold',
                      l.isDone ? 'text-slate-500 line-through' : 'text-slate-200'
                    )}
                  >
                    {l.isDone ? (
                      <CheckCircle2 size={16} className="shrink-0 text-orange-400" />
                    ) : (
                      <Circle size={16} className="shrink-0 text-slate-600" />
                    )}
                    <span className="text-[10px] font-black text-slate-600">{idx + 1}</span>
                    <span className="flex-1">{l.title}</span>
                  </button>
                  <button
                    className="shrink-0 text-slate-600 opacity-0 transition hover:text-orange-300 group-hover:opacity-100"
                    title="فتح في وضع التركيز"
                    onClick={() => openTheater(open, l)}
                  >
                    <Maximize2 size={13} />
                  </button>
                  <button className="shrink-0 text-slate-700 opacity-0 group-hover:opacity-100 hover:!text-rose-400" onClick={() => delLesson(l.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* إضافة درس واحد */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addLessonSingle(new FormData(e.currentTarget), e.currentTarget);
              }}
              className="flex gap-2"
            >
              <input name="title" className="input" required placeholder="درس جديد…" />
              <button className="btn-primary !px-3.5"><Plus size={15} /></button>
            </form>

            {/* لصق دفعة واحدة */}
            {!bulkOpen ? (
              <button className="btn-ghost !py-2 text-xs" onClick={() => setBulkOpen(true)}>
                <Sparkles size={13} /> لصق قائمة دروس كاملة (سطر لكل درس)
              </button>
            ) : (
              <form onSubmit={onForm(addLessonsBulk)} className="flex flex-col gap-2">
                <textarea
                  name="bulk"
                  className="input"
                  rows={5}
                  required
                  placeholder={'مقدمة الكورس\nتنصيب الأدوات\nأساسيات التصميم\n… (الترقيم يُزال تلقائياً)'}
                />
                <button className="btn-primary !py-2 text-xs">إضافة الدروس دفعة واحدة</button>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* ============ نافذة إضافة كورس/كتاب ============ */}
      <Modal open={modal} onClose={() => setModal(false)} title="كورس / كتاب جديد">
        <form onSubmit={onForm(addItem)} className="flex flex-col gap-4">
          <div>
            <label className="label">العنوان</label>
            <input name="title" className="input" required autoFocus placeholder="كورس UI/UX من الصفر…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">التصنيف</label>
              <select name="kind" className="input" defaultValue="course">
                <option value="course">كورس 🎓</option>
                <option value="book">كتاب 📚</option>
              </select>
            </div>
            <div>
              <label className="label">المجال</label>
              <input name="category" className="input" placeholder="جرافيك، برمجة…" />
            </div>
          </div>
          <div>
            <label className="label">رابط الكورس (يوتيوب = صورة مصغرة تلقائية 🎬)</label>
            <input name="url" className="input" dir="ltr" placeholder="https://youtube.com/watch?v=…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">القناة / المؤلف</label>
              <input name="channel" className="input" placeholder="اسم القناة…" />
            </div>
            <div>
              <label className="label">الإجمالي (إن لم تُدخل دروساً)</label>
              <input name="totalUnits" type="number" min="1" className="input" placeholder="عدد الدروس/الصفحات" />
            </div>
          </div>
          <div>
            <label className="label">قائمة الدروس — سطر لكل درس (اختياري لكنه الأقوى ⚡)</label>
            <textarea
              name="lessons"
              className="input"
              rows={4}
              placeholder={'1. مقدمة الكورس\n2. تجهيز الأدوات\n3. أول مشروع\n… (انسخها من وصف قائمة التشغيل)'}
            />
          </div>
          <button className="btn-primary">إضافة وبدء الرحلة 🚀</button>
        </form>
      </Modal>

      {/* ============ وضع التركيز المسرحي ============ */}
      {theaterItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-md">
          {/* شريط علوي */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <button
              onClick={closeTheater}
              className="flex items-center gap-2 rounded-xl border border-white/[0.10] bg-white/[0.05] px-4 py-2 text-sm font-bold text-slate-300 backdrop-blur transition hover:border-rose-500/30 hover:text-rose-300"
            >
              <X size={16} /> خروج
            </button>
            <div className="flex flex-1 items-center justify-center gap-3 px-4 text-center">
              <h2 className="text-base font-black text-slate-100">{theaterItem.title}</h2>
              {theaterLesson && (
                <span className="hidden text-sm text-slate-500 sm:inline">
                  · {theaterLesson.title}
                </span>
              )}
            </div>
            <div className="w-20" />
          </div>

          {/* المحتوى الرئيسي */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-4 lg:flex-row lg:items-start lg:p-8">
            {/* الجانب الأيمن: مشغل الفيديو / عدّاد الصفحات */}
            <div className="flex w-full max-w-4xl flex-col items-center justify-center lg:w-3/5">
              {theaterItem.lessons.length === 0 ? (
                /* كتب / كورسات بدون دروس: عدّاد كبير */
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-8">
                    <button
                      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.05] text-2xl font-black text-slate-300 backdrop-blur transition hover:border-orange-500/30 hover:text-orange-300"
                      onClick={() => bump(theaterItem, -1)}
                    >
                      <Minus size={28} />
                    </button>
                    <div className="text-center">
                      <div className="text-7xl font-black text-slate-100">
                        {theaterItem.doneUnits}
                      </div>
                      <p className="mt-2 text-lg text-slate-500">
                        من {theaterItem.totalUnits} {theaterItem.kind === 'book' ? 'صفحة' : 'وحدة'}
                      </p>
                    </div>
                    <button
                      className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.05] text-2xl font-black text-slate-300 backdrop-blur transition hover:border-orange-500/30 hover:text-orange-300"
                      onClick={() => bump(theaterItem, +1)}
                    >
                      <Plus size={28} />
                    </button>
                  </div>
                  <ProgressBar
                    value={pctOf(theaterItem)}
                    className="w-full max-w-sm"
                    color={theaterItem.kind === 'book' ? '#38bdf8' : '#a78bfa'}
                  />
                </div>
              ) : theaterLesson && isYouTube(theaterItem.url) ? (
                /* فيديو يوتيوب */
                <div className="w-full">
                  <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-2xl">
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeVideoId(theaterItem.url)}?autoplay=1&rel=0`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={theaterLesson.title}
                    />
                  </div>
                  {/* التنقل بين الدروس */}
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <button
                      className="btn-ghost !px-4 !py-2 text-sm"
                      onClick={theaterPrevLesson}
                    >
                      ‹ السابق
                    </button>
                    <span className="text-xs text-slate-500">
                      {theaterItem.lessons.findIndex((l) => l.id === theaterLesson.id) + 1}
                      {' '}/ {theaterItem.lessons.length}
                    </span>
                    <button
                      className="btn-ghost !px-4 !py-2 text-sm"
                      onClick={theaterNextLesson}
                    >
                      التالي ›
                    </button>
                  </div>
                </div>
              ) : theaterLesson ? (
                /* كورس بدون رابط يوتيوب: عرض الدرس الحالي */
                <div className="flex w-full flex-col items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                    <GraduationCap size={36} />
                  </div>
                  <p className="text-xl font-black text-slate-100">{theaterLesson.title}</p>
                  <div className="flex items-center gap-4">
                    <button
                      className="btn-ghost !px-4 !py-2 text-sm"
                      onClick={theaterPrevLesson}
                    >
                      ‹ السابق
                    </button>
                    <span className="text-xs text-slate-500">
                      {theaterItem.lessons.findIndex((l) => l.id === theaterLesson.id) + 1}
                      {' / '}{theaterItem.lessons.length}
                    </span>
                    <button
                      className="btn-ghost !px-4 !py-2 text-sm"
                      onClick={theaterNextLesson}
                    >
                      التالي ›
                    </button>
                  </div>
                  <button
                    className={cn(
                      'btn-primary !px-6 !py-3 text-sm',
                      theaterLesson.isDone && '!border-orange-500/30 !bg-orange-500/15 !text-orange-300'
                    )}
                    onClick={() => toggleLesson(theaterItem, theaterLesson)}
                  >
                    {theaterLesson.isDone ? '✓ تم' : 'إنجاز هذا الدرس'}
                  </button>
                </div>
              ) : (
                /* لا يوجد درس محدد */
                <div className="flex flex-col items-center gap-4 text-slate-500">
                  <GraduationCap size={48} />
                  <p>اختر درساً من القائمة للبدء</p>
                </div>
              )}
            </div>

            {/* الجانب الأيسر: الملاحظات */}
            {theaterLesson && (
              <div className="w-full max-w-lg lg:w-2/5">
                <GlassCard className="!p-4">
                  <LessonNotesEditor
                    lessonId={theaterLesson.id}
                    initialNotes={theaterLesson.notes}
                  />
                  {theaterItem.url && isYouTube(theaterItem.url) && (
                    <a
                      href={theaterItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-400 transition hover:text-orange-300"
                    >
                      <ExternalLink size={13} /> فتح في يوتيوب
                    </a>
                  )}
                </GlassCard>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
