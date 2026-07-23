'use client';

import { useCallback, useRef, useState } from 'react';
import ConfirmModal, { type ConfirmModalProps } from '@/frontend/components/ui/ConfirmModal';

type ConfirmOptions = Omit<ConfirmModalProps, 'open' | 'onConfirm' | 'onCancel' | 'loading'>;

/**
 * بديل async لـ window.confirm الافتراضي — نافذة زجاجية متناسقة مع التصميم.
 * الاستخدام:
 *   const { confirm, ConfirmDialog } = useConfirm();
 *   const ok = await confirm({ title: '...', description: '...', danger: true });
 *   if (!ok) return;
 *   ...
 *   return <>{...}<ConfirmDialog /></>;
 */
export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<(value: boolean) => void>();

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result: boolean) => {
    setState((s) => (s ? { ...s, open: false } : s));
    resolver.current?.(result);
    resolver.current = undefined;
  };

  const ConfirmDialog = useCallback(() => {
    if (!state) return null;
    return <ConfirmModal {...state} onConfirm={() => settle(true)} onCancel={() => settle(false)} />;
  }, [state]);

  return { confirm, ConfirmDialog };
}
