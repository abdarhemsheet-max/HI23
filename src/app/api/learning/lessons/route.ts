import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, reqStr } from '@/backend/validate';
import { syncLearningItem } from '@/backend/learningSync';

export const dynamic = 'force-dynamic';

/**
 * POST /api/learning/lessons — إضافة دروس (فردي أو دفعة واحدة).
 * body: { itemId, titles: string[] } — مثالي للصق قائمة تشغيل يوتيوب كاملة.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await readBody(req);
    const itemId = reqStr(b, 'itemId', 'الكورس', 100);

    if (!Array.isArray(b.titles)) throw new ValidationError('قائمة الدروس غير صالحة');
    const titles = (b.titles as unknown[])
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t) => t.length > 0)
      .map((t) => t.slice(0, 300));
    if (titles.length === 0) throw new ValidationError('أضف عنوان درس واحد على الأقل');
    if (titles.length > 500) throw new ValidationError('الحد الأقصى 500 درس دفعة واحدة');

    const item = await prisma.learningItem.findUnique({ where: { id: itemId } });
    if (!item) throw new ValidationError('الكورس غير موجود — أعد تحميل الصفحة');

    const last = await prisma.learningLesson.findFirst({
      where: { itemId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const base = (last?.sortOrder ?? 0) + 1;

    await prisma.learningLesson.createMany({
      data: titles.map((title, i) => ({ itemId, title, sortOrder: base + i })),
    });
    await syncLearningItem(itemId);

    return NextResponse.json({ ok: true, added: titles.length }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
