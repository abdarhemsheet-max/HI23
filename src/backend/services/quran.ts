import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, oneOf, optStr, dayStr } from '../validate';
import { lastNDays, todayStr } from '@/shared/utils';
import { SURAH_BY_NUMBER } from '@/shared/quranData';

type Body = Record<string, unknown>;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FORT_FIELDS = ['fort1', 'fort2', 'fort3', 'fort4', 'fort5'] as const;

export async function reviewSrsCard(cardId: string, b: Body) {
  const rating = oneOf(b, 'rating', ['easy', 'medium', 'hard'] as const, 'التقييم');
  const today = dayStr(b, 'today', 'اليوم');
  return unwrap(await supabase.rpc('review_srs_card', { p_card_id: cardId, p_rating: rating, p_today: today }));
}

interface HosoonRow {
  date: string;
  fort1: boolean;
  fort2: boolean;
  fort3: boolean;
  fort4: boolean;
  fort5: boolean;
}
interface DateOnly {
  date: string;
}

export async function getQuranHeatmap(): Promise<Record<string, number>> {
  const [hosoonRes, shanqitiRes, entriesRes, srsRes] = await Promise.all([
    supabase.from('HosoonDay').select('date, fort1, fort2, fort3, fort4, fort5'),
    supabase.from('ShanqitiSession').select('date'),
    supabase.from('QuranEntry').select('date'),
    supabase.from('SrsReviewLog').select('date'),
  ]);

  const map: Record<string, number> = {};
  const add = (date: string, n: number) => {
    if (n > 0) map[date] = (map[date] ?? 0) + n;
  };
  const countBy = (rows: DateOnly[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.date, (m.get(r.date) ?? 0) + 1);
    return m;
  };

  for (const h of unwrap(hosoonRes) as HosoonRow[]) {
    const done = [h.fort1, h.fort2, h.fort3, h.fort4, h.fort5].filter(Boolean).length;
    add(h.date, done);
  }
  for (const [date, n] of countBy(unwrap(shanqitiRes) as DateOnly[])) add(date, n);
  for (const [date, n] of countBy(unwrap(entriesRes) as DateOnly[])) add(date, n);
  for (const [date, n] of countBy(unwrap(srsRes) as DateOnly[])) add(date, n);

  return map;
}

export async function getMushafProgress(): Promise<Record<number, number>> {
  const rows = unwrap(
    await supabase.from('QuranEntry').select('surahNumber, ayahCount').eq('type', 'hifz').not('surahNumber', 'is', null)
  ) as { surahNumber: number; ayahCount: number }[];

  const sums = new Map<number, number>();
  for (const r of rows) sums.set(r.surahNumber, (sums.get(r.surahNumber) ?? 0) + r.ayahCount);

  const progress: Record<number, number> = {};
  for (const [surahNumber, total] of sums) {
    const totalAyahs = SURAH_BY_NUMBER.get(surahNumber)?.totalAyahs ?? 0;
    progress[surahNumber] = Math.min(totalAyahs, total);
  }
  return progress;
}

export async function getHosoonWeek(date?: string) {
  const d = date && DAY_RE.test(date) ? date : todayStr();
  const weekDates = lastNDays(7);
  const [dayRes, weekRes] = await Promise.all([
    supabase.from('HosoonDay').select('*').eq('date', d).maybeSingle(),
    supabase.from('HosoonDay').select('*').in('date', weekDates),
  ]);
  const day = unwrap(dayRes) ?? {
    id: '', date: d, fort1: false, fort2: false, fort3: false, fort4: false, fort5: false, notes: null,
  };
  return { day, week: unwrap(weekRes), weekDates };
}

export async function upsertHosoonField(b: Body) {
  const date = typeof b.date === 'string' && DAY_RE.test(b.date) ? b.date : null;
  if (!date) throw new ValidationError('تاريخ غير صالح');

  let data: Record<string, unknown>;
  if (b.field === 'notes') {
    data = { notes: optStr(b, 'value') };
  } else {
    const field = oneOf(b, 'field', FORT_FIELDS, 'الحصن');
    if (typeof b.value !== 'boolean') throw new ValidationError('قيمة الحصن غير صالحة');
    data = { [field]: b.value };
  }

  const { data: userData } = await supabase.auth.getUser();
  return unwrap(
    await supabase
      .from('HosoonDay')
      .upsert({ date, ...data, userId: userData.user?.id }, { onConflict: 'userId,date' })
      .select('*')
      .single()
  );
}
