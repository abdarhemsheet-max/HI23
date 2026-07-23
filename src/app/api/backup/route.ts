import { NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';
import { todayStr } from '@/shared/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/backup — نسخة احتياطية كاملة بنقرة واحدة.
 * يصدّر كل الجداول في ملف JSON واحد قابل للقراءة والحفظ.
 * (ملفات المستندات المرفوعة في مجلد uploads/ تُنسخ يدوياً)
 */
export async function GET() {
  try {
    const [
      wallets,
      transactions,
      debts,
      subscriptions,
      assets,
      savingsGoals,
      dailyTasks,
      taskLogs,
      habits,
      habitLogs,
      weeklyFocus,
      workEntities,
      projects,
      projectTasks,
      reports,
      docFolders,
      documents,
      hosoonDays,
      shanqitiSessions,
      quranEntries,
      learningItems,
      learningLessons,
    ] = await Promise.all([
      prisma.wallet.findMany(),
      prisma.transaction.findMany(),
      prisma.debt.findMany(),
      prisma.subscription.findMany(),
      prisma.asset.findMany(),
      prisma.savingsGoal.findMany(),
      prisma.dailyTask.findMany(),
      prisma.taskLog.findMany(),
      prisma.habit.findMany(),
      prisma.habitLog.findMany(),
      prisma.weeklyFocus.findMany(),
      prisma.workEntity.findMany(),
      prisma.project.findMany(),
      prisma.projectTask.findMany(),
      prisma.report.findMany(),
      prisma.docFolder.findMany(),
      prisma.document.findMany(),
      prisma.hosoonDay.findMany(),
      prisma.shanqitiSession.findMany(),
      prisma.quranEntry.findMany(),
      prisma.learningItem.findMany(),
      prisma.learningLesson.findMany(),
    ]);

    const backup = {
      app: 'نظام حياتي',
      version: 3,
      exportedAt: new Date().toISOString(),
      note: 'ملفات المستندات الفعلية في مجلد uploads/ — انسخه مع هذا الملف',
      data: {
        wallets,
        transactions,
        debts,
        subscriptions,
        assets,
        savingsGoals,
        dailyTasks,
        taskLogs,
        habits,
        habitLogs,
        weeklyFocus,
        workEntities,
        projects,
        projectTasks,
        reports,
        docFolders,
        documents,
        hosoonDays,
        shanqitiSessions,
        quranEntries,
        learningItems,
        learningLessons,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="hayati-backup-${todayStr()}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
