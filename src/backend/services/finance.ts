// خدمات المالية — العمليات التي تمس رصيد محفظة تمر عبر RPC (ذرّية كاملة)
import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { ValidationError, oneOf, posNum, optStr, optDate, optId, reqStr } from '../validate';

type Body = Record<string, unknown>;

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

  return unwrap(
    await supabase.rpc('create_transaction', {
      p_type: type,
      p_status: status,
      p_amount: amount,
      p_category: optStr(b, 'category') ?? 'عام',
      p_description: optStr(b, 'description'),
      p_date: optDate(b, 'date') ?? new Date(),
      p_wallet_id: walletId,
    })
  );
}

export async function confirmPendingTransaction(id: string, b: Body) {
  return unwrap(
    await supabase.rpc('confirm_pending_transaction', { p_txn_id: id, p_wallet_id: optId(b, 'walletId') })
  );
}

export async function deleteTransaction(id: string) {
  unwrap(await supabase.rpc('delete_transaction', { p_txn_id: id }));
}

export async function settleDebt(debtId: string, b: Body) {
  const walletId = reqStr(b, 'walletId', 'المحفظة', 100);
  return unwrap(await supabase.rpc('settle_debt', { p_debt_id: debtId, p_wallet_id: walletId }));
}

export async function paySubscription(subId: string, b: Body) {
  const walletId = reqStr(b, 'walletId', 'المحفظة', 100);
  return unwrap(await supabase.rpc('pay_subscription', { p_subscription_id: subId, p_wallet_id: walletId }));
}
