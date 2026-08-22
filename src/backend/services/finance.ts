// خدمات المالية — العمليات التي تمس رصيد محفظة تمر عبر RPC (ذرّية كاملة)
import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, oneOf, posNum, optStr, optDate, optId, optBool, reqStr } from '../validate';
import { financeSchemaReady } from './capabilities';
import type { TxCategoryKey } from '@/shared/types';

type Body = Record<string, unknown>;

/** التصنيفات المسموح بها يدوياً — 'transfer' محجوز لدالة التحويل الداخلي */
const MANUAL_CATEGORY_KEYS = [
  'general',
  'salary',
  'side_income',
  'sale',
  'gift',
  'family_support',
  'allowance',
  'petty_cash',
  'food',
  'transport',
  'bills',
  'health',
  'family_care',
  'savings',
  'trust_fund',
  'debt',
  'subscription',
] as const satisfies readonly TxCategoryKey[];

export async function listTransactions() {
  return unwrap(await supabase.from('Transaction').select('*').order('date', { ascending: false }));
}

export async function createTransaction(b: Body) {
  const type = oneOf(b, 'type', ['income', 'expense'] as const, 'نوع الحركة');
  const status = oneOf(b, 'status', ['completed', 'pending'] as const, 'حالة الحركة');
  if (status === 'pending' && type !== 'income') {
    throw new ValidationError('الأرباح المعلقة تكون دخلاً فقط');
  }
  const amount = posNum(b, 'amount', 'المبلغ');
  const walletId = optId(b, 'walletId');
  if (status === 'completed' && !walletId) {
    throw new ValidationError('اختر المحفظة — كل دخل أو مصروف يرتبط بمحفظة');
  }
  const categoryKey = b.categoryKey === undefined || b.categoryKey === null || b.categoryKey === ''
    ? 'general'
    : oneOf(b, 'categoryKey', MANUAL_CATEGORY_KEYS, 'تصنيف الحركة');

  const base = {
    p_type: type,
    p_status: status,
    p_amount: amount,
    p_category: optStr(b, 'category') ?? 'عام',
    p_description: optStr(b, 'description'),
    p_date: optDate(b, 'date') ?? new Date(),
    p_wallet_id: walletId,
  };
  // قاعدة لم تُرحَّل بعد: تُستدعى الصيغة القديمة فتبقى الحركات تعمل
  const args = (await financeSchemaReady())
    ? { ...base, p_category_key: categoryKey, p_expected_date: optDate(b, 'expectedDate') }
    : base;

  return unwrap(await supabase.rpc('create_transaction', args));
}

/**
 * تحصيل دخل متوقّع — تاريخ الحركة يصير يوم الاستلام الفعلي لا يوم التوقّع،
 * فيُحتسب المبلغ في شهر وصوله (مهم مع المرتب المتأخر). و repeatNext ينشئ
 * توقّع الشهر القادم بنفس القيمة في المعاملة نفسها.
 */
export async function confirmPendingTransaction(id: string, b: Body) {
  const base = { p_txn_id: id, p_wallet_id: optId(b, 'walletId') };
  const args = (await financeSchemaReady())
    ? {
        ...base,
        p_received_date: optDate(b, 'receivedDate') ?? new Date(),
        p_repeat_next: optBool(b, 'repeatNext') ?? false,
      }
    : base;

  return unwrap(await supabase.rpc('confirm_pending_transaction', args));
}

export async function deleteTransaction(id: string) {
  unwrap(await supabase.rpc('delete_transaction', { p_txn_id: id }));
}

/**
 * تحويل داخلي بين محفظتين — طرفان ماليان + رصيدان + دين اختياري في معاملة واحدة.
 *   mode = 'transfer' → نقل محايد بين محافظي (لا دخل ولا مصروف)
 *   mode = 'debt'     → سلفة: يُنشأ دين "عليّ" باسم صاحب المحفظة المصدر
 *   mode = 'gift'     → منحة: الطرف الداخل يُحتسب دخلاً بتصنيف 'allowance'
 */
export async function transferBetweenWallets(b: Body) {
  if (!(await financeSchemaReady())) {
    throw new ValidationError('التحويل الداخلي يحتاج تشغيل ملف الترحيل على قاعدة البيانات أولاً');
  }
  const fromWalletId = reqStr(b, 'fromWalletId', 'المحفظة المصدر', 100);
  const toWalletId = reqStr(b, 'toWalletId', 'المحفظة الوجهة', 100);
  if (fromWalletId === toWalletId) {
    throw new ValidationError('لا يمكن التحويل إلى نفس المحفظة');
  }
  const mode = oneOf(b, 'mode', ['transfer', 'debt', 'gift'] as const, 'نوع التحويل');

  return unwrap(
    await supabase.rpc('transfer_between_wallets', {
      p_from_wallet_id: fromWalletId,
      p_to_wallet_id: toWalletId,
      p_amount: posNum(b, 'amount', 'المبلغ'),
      p_note: optStr(b, 'note', 300),
      p_mode: mode,
      p_due_date: mode === 'debt' ? optDate(b, 'dueDate') : null,
    })
  );
}

/** تسديد دين — toWalletId اختياري: يُرجع المبلغ إلى محفظة أمانة صاحب الدين */
export async function settleDebt(debtId: string, b: Body) {
  const walletId = reqStr(b, 'walletId', 'المحفظة', 100);
  const toWalletId = optId(b, 'toWalletId');
  if (toWalletId && toWalletId === walletId) {
    throw new ValidationError('لا يمكن السداد إلى نفس المحفظة');
  }
  const base = { p_debt_id: debtId, p_wallet_id: walletId };
  const args = (await financeSchemaReady()) ? { ...base, p_to_wallet_id: toWalletId } : base;

  return unwrap(await supabase.rpc('settle_debt', args));
}

export async function paySubscription(subId: string, b: Body) {
  const walletId = reqStr(b, 'walletId', 'المحفظة', 100);
  return unwrap(await supabase.rpc('pay_subscription', { p_subscription_id: subId, p_wallet_id: walletId }));
}
