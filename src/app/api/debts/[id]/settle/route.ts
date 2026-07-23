import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, reqStr } from '@/backend/validate';

export const dynamic = 'force-dynamic';

/**
 * POST /api/debts/[id]/settle — تسديد دين عبر محفظة محددة.
 * المركزية المالية: كل قرش يمر عبر محفظة —
 *  - دين «لي عنده» (owed_to_me): تحصيل → يُضاف المبلغ للمحفظة + حركة دخل
 *  - دين «عليّ له» (i_owe): سداد → يُخصم من المحفظة + حركة مصروف
 * كل ذلك في معاملة واحدة ($transaction) — تنجح كاملة أو تفشل كاملة.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const b = await readBody(req);
    const walletId = reqStr(b, 'walletId', 'المحفظة', 100);

    const result = await prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findUnique({ where: { id: params.id } });
      if (!debt) throw new ValidationError('الدين غير موجود — أعد تحميل الصفحة');
      if (debt.isSettled) throw new ValidationError('هذا الدين مسدد بالفعل');

      const remaining = debt.amount - debt.paidAmount;
      if (remaining <= 0) throw new ValidationError('لا يوجد مبلغ متبقٍ على هذا الدين');

      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new ValidationError('المحفظة غير موجودة');

      const isCollecting = debt.direction === 'owed_to_me';
      if (!isCollecting && wallet.balance < remaining) {
        throw new ValidationError(`رصيد «${wallet.name}» غير كافٍ لسداد ${remaining}`);
      }

      // حركة مالية موثقة مرتبطة بالمحفظة
      await tx.transaction.create({
        data: {
          type: isCollecting ? 'income' : 'expense',
          status: 'completed',
          amount: remaining,
          category: isCollecting ? 'تحصيل دين' : 'سداد دين',
          description: `${isCollecting ? 'تحصيل دين من' : 'سداد دين إلى'} ${debt.personName}`,
          walletId: wallet.id,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: isCollecting ? remaining : -remaining } },
      });

      return tx.debt.update({
        where: { id: debt.id },
        data: { isSettled: true, paidAmount: debt.amount },
      });
    });

    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
