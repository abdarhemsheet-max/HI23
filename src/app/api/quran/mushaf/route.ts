import { NextResponse } from 'next/server';
import { prisma } from '@/backend/prisma';
import { errorResponse } from '@/backend/resources';
import { SURAH_BY_NUMBER } from '@/shared/quranData';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quran/mushaf — يجمّع عدد الآيات المحفوظة (نظام hifz) لكل سورة
 * من سجلات النظام المخصص (QuranEntry) — تقدير تراكمي مُقيَّد بعدد آيات
 * السورة الفعلي، لتغذية لوحة المصحف البصرية (114 سورة).
 */
export async function GET() {
  try {
    const rows = await prisma.quranEntry.groupBy({
      by: ['surahNumber'],
      where: { type: 'hifz', surahNumber: { not: null } },
      _sum: { ayahCount: true },
    });

    const progress: Record<number, number> = {};
    for (const r of rows) {
      if (r.surahNumber === null) continue;
      const total = SURAH_BY_NUMBER.get(r.surahNumber)?.totalAyahs ?? 0;
      const memorized = Math.min(total, r._sum.ayahCount ?? 0);
      progress[r.surahNumber] = memorized;
    }

    return NextResponse.json(progress);
  } catch (e) {
    return errorResponse(e);
  }
}
