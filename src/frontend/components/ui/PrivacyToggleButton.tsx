'use client';

import { Eye, EyeOff } from 'lucide-react';

/** زر خصوصية زجاجي موحّد — يُستخدم في الرئيسية وقسم المالية معاً */
export default function PrivacyToggleButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={visible ? 'إخفاء المبالغ' : 'إظهار المبالغ'}
      aria-label={visible ? 'إخفاء المبالغ' : 'إظهار المبالغ'}
      className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 backdrop-blur-xl transition hover:border-orange-500/30 hover:bg-white/10 hover:text-orange-300"
    >
      {visible ? <Eye size={17} /> : <EyeOff size={17} />}
    </button>
  );
}
