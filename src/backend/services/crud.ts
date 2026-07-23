// ======================================================================
// محرك CRUD عام يحل محل /api/crud/[resource] المبني على Next.js.
// كل مورد مُعرَّف بقائمة بيضاء (لا وصول عشوائي للجداول) + دوال تنظيف/
// تحقق للإنشاء والتعديل — نفس بنية src/backend/resources.ts الأصلية
// لكن موجَّهة لجداول Supabase (Postgres) بدل Prisma/SQLite.
// ======================================================================

import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import {
  ValidationError,
  reqStr,
  optStr,
  posNum,
  optNum,
  intMin,
  oneOf,
  optBool,
  dayStr,
  reqDate,
  optDate,
  optId,
} from '../validate';

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

interface OrderSpec {
  column: string;
  ascending?: boolean;
  foreignTable?: string;
}

export interface ResourceDef {
  table: string;
  select?: string; // افتراضياً '*'
  orderBy?: OrderSpec[];
  upsertOn?: string; // اسم عمود فريد لكل مستخدم — يُستخدم مع weeklyFocus
  create?: (b: Body) => Row;
  update?: (b: Body) => Row;
  /** تحويل ما بعد الجلب — للحالات التي لا تُترجم مباشرة لصياغة PostgREST */
  postProcess?: (rows: Row[]) => Row[] | Promise<Row[]>;
}

function safeJsonArray(v: unknown): string {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    throw new ValidationError('قائمة الأيام غير صالحة');
  }
  return JSON.stringify(v);
}

async function foldersPostProcess(rows: Row[]): Promise<Row[]> {
  const { data: docs } = await supabase.from('Document').select('folderId');
  const counts = new Map<string, number>();
  for (const d of (docs ?? []) as { folderId: string | null }[]) {
    if (d.folderId) counts.set(d.folderId, (counts.get(d.folderId) ?? 0) + 1);
  }
  return rows.map((f) => ({ ...f, _count: { documents: counts.get(f.id as string) ?? 0 } }));
}

function projectsPostProcess(rows: Row[]): Row[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  return rows.map((p) => {
    const allTasks = (p.tasks as Row[] | null) ?? [];
    const visible = allTasks
      .filter((t) => !t.isCompleted || (t.completedAt && new Date(t.completedAt as string) >= cutoff))
      .sort((a, b) => {
        const so = (a.sortOrder as number) - (b.sortOrder as number);
        if (so !== 0) return so;
        return new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime();
      });
    return { ...p, tasks: visible, _count: { tasks: allTasks.length } };
  });
}

export const RESOURCES: Record<string, ResourceDef> = {
  // ===== المالية =====
  wallets: {
    table: 'Wallet',
    orderBy: [{ column: 'createdAt', ascending: true }],
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم المحفظة', 100),
      type: oneOf(b, 'type', ['cash', 'bank'] as const, 'نوع المحفظة'),
      balance: optNum(b, 'balance', 0),
    }),
    update: (b) => ({
      ...(b.name !== undefined && { name: reqStr(b, 'name', 'اسم المحفظة', 100) }),
      ...(b.balance !== undefined && { balance: optNum(b, 'balance', 0) }),
    }),
  },

  debts: {
    table: 'Debt',
    orderBy: [{ column: 'createdAt', ascending: false }],
    create: (b) => ({
      personName: reqStr(b, 'personName', 'اسم الشخص', 100),
      direction: oneOf(b, 'direction', ['owed_to_me', 'i_owe'] as const, 'اتجاه الدين'),
      amount: posNum(b, 'amount', 'المبلغ'),
      dueDate: optDate(b, 'dueDate'),
      notes: optStr(b, 'notes'),
    }),
    update: (b) => ({
      ...(b.isSettled !== undefined && { isSettled: optBool(b, 'isSettled') }),
      ...(b.paidAmount !== undefined && { paidAmount: optNum(b, 'paidAmount', 0) }),
    }),
  },

  subscriptions: {
    table: 'Subscription',
    orderBy: [{ column: 'nextRenewal', ascending: true }],
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم الاشتراك', 100),
      amount: posNum(b, 'amount', 'قيمة الاشتراك'),
      billingCycle: oneOf(b, 'billingCycle', ['monthly', 'yearly'] as const, 'دورة التجديد'),
      nextRenewal: reqDate(b, 'nextRenewal', 'تاريخ التجديد'),
      category: optStr(b, 'category') ?? 'أدوات',
    }),
    update: (b) => ({
      ...(b.nextRenewal !== undefined && { nextRenewal: reqDate(b, 'nextRenewal', 'تاريخ التجديد') }),
      ...(b.isActive !== undefined && { isActive: optBool(b, 'isActive') }),
    }),
  },

  assets: {
    table: 'Asset',
    orderBy: [{ column: 'createdAt', ascending: false }],
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم الأصل', 150),
      category: optStr(b, 'category') ?? 'عام',
      estimatedValue: optNum(b, 'estimatedValue', 0),
      purchaseDate: optDate(b, 'purchaseDate'),
      notes: optStr(b, 'notes'),
    }),
    update: (b) => ({
      ...(b.estimatedValue !== undefined && { estimatedValue: optNum(b, 'estimatedValue', 0) }),
    }),
  },

  savings: {
    table: 'SavingsGoal',
    orderBy: [{ column: 'createdAt', ascending: false }],
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم الهدف', 150),
      targetAmount: posNum(b, 'targetAmount', 'المبلغ المستهدف'),
      currentAmount: optNum(b, 'currentAmount', 0),
      deadline: optDate(b, 'deadline'),
      color: optStr(b, 'color') ?? '#f97316',
    }),
    update: (b) => ({
      ...(b.currentAmount !== undefined && { currentAmount: optNum(b, 'currentAmount', 0) }),
    }),
  },

  // ===== العادات والمهام =====
  dailyTasks: {
    table: 'DailyTask',
    select: '*, logs:TaskLog(date)',
    orderBy: [{ column: 'createdAt', ascending: true }],
    create: (b) => {
      const kind = oneOf(b, 'kind', ['recurring', 'once'] as const, 'نوع المهمة');
      return {
        title: reqStr(b, 'title', 'عنوان المهمة', 200),
        kind,
        date: kind === 'once' ? dayStr(b, 'date', 'يوم المهمة') : null,
      };
    },
    update: (b) => ({
      ...(b.title !== undefined && { title: reqStr(b, 'title', 'عنوان المهمة', 200) }),
      ...(b.isActive !== undefined && { isActive: optBool(b, 'isActive') }),
    }),
  },

  habits: {
    table: 'Habit',
    select: '*, logs:HabitLog(date)',
    orderBy: [{ column: 'createdAt', ascending: true }],
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم العادة', 100),
      icon: optStr(b, 'icon') ?? '🔥',
      color: optStr(b, 'color') ?? '#f97316',
    }),
    update: (b) => ({
      ...(b.name !== undefined && { name: reqStr(b, 'name', 'اسم العادة', 100) }),
      ...(b.isActive !== undefined && { isActive: optBool(b, 'isActive') }),
    }),
  },

  weeklyFocus: {
    table: 'WeeklyFocus',
    orderBy: [{ column: 'weekStart', ascending: false }],
    upsertOn: 'weekStart', // تركيز واحد فقط لكل أسبوع — الإنشاء المكرر يحدّث بدل أن يفشل
    create: (b) => ({
      title: reqStr(b, 'title', 'عنوان التركيز', 200),
      description: optStr(b, 'description'),
      weekStart: dayStr(b, 'weekStart', 'بداية الأسبوع'),
    }),
    update: (b) => ({
      ...(b.doneDates !== undefined && { doneDates: safeJsonArray(b.doneDates) }),
      ...(b.title !== undefined && { title: reqStr(b, 'title', 'عنوان التركيز', 200) }),
      ...(b.description !== undefined && { description: optStr(b, 'description') }),
    }),
  },

  // ===== الأعمال والمشاريع =====
  entities: {
    table: 'WorkEntity',
    orderBy: [{ column: 'name', ascending: true }],
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم الجهة', 150),
      brandColor: optStr(b, 'brandColor') ?? '#38bdf8',
      contactInfo: optStr(b, 'contactInfo'),
    }),
    update: (b) => ({
      ...(b.name !== undefined && { name: reqStr(b, 'name', 'اسم الجهة', 150) }),
      ...(b.brandColor !== undefined && { brandColor: optStr(b, 'brandColor') ?? '#38bdf8' }),
    }),
  },

  projects: {
    table: 'Project',
    select: '*, entity:WorkEntity(*), tasks:ProjectTask(*)',
    orderBy: [{ column: 'createdAt', ascending: false }],
    postProcess: projectsPostProcess,
    create: (b) => {
      const type = oneOf(b, 'type', ['finite', 'ongoing'] as const, 'نوع المشروع');
      return {
        name: reqStr(b, 'name', 'اسم المشروع', 200),
        description: optStr(b, 'description'),
        type,
        color: optStr(b, 'color') ?? '#a78bfa',
        startDate: optDate(b, 'startDate') ?? new Date(),
        endDate: type === 'ongoing' ? null : optDate(b, 'endDate'),
        entityId: optId(b, 'entityId'),
      };
    },
    update: (b) => {
      const data: Row = {};
      if (b.status !== undefined) {
        data.status = oneOf(b, 'status', ['active', 'done', 'archived'] as const, 'حالة المشروع');
        if (data.status === 'archived' || data.status === 'done') {
          data.endedAt = new Date();
          data.endedReason = optStr(b, 'endedReason') ?? (data.status === 'done' ? 'اكتمال المشروع' : null);
        } else {
          data.endedAt = null;
          data.endedReason = null;
        }
      }
      if (b.name !== undefined) data.name = reqStr(b, 'name', 'اسم المشروع', 200);
      if (b.description !== undefined) data.description = optStr(b, 'description');
      return data;
    },
  },

  projectTasks: {
    table: 'ProjectTask',
    select: '*, project:Project(id,name,color)',
    orderBy: [
      { column: 'sortOrder', ascending: true },
      { column: 'createdAt', ascending: true },
    ],
    create: (b) => {
      const projectId = optId(b, 'projectId');
      if (!projectId) throw new ValidationError('المشروع غير محدد');
      return {
        title: reqStr(b, 'title', 'عنوان المهمة', 300),
        projectId,
        sortOrder: Math.floor((Date.now() - 1704067200000) / 1000),
      };
    },
    update: (b) => {
      const data: Row = {};
      if (b.isCompleted !== undefined) {
        const done = optBool(b, 'isCompleted') === true;
        data.isCompleted = done;
        data.completedAt = done ? new Date() : null;
        if (!done) data.includeInReport = false;
      }
      if (b.title !== undefined) data.title = reqStr(b, 'title', 'عنوان المهمة', 300);
      return data;
    },
  },

  // ===== التقارير (القراءة والحذف فقط — الإنشاء عبر generate_report RPC) =====
  reports: {
    table: 'Report',
    select: '*, entity:WorkEntity(*), project:Project(id,name,color)',
    orderBy: [{ column: 'createdAt', ascending: false }],
  },

  manualReports: {
    table: 'ManualReport',
    select: '*, entity:WorkEntity(*)',
    orderBy: [{ column: 'createdAt', ascending: false }],
    create: (b) => {
      const entityId = optId(b, 'entityId');
      if (!entityId) throw new ValidationError('اختر الجهة/الشركة الموجه إليها التقرير');
      return {
        title: reqStr(b, 'title', 'عنوان التقرير', 200),
        reportDate: reqDate(b, 'reportDate', 'تاريخ التقرير'),
        content: optStr(b, 'content', 3_000_000) ?? '',
        entityId,
      };
    },
    update: (b) => {
      const data: Row = {};
      if (b.title !== undefined) data.title = reqStr(b, 'title', 'عنوان التقرير', 200);
      if (b.reportDate !== undefined) data.reportDate = reqDate(b, 'reportDate', 'تاريخ التقرير');
      if (b.content !== undefined) data.content = optStr(b, 'content', 3_000_000) ?? '';
      if (b.entityId !== undefined) {
        const entityId = optId(b, 'entityId');
        if (!entityId) throw new ValidationError('اختر الجهة/الشركة الموجه إليها التقرير');
        data.entityId = entityId;
      }
      return data;
    },
  },

  // ===== القرآن =====
  shanqiti: {
    table: 'ShanqitiSession',
    orderBy: [{ column: 'createdAt', ascending: false }],
    create: (b) => ({
      date: dayStr(b, 'date', 'اليوم'),
      verses: reqStr(b, 'verses', 'الآيات المراد حفظها', 500),
      targetReps: intMin(b, 'targetReps', 'هدف التكرار', 1),
    }),
    update: (b) => {
      const data: Row = {};
      if (b.currentReps !== undefined) data.currentReps = intMin(b, 'currentReps', 'عدد التكرارات', 0);
      if (b.linkingDone !== undefined) data.linkingDone = optBool(b, 'linkingDone');
      if (b.reviewDone !== undefined) data.reviewDone = optBool(b, 'reviewDone');
      if (b.isDone !== undefined) data.isDone = optBool(b, 'isDone');
      return data;
    },
  },

  quranEntries: {
    table: 'QuranEntry',
    orderBy: [{ column: 'createdAt', ascending: false }],
    create: (b) => {
      const fromAyah = b.fromAyah !== undefined && b.fromAyah !== '' && b.fromAyah !== null ? intMin(b, 'fromAyah', 'من آية', 1) : null;
      const toAyah = b.toAyah !== undefined && b.toAyah !== '' && b.toAyah !== null ? intMin(b, 'toAyah', 'إلى آية', 1) : null;
      if (fromAyah !== null && toAyah !== null && toAyah < fromAyah) {
        throw new ValidationError('«إلى آية» يجب ألا تسبق «من آية»');
      }
      const ayahCount = fromAyah !== null && toAyah !== null ? toAyah - fromAyah + 1 : optNum(b, 'ayahCount', 0);
      const surahNumberRaw = b.surahNumber;
      const surahNumber =
        surahNumberRaw === undefined || surahNumberRaw === null || surahNumberRaw === ''
          ? null
          : intMin(b, 'surahNumber', 'رقم السورة', 1);
      if (surahNumber !== null && surahNumber > 114) throw new ValidationError('رقم السورة غير صالح');
      return {
        date: dayStr(b, 'date', 'اليوم'),
        surah: reqStr(b, 'surah', 'السورة', 100),
        surahNumber,
        fromAyah,
        toAyah,
        ayahCount: Math.round(ayahCount),
        type: oneOf(b, 'type', ['hifz', 'murajaa'] as const, 'نوع الورد'),
        notes: optStr(b, 'notes'),
      };
    },
  },

  srsCards: {
    table: 'SrsCard',
    orderBy: [
      { column: 'dueDate', ascending: true },
      { column: 'createdAt', ascending: true },
    ],
    create: (b) => {
      const surahNumberRaw = b.surahNumber;
      const surahNumber =
        surahNumberRaw === undefined || surahNumberRaw === null || surahNumberRaw === ''
          ? null
          : intMin(b, 'surahNumber', 'رقم السورة', 1);
      if (surahNumber !== null && surahNumber > 114) throw new ValidationError('رقم السورة غير صالح');
      return {
        label: reqStr(b, 'label', 'وصف المحفوظ', 200),
        surahNumber,
        dueDate: dayStr(b, 'dueDate', 'تاريخ الاستحقاق'),
      };
    },
    update: (b) => {
      const data: Row = {};
      if (b.isActive !== undefined) data.isActive = optBool(b, 'isActive');
      if (b.label !== undefined) data.label = reqStr(b, 'label', 'وصف المحفوظ', 200);
      return data;
    },
  },

  // ===== التعلم والقراءة =====
  learning: {
    table: 'LearningItem',
    select: '*, lessons:LearningLesson(*)',
    orderBy: [{ column: 'createdAt', ascending: false }],
    postProcess: (rows) =>
      rows.map((r) => ({
        ...r,
        lessons: [...((r.lessons as Row[] | null) ?? [])].sort(
          (a, b) => (a.sortOrder as number) - (b.sortOrder as number)
        ),
      })),
    create: (b) => ({
      title: reqStr(b, 'title', 'العنوان', 200),
      kind: oneOf(b, 'kind', ['course', 'book'] as const, 'التصنيف'),
      category: optStr(b, 'category') ?? 'عام',
      url: optStr(b, 'url', 500),
      channel: optStr(b, 'channel', 150),
      totalUnits: intMin(b, 'totalUnits', 'الإجمالي (دروس/صفحات)', 1),
      notes: optStr(b, 'notes'),
    }),
    update: (b) => {
      const data: Row = {};
      if (b.doneUnits !== undefined) data.doneUnits = intMin(b, 'doneUnits', 'المنجز', 0);
      if (b.totalUnits !== undefined) data.totalUnits = intMin(b, 'totalUnits', 'الإجمالي', 1);
      if (b.url !== undefined) data.url = optStr(b, 'url', 500);
      if (b.channel !== undefined) data.channel = optStr(b, 'channel', 150);
      if (b.status !== undefined) {
        data.status = oneOf(b, 'status', ['in_progress', 'done', 'paused'] as const, 'الحالة');
      }
      return data;
    },
  },

  // ===== مجلدات المستندات (الملفات نفسها عبر backend/services/documents.ts) =====
  folders: {
    table: 'DocFolder',
    orderBy: [{ column: 'createdAt', ascending: true }],
    postProcess: foldersPostProcess,
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم المجلد', 100),
      color: optStr(b, 'color') ?? '#38bdf8',
    }),
    update: (b) => ({
      ...(b.name !== undefined && { name: reqStr(b, 'name', 'اسم المجلد', 100) }),
    }),
  },
};

export function getResource(name: string): ResourceDef {
  const def = RESOURCES[name];
  if (!def) throw new ValidationError('مورد غير معروف');
  return def;
}

export async function listResource(name: string): Promise<Row[]> {
  const def = getResource(name);
  let q = supabase.from(def.table).select(def.select ?? '*');
  for (const o of def.orderBy ?? []) {
    q = q.order(o.column, { ascending: o.ascending ?? true, ...(o.foreignTable ? { foreignTable: o.foreignTable } : {}) });
  }
  const rows = unwrap(await q) as unknown as Row[];
  return def.postProcess ? await def.postProcess(rows) : rows;
}

export async function createResource(name: string, body: Body): Promise<Row> {
  const def = getResource(name);
  if (!def.create) throw new ValidationError('الإنشاء غير متاح لهذا المورد');
  const data = def.create(body);

  if (def.upsertOn) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    return unwrap(
      await supabase
        .from(def.table)
        .upsert({ ...data, userId }, { onConflict: `userId,${def.upsertOn}` })
        .select('*')
        .single()
    ) as Row;
  }

  return unwrap(await supabase.from(def.table).insert(data).select('*').single()) as Row;
}

export async function updateResource(name: string, id: string, body: Body): Promise<Row> {
  const def = getResource(name);
  if (!def.update) throw new ValidationError('التعديل غير متاح لهذا المورد');
  const data = def.update(body);
  if (Object.keys(data).length === 0) throw new ValidationError('لا توجد تعديلات صالحة');
  return unwrap(await supabase.from(def.table).update(data).eq('id', id).select('*').single()) as Row;
}

export async function deleteResource(name: string, id: string): Promise<void> {
  const def = getResource(name);
  unwrap(await supabase.from(def.table).delete().eq('id', id));
}
