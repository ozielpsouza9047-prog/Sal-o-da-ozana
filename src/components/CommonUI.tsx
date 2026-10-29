import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, X, Inbox } from 'lucide-react';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr || dateStr === '-') return '-';
  if (dateStr.includes('T')) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning';
  title: string;
  message: string;
}

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border bg-white shadow-lg transition-all ${
            t.type === 'error'
              ? 'border-red-200 text-red-950'
              : t.type === 'warning'
              ? 'border-amber-200 text-amber-950'
              : 'border-emerald-200 text-zinc-900'
          }`}
        >
          {t.type === 'error' ? (
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : t.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t.title}</p>
            <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{t.message}</p>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar Exclusão',
  onConfirm,
  onCancel,
  isLoading,
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-xs p-4">
      <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            <p className="text-sm text-zinc-600 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-zinc-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Modal: React.FC<{
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ isOpen, title, subtitle, onClose, children, maxWidth = 'max-w-xl' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className={`bg-white border border-zinc-200 rounded-xl w-full ${maxWidth} p-6 shadow-xl my-8`}>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-100">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="bg-white border border-zinc-200/80 rounded-xl p-10 text-center flex flex-col items-center justify-center">
    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-500 mb-3">
      <Inbox className="w-5 h-5" />
    </div>
    <h4 className="text-sm font-semibold text-zinc-900">{title}</h4>
    <p className="text-xs text-zinc-500 max-w-sm mt-1 leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="mt-4 px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="bg-white border border-zinc-200/80 rounded-xl p-4 space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-10 bg-zinc-100 animate-pulse rounded-lg" />
    ))}
  </div>
);
