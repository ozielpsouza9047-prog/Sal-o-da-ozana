import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Inbox,
  User as UserIcon,
  Camera,
  Upload,
  Trash2,
} from 'lucide-react';

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

export function formatRoleLabel(role?: string): string {
  switch (role) {
    case 'admin':
      return 'Administrador Master';
    case 'manager':
      return 'Gerente Operacional';
    case 'receptionist':
      return 'Recepção & Concierge';
    case 'professional':
      return 'Profissional Especialista';
    case 'client':
      return 'Cliente';
    default:
      return role || 'Visitante';
  }
}

export function getInitials(name?: string): string {
  if (!name || !name.trim()) return '';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export const UserAvatar: React.FC<{
  name?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dark' | 'light';
  showCameraBadge?: boolean;
  onClick?: () => void;
  title?: string;
}> = ({
  name,
  avatarUrl,
  size = 'md',
  variant = 'light',
  showCameraBadge = false,
  onClick,
  title,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const sizeClasses: Record<string, string> = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
  };

  const themeClasses =
    variant === 'dark'
      ? 'bg-zinc-800 text-amber-300 border-zinc-700'
      : 'bg-zinc-900 text-amber-300 border-zinc-200';

  const hasValidImage = Boolean(avatarUrl && avatarUrl.trim() && !imgError);
  const initials = getInitials(name);

  const content = (
    <div
      className={`relative rounded-full border overflow-hidden flex items-center justify-center shrink-0 select-none font-serif-display font-semibold ${sizeClasses[size]} ${themeClasses}`}
    >
      {hasValidImage ? (
        <img
          src={avatarUrl}
          alt={name || 'Foto de perfil'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <UserIcon className="w-1/2 h-1/2 opacity-80" />
      )}
    </div>
  );

  if (!onClick && !showCameraBadge) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || 'Visualizar ou atualizar foto de perfil'}
      className="relative inline-flex items-center justify-center group cursor-pointer shrink-0 focus:outline-none"
    >
      {content}
      {showCameraBadge && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-700 text-white border-2 border-white flex items-center justify-center shadow-xs group-hover:bg-amber-800 transition-colors">
          <Camera className="w-2.5 h-2.5" />
        </span>
      )}
    </button>
  );
};

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

export function resizeImageFileToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = maxSize;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context indisponível'));
          return;
        }
        // Center crop square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem selecionada'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export const ProfilePhotoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userRoleLabel: string;
  currentAvatarUrl?: string;
  onSave: (newAvatarUrl: string, newName?: string) => Promise<void>;
}> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  userRoleLabel,
  currentAvatarUrl,
  onSave,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>(currentAvatarUrl || '');
  const [nameInput, setNameInput] = useState<string>(userName || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentAvatarUrl || '');
      setNameInput(userName || '');
      setLocalError(null);
    }
  }, [isOpen, currentAvatarUrl, userName]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
      return;
    }
    try {
      setLocalError(null);
      const dataUrl = await resizeImageFileToDataUrl(file, 256);
      setPreviewUrl(dataUrl);
    } catch {
      setLocalError('Não foi possível processar a imagem selecionada.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || nameInput.trim().length < 3) {
      setLocalError('O nome deve conter ao menos 3 caracteres.');
      return;
    }
    setIsSaving(true);
    setLocalError(null);
    try {
      await onSave(previewUrl.trim(), nameInput.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Meu Perfil & Foto de Identificação"
      subtitle="Visualize ou atualize sua foto de perfil. Apenas você pode alterar seus próprios dados de identificação."
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Large Avatar Preview & User Role Info */}
        <div className="flex flex-col items-center text-center p-5 rounded-xl bg-zinc-50 border border-zinc-200/80">
          <UserAvatar
            name={nameInput || userName}
            avatarUrl={previewUrl}
            size="xl"
            variant="light"
          />
          <p className="text-sm font-semibold text-zinc-900 mt-3">{nameInput || userName}</p>
          <p className="text-xs font-mono-num text-amber-800 font-semibold uppercase mt-0.5">
            {userRoleLabel}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{userEmail}</p>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar Foto do Dispositivo</span>
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={() => setPreviewUrl('')}
                className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Usar Avatar Padrão</span>
              </button>
            )}
          </div>
        </div>

        {localError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {localError}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            Nome de Exibição *
          </label>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            URL da Imagem (ou envie arquivo acima)
          </label>
          <input
            type="text"
            value={previewUrl.startsWith('data:image/') ? '' : previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder={
              previewUrl.startsWith('data:image/')
                ? 'Imagem enviada do dispositivo carregada'
                : 'https://exemplo.com/minha-foto.jpg (vazio = avatar padrão)'
            }
            className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
          >
            {isSaving ? 'Salvando...' : 'Salvar Foto & Perfil'}
          </button>
        </div>
      </form>
    </Modal>
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

