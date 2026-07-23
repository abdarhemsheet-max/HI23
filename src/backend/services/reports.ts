import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, reqStr, reqDate, optStr } from '../validate';

type Body = Record<string, unknown>;

/**
 * توليد تقرير إنجاز مؤتمت — القاعدة الصارمة (اعتماد وأرشفة فورية، لا مراجعة
 * يدوية) منفَّذة داخل دالة generate_report في Postgres.
 */
export async function generateReport(b: Body) {
  const projectId = reqStr(b, 'projectId', 'المشروع', 100);
  const periodStart = reqDate(b, 'periodStart', 'بداية الفترة');
  const periodEnd = reqDate(b, 'periodEnd', 'نهاية الفترة');
  if (periodEnd < periodStart) throw new ValidationError('نهاية الفترة لا يمكن أن تسبق بدايتها');

  const created = unwrap(
    await supabase.rpc('generate_report', {
      p_project_id: projectId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_title: optStr(b, 'title') ?? '',
    })
  ) as { id: string };

  // إعادة الجلب مع العلاقات (entity/project) لعرضه فوراً بنفس شكل قائمة reports
  return unwrap(
    await supabase
      .from('Report')
      .select('*, entity:WorkEntity(*), project:Project(id,name,color)')
      .eq('id', created.id)
      .single()
  );
}
