import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, oneOf, dayStr } from '@/backend/validate';
import { nextSrsState } from '@/backend/srs';
import { addDaysStr } from '@/shared/utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/quran/srs/[id]/review — تقييم مراجعة بطاقة (سهل/متوسط/صعب).
 * يقرأ حالة البطاقة الحالية، يحسب الفاصل القادم عبر خوارزمية SM-2 المبسّطة،
 * يحدّث موعد الاستحقاق، ويسجّل التقييم في سجل منفصل (يغذي الخريطة الحرارية).
 * كل ذلك في معاملة واحدة — تنجح كاملة أو تفشل كاملة.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await readBody(req);
    const rating = oneOf(b, 'rating', ['easy', 'medium', 'hard'] as const, 'التقييم');
    const today = dayStr(b, 'today', 'اليوم');

    const result = await prisma.$transaction(async (tx) => {
      const card = await tx.srsCard.findUnique({ where: { id: params.id } });
      if (!card) throw new ValidationError('البطاقة غير موجودة — أعد تحميل الصفحة');
      if (!card.isActive) throw new ValidationError('هذه البطاقة موقوفة');

      const next = nextSrsState(
        { intervalDays: card.intervalDays, easeFactor: card.easeFactor, reviewCount: card.reviewCount },
        rating
      );

      const updated = await tx.srsCard.update({
        where: { id: card.id },
        data: {
          intervalDays: next.intervalDays,
          easeFactor: next.easeFactor,
          dueDate: addDaysStr(today, next.intervalDays),
          reviewCount: card.reviewCount + 1,
        },
      });

      await tx.srsReviewLog.create({
        data: { cardId: card.id, date: today, rating },
      });

      return updated;
    });

    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
