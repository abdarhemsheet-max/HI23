// ======================================================================
// خريطة الموارد للـ CRUD الموحّد (/api/crud/[resource])
// كل مورد يعرّف: نموذج Prisma + ترتيب + دوال تنظيف/تحقق للإنشاء والتعديل.
// أي مورد غير مذكور هنا يُرفض فوراً (whitelist) — لا وصول عشوائي للجداول.
// ======================================================================

import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
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
  optDayStr,
  reqDate,
  optDate,
  optId,
} from './validate';

type Body = Record<string, unknown>;
type Data = Record<string, unknown>;

export interface ResourceDef {
  model: string; // اسم النموذج في عميل Prisma (camelCase)
  orderBy?: Data | Data[]; // كائن واحد أو مصفوفة (ترتيب متعدد المستويات)
  /** include ثابت أو دالة تُقيَّم عند كل طلب (للفلاتر الزمنية) */
  include?: Data | (() => Data);
  /** إن وُجد: الإنشاء يستخدم upsert على هذا الحقل الفريد */
  upsertOn?: string;
  create?: (b: Body) => Data;
  update?: (b: Body) => Data;
}

const RESOURCES: Record<string, ResourceDef> = {
  // ===== المالية =====
  wallets: {
    model: 'wallet',
    orderBy: { createdAt: 'asc' },
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
    model: 'debt',
    orderBy: { createdAt: 'desc' },
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
    model: 'subscription',
    orderBy: { nextRenewal: 'asc' },
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
    model: 'asset',
    orderBy: { createdAt: 'desc' },
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
    model: 'savingsGoal',
    orderBy: { createdAt: 'desc' },
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم الهدف', 150),
      targetAmount: posNum(b, 'targetAmount', 'المبلغ المستهدف'),
      currentAmount: optNum(b, 'currentAmount', 0),
      deadline: optDate(b, 'deadline'),
      color: optStr(b, 'color') ?? '#34d399',
    }),
    update: (b) => ({
      ...(b.currentAmount !== undefined && { currentAmount: optNum(b, 'currentAmount', 0) }),
    }),
  },

  // ===== العادات والمهام =====
  dailyTasks: {
    model: 'dailyTask',
    orderBy: { createdAt: 'asc' },
    include: { logs: { select: { date: true } } },
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
    model: 'habit',
    orderBy: { createdAt: 'asc' },
    include: { logs: { select: { date: true } } },
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم العادة', 100),
      icon: optStr(b, 'icon') ?? '🔥',
      color: optStr(b, 'color') ?? '#34d399',
    }),
    update: (b) => ({
      ...(b.name !== undefined && { name: reqStr(b, 'name', 'اسم العادة', 100) }),
      ...(b.isActive !== undefined && { isActive: optBool(b, 'isActive') }),
    }),
  },

  weeklyFocus: {
    model: 'weeklyFocus',
    orderBy: { weekStart: 'desc' },
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
    model: 'workEntity',
    orderBy: { name: 'asc' },
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
    model: 'project',
    orderBy: { createdAt: 'desc' },
    // أتمتة الأرشيف: المهمة المنجزة تختفي من الواجهة بعد 3 أيام من إنجازها
    // لكنها تبقى في قاعدة البيانات (يشملها _count وتظهر في الأرشيف والتقارير)
    include: () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 3);
      return {
        tasks: {
          where: { OR: [{ isCompleted: false }, { completedAt: { gte: cutoff } }] },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        entity: true,
        _count: { select: { tasks: true } },
      };
    },
    create: (b) => {
      const type = oneOf(b, 'type', ['finite', 'ongoing'] as const, 'نوع المشروع');
      return {
        name: reqStr(b, 'name', 'اسم المشروع', 200),
        description: optStr(b, 'description'),
        type,
        color: optStr(b, 'color') ?? '#a78bfa',
        startDate: optDate(b, 'startDate') ?? new Date(),
        // قاعدة صارمة: المشاريع المستمرة لا تملك تاريخ انتهاء إطلاقاً
        endDate: type === 'ongoing' ? null : optDate(b, 'endDate'),
        entityId: optId(b, 'entityId'),
      };
    },
    update: (b) => {
      const data: Data = {};
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
    model: 'projectTask',
    // الترتيب اليدوي أولاً (sortOrder) ثم الأقدم — يحترم السحب والإفلات
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { project: { select: { id: true, name: true, color: true } } },
    create: (b) => {
      const projectId = optId(b, 'projectId');
      if (!projectId) throw new ValidationError('المشروع غير محدد');
      return {
        title: reqStr(b, 'title', 'عنوان المهمة', 300),
        projectId,
        // ثوانٍ منذ 2024 — قيمة متزايدة تضع الجديد في النهاية وتبقى ضمن حدود Int32
        sortOrder: Math.floor((Date.now() - 1704067200000) / 1000),
      };
    },
    update: (b) => {
      const data: Data = {};
      if (b.isCompleted !== undefined) {
        const done = optBool(b, 'isCompleted') === true;
        data.isCompleted = done;
        data.completedAt = done ? new Date() : null;
        // إلغاء الإنجاز يُسقط تلقائياً إدراجها في التقرير — لا يجوز أن تبقى
        // مهمة غير منجزة مُعلَّمة للتقرير. تفعيل includeInReport له مسار
        // مخصص (/api/projects/tasks/[id]/report) يتحقق من isCompleted أولاً.
        if (!done) data.includeInReport = false;
      }
      if (b.title !== undefined) data.title = reqStr(b, 'title', 'عنوان المهمة', 300);
      return data;
    },
  },

  // ===== التقارير (القراءة والحذف فقط — الإنشاء عبر /api/reports/generate) =====
  reports: {
    model: 'report',
    orderBy: { createdAt: 'desc' },
    include: { entity: true, project: { select: { id: true, name: true, color: true } } },
  },

  // ===== التقارير اليدوية — مساحة حرة منفصلة تماماً عن التقارير المؤتمتة =====
  manualReports: {
    model: 'manualReport',
    orderBy: { createdAt: 'desc' },
    include: { entity: true },
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
      const data: Data = {};
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
    model: 'shanqitiSession',
    orderBy: { createdAt: 'desc' },
    create: (b) => ({
      date: dayStr(b, 'date', 'اليوم'),
      verses: reqStr(b, 'verses', 'الآيات المراد حفظها', 500),
      targetReps: intMin(b, 'targetReps', 'هدف التكرار', 1),
    }),
    update: (b) => {
      const data: Data = {};
      if (b.currentReps !== undefined) data.currentReps = intMin(b, 'currentReps', 'عدد التكرارات', 0);
      if (b.linkingDone !== undefined) data.linkingDone = optBool(b, 'linkingDone');
      if (b.reviewDone !== undefined) data.reviewDone = optBool(b, 'reviewDone');
      if (b.isDone !== undefined) data.isDone = optBool(b, 'isDone');
      return data;
    },
  },

  quranEntries: {
    model: 'quranEntry',
    orderBy: { createdAt: 'desc' },
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

  // ===== نظام المراجعة الذكية (SRS) =====
  srsCards: {
    model: 'srsCard',
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
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
      const data: Data = {};
      if (b.isActive !== undefined) data.isActive = optBool(b, 'isActive');
      if (b.label !== undefined) data.label = reqStr(b, 'label', 'وصف المحفوظ', 200);
      return data;
    },
  },

  // ===== التعلم والقراءة =====
  learning: {
    model: 'learningItem',
    orderBy: { createdAt: 'desc' },
    include: { lessons: { orderBy: { sortOrder: 'asc' } } },
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
      const data: Data = {};
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

  // ===== مجلدات المستندات (الملفات نفسها عبر /api/documents) =====
  folders: {
    model: 'docFolder',
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { documents: true } } },
    create: (b) => ({
      name: reqStr(b, 'name', 'اسم المجلد', 100),
      color: optStr(b, 'color') ?? '#38bdf8',
    }),
    update: (b) => ({
      ...(b.name !== undefined && { name: reqStr(b, 'name', 'اسم المجلد', 100) }),
    }),
  },
};

function safeJsonArray(v: unknown): string {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) {
    throw new ValidationError('قائمة الأيام غير صالحة');
  }
  return JSON.stringify(v);
}

export function getResource(name: string): ResourceDef {
  const def = RESOURCES[name];
  if (!def) throw new ValidationError('مورد غير معروف');
  return def;
}

/**
 * تحويل أي خطأ إلى استجابة JSON آمنة برسالة عربية —
 * لا تتسرب أي أخطاء خام إلى الواجهة (لا شاشات حمراء).
 */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ValidationError) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'هذا السجل موجود مسبقاً (قيمة مكررة)' }, { status: 409 });
    }
    if (e.code === 'P2003') {
      return NextResponse.json({ error: 'العنصر المرتبط غير موجود — أعد تحميل الصفحة' }, { status: 400 });
    }
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'العنصر غير موجود — ربما حُذف مسبقاً' }, { status: 404 });
    }
  }
  console.error('[API ERROR]', e);
  return NextResponse.json({ error: 'خطأ داخلي في قاعدة البيانات المحلية' }, { status: 500 });
}

/** قراءة جسم الطلب بأمان */
export async function readBody(req: Request): Promise<Body> {
  try {
    const b = await req.json();
    if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new Error();
    return b as Body;
  } catch {
    throw new ValidationError('بيانات الطلب غير صالحة');
  }
}
