import React, { useState } from 'react';
import {
  Plus,
  Shield,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  Edit2,
  Bell,
  Save,
  Info,
} from 'lucide-react';
import type {
  AppDatabase,
  ModuleId,
  UserAccount,
  Role,
  SalonSettings,
} from '../types';
import {
  formatDateBR,
  Modal,
  ConfirmDialog,
  EmptyState,
  UserAvatar,
} from './CommonUI';

interface ModuleProps {
  db: AppDatabase;
  currentUser: UserAccount;
  onNavigate: (mod: ModuleId) => void;
  apiRequest: <T = any>(
    url: string,
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ) => Promise<T | null>;
  refreshData: () => Promise<void>;
  notify: (type: 'success' | 'error' | 'warning', title: string, message: string) => void;
}

const ALL_MODULES_LIST: { id: ModuleId; label: string }[] = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'clients', label: 'Clientes' },
  { id: 'inventory', label: 'Estoque' },
  { id: 'products', label: 'Produtos' },
  { id: 'services', label: 'Serviços' },
  { id: 'professionals', label: 'Profissionais' },
  { id: 'sales', label: 'Vendas (PDV)' },
  { id: 'cashflow', label: 'Fluxo de Caixa' },
  { id: 'accounts', label: 'Contas a Pagar/Receber' },
  { id: 'commissions', label: 'Comissões' },
  { id: 'reports', label: 'Relatórios' },
  { id: 'users', label: 'Usuários' },
  { id: 'security', label: 'Segurança' },
  { id: 'notifications', label: 'Notificações' },
  { id: 'settings', label: 'Configurações' },
];

// ============================================================================
// 13. USUÁRIOS & MATRIZ DE PERMISSÕES (RBAC)
// ============================================================================
export const UsersModule: React.FC<ModuleProps> = ({
  db,
  currentUser,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('receptionist');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<UserAccount['status']>('active');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [permissions, setPermissions] = useState<ModuleId[]>([
    'overview',
    'agenda',
    'clients',
    'sales',
    'notifications',
  ]);

  const openCreate = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('Lumina@2026');
    setRole('receptionist');
    setPhone('(11) 98888-0000');
    setStatus('active');
    setTwoFactorEnabled(false);
    setPermissions(['overview', 'agenda', 'clients', 'sales', 'cashflow', 'notifications']);
    setIsModalOpen(true);
  };

  const openEdit = (u: UserAccount) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setPhone(u.phone);
    setStatus(u.status);
    setTwoFactorEnabled(u.twoFactorEnabled);
    setPermissions(u.permissions);
    setIsModalOpen(true);
  };

  const togglePermission = (mod: ModuleId) => {
    setPermissions((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      notify('error', 'Validação', 'Nome e e-mail são obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const res = await apiRequest(`/api/users/${editingUser.id}`, 'PUT', {
          name,
          role,
          phone,
          status,
          twoFactorEnabled,
          permissions,
          newPassword: password.trim() ? password : undefined,
        });
        if (res) {
          notify('success', 'Operador Atualizado', `Permissões de ${name} salvas no servidor.`);
          setIsModalOpen(false);
          await refreshData();
        }
      } else {
        if (password.length < 6) {
          notify('error', 'Senha Fraca', 'A senha inicial deve possuir no mínimo 6 caracteres.');
          setIsSubmitting(false);
          return;
        }
        const res = await apiRequest('/api/users', 'POST', {
          name,
          email,
          password,
          role,
          phone,
          twoFactorEnabled,
          permissions,
        });
        if (res) {
          notify('success', 'Operador Criado', `A conta ${email} foi provisionada.`);
          setIsModalOpen(false);
          await refreshData();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/users/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Conta Revogada', `O acesso de ${deleteTarget.name} foi removido.`);
        setDeleteTarget(null);
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Gestão de Usuários & Controle de Acesso (RBAC)
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Provisionamento de contas de operadores, papéis hierárquicos e escopo granular de módulos validados no backend
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Provisionar Usuário</span>
        </button>
      </div>

      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Operador & E-mail</th>
                <th className="py-3 px-4">Papel (Role)</th>
                <th className="py-3 px-4">Escopo de Módulos Autorizados</th>
                <th className="py-3 px-4">Status & 2FA</th>
                <th className="py-3 px-4">Último Login</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {db.users.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/70">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="sm" variant="light" />
                      <div>
                        <p className="font-semibold text-zinc-900">{u.name}</p>
                        <p className="text-[11px] font-mono-num text-zinc-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 uppercase font-mono-num font-semibold text-amber-800 whitespace-nowrap">
                    {u.role}
                  </td>
                  <td className="py-3.5 px-4 max-w-sm">
                    <p className="text-zinc-700 truncate">
                      {u.permissions.length} de {ALL_MODULES_LIST.length} módulos ({u.permissions.slice(0, 5).join(', ')}...)
                    </p>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        u.status === 'active' ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {u.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </span>
                    <span className="text-zinc-300 mx-1">·</span>
                    <span className="text-[11px] text-zinc-500">
                      {u.twoFactorEnabled ? '2FA Ativo' : 'Senha Padrão'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono-num text-zinc-500 whitespace-nowrap">
                    {formatDateBR(u.lastLogin)}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md cursor-pointer"
                        title="Editar permissões"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {u.id !== 'usr-1' && u.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
                          title="Revogar conta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        title={editingUser ? 'Editar Operador & Permissões RBAC' : 'Provisionar Novo Operador'}
        subtitle="As permissões selecionadas abaixo são validadas pelo middleware do backend em cada requisição HTTP."
        onClose={() => setIsModalOpen(false)}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">E-mail Corporativo *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(editingUser)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg disabled:bg-zinc-100"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Papel Hierárquico *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="admin">Administrador (Master)</option>
                <option value="manager">Gerente Operacional</option>
                <option value="receptionist">Recepção & Caixa</option>
                <option value="professional">Profissional Especialista</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Status da Conta</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserAccount['status'])}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="active">Ativo</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {editingUser ? 'Nova Senha (opcional)' : 'Senha Inicial *'}
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingUser ? 'Manter atual' : 'Mín. 6 caracteres'}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-800 mb-2">
              Módulos Autorizados para este Usuário (Verificados na API):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
              {ALL_MODULES_LIST.map((mod) => {
                const checked = permissions.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(mod.id)}
                      className="rounded border-zinc-300 text-zinc-900"
                    />
                    <span className="truncate">{mod.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Permissões'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Revogar e Excluir Usuário"
        description={`Confirmar exclusão definitiva do operador "${deleteTarget?.name}" (${deleteTarget?.email})?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 14. SEGURANÇA & TRILHA DE AUDITORIA ADMINISTRATIVA
// ============================================================================
export const SecurityModule: React.FC<ModuleProps> = ({
  db,
  currentUser,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [isTestingRbac, setIsTestingRbac] = useState(false);

  const filteredLogs = db.auditLogs.filter((l) =>
    severityFilter === 'all' ? true : l.severity === severityFilter
  );

  const handleTestBackendProtection = async () => {
    setIsTestingRbac(true);
    try {
      const res = await apiRequest('/api/security/test-rbac', 'POST');
      if (res) {
        notify('success', 'Auditoria RBAC Verificada', res.message);
        await refreshData();
      }
    } finally {
      setIsTestingRbac(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Segurança da Informação & Trilha de Auditoria
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Monitoramento de eventos administrativos, bloqueios de permissão HTTP 403 e criptografia de credenciais
          </p>
        </div>
        <button
          type="button"
          onClick={handleTestBackendProtection}
          disabled={isTestingRbac}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Shield className="w-4 h-4" />
          <span>{isTestingRbac ? 'Verificando...' : 'Testar Proteção RBAC no Servidor'}</span>
        </button>
      </div>

      {/* Security Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900">Autenticação & Sessão</span>
            <span className="text-xs font-mono-num text-emerald-700 font-semibold">HMAC-SHA256</span>
          </div>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Senhas derivadas via <code className="font-mono-num">crypto.scryptSync</code> (64 bytes) e tokens validados a cada chamada em <code className="font-mono-num">/api/*</code>.
          </p>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900">Proteção de Rotas Backend</span>
            <span className="text-xs font-mono-num text-emerald-700 font-semibold">Ativa (HTTP 403)</span>
          </div>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Nenhuma operação confia apenas na ocultação visual de botões. O middleware <code className="font-mono-num">requireModulePermission</code> rejeita chamadas não autorizadas.
          </p>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-900">Operador Autenticado</span>
            <span className="text-xs font-mono-num text-amber-800 font-semibold uppercase">
              {currentUser.role}
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Logado como <strong>{currentUser.name}</strong> ({currentUser.email}). Todas as ações geram registro assinado abaixo.
          </p>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900">
            Registro Imutável de Ações Administrativas ({filteredLogs.length})
          </h2>
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'info', label: 'Informativo' },
                { id: 'warning', label: 'Alerta / Permissão' },
                { id: 'critical', label: 'Crítico / Estorno' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeverityFilter(s.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  severityFilter === s.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Operador & Role</th>
                <th className="py-3 px-4">Evento / Ação</th>
                <th className="py-3 px-4">Módulo</th>
                <th className="py-3 px-4">Detalhes da Operação</th>
                <th className="py-3 px-4 text-right">Severidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/70">
                  <td className="py-3 px-4 font-mono-num text-zinc-500 whitespace-nowrap">
                    {formatDateBR(log.timestamp)}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-medium text-zinc-900">{log.userName}</span>
                    <span className="text-zinc-400 mx-1">·</span>
                    <span className="font-mono-num text-[11px] uppercase text-zinc-500">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono-num font-semibold text-zinc-800 whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-zinc-600 whitespace-nowrap">{log.module}</td>
                  <td className="py-3 px-4 text-zinc-700 max-w-md">{log.details}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        log.severity === 'critical'
                          ? 'text-red-600'
                          : log.severity === 'warning'
                          ? 'text-amber-700'
                          : 'text-zinc-600'
                      }`}
                    >
                      {log.severity === 'critical'
                        ? 'Crítico'
                        : log.severity === 'warning'
                        ? 'Alerta'
                        : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 15. NOTIFICAÇÕES & CENTRAL DE ALERTAS
// ============================================================================
export const NotificationsModule: React.FC<ModuleProps> = ({
  db,
  onNavigate,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'system' | 'stock' | 'agenda' | 'finance'>('system');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMarkRead = async (id: string) => {
    await apiRequest(`/api/notifications/${id}/read`, 'POST');
    await refreshData();
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/read-all', 'POST');
    notify('success', 'Notificações Lidas', 'Todos os alertas foram marcados como lidos.');
    await refreshData();
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/notifications/${id}`, 'DELETE');
    await refreshData();
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/notifications', 'POST', {
        title,
        message,
        category,
      });
      if (res) {
        notify('success', 'Comunicado Publicado', 'O alerta foi enviado para a central da equipe.');
        setIsModalOpen(false);
        setTitle('');
        setMessage('');
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Central de Notificações & Comunicados
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Avisos automáticos de estoque mínimo, vencimentos financeiros, confirmações VIP e comunicados internos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg cursor-pointer"
          >
            Marcar Todas como Lidas
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span>Novo Comunicado</span>
          </button>
        </div>
      </div>

      {db.notifications.length === 0 ? (
        <EmptyState
          title="Caixa de notificações limpa"
          description="Não há alertas pendentes no momento."
        />
      ) : (
        <div className="space-y-3">
          {db.notifications.map((n) => (
            <div
              key={n.id}
              className={`p-5 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                n.read ? 'bg-white border-zinc-200/70' : 'bg-amber-50/40 border-amber-300/80'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-zinc-900">{n.title}</span>
                  <span className="text-zinc-300">·</span>
                  <span className="font-mono-num text-[11px] text-zinc-500">
                    {formatDateBR(n.createdAt)}
                  </span>
                  {!n.read && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span className="text-[11px] font-semibold text-amber-800">Não lida</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{n.message}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {n.actionModule && (
                  <button
                    type="button"
                    onClick={() => onNavigate(n.actionModule!)}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
                  >
                    Abrir Módulo
                  </button>
                )}
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(n.id)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                  >
                    Concluir Leitura
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        title="Emitir Comunicado Interno para Equipe"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Título do Alerta *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Reunião de Alinhamento Sábado às 08h30"
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
            >
              <option value="system">Comunicado Geral</option>
              <option value="agenda">Agenda & Recepção</option>
              <option value="stock">Estoque & Produtos</option>
              <option value="finance">Financeiro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Mensagem *</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg"
            >
              Publicar Comunicado
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ============================================================================
// 16. CONFIGURAÇÕES GLOBAIS & TRANSPARÊNCIA DO SISTEMA
// ============================================================================
export const SettingsModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [formData, setFormData] = useState<SalonSettings>({
    ...db.settings,
    cancellationNoticeHours: db.settings.cancellationNoticeHours ?? 4,
    banners: db.settings.banners || [],
  });
  const [isSaving, setIsSaving] = useState(false);

  const PRESET_BANNER_IMAGES = [
    {
      label: 'Salão Flagship Jardins',
      url: '/src/assets/images/salon_banner_couture_interior_1793234470450.jpg',
    },
    {
      label: 'Ritual Mechas & Balayage',
      url: '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg',
    },
    {
      label: 'Spa Facial Botânico',
      url: '/src/assets/images/salon_banner_facial_spa_1793234472494.jpg',
    },
  ];

  const handleAddBanner = () => {
    const current = formData.banners || [];
    const nextOrder = current.length + 1;
    setFormData({
      ...formData,
      banners: [
        ...current,
        {
          id: `bnr-${Date.now()}`,
          title: 'Novo Ritual de Beleza Exclusivo',
          subtitle: 'Personalize o subtítulo promocional ou institucional exibido no portal da cliente.',
          ctaLabel: 'Agendar Horário',
          imageUrl: PRESET_BANNER_IMAGES[0].url,
          active: true,
          order: nextOrder,
        },
      ],
    });
  };

  const handleUpdateBanner = (
    id: string,
    field: 'title' | 'subtitle' | 'ctaLabel' | 'imageUrl' | 'active' | 'order',
    value: any
  ) => {
    const current = formData.banners || [];
    setFormData({
      ...formData,
      banners: current.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    });
  };

  const handleRemoveBanner = (id: string) => {
    const current = formData.banners || [];
    if (current.length <= 1) {
      notify('warning', 'Atenção', 'Mantenha ao menos 1 banner cadastrado para a página inicial da cliente.');
      return;
    }
    setFormData({
      ...formData,
      banners: current.filter((b) => b.id !== id),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.salonName.trim() || !formData.cnpj.trim()) {
      notify('error', 'Validação', 'Nome do salão e CNPJ são obrigatórios.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiRequest('/api/settings', 'PUT', formData);
      if (res) {
        notify('success', 'Configurações Salvas', 'Os parâmetros globais e banners do portal da cliente foram atualizados.');
        await refreshData();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
          Configurações do Estabelecimento & Portal da Cliente
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Dados cadastrais, regras de cancelamento, administração do carrossel fotográfico da cliente e escopo técnico
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-6">
        <h2 className="text-base font-semibold text-zinc-900 pb-3 border-b border-zinc-100">
          1. Identidade Corporativa & Dados Fiscais
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Nome Fantasia *</label>
            <input
              type="text"
              value={formData.salonName}
              onChange={(e) => setFormData({ ...formData, salonName: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Razão Social</label>
            <input
              type="text"
              value={formData.legalName}
              onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">CNPJ *</label>
            <input
              type="text"
              value={formData.cnpj}
              onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Telefone Recepção</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Chave PIX Oficial</label>
            <input
              type="text"
              value={formData.pixKey}
              onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Regime Tributário</label>
            <select
              value={formData.taxRegime}
              onChange={(e) => setFormData({ ...formData, taxRegime: e.target.value as any })}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
            >
              <option value="Simples Nacional">Simples Nacional (Lei Salão-Parceiro)</option>
              <option value="Lucro Presumido">Lucro Presumido</option>
              <option value="MEI">MEI</option>
            </select>
          </div>
        </div>

        <h2 className="text-base font-semibold text-zinc-900 pt-4 pb-3 border-b border-zinc-100">
          2. Regras de Automação Operacional & Política de Cancelamento Online
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 bg-zinc-50/50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoDeductStockOnSale}
              onChange={(e) =>
                setFormData({ ...formData, autoDeductStockOnSale: e.target.checked })
              }
              className="mt-0.5 rounded border-zinc-300"
            />
            <div>
              <span className="text-xs font-semibold text-zinc-900 block">
                Baixa Automática de Estoque no PDV
              </span>
              <span className="text-[11px] text-zinc-500">
                Deduzir saldo físico e registrar no Kardex ao faturar produtos.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-4 rounded-lg border border-zinc-200 bg-zinc-50/50 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.autoGenerateCommission}
              onChange={(e) =>
                setFormData({ ...formData, autoGenerateCommission: e.target.checked })
              }
              className="mt-0.5 rounded border-zinc-300"
            />
            <div>
              <span className="text-xs font-semibold text-zinc-900 block">
                Cálculo Automático de Comissões
              </span>
              <span className="text-[11px] text-zinc-500">
                Gerar lançamentos de comissão para o especialista ao concluir vendas.
              </span>
            </div>
          </label>

          <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50/50">
            <label className="block text-xs font-semibold text-zinc-900 mb-1">
              Antecedência Mínima (Cancelamento/Reagendamento)
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="number"
                min={0}
                max={72}
                value={formData.cancellationNoticeHours ?? 4}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cancellationNoticeHours: Math.max(0, Number(e.target.value)),
                  })
                }
                className="w-20 px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
              />
              <span className="text-xs text-zinc-600">horas antes do horário agendado</span>
            </div>
          </div>
        </div>

        {/* 3. Banner Carousel Administration */}
        <div className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                3. Gestão de Banners Fotográficos — Área Inicial da Cliente
              </h2>
              <p className="text-xs text-zinc-500">
                Administre os slides, títulos, chamadas e fotografias exibidos no carrossel automático da página da cliente.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddBanner}
              className="px-3.5 py-2 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Slide ao Carrossel</span>
            </button>
          </div>

          <div className="space-y-4">
            {(formData.banners || []).map((banner, idx) => (
              <div
                key={banner.id}
                className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start"
              >
                <div className="lg:col-span-3">
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-zinc-900 border border-zinc-200 relative">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-mono-num font-semibold bg-black/70 text-white rounded">
                      Slide #{idx + 1}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {PRESET_BANNER_IMAGES.map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => handleUpdateBanner(banner.id, 'imageUrl', preset.url)}
                        className={`px-2 py-1 text-[10px] rounded border transition-colors cursor-pointer ${
                          banner.imageUrl === preset.url
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-9 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Título Principal do Banner *
                      </label>
                      <input
                        type="text"
                        value={banner.title}
                        onChange={(e) => handleUpdateBanner(banner.id, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Texto do Botão (CTA)
                      </label>
                      <input
                        type="text"
                        value={banner.ctaLabel}
                        onChange={(e) => handleUpdateBanner(banner.id, 'ctaLabel', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                      Subtítulo Descritivo
                    </label>
                    <input
                      type="text"
                      value={banner.subtitle}
                      onChange={(e) => handleUpdateBanner(banner.id, 'subtitle', e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        URL da Fotografia (16:9)
                      </label>
                      <input
                        type="text"
                        value={banner.imageUrl}
                        onChange={(e) => handleUpdateBanner(banner.id, 'imageUrl', e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                        Ordem
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={banner.order}
                        onChange={(e) =>
                          handleUpdateBanner(banner.id, 'order', Number(e.target.value))
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                      />
                    </div>
                    <div className="sm:col-span-3 flex items-center justify-end gap-3 pt-4">
                      <label className="flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={banner.active}
                          onChange={(e) =>
                            handleUpdateBanner(banner.id, 'active', e.target.checked)
                          }
                          className="rounded border-zinc-300"
                        />
                        <span>Visível</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveBanner(banner.id)}
                        className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg cursor-pointer"
                        title="Remover Slide"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvando Configurações...' : 'Salvar Parâmetros Globais'}</span>
          </button>
        </div>
      </form>

      {/* Transparency Matrix requested by user prompt */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-800" />
          <h2 className="text-sm font-semibold text-zinc-900">
            Matriz de Transparência Técnica & Status de Implementação
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <p className="font-semibold text-emerald-800 mb-1.5">
              1. Funcional & Implementado (Backend + Frontend)
            </p>
            <p className="text-zinc-600 leading-relaxed">
              Autenticação via hash criptográfico (<code className="font-mono-num">scrypt</code>) e tokens HMAC-SHA256; middleware RBAC verificando permissões por rota no Express; persistência em disco (<code className="font-mono-num">data/salon_db.json</code>); todos os 16 módulos com CRUD, busca, filtros, baixa automática de estoque, geração de comissões, lançamento no fluxo de caixa, estorno, exportação CSV e trilha de auditoria.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <p className="font-semibold text-amber-800 mb-1.5">
              2. Dados Demonstrativos Pré-Carregados
            </p>
            <p className="text-zinc-600 leading-relaxed">
              Cadastros iniciais de demonstração do salão (4 perfis de usuários para teste de RBAC, 5 clientes, 6 serviços, 5 produtos Kérastase/Wella/Olaplex, 4 especialistas e histórico inicial de caixa/agenda) preservados e editáveis.
            </p>
          </div>
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <p className="font-semibold text-zinc-900 mb-1.5">
              3. Integrações Externas (Exigem Configuração Futura)
            </p>
            <p className="text-zinc-600 leading-relaxed">
              Emissão de NFS-e junto à prefeitura municipal, adquirência de maquininhas TEF/POS físicas (Stone/Cielo), disparo externo de mensagens WhatsApp Business API e migração opcional para banco de dados em nuvem (Cloud SQL / Firestore) mediante autorização.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
