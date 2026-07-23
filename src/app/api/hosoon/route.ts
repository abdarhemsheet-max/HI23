import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, oneOf, optStr } from '@/backend/validate';
import { lastNDays, todayStr } from '@/shared/utils';

export const dynamic = 'force-dynamic';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORT_FIELDS = ['fort1', 'fort2', 'fort3', 'fort4', 'fort5'] as const;

/** GET /api/hosoon?date=YYYY-MM-DD → { day, week } (اليوم + آخر 7 أيام) */
export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date') ?? todayStr();
    if (!DAY_RE.test(date)) throw new ValidationError('تاريخ غير صالح');

    const weekDates = lastNDays(7);
    const [day, week] = await Promise.all([
      prisma.hosoonDay.findUnique({ where: { date } }),
      prisma.hosoonDay.findMany({ where: { date: { in: weekDates } } }),
    ]);

    return NextResponse.json({
      day: day ?? { id: '', date, fort1: false, fort2: false, fort3: false, fort4: false, fort5: false, notes: null },
      week,
      weekDates,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/hosoon — تبديل حصن أو حفظ ملاحظة ليوم معين (upsert آمن) */
export async function POST(req: NextRequest) {
  try {
    const b = await readBody(req);
    const date = typeof b.date === 'string' && DAY_RE.test(b.date) ? b.date : null;
    if (!date) throw new ValidationError('تاريخ غير صالح');

    let data: Record<string, unknown>;
    if (b.field === 'notes') {
      data = { notes: optStr(b, 'value') };
    } else {
      const field = oneOf(b, 'field', FORT_FIELDS, 'الحصن');
      if (typeof b.value !== 'boolean') throw new ValidationError('قيمة الحصن غير صالحة');
      data = { [field]: b.value };
    }

    const row = await prisma.hosoonDay.upsert({
      where: { date },
      create: { date, ...data },
      update: data,
    });
    return NextResponse.json(row);
  } catch (e) {
    return errorResponse(e);
  }
}
