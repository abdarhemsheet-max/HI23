import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, oneOf, posNum, optStr, optDate, optId } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/** GET /api/transactions — كل الحركات المالية */
export async function GET() {
  try {
    const rows = await prisma.transaction.findMany({ orderBy: { date: 'desc' } });
    return NextResponse.json(rows);
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/transactions — إنشاء حركة مالية.
 * سلامة الحسابات: إنشاء الحركة وتحديث رصيد المحفظة يتمان داخل
 * معاملة قاعدة بيانات واحدة ($transaction) — إما ينجحان معاً أو يفشلان معاً.
 */
export async function POST(req: NextRequest) {
  try {
    const b = await readBody(req);
    const type = oneOf(b, 'type', ['income', 'expense'] as const, 'نوع الحركة');
    const status = oneOf(b, 'status', ['completed', 'pending'] as const, 'حالة الحركة');
    if (status === 'pending' && type !== 'income') {
      throw new ValidationError('الأرباح المعلقة تكون دخلاً فقط');
    }
    const amount = posNum(b, 'amount', 'المبلغ');
    const walletId = optId(b, 'walletId');
    // المركزية المالية: كل حركة مكتملة يجب أن ترتبط بمحفظة
    // (الأرباح المعلقة تُستثنى حتى التحصيل)
    if (status === 'completed' && !walletId) {
      throw new ValidationError('اختر المحفظة — كل دخل أو مصروف يرتبط بمحفظة');
    }

    const txn = await prisma.$transaction(async (tx) => {
      if (walletId) {
        const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
        if (!wallet) throw new ValidationError('المحفظة المحددة غير موجودة');
        if (status === 'completed' && type === 'expense' && wallet.balance < amount) {
          throw new ValidationError(
            `رصيد «${wallet.name}» غير كافٍ لهذا المصروف`
          );
        }
      }

      const created = await tx.transaction.create({
        data: {
          type,
          status,
          amount,
          category: optStr(b, 'category') ?? 'عام',
          description: optStr(b, 'description'),
          date: optDate(b, 'date') ?? new Date(),
          walletId,
        },
      });

      // الرصيد يتأثر فقط بالحركات المكتملة المرتبطة بمحفظة
      if (status === 'completed' && walletId) {
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: type === 'income' ? amount : -amount } },
        });
      }
      return created;
    });

    return NextResponse.json(txn, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
