import { NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';
import { todayStr, weekStartStr } from '@/shared/utils';

export const dynamic = 'force-dynamic';

/** GET /api/summary — كل بيانات اللوحة الرئيسية في طلب واحد */
export async function GET() {
  try {
    const today = todayStr();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      wallets,
      monthTxns,
      pendingTxns,
      debts,
      subscriptions,
      tasks,
      habits,
      focus,
      projects,
      hosoonToday,
      learning,
    ] = await Promise.all([
      prisma.wallet.findMany(),
      prisma.transaction.findMany({ where: { status: 'completed', date: { gte: monthStart } } }),
      prisma.transaction.findMany({ where: { status: 'pending' } }),
      prisma.debt.findMany({ where: { isSettled: false } }),
      prisma.subscription.findMany({ where: { isActive: true }, orderBy: { nextRenewal: 'asc' }, take: 4 }),
      prisma.dailyTask.findMany({ where: { isActive: true }, include: { logs: { select: { date: true } } } }),
      prisma.habit.findMany({ where: { isActive: true }, include: { logs: { select: { date: true } } } }),
      prisma.weeklyFocus.findUnique({ where: { weekStart: weekStartStr() } }),
      prisma.project.findMany({
        where: { status: 'active' },
        include: { tasks: { select: { isCompleted: true } } },
      }),
      prisma.hosoonDay.findUnique({ where: { date: today } }),
      prisma.learningItem.findMany({
        where: { status: 'in_progress' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    return NextResponse.json({
      today,
      wallets,
      monthTxns,
      pendingTxns,
      debts,
      subscriptions,
      tasks,
      habits,
      focus,
      projects,
      hosoonToday,
      learning,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
