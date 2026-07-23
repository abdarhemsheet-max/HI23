import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/reorder — حفظ الترتيب اليدوي لكافة المهام.
 * body: { ids: string[] } بالترتيب الجديد من الأعلى للأسفل.
 * يُكتب sortOrder تصاعدياً داخل معاملة واحدة — إما ينجح كامل الترتيب أو لا شيء.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await readBody(req);
    if (!Array.isArray(b.ids)) throw new ValidationError('قائمة الترتيب غير صالحة');
    const ids = (b.ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0);
    if (ids.length === 0) throw new ValidationError('لا توجد مهام لإعادة ترتيبها');
    if (ids.length > 2000) throw new ValidationError('عدد المهام كبير جداً');

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.projectTask.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (e) {
    return errorResponse(e);
  }
}
