import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/**
 * بوابة الدخول — النظام أصبح رابطاً عاماً على GitHub Pages، لذا كل الأقسام
 * محمية بتسجيل دخول عبر Supabase Auth (بريد + كلمة مرور). أنشئ المستخدم
 * الوحيد المصرَّح له من Supabase Dashboard → Authentication → Users.
 */
export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
