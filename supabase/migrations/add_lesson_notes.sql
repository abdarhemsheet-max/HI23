-- إضافة حقل الملاحظات لكل درس
alter table "LearningLesson" add column if not exists notes text;

-- تحديث دالة update_learning_lesson لدعم الملاحظات
create or replace function update_learning_lesson(
  p_lesson_id uuid,
  p_is_done boolean default null,
  p_title text default null,
  p_notes text default null
)
returns "LearningLesson" language plpgsql as $$
declare
  v_lesson "LearningLesson";
begin
  select l.* into v_lesson from "LearningLesson" l
    join "LearningItem" i on i.id = l."itemId"
    where l.id = p_lesson_id and i."userId" = auth.uid();
  if not found then raise exception 'الدرس غير موجود'; end if;

  update "LearningLesson" set
    "isDone" = coalesce(p_is_done, "isDone"),
    title = coalesce(p_title, title),
    notes = coalesce(p_notes, notes)
    where id = p_lesson_id returning * into v_lesson;

  perform sync_learning_item(v_lesson."itemId");
  return v_lesson;
end;
$$;
