import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, reqBool } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/tasks/[id]/report — تبديل «إدراج في التقرير الرسمي».
 * قاعدة صارمة: لا يمكن تفعيلها إلا لمهمة منجزة (isCompleted) بالفعل —
 * يتطلب قراءة الحالة الحالية من القاعدة قبل الكتابة، لذا لا يُنفَّذ هذا
 * ضمن /api/crud العام (الذي يحوّل الجسم إلى بيانات فوراً بلا قراءة مسبقة).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await readBody(req);
    const include = reqBool(b, 'include', 'الإدراج في التقرير');

    const task = await prisma.projectTask.findUnique({ where: { id: params.id } });
    if (!task) throw new ValidationError('المهمة غير موجودة — أعد تحميل الصفحة');

    if (include && !task.isCompleted) {
      throw new ValidationError('لا يمكن إضافة مهمة غير منجزة إلى التقرير — أنجزها أولاً');
    }

    const updated = await prisma.projectTask.update({
      where: { id: task.id },
      data: { includeInReport: include },
    });

    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}
