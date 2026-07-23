import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** false قبل ملء .env — تفحصه AuthGate لعرض شاشة إعداد بدل انهيار صامت */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * عميل Supabase الوحيد في التطبيق — كل الاتصال بقاعدة البيانات يمر من هنا.
 * يُبنى بقيم وهمية إن غابت متغيرات البيئة حتى لا تنهار الوحدة عند التحميل
 * (import.meta.env يُقيَّم عند تحميل الوحدة، قبل أي فرصة لعرض واجهة خطأ) —
 * AuthGate يمنع فعلياً أي استدعاء له قبل التحقق من isSupabaseConfigured.
 */
export const supabase = createClient(supabaseUrl || 'https://placeholder.invalid', supabaseAnonKey || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true },
});
