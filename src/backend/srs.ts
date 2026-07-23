// ======================================================================
// خوارزمية التكرار المتباعد (Spaced Repetition) — نسخة مبسّطة بثلاثة تقييمات
// (صعب/متوسط/سهل) بدل تعقيد Anki الرباعي. مبدأ SM-2: كل تقييم يُعدّل
// الفاصل الزمني القادم ومعامل السهولة (easeFactor) الذي يحكم نمو الفواصل.
// ======================================================================

export type SrsRating = 'easy' | 'medium' | 'hard';

export interface SrsState {
  intervalDays: number;
  easeFactor: number;
  reviewCount: number;
}

export interface SrsResult {
  intervalDays: number;
  easeFactor: number;
}

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;

/**
 * يحسب الفاصل الزمني الجديد ومعامل السهولة بعد تقييم المستخدم.
 * صعب → تظهر غداً دائماً (إعادة تثبيت). سهل عند أول مراجعة → تختفي 10 أيام،
 * وبعد ذلك تنمو الفواصل تصاعدياً بضرب الفاصل الحالي بمعامل السهولة.
 */
export function nextSrsState(state: SrsState, rating: SrsRating): SrsResult {
  const { intervalDays, easeFactor, reviewCount } = state;

  if (rating === 'hard') {
    return { intervalDays: 1, easeFactor: Math.max(MIN_EASE, easeFactor - 0.2) };
  }

  if (rating === 'medium') {
    const next = reviewCount === 0 ? 3 : Math.round(intervalDays * 1.3);
    return { intervalDays: Math.max(1, next), easeFactor };
  }

  // easy
  const next = reviewCount === 0 ? 10 : Math.round(intervalDays * easeFactor);
  return { intervalDays: Math.max(1, next), easeFactor: Math.min(MAX_EASE, easeFactor + 0.15) };
}
