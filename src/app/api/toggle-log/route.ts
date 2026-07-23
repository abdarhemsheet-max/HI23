import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, oneOf, reqStr, dayStr } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/toggle-log — تسجيل/إلغاء إنجاز يومي لعادة أو مهمة.
 * upsert يمنع خطأ التكرار، وdeleteMany يمنع خطأ «غير موجود» — لا انهيار أبداً.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await readBody(req);
    const kind = oneOf(b, 'kind', ['habit', 'task'] as const, 'النوع');
    const id = reqStr(b, 'id', 'المعرّف', 100);
    const date = dayStr(b, 'date', 'اليوم');
    if (typeof b.done !== 'boolean') throw new ValidationError('حالة الإنجاز غير صالحة');

    if (kind === 'habit') {
      if (b.done) {
        await prisma.habitLog.upsert({
          where: { habitId_date: { habitId: id, date } },
          create: { habitId: id, date },
          update: {},
        });
      } else {
        await prisma.habitLog.deleteMany({ where: { habitId: id, date } });
      }
    } else {
      if (b.done) {
        await prisma.taskLog.upsert({
          where: { taskId_date: { taskId: id, date } },
          create: { taskId: id, date },
          update: {},
        });
      } else {
        await prisma.taskLog.deleteMany({ where: { taskId: id, date } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
