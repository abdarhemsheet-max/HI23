import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, reqStr } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/subscriptions/[id]/pay — دفع اشتراك من محفظة محددة.
 * معاملة واحدة: خصم من المحفظة + حركة مصروف موثقة + ترحيل تاريخ التجديد
 * للدورة القادمة (شهر أو سنة).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await readBody(req);
    const walletId = reqStr(b, 'walletId', 'المحفظة', 100);

    const result = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id: params.id } });
      if (!sub) throw new ValidationError('الاشتراك غير موجود — أعد تحميل الصفحة');
      if (!sub.isActive) throw new ValidationError('هذا الاشتراك موقوف');
      if (sub.amount <= 0) throw new ValidationError('قيمة الاشتراك غير صالحة');

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new ValidationError('المحفظة غير موجودة');
      if (wallet.balance < sub.amount) {
        throw new ValidationError(`رصيد «${wallet.name}» غير كافٍ لدفع ${sub.amount}`);
      }

      await tx.transaction.create({
        data: {
          type: 'expense',
          status: 'completed',
          amount: sub.amount,
          category: 'اشتراكات',
          description: `دفع اشتراك ${sub.name}`,
          walletId: wallet.id,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: -sub.amount } },
      });

      // ترحيل التجديد للدورة القادمة
      const next = new Date(sub.nextRenewal);
      if (sub.billingCycle === 'monthly') next.setMonth(next.getMonth() + 1);
      else next.setFullYear(next.getFullYear() + 1);

      return tx.subscription.update({
        where: { id: sub.id },
        data: { nextRenewal: next },
      });
    });

    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
