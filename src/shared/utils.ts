// العملة الافتراضية — غيّرها من هنا إن أردت (مثال: 'ر.س' أو '$')
export const CURRENCY = 'د.ل';

export function fmtMoney(n: number): string {
  return `${Number(n).toLocaleString('ar-LY', { maximumFractionDigits: 2 })} ${CURRENCY}`;
}

export function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('ar-LY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function fmtDateShort(d: string | Date): string {
  return new Date(d).toLocaleDateString('ar-LY', { month: 'short', day: 'numeric' });
}

/** تاريخ اليوم بصيغة YYYY-MM-DD بالتوقيت المحلي */
export function todayStr(): string {
  const d = new Date();
  return dateStr(d);
}

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** بداية الأسبوع الحالي (السبت) */
export function weekStartStr(): string {
  const d = new Date();
  // getDay: الأحد=0 ... السبت=6 — الأسبوع يبدأ سبتاً
  const diff = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - diff);
  return dateStr(d);
}

/** آخر n أيام كمصفوفة تواريخ (الأقدم أولاً) */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(dateStr(d));
  }
  return out;
}

/**
 * حساب عداد الاستمرارية (Streak) من مجموعة تواريخ الإنجاز.
 * يُحسب التتابع رجوعاً من اليوم (أو من الأمس إذا لم يُنجز اليوم بعد).
 * فقدان يوم كامل يكسر العداد ويعيده للصفر.
 */
export function calcStreak(dates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(dateStr(cursor))) {
    cursor.setDate(cursor.getDate() - 1); // اليوم لم يُنجز بعد؛ نبدأ من الأمس
  }
  while (dates.has(dateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * أيام متبقية حتى تاريخ معيّن — يقبل YYYY-MM-DD أو ISO كامل (UTC).
 * التطبيع لمنتصف الليل المحلي يمنع انزياح اليوم الواحد بين UTC والتوقيت المحلي.
 */
export function daysUntil(date: string): number {
  const raw = date.length === 10 ? new Date(date + 'T00:00:00') : new Date(date);
  const target = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayMid.getTime()) / 86400000);
}

/** الشهر المحلي (YYYY-MM) لأي تاريخ ISO — لتصنيف الحركات في شهرها الصحيح */
export function localMonth(iso: string): string {
  return dateStr(new Date(iso)).slice(0, 7);
}

/** إضافة (أو طرح بعدد سالب) أيام إلى تاريخ نصي YYYY-MM-DD */
export function addDaysStr(day: string, days: number): string {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
