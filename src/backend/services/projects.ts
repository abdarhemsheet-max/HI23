import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, reqBool } from '../validate';

type Body = Record<string, unknown>;

export async function reorderProjectTasks(b: Body) {
  if (!Array.isArray(b.ids)) throw new ValidationError('قائمة الترتيب غير صالحة');
  const ids = (b.ids as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (ids.length === 0) throw new ValidationError('لا توجد مهام لإعادة ترتيبها');
  if (ids.length > 2000) throw new ValidationError('عدد المهام كبير جداً');
  unwrap(await supabase.rpc('reorder_project_tasks', { p_ids: ids }));
  return { ok: true, count: ids.length };
}

export async function setTaskReportFlag(taskId: string, b: Body) {
  const include = reqBool(b, 'include', 'الإدراج في التقرير');
  return unwrap(await supabase.rpc('set_task_report_flag', { p_task_id: taskId, p_include: include }));
}
