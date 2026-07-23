// ======================================================================
// أدوات تحقق صارمة — كل مدخل يمر من هنا قبل لمس قاعدة البيانات.
// أي قيمة غير صالحة ترمي ValidationError برسالة عربية واضحة
// تظهر للمستخدم كتنبيه لطيف بدلاً من انهيار الواجهة.
// ======================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Body = Record<string, unknown>;

/** نص إلزامي غير فارغ */
export function reqStr(b: Body, key: string, label: string, max = 500): string {
  const v = b[key];
  if (typeof v !== 'string' || v.trim() === '') throw new ValidationError(`حقل «${label}» مطلوب`);
  if (v.length > max) throw new ValidationError(`حقل «${label}» طويل جداً`);
  return v.trim();
}

/** نص اختياري — يعيد null إذا غاب أو كان فارغاً */
export function optStr(b: Body, key: string, max = 2000): string | null {
  const v = b[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new ValidationError('قيمة نصية غير صالحة');
  return v.slice(0, max).trim() || null;
}

/** رقم إلزامي منتهٍ (يقبل نصاً رقمياً من الحقول) */
export function reqNum(b: Body, key: string, label: string): number {
  const v = typeof b[key] === 'string' ? Number(b[key]) : b[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ValidationError(`حقل «${label}» يجب أن يكون رقماً صحيحاً`);
  }
  return v;
}

/** رقم موجب > 0 */
export function posNum(b: Body, key: string, label: string): number {
  const v = reqNum(b, key, label);
  if (v <= 0) throw new ValidationError(`حقل «${label}» يجب أن يكون أكبر من صفر`);
  return v;
}

/** رقم ≥ 0 اختياري بقيمة افتراضية */
export function optNum(b: Body, key: string, fallback = 0): number {
  if (b[key] === undefined || b[key] === null || b[key] === '') return fallback;
  const v = typeof b[key] === 'string' ? Number(b[key]) : b[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new ValidationError('قيمة رقمية غير صالحة');
  }
  return v;
}

/** عدد صحيح ≥ min */
export function intMin(b: Body, key: string, label: string, min: number): number {
  const v = Math.round(reqNum(b, key, label));
  if (v < min) throw new ValidationError(`حقل «${label}» يجب ألا يقل عن ${min}`);
  return v;
}

/** قيمة من قائمة مسموحة */
export function oneOf<T extends string>(b: Body, key: string, allowed: readonly T[], label: string): T {
  const v = b[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw new ValidationError(`قيمة «${label}» غير مسموحة`);
  }
  return v as T;
}

export function optBool(b: Body, key: string): boolean | undefined {
  const v = b[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'boolean') throw new ValidationError('قيمة منطقية غير صالحة');
  return v;
}

/** قيمة منطقية إلزامية */
export function reqBool(b: Body, key: string, label: string): boolean {
  const v = b[key];
  if (typeof v !== 'boolean') throw new ValidationError(`حقل «${label}» يجب أن يكون صح/خطأ`);
  return v;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** تاريخ يوم بصيغة YYYY-MM-DD (يُخزن كنص) */
export function dayStr(b: Body, key: string, label: string): string {
  const v = b[key];
  if (typeof v !== 'string' || !DAY_RE.test(v) || Number.isNaN(new Date(v + 'T00:00:00').getTime())) {
    throw new ValidationError(`تاريخ «${label}» غير صالح`);
  }
  return v;
}

export function optDayStr(b: Body, key: string): string | null {
  if (b[key] === undefined || b[key] === null || b[key] === '') return null;
  return dayStr(b, key, 'التاريخ');
}

/** تاريخ إلزامي يُحوَّل إلى Date (لحقول DateTime في Prisma) */
export function reqDate(b: Body, key: string, label: string): Date {
  const v = b[key];
  if (typeof v !== 'string' || v === '') throw new ValidationError(`تاريخ «${label}» مطلوب`);
  const d = new Date(DAY_RE.test(v) ? v + 'T00:00:00' : v);
  if (Number.isNaN(d.getTime())) throw new ValidationError(`تاريخ «${label}» غير صالح`);
  return d;
}

/** تاريخ اختياري → Date أو null */
export function optDate(b: Body, key: string): Date | null {
  if (b[key] === undefined || b[key] === null || b[key] === '') return null;
  return reqDate(b, key, 'التاريخ');
}

/** معرّف اختياري (نص غير فارغ أو null) */
export function optId(b: Body, key: string): string | null {
  const v = b[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw new ValidationError('معرّف غير صالح');
  return v;
}
