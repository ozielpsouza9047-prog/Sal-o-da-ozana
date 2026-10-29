import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Boxes,
  Package,
  Scissors,
  UserCheck,
  ShoppingBag,
  Wallet,
  Receipt,
  Percent,
  BarChart3,
  UserCog,
  ShieldCheck,
  Bell,
  Settings,
  Menu,
  X,
  LogOut,
  Lock,
} from 'lucide-react';
import type { AppDatabase, ModuleId, UserAccount } from './types';
import { ToastContainer, ToastMessage, SkeletonRows } from './components/CommonUI';
import { LoginScreen } from './components/LoginScreen';
import {
  OverviewModule,
  AgendaModule,
  ClientsModule,
  ProfessionalsModule,
} from './components/OperationsViews';
import {
  ServicesModule,
  ProductsModule,
  InventoryModule,
} from './components/CatalogInventoryViews';
import {
  SalesModule,
  CashFlowModule,
  AccountsModule,
  CommissionsModule,
  ReportsModule,
} from './components/FinanceViews';
import {
  UsersModule,
  SecurityModule,
  NotificationsModule,
  SettingsModule,
} from './components/AdminGovernanceViews';

interface NavItem {
  id: ModuleId;
  label: string;
  group: 'Operação & Atendimento' | 'Catálogo & Suprimentos' | 'Financeiro & Fiscal' | 'Governança & Sistema';
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Visão Geral', group: 'Operação & Atendimento', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', group: 'Operação & Atendimento', icon: Calendar },
  { id: 'clients', label: 'Clientes', group: 'Operação & Atendimento', icon: Users },
  { id: 'professionals', label: 'Profissionais', group: 'Operação & Atendimento', icon: UserCheck },

  { id: 'services', label: 'Serviços', group: 'Catálogo & Suprimentos', icon: Scissors },
  { id: 'products', label: 'Produtos', group: 'Catálogo & Suprimentos', icon: Package },
  { id: 'inventory', label: 'Estoque', group: 'Catálogo & Suprimentos', icon: Boxes },

  { id: 'sales', label: 'Vendas', group: 'Financeiro & Fiscal', icon: ShoppingBag },
  { id: 'cashflow', label: 'Fluxo de Caixa', group: 'Financeiro & Fiscal', icon: Wallet },
  { id: 'accounts', label: 'Contas a Pagar e Receber', group: 'Financeiro & Fiscal', icon: Receipt },
  { id: 'commissions', label: 'Comissões', group: 'Financeiro & Fiscal', icon: Percent },
  { id: 'reports', label: 'Relatórios', group: 'Financeiro & Fiscal', icon: BarChart3 },

  { id: 'users', label: 'Usuários', group: 'Governança & Sistema', icon: UserCog },
  { id: 'security', label: 'Segurança', group: 'Governança & Sistema', icon: ShieldCheck },
  { id: 'notifications', label: 'Notificações', group: 'Governança & Sistema', icon: Bell },
  { id: 'settings', label: 'Configurações', group: 'Governança & Sistema', icon: Settings },
];

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('lumina_auth_token'));
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(token));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (type: 'success' | 'error' | 'warning', title: string, message: string) => {
      const id = `tst-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('lumina_auth_token');
    setToken(null);
    setCurrentUser(null);
    setDb(null);
    setActiveModule('overview');
  }, []);

  const apiRequest = useCallback(
    async <T = any>(
      url: string,
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
      body?: any
    ): Promise<T | null> => {
      if (!token) return null;
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (res.status === 401) {
          notify('error', 'Sessão Expirada', data.error || 'Faça login novamente.');
          handleLogout();
          return null;
        }
        if (!res.ok) {
          notify('error', 'Operação Recusada pelo Servidor', data.error || 'Erro ao processar solicitação.');
          return null;
        }
        return data as T;
      } catch {
        notify('error', 'Erro de Rede', 'Não foi possível comunicar com o servidor.');
        return null;
      }
    },
    [token, notify, handleLogout]
  );

  const refreshData = useCallback(async () => {
    if (!token) return;
    const data = await apiRequest<AppDatabase & { user: UserAccount }>('/api/bootstrap', 'GET');
    if (data) {
      setCurrentUser(data.user);
      setDb(data);
    }
    setIsLoading(false);
  }, [token, apiRequest]);

  useEffect(() => {
    if (token) {
      setIsLoading(true);
      refreshData();
    }
  }, [token, refreshData]);

  const handleLoginSuccess = (newToken: string, user: UserAccount) => {
    localStorage.setItem('lumina_auth_token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    notify('success', 'Autenticação Confirmada', `Bem-vinda(o), ${user.name} (${user.role.toUpperCase()}).`);
  };

  if (!token || (!isLoading && !currentUser)) {
    return (
      <>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const unreadNotifications = db?.notifications.filter((n) => !n.read).length || 0;
  const activeNavObj = NAV_ITEMS.find((i) => i.id === activeModule) || NAV_ITEMS[0];
  const hasPermissionForActive = currentUser?.permissions.includes(activeModule);

  const groups: NavItem['group'][] = [
    'Operação & Atendimento',
    'Catálogo & Suprimentos',
    'Financeiro & Fiscal',
    'Governança & Sistema',
  ];

  const renderActiveModule = () => {
    if (isLoading || !db || !currentUser) {
      return (
        <div className="space-y-4">
          <SkeletonRows rows={6} />
        </div>
      );
    }

    if (!hasPermissionForActive) {
      return (
        <div className="bg-white border border-zinc-200/80 rounded-xl p-10 text-center max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-serif-display text-2xl font-semibold text-zinc-900">
            Módulo Restrito ao seu Perfil ({currentUser.role.toUpperCase()})
          </h2>
          <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
            Seu operador (<strong>{currentUser.email}</strong>) não possui permissão RBAC para acessar o módulo{' '}
            <strong>{activeNavObj.label}</strong>. Caso tente invocar a API diretamente, o middleware de backend bloqueará com HTTP 403 e registrará o evento na auditoria.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setActiveModule('overview')}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
            >
              Voltar à Visão Geral
            </button>
          </div>
        </div>
      );
    }

    const commonProps = {
      db,
      currentUser,
      onNavigate: (m: ModuleId) => setActiveModule(m),
      apiRequest,
      refreshData,
      notify,
    };

    switch (activeModule) {
      case 'overview':
        return <OverviewModule {...commonProps} />;
      case 'agenda':
        return <AgendaModule {...commonProps} />;
      case 'clients':
        return <ClientsModule {...commonProps} />;
      case 'professionals':
        return <ProfessionalsModule {...commonProps} />;
      case 'services':
        return <ServicesModule {...commonProps} />;
      case 'products':
        return <ProductsModule {...commonProps} />;
      case 'inventory':
        return <InventoryModule {...commonProps} />;
      case 'sales':
        return <SalesModule {...commonProps} />;
      case 'cashflow':
        return <CashFlowModule {...commonProps} />;
      case 'accounts':
        return <AccountsModule {...commonProps} />;
      case 'commissions':
        return <CommissionsModule {...commonProps} />;
      case 'reports':
        return <ReportsModule {...commonProps} />;
      case 'users':
        return <UsersModule {...commonProps} />;
      case 'security':
        return <SecurityModule {...commonProps} />;
      case 'notifications':
        return <NotificationsModule {...commonProps} />;
      case 'settings':
        return <SettingsModule {...commonProps} />;
      default:
        return <OverviewModule {...commonProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-zinc-950 text-zinc-300 border-r border-zinc-800 z-30">
        <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between">
          <span className="font-serif-display text-xl font-semibold tracking-tight text-white whitespace-nowrap">
            Lumina Atelier
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {groups.map((grp) => (
            <div key={grp}>
              <p className="px-3 text-[11px] font-medium text-zinc-500 mb-1.5">
                {grp}
              </p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === grp).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeModule === item.id;
                  const permitted = currentUser?.permissions.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveModule(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-zinc-800 text-white'
                          : permitted
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.id === 'notifications' && unreadNotifications > 0 && (
                        <span className="font-mono-num text-[11px] text-amber-400 font-semibold">
                          {unreadNotifications}
                        </span>
                      )}
                      {!permitted && <Lock className="w-3 h-3 text-zinc-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.name}
              </p>
              <p className="text-[11px] text-zinc-400 truncate">
                Perfil: <span className="uppercase font-mono-num text-amber-400">{currentUser?.role}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Encerrar Sessão"
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-zinc-950 text-zinc-300 flex flex-col h-full z-10">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="font-serif-display text-lg font-semibold text-white">
                Lumina Atelier
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {groups.map((grp) => (
                <div key={grp}>
                  <p className="px-3 text-[11px] font-medium text-zinc-500 mb-1">{grp}</p>
                  <div className="space-y-0.5">
                    {NAV_ITEMS.filter((i) => i.group === grp).map((item) => {
                      const Icon = item.icon;
                      const isActive = activeModule === item.id;
                      const permitted = currentUser?.permissions.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveModule(item.id);
                            setMobileMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium ${
                            isActive
                              ? 'bg-zinc-800 text-white'
                              : permitted
                              ? 'text-zinc-400 hover:text-white'
                              : 'text-zinc-600'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          {!permitted && <Lock className="w-3 h-3 text-zinc-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
              <div className="text-xs">
                <p className="font-semibold text-white">{currentUser?.name}</p>
                <p className="text-zinc-400 uppercase font-mono-num text-[11px]">{currentUser?.role}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-800 rounded-lg"
              >
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Zone 1 (Breadcrumb/Brand) — Zone 2 (Quick Nav) — Zone 3 (Primary Action) */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-zinc-200 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line breadcrumb / brand */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-zinc-700 hover:bg-zinc-100 rounded-lg"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-zinc-900 whitespace-nowrap shrink-0">
              Painel ADM · {activeNavObj.label}
            </span>
          </div>

          {/* Zone 2: 4 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600">
            <button
              type="button"
              onClick={() => setActiveModule('agenda')}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Agenda Hoje
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('sales')}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              PDV Comandas
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('cashflow')}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Caixa Diário
            </button>
            <button
              type="button"
              onClick={() => setActiveModule('notifications')}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Alertas ({unreadNotifications})
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Trocar Operador ({currentUser?.role.toUpperCase()})
            </button>
          </div>
        </header>

        {/* Viewport Workspace */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {renderActiveModule()}
        </main>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
