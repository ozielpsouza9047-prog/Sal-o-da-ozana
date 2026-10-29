import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  ChevronLeft,
  ChevronRight,
  History,
  ListPlus,
  Play,
  Sparkles,
} from 'lucide-react';
import type {
  AppDatabase,
  ModuleId,
  Appointment,
  Client,
  Professional,
  WaitlistEntry,
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
// 2. AGENDA (DAILY, WEEKLY, MONTHLY VIEWS, REAL AVAILABILITY, HISTORY & WAITLIST)
// ============================================================================
interface AvailabilitySlotInfo {
  date: string;
  dayLabel: string;
  isWorkingDay: boolean;
  reason?: string;
  openTime?: string;
  closeTime?: string;
  durationMinutes?: number;
  availableSlots: Array<{ startTime: string; endTime: string }>;
  occupiedIntervals: Array<{ startTime: string; endTime: string; clientName?: string; serviceName?: string; status?: string }>;
}

export function formatAppointmentStatusLabel(status: Appointment['status']): string {
  switch (status) {
    case 'requested':
    case 'scheduled':
      return 'Solicitado';
    case 'confirmed':
      return 'Confirmado';
    case 'in_progress':
      return 'Em Andamento';
    case 'completed':
      return 'Concluído';
    case 'cancelled':
      return 'Cancelado';
    case 'no_show':
      return 'Não Compareceu';
    default:
      return status;
  }
}

export const AgendaModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
  onNavigate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [profFilter, setProfFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Real Available Slots Explorer state (Daily panel)
  const [slotExplorerProfId, setSlotExplorerProfId] = useState(
    db.professionals.find((p) => p.status === 'active')?.id || db.professionals[0]?.id || ''
  );
  const [slotExplorerServiceId, setSlotExplorerServiceId] = useState(
    db.services.find((s) => s.status === 'active')?.id || db.services[0]?.id || ''
  );
  const [explorerAvailability, setExplorerAvailability] = useState<AvailabilitySlotInfo | null>(null);
  const [isLoadingExplorerSlots, setIsLoadingExplorerSlots] = useState(false);

  // Create/Edit Appointment Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [historyApt, setHistoryApt] = useState<Appointment | null>(null);
  const [cancelModalApt, setCancelModalApt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [convertingWaitlistId, setConvertingWaitlistId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Appointment Form state
  const [clientId, setClientId] = useState(db.clients[0]?.id || '');
  const [professionalId, setProfessionalId] = useState(db.professionals[0]?.id || '');
  const [serviceId, setServiceId] = useState(db.services[0]?.id || '');
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [status, setStatus] = useState<Appointment['status']>('confirmed');
  const [notes, setNotes] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [modalAvailability, setModalAvailability] = useState<AvailabilitySlotInfo | null>(null);
  const [isLoadingModalSlots, setIsLoadingModalSlots] = useState(false);

  // Waitlist Modal state
  const [isWaitlistModalOpen, setIsWaitlistModalOpen] = useState(false);
  const [wltClientId, setWltClientId] = useState(db.clients[0]?.id || '');
  const [wltServiceId, setWltServiceId] = useState(db.services[0]?.id || '');
  const [wltProfId, setWltProfId] = useState('any');
  const [wltDate, setWltDate] = useState(todayStr);
  const [wltPeriod, setWltPeriod] = useState<WaitlistEntry['preferredPeriod']>('Qualquer Horário');
  const [wltTimesInput, setWltTimesInput] = useState('10:00, 14:00');
  const [wltNotes, setWltNotes] = useState('');

  // Fetch real deduplicated slots for the Explorer Panel
  const fetchExplorerAvailability = useCallback(async () => {
    const targetDate = selectedDate || todayStr;
    if (!slotExplorerProfId || !slotExplorerServiceId || !targetDate) return;
    setIsLoadingExplorerSlots(true);
    try {
      const params = new URLSearchParams({
        date: targetDate,
        professionalId: slotExplorerProfId,
        serviceId: slotExplorerServiceId,
      });
      const res = await fetch(`/api/public/availability?${params.toString()}`);
      if (res.ok) {
        const data: AvailabilitySlotInfo = await res.json();
        setExplorerAvailability(data);
      }
    } catch {
      setExplorerAvailability(null);
    } finally {
      setIsLoadingExplorerSlots(false);
    }
  }, [selectedDate, todayStr, slotExplorerProfId, slotExplorerServiceId]);

  useEffect(() => {
    fetchExplorerAvailability();
  }, [fetchExplorerAvailability, db.appointments]);

  // Fetch real deduplicated slots inside the Create/Edit Appointment Modal
  useEffect(() => {
    if (!isModalOpen || !professionalId || !serviceId || !date) return;
    let active = true;
    const loadModalSlots = async () => {
      setIsLoadingModalSlots(true);
      try {
        const params = new URLSearchParams({
          date,
          professionalId,
          serviceId,
        });
        if (editingApt) {
          params.set('excludeAppointmentId', editingApt.id);
        }
        const res = await fetch(`/api/public/availability?${params.toString()}`);
        if (active && res.ok) {
          const data: AvailabilitySlotInfo = await res.json();
          setModalAvailability(data);
          // If creating a new appointment and current startTime is not available, auto-select first available slot
          if (
            !editingApt &&
            data.availableSlots.length > 0 &&
            !data.availableSlots.some((s) => s.startTime === startTime)
          ) {
            setStartTime(data.availableSlots[0].startTime);
          }
        }
      } finally {
        if (active) setIsLoadingModalSlots(false);
      }
    };
    loadModalSlots();
    return () => {
      active = false;
    };
  }, [isModalOpen, professionalId, serviceId, date, editingApt]);

  // Compute Week Days (Sunday to Saturday around selectedDate)
  const weekDays = useMemo(() => {
    const baseStr = selectedDate || todayStr;
    const [yy, mm, dd] = baseStr.split('-').map(Number);
    const baseDate = new Date(yy, (mm || 1) - 1, dd || 1);
    const dayOfWeek = baseDate.getDay(); // 0 = Sun
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);

    const names = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const result: Array<{ iso: string; dayNum: string; weekLabel: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      result.push({
        iso,
        dayNum: String(d.getDate()).padStart(2, '0'),
        weekLabel: names[i],
      });
    }
    return result;
  }, [selectedDate, todayStr]);

  // Compute Month Grid around selectedDate
  const monthCalendar = useMemo(() => {
    const baseStr = selectedDate || todayStr;
    const [yy, mm] = baseStr.split('-').map(Number);
    const year = yy || new Date().getFullYear();
    const month = (mm || 1) - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const monthNames = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];

    const cells: Array<{ iso: string | null; dayNum?: number }> = [];
    for (let i = 0; i < startPadding; i++) {
      cells.push({ iso: null });
    }
    for (let d = 1; d <= totalDays; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ iso, dayNum: d });
    }
    return {
      title: `${monthNames[month]} de ${year}`,
      year,
      month,
      cells,
    };
  }, [selectedDate, todayStr]);

  const shiftDate = (daysDelta: number) => {
    const baseStr = selectedDate || todayStr;
    const [yy, mm, dd] = baseStr.split('-').map(Number);
    const d = new Date(yy, (mm || 1) - 1, (dd || 1) + daysDelta);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    setSelectedDate(iso);
  };

  const shiftMonth = (monthsDelta: number) => {
    const baseStr = selectedDate || todayStr;
    const [yy, mm] = baseStr.split('-').map(Number);
    const d = new Date(yy, (mm || 1) - 1 + monthsDelta, 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    setSelectedDate(iso);
  };

  // Base filtered appointments (respecting professional, status, and search filters)
  const baseFilteredAppointments = useMemo(() => {
    return db.appointments.filter((a) => {
      if (profFilter !== 'all' && a.professionalId !== profFilter) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'requested') {
          if (a.status !== 'requested' && a.status !== 'scheduled') return false;
        } else if (a.status !== statusFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.clientName.toLowerCase().includes(q) ||
          a.serviceName.toLowerCase().includes(q) ||
          a.professionalName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [db.appointments, profFilter, statusFilter, searchQuery]);

  const filteredAppointments = useMemo(() => {
    return baseFilteredAppointments
      .filter((a) => {
        if (viewMode === 'day') return a.date === (selectedDate || todayStr);
        if (viewMode === 'week') {
          const startIso = weekDays[0].iso;
          const endIso = weekDays[6].iso;
          return a.date >= startIso && a.date <= endIso;
        }
        if (viewMode === 'month') {
          const prefix = (selectedDate || todayStr).slice(0, 7);
          return a.date.startsWith(prefix);
        }
        return true;
      })
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  }, [baseFilteredAppointments, viewMode, selectedDate, todayStr, weekDays]);

  const openCreateModal = (prefill?: {
    date?: string;
    startTime?: string;
    professionalId?: string;
    serviceId?: string;
    clientId?: string;
    notes?: string;
    waitlistId?: string;
  }) => {
    setEditingApt(null);
    setConvertingWaitlistId(prefill?.waitlistId || null);
    setClientId(prefill?.clientId || db.clients[0]?.id || '');
    setProfessionalId(
      prefill?.professionalId && prefill.professionalId !== 'any'
        ? prefill.professionalId
        : slotExplorerProfId || db.professionals[0]?.id || ''
    );
    setServiceId(prefill?.serviceId || slotExplorerServiceId || db.services[0]?.id || '');
    setDate(prefill?.date || selectedDate || todayStr);
    setStartTime(prefill?.startTime || '10:00');
    setStatus('confirmed');
    setNotes(prefill?.notes || '');
    setRescheduleReason('');
    setIsModalOpen(true);
  };

  const openEditModal = (apt: Appointment) => {
    setEditingApt(apt);
    setConvertingWaitlistId(null);
    setClientId(apt.clientId);
    setProfessionalId(apt.professionalId);
    setServiceId(apt.serviceId);
    setDate(apt.date);
    setStartTime(apt.startTime);
    setStatus(apt.status);
    setNotes(apt.notes);
    setRescheduleReason('');
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
        const res = await apiRequest<Appointment>(`/api/appointments/${editingApt.id}`, 'PUT', {
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
          reason: rescheduleReason || undefined,
        });
        if (res) {
          notify('success', 'Horário Atualizado', 'Os dados e o histórico do agendamento foram salvos.');
          setIsModalOpen(false);
          await refreshData();
          await fetchExplorerAvailability();
        }
      } else {
        const res = await apiRequest<Appointment>('/api/appointments', 'POST', {
          clientId,
          professionalId,
          serviceId,
          date,
          startTime,
          status,
          notes,
        });
        if (res) {
          if (convertingWaitlistId) {
            await apiRequest(`/api/waitlist/${convertingWaitlistId}`, 'PUT', {
              status: 'booked',
            });
          }
          notify('success', 'Horário Agendado', 'O novo agendamento foi registrado na grade.');
          setIsModalOpen(false);
          setConvertingWaitlistId(null);
          setSelectedDate(date);
          await refreshData();
          await fetchExplorerAvailability();
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatus = async (
    apt: Appointment,
    nextStatus: Appointment['status'],
    reason?: string
  ) => {
    const res = await apiRequest<Appointment>(`/api/appointments/${apt.id}`, 'PUT', {
      status: nextStatus,
      reason,
    });
    if (res) {
      notify(
        'success',
        'Status Atualizado',
        `Agendamento de ${apt.clientName} alterado para "${formatAppointmentStatusLabel(nextStatus)}".`
      );
      await refreshData();
      await fetchExplorerAvailability();
    }
  };

  const handleConfirmCancelWithReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalApt) return;
    setIsSubmitting(true);
    try {
      await handleQuickStatus(
        cancelModalApt,
        'cancelled',
        cancelReason.trim() || 'Cancelado pela recepção/administração.'
      );
      setCancelModalApt(null);
      setCancelReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/appointments/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify(
          'warning',
          'Agendamento Removido',
          `O horário de ${deleteTarget.clientName} foi excluído e a vaga liberada.`
        );
        setDeleteTarget(null);
        await refreshData();
        await fetchExplorerAvailability();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wltClientId || !wltServiceId || !wltDate) {
      notify('error', 'Fila de Espera', 'Selecione cliente, serviço e data desejada.');
      return;
    }
    setIsSubmitting(true);
    try {
      const preferredTimes = wltTimesInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await apiRequest<WaitlistEntry>('/api/waitlist', 'POST', {
        clientId: wltClientId,
        serviceId: wltServiceId,
        professionalId: wltProfId,
        desiredDate: wltDate,
        preferredPeriod: wltPeriod,
        preferredTimes,
        notes: wltNotes,
      });
      if (res) {
        notify(
          'success',
          'Incluído na Fila de Espera',
          `${res.clientName} foi registrada(o) na fila de espera para ${formatDateBR(res.desiredDate)}.`
        );
        setIsWaitlistModalOpen(false);
        setWltNotes('');
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWaitlistStatus = async (wlt: WaitlistEntry, nextStatus: WaitlistEntry['status']) => {
    const res = await apiRequest(`/api/waitlist/${wlt.id}`, 'PUT', { status: nextStatus });
    if (res) {
      notify('success', 'Fila de Espera Atualizada', `Solicitação de ${wlt.clientName} marcada como ${nextStatus}.`);
      await refreshData();
    }
  };

  const renderStatusPill = (st: Appointment['status']) => {
    const styles: Record<string, string> = {
      requested: 'bg-purple-50 text-purple-900 border-purple-200',
      scheduled: 'bg-purple-50 text-purple-900 border-purple-200',
      confirmed: 'bg-blue-50 text-blue-800 border-blue-200',
      in_progress: 'bg-amber-100 text-amber-950 border-amber-300',
      completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      cancelled: 'bg-red-50 text-red-700 border-red-200',
      no_show: 'bg-zinc-200 text-zinc-700 border-zinc-300',
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
          styles[st] || styles.scheduled
        }`}
      >
        {formatAppointmentStatusLabel(st)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & View Mode Switcher (Diária, Semanal, Mensal, Lista) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Agenda & Grade Inteligente de Horários
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Visualização diária, semanal e mensal, vagas reais por duração, histórico de remarcações e fila de espera
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            {(
              [
                { id: 'day', label: 'Diária' },
                { id: 'week', label: 'Semanal' },
                { id: 'month', label: 'Mensal' },
                { id: 'all', label: 'Todos' },
              ] as const
            ).map((vm) => (
              <button
                key={vm.id}
                type="button"
                onClick={() => setViewMode(vm.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === vm.id
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {vm.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsWaitlistModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ListPlus className="w-4 h-4" />
            <span>+ Fila de Espera</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">
            Data de Referência
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => (viewMode === 'month' ? shiftMonth(-1) : shiftDate(viewMode === 'week' ? -7 : -1))}
              className="p-2 text-zinc-600 hover:bg-zinc-100 border border-zinc-200 rounded-lg cursor-pointer"
              title="Período anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayStr)}
              className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900 font-mono-num"
            />
            <button
              type="button"
              onClick={() => (viewMode === 'month' ? shiftMonth(1) : shiftDate(viewMode === 'week' ? 7 : 1))}
              className="p-2 text-zinc-600 hover:bg-zinc-100 border border-zinc-200 rounded-lg cursor-pointer"
              title="Próximo período"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">Especialista</label>
          <select
            value={profFilter}
            onChange={(e) => {
              setProfFilter(e.target.value);
              if (e.target.value !== 'all') setSlotExplorerProfId(e.target.value);
            }}
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
            <option value="requested">Solicitado</option>
            <option value="confirmed">Confirmado</option>
            <option value="in_progress">Em Andamento</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-500 mb-1">
            Buscar Cliente / Serviço
          </label>
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

      {/* =====================================================================
          REAL DEDUPLICATED AVAILABLE SLOTS PANEL (BY PROFESSIONAL & DURATION)
         ===================================================================== */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-800" />
              <h2 className="text-sm font-semibold text-zinc-900">
                Vagas Reais Disponíveis em {formatDateBR(selectedDate || todayStr)} (Sem Duplicidade)
              </h2>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Calculadas em tempo real pelo servidor conforme expediente do profissional, duração do serviço e bloqueio de conflitos. Clique em um horário livre para agendar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={slotExplorerProfId}
              onChange={(e) => setSlotExplorerProfId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg font-medium"
            >
              {db.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.workHours})
                </option>
              ))}
            </select>

            <select
              value={slotExplorerServiceId}
              onChange={(e) => setSlotExplorerServiceId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg font-medium"
            >
              {db.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMinutes} min)
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingExplorerSlots ? (
          <p className="text-xs text-zinc-500 py-2">Consultando disponibilidade real no servidor...</p>
        ) : !explorerAvailability?.isWorkingDay ? (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between gap-3">
            <span>
              {explorerAvailability?.reason || 'Profissional não atende nesta data.'}
            </span>
            <button
              type="button"
              onClick={() => {
                setWltDate(selectedDate || todayStr);
                setWltProfId(slotExplorerProfId);
                setWltServiceId(slotExplorerServiceId);
                setIsWaitlistModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/70 hover:bg-amber-200 rounded-lg shrink-0 cursor-pointer"
            >
              Registrar na Fila de Espera
            </button>
          </div>
        ) : explorerAvailability.availableSlots.length === 0 ? (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-center justify-between gap-3">
            <span>
              Agenda completa para este profissional em {formatDateBR(selectedDate || todayStr)} considerando a duração de {explorerAvailability.durationMinutes} min.
            </span>
            <button
              type="button"
              onClick={() => {
                setWltDate(selectedDate || todayStr);
                setWltProfId(slotExplorerProfId);
                setWltServiceId(slotExplorerServiceId);
                setIsWaitlistModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shrink-0 cursor-pointer"
            >
              Incluir na Fila de Espera
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {explorerAvailability.availableSlots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() =>
                    openCreateModal({
                      date: selectedDate || todayStr,
                      startTime: slot.startTime,
                      professionalId: slotExplorerProfId,
                      serviceId: slotExplorerServiceId,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg font-mono-num text-xs font-semibold bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition-colors cursor-pointer"
                  title={`Agendar das ${slot.startTime} às ${slot.endTime}`}
                >
                  {slot.startTime} <span className="text-[10px] text-emerald-700 font-normal">→ {slot.endTime}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-zinc-500">
              {explorerAvailability.availableSlots.length} horários reais disponíveis ·{' '}
              {explorerAvailability.occupiedIntervals.length} intervalos ocupados nesta data.
            </p>
          </div>
        )}
      </div>

      {/* =====================================================================
          WEEKLY CALENDAR VIEW
         ===================================================================== */}
      {viewMode === 'week' && (
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Grade Semanal ({formatDateBR(weekDays[0].iso)} a {formatDateBR(weekDays[6].iso)})
              </h2>
              <p className="text-xs text-zinc-500">
                Clique em qualquer dia para inspecionar seus horários ou clique sobre um atendimento para editar/remarcar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((wd) => {
              const dayApts = baseFilteredAppointments
                .filter((a) => a.date === wd.iso)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isSelected = wd.iso === selectedDate;
              const isToday = wd.iso === todayStr;

              return (
                <div
                  key={wd.iso}
                  className={`rounded-xl border p-3 flex flex-col justify-between min-h-[210px] transition-colors ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-50/70'
                      : 'border-zinc-200/80 bg-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(wd.iso);
                          setViewMode('day');
                        }}
                        className="text-left cursor-pointer group"
                      >
                        <span className="text-[10px] font-mono-num uppercase text-zinc-500 block">
                          {wd.weekLabel}
                        </span>
                        <span className="text-sm font-mono-num font-bold text-zinc-900 group-hover:text-amber-800">
                          {wd.dayNum}/{wd.iso.slice(5, 7)}
                        </span>
                      </button>
                      {isToday && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 rounded">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {dayApts.length === 0 ? (
                        <p className="text-[11px] text-zinc-400 py-4 text-center">Livre</p>
                      ) : (
                        dayApts.map((apt) => (
                          <button
                            key={apt.id}
                            type="button"
                            onClick={() => openEditModal(apt)}
                            className={`w-full text-left p-2 rounded-lg border text-[11px] transition-colors cursor-pointer ${
                              apt.status === 'cancelled'
                                ? 'bg-red-50/50 border-red-200 text-zinc-500 line-through'
                                : apt.status === 'completed'
                                ? 'bg-emerald-50/60 border-emerald-200 text-zinc-900'
                                : apt.status === 'in_progress'
                                ? 'bg-amber-50 border-amber-300 text-zinc-900'
                                : 'bg-zinc-50 border-zinc-200/90 hover:border-zinc-400 text-zinc-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono-num font-semibold">
                              <span>{apt.startTime}</span>
                              <span className="text-[10px] text-zinc-500">
                                {formatAppointmentStatusLabel(apt.status)}
                              </span>
                            </div>
                            <p className="font-medium truncate mt-0.5">{apt.clientName}</p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {apt.professionalName.split(' ')[0]} · {apt.serviceName}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCreateModal({ date: wd.iso })}
                    className="mt-3 w-full py-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-100/80 hover:bg-zinc-200/70 rounded-md cursor-pointer"
                  >
                    + Agendar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MONTHLY CALENDAR VIEW
         ===================================================================== */}
      {viewMode === 'month' && (
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h2 className="font-serif-display text-lg font-semibold text-zinc-900">
                Calendário Mensal — {monthCalendar.title}
              </h2>
              <p className="text-xs text-zinc-500">
                Visão consolidada do mês. Clique em um dia para abrir a grade diária detalhada.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
              >
                ← Mês Anterior
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
              >
                Próximo Mês →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-zinc-500 pb-1">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {monthCalendar.cells.map((cell, idx) => {
              if (!cell.iso) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-24 rounded-xl bg-zinc-50/40 border border-transparent"
                  />
                );
              }
              const dayApts = baseFilteredAppointments.filter((a) => a.date === cell.iso);
              const activeCount = dayApts.filter((a) => a.status !== 'cancelled').length;
              const cancelledCount = dayApts.filter((a) => a.status === 'cancelled').length;
              const isSelected = cell.iso === selectedDate;
              const isToday = cell.iso === todayStr;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(cell.iso!);
                    setViewMode('day');
                  }}
                  className={`h-24 rounded-xl border p-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : isToday
                      ? 'border-amber-400 bg-amber-50/40 text-zinc-900'
                      : 'border-zinc-200/80 hover:border-zinc-400 bg-white text-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono-num text-xs font-bold">{cell.dayNum}</span>
                    {activeCount > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-mono-num font-semibold ${
                          isSelected
                            ? 'bg-amber-400 text-zinc-950'
                            : 'bg-zinc-900 text-white'
                        }`}
                      >
                        {activeCount} hor.
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 overflow-hidden">
                    {dayApts.slice(0, 2).map((a) => (
                      <p
                        key={a.id}
                        className={`text-[10px] truncate ${
                          isSelected ? 'text-zinc-200' : 'text-zinc-600'
                        }`}
                      >
                        {a.startTime} {a.clientName.split(' ')[0]}
                      </p>
                    ))}
                    {cancelledCount > 0 && (
                      <p className="text-[9px] text-red-500 font-medium">
                        {cancelledCount} cancelado(s)
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          APPOINTMENTS TABLE (FOR ACTIVE VIEW PERIOD)
         ===================================================================== */}
      {filteredAppointments.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento encontrado para este período/filtro"
          description="Selecione um horário livre no painel de vagas reais acima ou clique em Novo Agendamento."
          actionLabel="Agendar Horário"
          onAction={() => openCreateModal()}
        />
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Listagem de Atendimentos ({filteredAppointments.length})
            </h3>
            <span className="text-[11px] text-zinc-400">
              Política de cancelamento/remarcação: mín. {db.settings.cancellationNoticeHours ?? 4}h de antecedência
            </span>
          </div>
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
                  <th className="py-3 px-4 text-right">Fluxo & Ações</th>
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
                      {apt.cancellationReason && apt.status === 'cancelled' && (
                        <p className="text-[11px] text-red-600 truncate max-w-xs">
                          Motivo: {apt.cancellationReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-zinc-800 whitespace-nowrap">
                      {apt.professionalName}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {renderStatusPill(apt.status)}
                        <span className="text-[11px] text-zinc-500">
                          · {apt.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                      {formatBRL(apt.price)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {(apt.status === 'requested' || apt.status === 'scheduled') && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(apt, 'confirmed')}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                            title="Confirmar solicitação de agendamento"
                          >
                            Confirmar
                          </button>
                        )}
                        {apt.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(apt, 'in_progress')}
                            className="px-2 py-1 text-[11px] font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md cursor-pointer"
                            title="Iniciar atendimento na cadeira"
                          >
                            Iniciar
                          </button>
                        )}
                        {(apt.status === 'confirmed' || apt.status === 'in_progress') && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(apt, 'completed')}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                            title="Concluir Atendimento"
                          >
                            Concluir
                          </button>
                        )}
                        {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalApt(apt);
                              setCancelReason('');
                            }}
                            className="px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                            title="Cancelar agendamento com registro no histórico"
                          >
                            Cancelar
                          </button>
                        )}
                        {apt.paymentStatus !== 'paid' && apt.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => onNavigate('sales')}
                            title="Faturar no PDV"
                            className="px-2 py-1 text-[11px] font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer"
                          >
                            PDV
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setHistoryApt(apt)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                          title="Ver histórico de alterações do agendamento"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(apt)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md transition-colors cursor-pointer"
                          title="Editar ou remarcar agendamento"
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

      {/* =====================================================================
          WAITLIST MANAGEMENT SECTION (SERVICE, PROFESSIONAL, PREFERRED TIMES)
         ===================================================================== */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Fila de Espera Integrada ({(db.waitlist || []).filter((w) => w.status !== 'cancelled').length})
            </h2>
            <p className="text-xs text-zinc-500">
              Quando ocorre cancelamento ou remarcação, o sistema alerta automaticamente os clientes compatíveis desta fila.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsWaitlistModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer self-start sm:self-auto"
          >
            + Adicionar à Fila de Espera
          </button>
        </div>

        {!db.waitlist || db.waitlist.filter((w) => w.status !== 'cancelled').length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">
            Nenhuma solicitação ativa na fila de espera no momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] font-semibold text-zinc-500">
                  <th className="py-2.5 pr-4">Data Desejada & Horários Preferidos</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Serviço</th>
                  <th className="py-2.5 px-4">Especialista</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 pl-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {db.waitlist
                  .filter((w) => w.status !== 'cancelled')
                  .map((w) => (
                    <tr key={w.id} className="hover:bg-zinc-50/70">
                      <td className="py-3 pr-4 font-mono-num whitespace-nowrap">
                        <span className="font-semibold text-zinc-900">
                          {formatDateBR(w.desiredDate)}
                        </span>
                        <span className="text-zinc-300 mx-1.5">·</span>
                        <span className="text-amber-800 font-medium">{w.preferredPeriod}</span>
                        {w.preferredTimes && w.preferredTimes.length > 0 && (
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Horários: {w.preferredTimes.join(', ')}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-zinc-900">{w.clientName}</p>
                        <p className="font-mono-num text-[11px] text-zinc-500">{w.clientPhone}</p>
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-800">{w.serviceName}</td>
                      <td className="py-3 px-4 text-zinc-700">{w.professionalName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            w.status === 'notified'
                              ? 'bg-amber-100 text-amber-950 border border-amber-300'
                              : w.status === 'booked'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                          }`}
                        >
                          {w.status === 'notified'
                            ? 'Vaga Disponível / Notificado'
                            : w.status === 'booked'
                            ? 'Agendado'
                            : 'Aguardando'}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {w.status !== 'booked' && (
                            <button
                              type="button"
                              onClick={() =>
                                openCreateModal({
                                  clientId: w.clientId,
                                  serviceId: w.serviceId,
                                  professionalId: w.professionalId,
                                  date: w.desiredDate,
                                  startTime: w.preferredTimes?.[0] || '10:00',
                                  notes: w.notes,
                                  waitlistId: w.id,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-md cursor-pointer"
                            >
                              Converter em Agendamento
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUpdateWaitlistStatus(w, 'cancelled')}
                            className="px-2 py-1 text-[11px] text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL: CREATE / EDIT / RESCHEDULE APPOINTMENT
         ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        title={editingApt ? 'Editar / Remarcar Agendamento' : 'Novo Agendamento na Grade'}
        subtitle="O servidor valida automaticamente o expediente do especialista, a duração do serviço e bloqueia conflitos."
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
                    {p.name} — {p.workHours}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Serviço / Protocolo (Define a Duração do Bloco) *
            </label>
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
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Horário Inicial *
              </label>
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
                <option value="requested">Solicitado</option>
                <option value="confirmed">Confirmado</option>
                <option value="in_progress">Em Andamento</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Live Available Slots Selector inside Modal */}
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-zinc-800">
                Horários Livres Verificados para {formatDateBR(date)}:
              </span>
              {modalAvailability?.durationMinutes && (
                <span className="font-mono-num text-zinc-500">
                  Duração: {modalAvailability.durationMinutes} min
                </span>
              )}
            </div>
            {isLoadingModalSlots ? (
              <p className="text-[11px] text-zinc-500">Verificando disponibilidade...</p>
            ) : !modalAvailability?.isWorkingDay ? (
              <p className="text-[11px] text-red-700 font-medium">
                {modalAvailability?.reason || 'Especialista indisponível nesta data.'}
              </p>
            ) : modalAvailability.availableSlots.length === 0 ? (
              <p className="text-[11px] text-amber-800 font-medium">
                Nenhum horário livre restante nesta data para a duração deste serviço.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {modalAvailability.availableSlots.map((sl) => (
                  <button
                    key={sl.startTime}
                    type="button"
                    onClick={() => setStartTime(sl.startTime)}
                    className={`px-2.5 py-1 rounded-md font-mono-num text-[11px] font-semibold border cursor-pointer ${
                      startTime === sl.startTime
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {sl.startTime}
                  </button>
                ))}
              </div>
            )}
          </div>

          {editingApt && (date !== editingApt.date || startTime !== editingApt.startTime) && (
            <div>
              <label className="block text-xs font-medium text-amber-900 mb-1">
                Motivo da Remarcação (Registrado no Histórico)
              </label>
              <input
                type="text"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Ex.: Solicitação da cliente por telefone..."
                className="w-full px-3 py-2 text-xs bg-amber-50/40 border border-amber-300 rounded-lg"
              />
            </div>
          )}

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
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? 'Validando no Servidor...'
                : editingApt
                ? 'Salvar Alterações'
                : 'Confirmar Agendamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL: CANCEL APPOINTMENT WITH REASON & SALON RULES
         ===================================================================== */}
      <Modal
        isOpen={Boolean(cancelModalApt)}
        title="Cancelar Agendamento"
        subtitle={`A vaga será liberada imediatamente na disponibilidade de ${cancelModalApt?.professionalName}.`}
        onClose={() => setCancelModalApt(null)}
      >
        {cancelModalApt && (
          <form onSubmit={handleConfirmCancelWithReason} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-1">
              <p className="font-semibold text-zinc-900">
                {cancelModalApt.clientName} — {cancelModalApt.serviceName}
              </p>
              <p className="font-mono-num text-zinc-600">
                Data: {formatDateBR(cancelModalApt.date)} das {cancelModalApt.startTime} às{' '}
                {cancelModalApt.endTime}
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Motivo do Cancelamento (Obrigatório para o Histórico) *
              </label>
              <textarea
                rows={2}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setCancelModalApt(null)}
                className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer"
              >
                {isSubmitting ? 'Cancelando...' : 'Confirmar Cancelamento e Liberar Vaga'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL: APPOINTMENT AUDIT HISTORY ("HISTÓRICO DE ALTERAÇÕES")
         ===================================================================== */}
      <Modal
        isOpen={Boolean(historyApt)}
        title={`Histórico do Agendamento · ${historyApt?.clientName || ''}`}
        subtitle="Rastreabilidade completa de criação, confirmações, remarcações e cancelamentos."
        onClose={() => setHistoryApt(null)}
      >
        {historyApt && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-zinc-950 text-white text-xs flex items-center justify-between">
              <div>
                <p className="font-semibold">{historyApt.serviceName}</p>
                <p className="text-zinc-400 font-mono-num mt-0.5">
                  {formatDateBR(historyApt.date)} · {historyApt.startTime} às {historyApt.endTime} ·{' '}
                  {historyApt.professionalName}
                </p>
              </div>
              {renderStatusPill(historyApt.status)}
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {(historyApt.history || []).length === 0 ? (
                <p className="text-xs text-zinc-500">Sem registros de histórico.</p>
              ) : (
                (historyApt.history || []).map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-lg bg-zinc-50 border border-zinc-200/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900">
                        {h.action === 'created' && 'Agendamento Criado'}
                        {h.action === 'status_changed' &&
                          `Status Alterado (${h.previousStatus} → ${h.newStatus})`}
                        {h.action === 'rescheduled' &&
                          `Remarcado (${h.previousDate} ${h.previousStartTime} → ${h.newDate} ${h.newStartTime})`}
                        {h.action === 'cancelled' && 'Agendamento Cancelado'}
                        {h.action === 'notes_updated' && 'Prontuário / Notas Atualizadas'}
                      </span>
                      <span className="font-mono-num text-[11px] text-zinc-500">
                        {new Date(h.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600">Responsável: {h.performedBy}</p>
                    {h.reason && (
                      <p className="text-[11px] text-amber-900 font-medium">
                        Observação/Motivo: {h.reason}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================================
          MODAL: ADD TO WAITLIST
         ===================================================================== */}
      <Modal
        isOpen={isWaitlistModalOpen}
        title="Incluir Cliente na Fila de Espera"
        subtitle="Cadastre o serviço, profissional e horários preferidos para alerta imediato em caso de desistência."
        onClose={() => setIsWaitlistModalOpen(false)}
      >
        <form onSubmit={handleCreateWaitlist} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Cliente *</label>
              <select
                value={wltClientId}
                onChange={(e) => setWltClientId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
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
              <label className="block text-xs font-medium text-zinc-700 mb-1">Serviço *</label>
              <select
                value={wltServiceId}
                onChange={(e) => setWltServiceId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                required
              >
                {db.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMinutes} min)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Especialista</label>
              <select
                value={wltProfId}
                onChange={(e) => setWltProfId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
              >
                <option value="any">Qualquer Especialista</option>
                {db.professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Data Desejada *</label>
              <input
                type="date"
                value={wltDate}
                onChange={(e) => setWltDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Período</label>
              <select
                value={wltPeriod}
                onChange={(e) => setWltPeriod(e.target.value as WaitlistEntry['preferredPeriod'])}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
              >
                <option value="Qualquer Horário">Qualquer Horário</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Horários Preferidos (Separados por vírgula)
            </label>
            <input
              type="text"
              value={wltTimesInput}
              onChange={(e) => setWltTimesInput(e.target.value)}
              placeholder="Ex.: 10:00, 14:30, 16:00"
              className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Observações</label>
            <input
              type="text"
              value={wltNotes}
              onChange={(e) => setWltNotes(e.target.value)}
              placeholder="Ex.: Pode comparecer com 30 minutos de aviso..."
              className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsWaitlistModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar na Fila de Espera'}
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
