'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** إجراء خطير (حذف نهائي) → أيقونة وزر أحمر. خلاف ذلك → تحذير عادي. */
  danger?: boolean;
  icon?: LucideIcon;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * نافذة تأكيد زجاجية تحل محل window.confirm الافتراضي في المتصفح.
 * استخدمها عبر useConfirm بدلاً من استيرادها مباشرة.
 */
export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'إلغاء الأمر',
  danger = false,
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const Icon = icon ?? (danger ? Trash2 : AlertTriangle);

  return (
    <div
      className="print-hidden fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="animate-overlay-in absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="animate-scale-in relative w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-800/90 p-6 text-center shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'mx-auto flex h-14 w-14 items-center justify-center rounded-full',
            danger ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-400'
          )}
        >
          <Icon size={26} />
        </div>

        <h3 id="confirm-modal-title" className="mt-4 text-base font-black text-slate-50">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>

        <div className="mt-6 flex items-center gap-2.5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl bg-transparent px-4 py-2.5 text-sm font-bold text-slate-300 transition-all duration-300 hover:bg-slate-700/50 disabled:pointer-events-none disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 disabled:pointer-events-none disabled:opacity-60',
              danger
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-white'
            )}
          >
            {loading ? 'جارٍ التنفيذ…' : confirmLabel ?? (danger ? 'حذف' : 'تأكيد')}
          </button>
        </div>
      </div>
    </div>
  );
}
