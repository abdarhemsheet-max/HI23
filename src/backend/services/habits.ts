import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, oneOf, reqStr, dayStr } from '../validate';

type Body = Record<string, unknown>;

/** تسجيل/إلغاء إنجاز يومي لعادة أو مهمة */
export async function toggleLog(b: Body) {
  const kind = oneOf(b, 'kind', ['habit', 'task'] as const, 'النوع');
  const id = reqStr(b, 'id', 'المعرّف', 100);
  const date = dayStr(b, 'date', 'اليوم');
  if (typeof b.done !== 'boolean') throw new ValidationError('حالة الإنجاز غير صالحة');
  unwrap(await supabase.rpc('toggle_log', { p_kind: kind, p_id: id, p_date: date, p_done: b.done }));
  return { ok: true };
}
