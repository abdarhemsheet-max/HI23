import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse, readBody } from '@/backend/resources';
import { ValidationError, optId } from '@/backend/validate';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * PATCH /api/transactions/[id] — تأكيد ربح معلق (تحصيله).
 * يحوّل الحالة إلى completed ويضيف المبلغ للمحفظة داخل معاملة واحدة.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const b = await readBody(req);
    if (b.action !== 'confirm') throw new ValidationError('إجراء غير معروف');

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id: params.id } });
      if (!t) throw new ValidationError('الحركة غير موجودة');
      if (t.status !== 'pending') throw new ValidationError('هذه الحركة محصّلة بالفعل');

      const walletId = optId(b, 'walletId') ?? t.walletId;
      // التحصيل يحوّل الربح المعلق إلى مال حقيقي — لا بد من محفظة يدخل إليها
      if (!walletId) throw new ValidationError('اختر المحفظة التي سيدخل إليها المبلغ');
      const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new ValidationError('المحفظة المحددة غير موجودة');

      const row = await tx.transaction.update({
        where: { id: t.id },
        data: { status: 'completed', walletId },
      });
      // الأرباح المعلقة دخل دائماً
      if (walletId) {
        await tx.wallet.update({
          where: { id: walletId },
          data: { balance: { increment: t.amount } },
        });
      }
      return row;
    });

    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * DELETE /api/transactions/[id] — حذف حركة مع عكس أثرها على رصيد المحفظة
 * (إن كانت مكتملة ومرتبطة بمحفظة ما زالت موجودة).
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.findUnique({ where: { id: params.id } });
      if (!t) return; // محذوفة مسبقاً — عملية آمنة التكرار
      if (t.status === 'completed' && t.walletId) {
        const wallet = await tx.wallet.findUnique({ where: { id: t.walletId } });
        if (wallet) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: t.type === 'income' ? -t.amount : t.amount } },
          });
        }
      }
      await tx.transaction.delete({ where: { id: t.id } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
