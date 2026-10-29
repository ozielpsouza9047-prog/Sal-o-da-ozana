import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  AppDatabase,
  ModuleId,
  Appointment,
  Client,
  Professional,
} from '../types';
import {
  formatBRL,
  formatDateBR,
  Modal,
  ConfirmDialog,
  EmptyState,
} from './CommonUI';

interface ModuleProps {
  db: AppDatabase;
  onNavigate: (mod: ModuleId) => void;
  apiRequest: <T = any>(
    url: string,
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ) => Promise<T | null>;
  refreshData: () => Promise<void>;
  notify: (type: 'success' | 'error' | 'warning', title: string, message: string) => void;
}

// ============================================================================
// 1. VISÃO GERAL (OVERVIEW)
// ============================================================================
export const OverviewModule: React.FC<ModuleProps> = ({
  db,
  onNavigate,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'today' | 'month' | 'all'>('month');

  const todayStr = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const filteredSales = db.sales.filter((s) => {
      if (s.status !== 'completed') return false;
      if (periodFilter === 'today') return s.createdAt.startsWith(todayStr);
      if (periodFilter === 'month') return s.createdAt.startsWith(todayStr.slice(0, 7));
      return true;
    });

    const grossRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const avgTicket = filteredSales.length > 0 ? grossRevenue / filteredSales.length : 0;

    const todayAppointments = db.appointments.filter((a) => a.date === todayStr && a.status !== 'cancelled');
    const lowStockProducts = db.products.filter((p) => p.stock <= p.minStock);
    const overdueAccounts = db.accounts.filter((a) => a.status === 'overdue' || (a.status === 'pending' && a.dueDate < todayStr));
    const pendingCommissions = db.commissions
      .filter((c) => c.status !== 'paid')
      .reduce((acc, c) => acc + c.commissionAmount, 0);

    return {
      grossRevenue,
      salesCount: filteredSales.length,
      avgTicket,
      todayAppointments,
      lowStockProducts,
      overdueAccounts,
      pendingCommissions,
    };
  }, [db, periodFilter, todayStr]);

  return (
    <div className="space-y-8">
      {/* Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Visão Geral Executiva
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Indicadores operacionais em tempo real · {db.settings.salonName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-zinc-200/70 rounded-lg">
            {(
              [
                { id: 'today', label: 'Hoje' },
                { id: 'month', label: 'Mês Atual' },
                { id: 'all', label: 'Acumulado' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriodFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  periodFilter === tab.id
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Nova Comanda PDV
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Faturamento Bruto ({periodFilter === 'today' ? 'Hoje' : periodFilter === 'month' ? 'Mês' : 'Total'})</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-2">
            {formatBRL(stats.grossRevenue)}
          </p>
          <div className="flex items-center justify-between text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
            <span>{stats.salesCount} vendas concluídas</span>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-zinc-900 font-medium hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Ver PDV</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Ticket Médio por Atendimento</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-2">
            {formatBRL(stats.avgTicket)}
          </p>
          <div className="flex items-center justify-between text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
            <span>{db.clients.length} clientes na base ativa</span>
            <button
              type="button"
              onClick={() => onNavigate('clients')}
              className="text-zinc-900 font-medium hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Clientes</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Agendamentos de Hoje ({formatDateBR(todayStr)})</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-2">
            {stats.todayAppointments.length} horários
          </p>
          <div className="flex items-center justify-between text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
            <span>
              {stats.todayAppointments.filter((a) => a.status === 'completed').length} concluídos ·{' '}
              {stats.todayAppointments.filter((a) => a.status !== 'completed').length} pendentes
            </span>
            <button
              type="button"
              onClick={() => onNavigate('agenda')}
              className="text-zinc-900 font-medium hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Agenda</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Comissões Pendentes de Repasse</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-2">
            {formatBRL(stats.pendingCommissions)}
          </p>
          <div className="flex items-center justify-between text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-100">
            <span>{db.professionals.length} especialistas ativos</span>
            <button
              type="button"
              onClick={() => onNavigate('commissions')}
              className="text-zinc-900 font-medium hover:underline inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Repasses</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Today's Schedule & Operational Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Today's Appointments Table */}
        <div className="lg:col-span-2 bg-white border border-zinc-200/80 rounded-xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Cronograma de Atendimento — Hoje
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Acompanhamento de recepção, cadeira técnica e fechamento de conta
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('agenda')}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              Gerenciar Agenda
            </button>
          </div>

          {stats.todayAppointments.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Sem agendamentos para hoje"
                description="Cadastre um novo horário na agenda para iniciar o fluxo do dia."
                actionLabel="Novo Agendamento"
                onAction={() => onNavigate('agenda')}
              />
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-[11px] font-semibold text-zinc-500">
                    <th className="py-2.5 pr-4">Horário</th>
                    <th className="py-2.5 px-4">Cliente</th>
                    <th className="py-2.5 px-4">Serviço & Especialista</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 pl-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {stats.todayAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 pr-4 font-mono-num font-medium text-zinc-900 whitespace-nowrap">
                        {apt.startTime} · {apt.endTime}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-zinc-900">{apt.clientName}</p>
                        <p className="text-[11px] text-zinc-500 font-mono-num">{apt.clientPhone}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-zinc-800">{apt.serviceName}</p>
                        <p className="text-[11px] text-zinc-500">Profissional: {apt.professionalName}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-medium ${
                            apt.status === 'completed'
                              ? 'text-emerald-700'
                              : apt.status === 'in_progress'
                              ? 'text-amber-700'
                              : 'text-zinc-700'
                          }`}
                        >
                          {apt.status === 'completed'
                            ? 'Concluído'
                            : apt.status === 'in_progress'
                            ? 'Em Atendimento'
                            : apt.status === 'confirmed'
                            ? 'Confirmado'
                            : 'Agendado'}
                        </span>
                        <span className="text-zinc-400 mx-1.5">·</span>
                        <span className="text-[11px] text-zinc-500">
                          {apt.paymentStatus === 'paid' ? 'Pago' : 'A Receber'}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right font-mono-num font-medium text-zinc-900 whitespace-nowrap">
                        {formatBRL(apt.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Actionable Operational Alerts & Cash Register Status */}
        <div className="space-y-6">
          {/* Cash Register Status */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">Status do Caixa Diário</h3>
              <span
                className={`text-xs font-semibold ${
                  db.cashRegister.isOpen ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {db.cashRegister.isOpen ? 'Aberto · Operante' : 'Fechado'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Operador responsável: {db.cashRegister.openedBy} · Fundo inicial:{' '}
              <span className="font-mono-num font-medium text-zinc-800">
                {formatBRL(db.cashRegister.openingBalance)}
              </span>
            </p>
            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onNavigate('cashflow')}
                className="text-xs font-medium text-zinc-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Conferir Fluxo de Caixa</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Stock & Finance Alerts */}
          <div className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900">
              Pendências e Alertas de Gestão
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900">
                    Reposição de Estoque
                  </span>
                  <span className="text-xs font-mono-num font-semibold text-amber-700">
                    {stats.lowStockProducts.length} itens críticos
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  {stats.lowStockProducts.length > 0
                    ? stats.lowStockProducts.map((p) => `${p.name} (${p.stock} ${p.unit})`).join(' · ')
                    : 'Todos os produtos estão acima do estoque mínimo de segurança.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="mt-2 text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
                >
                  Regularizar Estoque →
                </button>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900">
                    Contas Vencidas / Pendentes
                  </span>
                  <span className="text-xs font-mono-num font-semibold text-red-700">
                    {stats.overdueAccounts.length} títulos
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-1">
                  {stats.overdueAccounts.length > 0
                    ? stats.overdueAccounts.map((a) => `${a.title} (${formatBRL(a.amount)})`).join(' · ')
                    : 'Nenhuma conta em atraso no momento.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('accounts')}
                  className="mt-2 text-xs font-medium text-zinc-900 hover:underline cursor-pointer"
                >
                  Acessar Contas a Pagar/Receber →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. AGENDA (APPOINTMENTS)
// ============================================================================
export const AgendaModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
  onNavigate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [profFilter, setProfFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [clientId, setClientId] = useState(db.clients[0]?.id || '');
  const [professionalId, setProfessionalId] = useState(db.professionals[0]?.id || '');
  const [serviceId, setServiceId] = useState(db.services[0]?.id || '');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [status, setStatus] = useState<Appointment['status']>('scheduled');
  const [notes, setNotes] = useState('');

  const filteredAppointments = useMemo(() => {
    return db.appointments
      .filter((a) => {
        if (selectedDate && a.date !== selectedDate) return false;
        if (profFilter !== 'all' && a.professionalId !== profFilter) return false;
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            a.clientName.toLowerCase().includes(q) ||
            a.serviceName.toLowerCase().includes(q) ||
            a.professionalName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [db.appointments, selectedDate, profFilter, statusFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingApt(null);
    setClientId(db.clients[0]?.id || '');
    setProfessionalId(db.professionals[0]?.id || '');
    setServiceId(db.services[0]?.id || '');
    setDate(selectedDate || todayStr);
    setStartTime('10:00');
    setStatus('scheduled');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (apt: Appointment) => {
    setEditingApt(apt);
    setClientId(apt.clientId);
    setProfessionalId(apt.professionalId);
    setServiceId(apt.serviceId);
    setDate(apt.date);
    setStartTime(apt.startTime);
    setStatus(apt.status);
    setNotes(apt.notes);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !professionalId || !serviceId || !date || !startTime) {
      notify('error', 'Validação da Agenda', 'Preencha todos os campos obrigatórios do horário.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingApt) {
        const client = db.clients.find((c) => c.id === clientId);
        const prof = db.professionals.find((p) => p.id === professionalId);
        const srv = db.services.find((s) => s.id === serviceId);
        const res = await apiRequest(`/api/appointments/${editingApt.id}`, 'PUT', {
          clientId,
          clientName: client?.name || editingApt.clientName,
          clientPhone: client?.phone || editingApt.clientPhone,
          professionalId,
          professionalName: prof?.name || editingApt.professionalName,
          serviceId,
          serviceName: srv?.name || editingApt.serviceName,
          price: srv?.price || editingApt.price,
          date,
          startTime,
          status,
          notes,
        });
        if (res) {
          notify('success', 'Horário Atualizado', 'Os dados do agendamento foram salvos.');
          setIsModalOpen(false);
          await refreshData();
        }
      } else {
        const res = await apiRequest('/api/appointments', 'POST', {
          clientId,
          professionalId,
          serviceId,
          date,
          startTime,
          status,
          notes,
        });
        if (res) {
          notify('success', 'Horário Agendado', 'O novo agendamento foi registrado na grade.');
          setIsModalOpen(false);
          setSelectedDate(date);
          await refreshData();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatus = async (apt: Appointment, nextStatus: Appointment['status']) => {
    const res = await apiRequest(`/api/appointments/${apt.id}`, 'PUT', { status: nextStatus });
    if (res) {
      notify(
        'success',
        'Status Atualizado',
        `Agendamento de ${apt.clientName} alterado para ${nextStatus}.`
      );
      await refreshData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/appointments/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Agendamento Removido', `O horário de ${deleteTarget.clientName} foi excluído.`);
        setDeleteTarget(null);
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Agenda & Grade de Horários
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Controle de ocupação por especialista, validação de conflito e status de atendimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDate('')}
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              selectedDate === ''
                ? 'bg-zinc-900 text-white border-zinc-900'
                : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
            }`}
          >
            Todas as Datas
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Data da Agenda</label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 font-mono-num"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Especialista</label>
          <select
            value={profFilter}
            onChange={(e) => setProfFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
          >
            <option value="all">Todos os Profissionais</option>
            {db.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
          >
            <option value="all">Todos os Status</option>
            <option value="scheduled">Agendado</option>
            <option value="confirmed">Confirmado</option>
            <option value="in_progress">Em Atendimento</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Buscar Cliente / Serviço</label>
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nome ou protocolo..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
            />
          </div>
        </div>
      </div>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado para os filtros selecionados"
          description="Altere a data selecionada ou registre um novo agendamento para um cliente."
          actionLabel="Agendar Horário"
          onAction={openCreateModal}
        />
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                  <th className="py-3 px-4">Data & Horário</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Serviço / Protocolo</th>
                  <th className="py-3 px-4">Especialista</th>
                  <th className="py-3 px-4">Status & Pagamento</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">
                      <p className="font-semibold text-zinc-900">
                        {apt.startTime} às {apt.endTime}
                      </p>
                      <p className="text-[11px] text-zinc-500">{formatDateBR(apt.date)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-zinc-900">{apt.clientName}</p>
                      <p className="text-[11px] text-zinc-500 font-mono-num">{apt.clientPhone}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-zinc-900">{apt.serviceName}</p>
                      {apt.notes && (
                        <p className="text-[11px] text-zinc-500 truncate max-w-xs">{apt.notes}</p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-800 whitespace-nowrap">
                      {apt.professionalName}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          apt.status === 'completed'
                            ? 'text-emerald-700'
                            : apt.status === 'in_progress'
                            ? 'text-amber-700'
                            : apt.status === 'cancelled'
                            ? 'text-red-600'
                            : 'text-zinc-800'
                        }`}
                      >
                        {apt.status === 'scheduled'
                          ? 'Agendado'
                          : apt.status === 'confirmed'
                          ? 'Confirmado'
                          : apt.status === 'in_progress'
                          ? 'Em Cadeira'
                          : apt.status === 'completed'
                          ? 'Concluído'
                          : 'Cancelado'}
                      </span>
                      <span className="mx-1.5 text-zinc-300">·</span>
                      <span className="text-[11px] text-zinc-500">
                        {apt.paymentStatus === 'paid' ? 'Liquidado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                      {formatBRL(apt.price)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(apt, 'completed')}
                            title="Concluir Atendimento"
                            className="px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                          >
                            Concluir
                          </button>
                        )}
                        {apt.paymentStatus !== 'paid' && apt.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => onNavigate('sales')}
                            title="Faturar no PDV"
                            className="px-2.5 py-1 text-[11px] font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer"
                          >
                            PDV
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(apt)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                          title="Editar agendamento"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(apt)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                          title="Excluir agendamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Create/Edit Appointment */}
      <Modal
        isOpen={isModalOpen}
        title={editingApt ? 'Editar Agendamento' : 'Novo Agendamento na Grade'}
        subtitle="O sistema verifica conflitos de horário automaticamente para o mesmo especialista."
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Cliente *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
                required
              >
                {db.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Especialista *</label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
                required
              >
                {db.professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.specialty}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Serviço / Protocolo *</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
              required
            >
              {db.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} min — {formatBRL(s.price)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Data *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Horário Inicial *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Appointment['status'])}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
              >
                <option value="scheduled">Agendado</option>
                <option value="confirmed">Confirmado</option>
                <option value="in_progress">Em Atendimento</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Observações Técnicas / Fórmulas
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Alergia a amônia, preferência de bebida, numeração de tonalizante..."
              className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : editingApt ? 'Salvar Alterações' : 'Confirmar Agendamento'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Excluir Agendamento"
        description={`Tem certeza que deseja excluir permanentemente o agendamento de "${deleteTarget?.clientName}" em ${formatDateBR(deleteTarget?.date || '')} às ${deleteTarget?.startTime}?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 3. CLIENTES (CRM & ANAMNESE)
// ============================================================================
export const ClientsModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('1992-05-15');
  const [tier, setTier] = useState<Client['tier']>('Standard');
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');

  const filteredClients = useMemo(() => {
    return db.clients.filter((c) => {
      if (tierFilter !== 'all' && c.tier !== tierFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.cpf.includes(q)
        );
      }
      return true;
    });
  }, [db.clients, search, tierFilter]);

  const openCreate = () => {
    setEditingClient(null);
    setName('');
    setEmail('');
    setPhone('');
    setCpf('');
    setBirthDate('1992-05-15');
    setTier('Standard');
    setAllergies('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditingClient(c);
    setName(c.name);
    setEmail(c.email);
    setPhone(c.phone);
    setCpf(c.cpf);
    setBirthDate(c.birthDate);
    setTier(c.tier);
    setAllergies(c.allergies);
    setNotes(c.notes);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3 || phone.trim().length < 8) {
      notify('error', 'Dados Inválidos', 'Informe nome completo (mín. 3 letras) e telefone válido.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = { name, email, phone, cpf, birthDate, tier, allergies, notes };
      if (editingClient) {
        const res = await apiRequest(`/api/clients/${editingClient.id}`, 'PUT', payload);
        if (res) {
          notify('success', 'Cliente Atualizada', `Ficha de ${name} atualizada com sucesso.`);
          setIsModalOpen(false);
          await refreshData();
        }
      } else {
        const res = await apiRequest('/api/clients', 'POST', payload);
        if (res) {
          notify('success', 'Cliente Cadastrada', `${name} foi adicionada à base do salão.`);
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
      const res = await apiRequest(`/api/clients/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Cliente Excluída', `O cadastro de ${deleteTarget.name} foi removido.`);
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
            Clientes & Ficha de Anamnese
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Histórico de consumo, classificação de fidelidade (Signature, Gold, Standard) e restrições químicas
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, CPF ou e-mail..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          {(['all', 'Signature', 'Gold', 'Standard'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tierFilter === t ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {t === 'all' ? 'Todas' : t}
            </button>
          ))}
        </div>
      </div>

      {filteredClients.length === 0 ? (
        <EmptyState
          title="Nenhuma cliente localizada"
          description="Verifique os termos de busca ou cadastre uma nova ficha de cliente."
          actionLabel="Cadastrar Cliente"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                  <th className="py-3 px-4">Cliente & Categoria</th>
                  <th className="py-3 px-4">Contato & Documento</th>
                  <th className="py-3 px-4">Alergias / Anamnese</th>
                  <th className="py-3 px-4 text-right">Visitas</th>
                  <th className="py-3 px-4 text-right">Total Investido</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredClients.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-zinc-900">{c.name}</p>
                      <p className="text-[11px] text-zinc-500">
                        Categoria <span className="font-semibold text-amber-800">{c.tier}</span> · Última visita: {formatDateBR(c.lastVisit)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 font-mono-num">
                      <p className="text-zinc-800">{c.phone}</p>
                      <p className="text-[11px] text-zinc-500">{c.email || c.cpf}</p>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-zinc-800 truncate">{c.allergies || 'Nenhuma relatada'}</p>
                      {c.notes && <p className="text-[11px] text-zinc-500 truncate">{c.notes}</p>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-medium text-zinc-800">
                      {c.visitsCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900">
                      {formatBRL(c.totalSpent)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                          title="Editar ficha"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        title={editingClient ? 'Editar Ficha da Cliente' : 'Nova Ficha de Cliente'}
        subtitle="Mantenha os dados de sensibilidade química atualizados para segurança técnica."
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Beatriz Monteiro"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Telefone / WhatsApp *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Classificação</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Client['tier'])}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="Standard">Standard</option>
                <option value="Gold">Gold</option>
                <option value="Signature">Signature VIP</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Restrições Alérgicas & Sensibilidades Químicas
            </label>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Ex.: Sensibilidade a amônia, formol, ácidos..."
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Preferências de Atendimento & Anotações
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Histórico de coloração, preferências de hospitalidade..."
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Ficha'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Excluir Cadastro de Cliente"
        description={`Confirmar a exclusão permanente da ficha de "${deleteTarget?.name}"? Esta operação é auditada.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 4. PROFISSIONAIS (ESPECIALISTAS)
// ============================================================================
export const ProfessionalsModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Professional | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [documentRegistry, setDocumentRegistry] = useState('');
  const [defaultCommission, setDefaultCommission] = useState(40);
  const [workHours, setWorkHours] = useState('09:00 às 19:00');
  const [status, setStatus] = useState<Professional['status']>('active');
  const [bio, setBio] = useState('');

  const filtered = useMemo(() => {
    return db.professionals.filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.specialty.toLowerCase().includes(q);
    });
  }, [db.professionals, search]);

  const openCreate = () => {
    setEditingProf(null);
    setName('');
    setSpecialty('');
    setEmail('');
    setPhone('');
    setDocumentRegistry('');
    setDefaultCommission(40);
    setWorkHours('09:00 às 19:00');
    setStatus('active');
    setBio('');
    setIsModalOpen(true);
  };

  const openEdit = (p: Professional) => {
    setEditingProf(p);
    setName(p.name);
    setSpecialty(p.specialty);
    setEmail(p.email);
    setPhone(p.phone);
    setDocumentRegistry(p.documentRegistry);
    setDefaultCommission(p.defaultCommission);
    setWorkHours(p.workHours);
    setStatus(p.status);
    setBio(p.bio);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3 || !specialty.trim()) {
      notify('error', 'Validação', 'Nome e especialidade técnica são obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        specialty,
        email,
        phone,
        documentRegistry,
        defaultCommission: Number(defaultCommission),
        workHours,
        status,
        bio,
      };
      if (editingProf) {
        const res = await apiRequest(`/api/professionals/${editingProf.id}`, 'PUT', payload);
        if (res) {
          notify('success', 'Especialista Atualizado', `Cadastro de ${name} atualizado.`);
          setIsModalOpen(false);
          await refreshData();
        }
      } else {
        const res = await apiRequest('/api/professionals', 'POST', payload);
        if (res) {
          notify('success', 'Especialista Cadastrado', `${name} foi integrado à equipe.`);
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
      const res = await apiRequest(`/api/professionals/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Profissional Removido', `${deleteTarget.name} foi removido do quadro.`);
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
            Quadro de Profissionais & Especialistas
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gestão de comissionamento base, jornada de atendimento, registro MEI/Conselho e produtividade
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Profissional</span>
        </button>
      </div>

      <div className="bg-white border border-zinc-200/80 rounded-xl p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar especialista por nome ou área técnica..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum profissional encontrado"
          description="Cadastre os especialistas do salão para vincular agendas e comissões."
          actionLabel="Novo Profissional"
          onAction={openCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-zinc-200/80 rounded-xl p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900">{p.name}</h3>
                    <p className="text-xs font-medium text-amber-800 mt-0.5">{p.specialty}</p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      p.status === 'active'
                        ? 'text-emerald-700'
                        : p.status === 'vacation'
                        ? 'text-amber-700'
                        : 'text-zinc-400'
                    }`}
                  >
                    {p.status === 'active' ? 'Ativo' : p.status === 'vacation' ? 'Férias' : 'Inativo'}
                  </span>
                </div>

                <p className="text-xs text-zinc-600 mt-3 leading-relaxed">{p.bio}</p>

                <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Comissão Base</span>
                    <span className="font-mono-num font-semibold text-zinc-900">
                      {p.defaultCommission}%
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Atendimentos</span>
                    <span className="font-mono-num font-semibold text-zinc-900">
                      {p.completedAppointments}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[11px]">Horário</span>
                    <span className="font-mono-num font-medium text-zinc-800">{p.workHours}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                <span className="font-mono-num">{p.documentRegistry || p.phone}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(p)}
                    className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        title={editingProf ? 'Editar Especialista' : 'Cadastrar Especialista'}
        onClose={() => setIsModalOpen(false)}
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
              <label className="block text-xs font-medium text-zinc-700 mb-1">Especialidade Técnica *</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ex.: Master Hairstylist & Colorista"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Telefone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Comissão Padrão (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultCommission}
                onChange={(e) => setDefaultCommission(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Professional['status'])}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="active">Ativo</option>
                <option value="vacation">Em Férias</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Registro MEI / Conselho</label>
              <input
                type="text"
                value={documentRegistry}
                onChange={(e) => setDocumentRegistry(e.target.value)}
                placeholder="CNPJ Parceiro Salão-Parceiro"
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Jornada Horária</label>
              <input
                type="text"
                value={workHours}
                onChange={(e) => setWorkHours(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Currículo Resumido / Bio</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
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
              {isSubmitting ? 'Salvando...' : 'Salvar Profissional'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Remover Profissional"
        description={`Deseja remover "${deleteTarget?.name}" do quadro de especialistas?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};
