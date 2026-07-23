import { prisma } from './prisma';

/**
 * مزامنة عدادات عنصر التعلم مع قائمة دروسه:
 * totalUnits = عدد الدروس، doneUnits = المنجز، والحالة تكتمل تلقائياً.
 * تُستدعى بعد أي تغيير في الدروس حتى تبقى اللوحة الرئيسية وشريط التقدم دقيقين.
 */
export async function syncLearningItem(itemId: string): Promise<void> {
  const lessons = await prisma.learningLesson.findMany({
    where: { itemId },
    select: { isDone: true },
  });
  if (lessons.length === 0) return; // عنصر بعدّاد يدوي — لا نلمس أرقامه

  const done = lessons.filter((l) => l.isDone).length;
  await prisma.learningItem.update({
    where: { id: itemId },
    data: {
      totalUnits: lessons.length,
      doneUnits: done,
      status: done === lessons.length ? 'done' : 'in_progress',
    },
  });
}
