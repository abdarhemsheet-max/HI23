import { NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quran/heatmap — يجمّع نشاط القرآن اليومي من كل الأنظمة الأربعة
 * (الحصون الخمسة، الشنقيطية، النظام المخصص، مراجعات SRS) في خريطة واحدة
 * { "YYYY-MM-DD": شدة النشاط } لتغذية الخريطة الحرارية على الواجهة.
 */
export async function GET() {
  try {
    const [hosoonDays, shanqitiCounts, entryCounts, srsCounts] = await Promise.all([
      prisma.hosoonDay.findMany({
        select: { date: true, fort1: true, fort2: true, fort3: true, fort4: true, fort5: true },
      }),
      prisma.shanqitiSession.groupBy({ by: ['date'], _count: { id: true } }),
      prisma.quranEntry.groupBy({ by: ['date'], _count: { id: true } }),
      prisma.srsReviewLog.groupBy({ by: ['date'], _count: { id: true } }),
    ]);

    const map: Record<string, number> = {};
    const add = (date: string, n: number) => {
      if (n > 0) map[date] = (map[date] ?? 0) + n;
    };

    for (const h of hosoonDays) {
      const done = [h.fort1, h.fort2, h.fort3, h.fort4, h.fort5].filter(Boolean).length;
      add(h.date, done);
    }
    for (const s of shanqitiCounts) add(s.date, s._count.id);
    for (const e of entryCounts) add(e.date, e._count.id);
    for (const r of srsCounts) add(r.date, r._count.id);

    return NextResponse.json(map);
  } catch (e) {
    return errorResponse(e);
  }
}
