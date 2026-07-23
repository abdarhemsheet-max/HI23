import { supabase } from '../config/supabaseClient';
import { unwrap } from './errors';
import { todayStr, weekStartStr } from '@/shared/utils';

/** كل بيانات اللوحة الرئيسية في مجموعة طلبات موازية واحدة */
export async function getSummary() {
  const today = todayStr();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [wallets, monthTxns, pendingTxns, debts, subscriptions, tasks, habits, focus, projects, hosoonToday, learning] =
    await Promise.all([
      supabase.from('Wallet').select('*'),
      supabase.from('Transaction').select('*').eq('status', 'completed').gte('date', monthStart.toISOString()),
      supabase.from('Transaction').select('*').eq('status', 'pending'),
      supabase.from('Debt').select('*').eq('isSettled', false),
      supabase.from('Subscription').select('*').eq('isActive', true).order('nextRenewal', { ascending: true }).limit(4),
      supabase.from('DailyTask').select('*, logs:TaskLog(date)').eq('isActive', true),
      supabase.from('Habit').select('*, logs:HabitLog(date)').eq('isActive', true),
      supabase.from('WeeklyFocus').select('*').eq('weekStart', weekStartStr()).maybeSingle(),
      supabase.from('Project').select('*, tasks:ProjectTask(isCompleted)').eq('status', 'active'),
      supabase.from('HosoonDay').select('*').eq('date', today).maybeSingle(),
      supabase.from('LearningItem').select('*').eq('status', 'in_progress').order('createdAt', { ascending: false }).limit(3),
    ]);

  return {
    today,
    wallets: unwrap(wallets),
    monthTxns: unwrap(monthTxns),
    pendingTxns: unwrap(pendingTxns),
    debts: unwrap(debts),
    subscriptions: unwrap(subscriptions),
    tasks: unwrap(tasks),
    habits: unwrap(habits),
    focus: unwrap(focus),
    projects: unwrap(projects),
    hosoonToday: unwrap(hosoonToday),
    learning: unwrap(learning),
  };
}
