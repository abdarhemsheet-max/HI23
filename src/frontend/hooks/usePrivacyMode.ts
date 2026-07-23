'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils';

const STORAGE_KEY = 'finance-show-balances';

/**
 * وضع الخصوصية المالية — تفضيل واحد مشترك بين الرئيسية وقسم المالية.
 * محلي بالكامل (localStorage) لتبديل فوري بلا أي تأخير شبكي أو استعلام قاعدة بيانات.
 */
export function usePrivacyMode() {
  const [showBalances, setShowBalances] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setShowBalances(saved === 'true');
  }, []);

  const togglePrivacy = () => {
    setShowBalances((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  /** صنف تمويه جاهز للنصوص المالية المضمّنة (خارج StatCard) */
  const moneyBlur = cn(!showBalances && 'blur-md select-none', 'transition-all duration-200');

  return { showBalances, togglePrivacy, moneyBlur };
}
