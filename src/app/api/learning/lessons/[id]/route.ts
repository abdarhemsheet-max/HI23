import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, reqStr } from '@/backend/validate';
import { syncLearningItem } from '@/backend/learningSync';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** PATCH /api/learning/lessons/[id] — إنجاز/تعديل درس مع مزامنة عدادات الكورس */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const b = await readBody(req);
    const data: Record<string, unknown> = {};
    if (b.isDone !== undefined) {
      if (typeof b.isDone !== 'boolean') throw new ValidationError('حالة الدرس غير صالحة');
      data.isDone = b.isDone;
    }
    if (b.title !== undefined) data.title = reqStr(b, 'title', 'عنوان الدرس', 300);
    if (Object.keys(data).length === 0) throw new ValidationError('لا توجد تعديلات صالحة');

    const lesson = await prisma.learningLesson.update({ where: { id: params.id }, data });
    await syncLearningItem(lesson.itemId);
    return NextResponse.json(lesson);
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/learning/lessons/[id] */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const lesson = await prisma.learningLesson.findUnique({ where: { id: params.id } });
    if (!lesson) return NextResponse.json({ ok: true });
    await prisma.learningLesson.delete({ where: { id: lesson.id } });
    await syncLearningItem(lesson.itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
