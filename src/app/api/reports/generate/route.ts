import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, reqStr, reqDate, optStr } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/reports/generate — مربوط برمجياً بقسم الأعمال:
 * 1) المستخدم يختار المشروع + المدة (من – إلى)
 * 2) النظام يجلب تلقائياً المهام التي تحقق ثلاثة شروط معاً:
 *    تنتمي للمشروع + isCompleted=true + includeInReport=true،
 *    وتاريخ إنجازها (completedAt) يقع ضمن الفترة المحددة.
 *    (يشمل المؤرشفة — الاستعلام بتاريخ الإنجاز لا بحالة العرض)
 * 3) قاعدة صارمة: يُعتمد ويُؤرشف فوراً — لا مراجعة يدوية
 */
export async function POST(req: NextRequest) {
  try {
    const b = await readBody(req);
    const projectId = reqStr(b, 'projectId', 'المشروع', 100);
    const periodStart = reqDate(b, 'periodStart', 'بداية الفترة');
    const periodEnd = reqDate(b, 'periodEnd', 'نهاية الفترة');
    if (periodEnd < periodStart) throw new ValidationError('نهاية الفترة لا يمكن أن تسبق بدايتها');

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { entity: true },
    });
    if (!project) throw new ValidationError('المشروع غير موجود — أعد تحميل الصفحة');

    // نهاية الفترة تشمل اليوم كاملاً
    const endInclusive = new Date(periodEnd);
    endInclusive.setHours(23, 59, 59, 999);

    // الجلب التلقائي: تنتمي للمشروع + منجزة + مُعلَّمة صراحةً للتقرير + ضمن الفترة
    const tasks = await prisma.projectTask.findMany({
      where: {
        projectId,
        isCompleted: true,
        includeInReport: true,
        completedAt: { gte: periodStart, lte: endInclusive },
      },
      orderBy: { completedAt: 'asc' },
    });

    const snapshot = tasks.map((t) => ({
      project_name: project.name,
      title: t.title,
      completed_at: (t.completedAt ?? new Date()).toISOString(),
    }));

    // اعتماد وأرشفة فورية
    const report = await prisma.report.create({
      data: {
        title: optStr(b, 'title') ?? `تقرير إنجاز — ${project.name}`,
        periodStart,
        periodEnd,
        tasksSnapshot: JSON.stringify(snapshot),
        status: 'archived',
        projectId: project.id,
        entityId: project.entityId, // هوية الجهة للعرض والطباعة
      },
      include: { entity: true, project: { select: { id: true, name: true, color: true } } },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
