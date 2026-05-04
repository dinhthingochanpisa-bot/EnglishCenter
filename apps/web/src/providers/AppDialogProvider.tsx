'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type NoticeType = 'success' | 'error' | 'info' | 'warning';

interface NotifyOptions {
  type?: NoticeType;
  title: string;
  message?: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
}

interface ToastItem extends Required<NotifyOptions> {
  id: number;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface AppDialogContextValue {
  notify: (options: NotifyOptions) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const AppDialogContext = createContext<AppDialogContextValue | undefined>(undefined);

const toastStyles: Record<NoticeType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
};

const toastIcons: Record<NoticeType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    ({ type = 'info', title, message = '' }: NotifyOptions) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [{ id, type, title, message }, ...current].slice(0, 4));
      window.setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast],
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        confirmLabel: 'Xác nhận',
        cancelLabel: 'Hủy',
        variant: 'primary',
        ...options,
        resolve,
      });
    });
  }, []);

  const closeConfirm = useCallback(
    (value: boolean) => {
      confirmState?.resolve(value);
      setConfirmState(null);
    },
    [confirmState],
  );

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-5 top-5 z-[80] flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl shadow-slate-900/10 backdrop-blur ${toastStyles[toast.type]}`}
            >
              <Icon size={20} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message && <p className="mt-1 text-sm opacity-80">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-1 opacity-60 transition hover:bg-white/50 hover:opacity-100"
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-950/25">
            <div className="flex items-start gap-4 border-b border-slate-100 p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-950">{confirmState.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{confirmState.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 bg-slate-50 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => closeConfirm(false)}>
                {confirmState.cancelLabel}
              </Button>
              <Button
                type="button"
                variant={confirmState.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => closeConfirm(true)}
              >
                {confirmState.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return context;
}
