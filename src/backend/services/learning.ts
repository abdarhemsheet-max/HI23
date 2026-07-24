import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, reqStr } from '../validate';

type Body = Record<string, unknown>;

export async function addLearningLessons(b: Body) {
  const itemId = reqStr(b, 'itemId', 'الكورس', 100);
  if (!Array.isArray(b.titles)) throw new ValidationError('قائمة الدروس غير صالحة');
  const titles = (b.titles as unknown[])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, 300));
  if (titles.length === 0) throw new ValidationError('أضف عنوان درس واحد على الأقل');
  if (titles.length > 500) throw new ValidationError('الحد الأقصى 500 درس دفعة واحدة');

  const added = unwrap(await supabase.rpc('add_learning_lessons', { p_item_id: itemId, p_titles: titles }));
  return { ok: true, added };
}

export async function updateLearningLesson(id: string, b: Body) {
  // الملاحظات تُحدَّث مباشرة عبر Supabase (RLS يراعي الملكية عبر الجدول الأب)
  if (b.notes !== undefined) {
    const notes = b.notes === null ? null : String(b.notes).slice(0, 10000);
    unwrap(await supabase.from('LearningLesson').update({ notes }).eq('id', id));
    return { ok: true };
  }

  const args: Record<string, unknown> = { p_lesson_id: id };
  if (b.isDone !== undefined) {
    if (typeof b.isDone !== 'boolean') throw new ValidationError('حالة الدرس غير صالحة');
    args.p_is_done = b.isDone;
  }
  if (b.title !== undefined) args.p_title = reqStr(b, 'title', 'عنوان الدرس', 300);
  if (Object.keys(args).length === 1) throw new ValidationError('لا توجد تعديلات صالحة');
  return unwrap(await supabase.rpc('update_learning_lesson', args));
}

export async function deleteLearningLesson(id: string) {
  unwrap(await supabase.rpc('delete_learning_lesson', { p_lesson_id: id }));
  return { ok: true };
}
