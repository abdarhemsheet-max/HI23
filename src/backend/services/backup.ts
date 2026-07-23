import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { todayStr } from '@/shared/utils';

const TABLES = [
  'Wallet', 'Transaction', 'Debt', 'Subscription', 'Asset', 'SavingsGoal',
  'DailyTask', 'TaskLog', 'Habit', 'HabitLog', 'WeeklyFocus', 'WorkEntity',
  'Project', 'ProjectTask', 'Report', 'ManualReport', 'DocFolder', 'Document',
  'HosoonDay', 'ShanqitiSession', 'QuranEntry', 'SrsCard', 'SrsReviewLog',
  'LearningItem', 'LearningLesson',
] as const;

/** نسخة احتياطية كاملة بنقرة واحدة — يصدّر كل الجداول في ملف JSON يُنزَّل مباشرة */
export async function downloadBackup(): Promise<void> {
  const results = await Promise.all(TABLES.map((t) => supabase.from(t).select('*')));
  const data: Record<string, unknown> = {};
  TABLES.forEach((t, i) => {
    data[t] = unwrap(results[i]);
  });

  const backup = {
    app: 'نظام حياتي',
    version: 3,
    exportedAt: new Date().toISOString(),
    note: 'ملفات المستندات الفعلية مخزَّنة على Backblaze B2 — غير مضمَّنة هنا',
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hayati-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
