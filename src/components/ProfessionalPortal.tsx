import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  History,
  Sparkles,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  Search,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  LogOut,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  ShieldCheck,
  UserCheck,
  Percent,
  Maximize2,
  X,
} from 'lucide-react';
import type {
  AppDatabase,
  Appointment,
  Client,
  UserAccount,
} from '../types';
import {
  UserAvatar,
  ProfilePhotoModal,
  Modal,
  EmptyState,
  formatBRL,
  formatDateBR,
  formatRoleLabel,
} from './CommonUI';

interface ProfessionalPortalProps {
  currentUser: UserAccount | null;
  db: AppDatabase | null;
  isLoading: boolean;
  onLoginSuccess: (token: string, user: UserAccount) => void;
  onLogout: () => void;
  onSaveProfile: (newAvatarUrl: string, newName?: string) => Promise<void>;
  apiRequest: <T = any>(
    url: string,
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ) => Promise<T | null>;
  refreshData: () => Promise<void>;
  notify: (type: 'success' | 'error' | 'warning', title: string, message: string) => void;
  onOpenClientPortal: () => void;
  onOpenAdminPortal: () => void;
}

type ProfTab = 'today' | 'in_progress' | 'upcoming' | 'cancelled' | 'history';

const REFERENCE_PRESET_PHOTOS = [
  {
    label: 'Mechas Contour Iluminadas',
    url: '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg',
  },
  {
    label: 'Protocolo Glow & Spa Facial',
    url: '/src/assets/images/salon_banner_facial_spa_1793234472494.jpg',
  },
  {
    label: 'Acabamento Couture & Brilho Espelhado',
    url: '/src/assets/images/salon_banner_couture_interior_1793234470450.jpg',
  },
];

function compressReferenceImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const maxDim = 900;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Erro ao processar imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const ProfessionalPortal: React.FC<ProfessionalPortalProps> = ({
  currentUser,
  db,
  isLoading,
  onLoginSuccess,
  onLogout,
  onSaveProfile,
  apiRequest,
  refreshData,
  notify,
  onOpenClientPortal,
  onOpenAdminPortal,
}) => {
  // Login state (reuses /api/auth/login)
  const [email, setEmail] = useState('rafael@luminaatelier.com.br');
  const [password, setPassword] = useState('Prof@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Workspace navigation state
  const [activeTab, setActiveTab] = useState<ProfTab>('today');
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Real available slots explorer for the logged-in professional
  const [profServiceFilterId, setProfServiceFilterId] = useState<string>('');
  const [profAvailableSlots, setProfAvailableSlots] = useState<Array<{ startTime: string; endTime: string }>>([]);
  const [profIsWorkingDay, setProfIsWorkingDay] = useState<boolean>(true);
  const [profAvailabilityReason, setProfAvailabilityReason] = useState<string>('');

  // Selected Appointment for Dossier, Reschedule, Cancel & Reference Photos Modal
  const [selectedAptId, setSelectedAptId] = useState<string | null>(null);
  const [technicalNotesDraft, setTechnicalNotesDraft] = useState('');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [isUpdatingApt, setIsUpdatingApt] = useState(false);
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);
  const [rescheduleDateDraft, setRescheduleDateDraft] = useState('');
  const [rescheduleTimeDraft, setRescheduleTimeDraft] = useState('');
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [showRescheduleBox, setShowRescheduleBox] = useState(false);
  const [showCancelBox, setShowCancelBox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const linkedProfessional = useMemo(() => {
    if (!db || !currentUser) return null;
    return (
      db.professionals.find(
        (p) =>
          p.email.toLowerCase() === currentUser.email.toLowerCase() ||
          p.name.toLowerCase() === currentUser.name.toLowerCase()
      ) || db.professionals[0] || null
    );
  }, [db, currentUser]);

  // Strict RBAC scope filter: only appointments belonging to this professional
  function getWeekRange(isoDate: string): { start: string; end: string } {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  }

  const myAppointments = useMemo(() => {
    if (!db || !currentUser) return [];
    if (linkedProfessional) {
      return db.appointments
        .filter((a) => a.professionalId === linkedProfessional.id)
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
    }
    return [];
  }, [db, currentUser, linkedProfessional]);

  // Fetch real available slots for this professional on selectedDate
  React.useEffect(() => {
    if (!linkedProfessional || !db) return;
    const srvId = profServiceFilterId || db.services.find((s) => s.status === 'active')?.id || '';
    if (!srvId || !selectedDate) return;
    if (!profServiceFilterId && srvId) {
      setProfServiceFilterId(srvId);
    }
    let active = true;
    fetch(
      `/api/public/availability?professionalId=${encodeURIComponent(
        linkedProfessional.id
      )}&serviceId=${encodeURIComponent(srvId)}&date=${encodeURIComponent(selectedDate)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setProfAvailableSlots(Array.isArray(data.availableSlots) ? data.availableSlots : []);
        setProfIsWorkingDay(Boolean(data.isWorkingDay));
        setProfAvailabilityReason(data.reason || '');
      })
      .catch(() => {
        if (active) setProfAvailableSlots([]);
      });
    return () => {
      active = false;
    };
  }, [linkedProfessional, db, profServiceFilterId, selectedDate, myAppointments.length]);

  const todayAppointments = useMemo(() => {
    const weekBounds = getWeekRange(selectedDate);
    const monthPrefix = selectedDate.slice(0, 7);
    return myAppointments
      .filter((a) => {
        if (a.status === 'cancelled') return false;
        if (calendarMode === 'day') return a.date === selectedDate;
        if (calendarMode === 'week') return a.date >= weekBounds.start && a.date <= weekBounds.end;
        return a.date.startsWith(monthPrefix);
      })
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  }, [myAppointments, selectedDate, calendarMode]);

  const inProgressAppointments = useMemo(
    () => myAppointments.filter((a) => a.status === 'in_progress'),
    [myAppointments]
  );

  const upcomingAppointments = useMemo(
    () =>
      myAppointments
        .filter(
          (a) =>
            (a.status === 'requested' || a.status === 'scheduled' || a.status === 'confirmed') &&
            a.date >= todayIso
        )
        .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)),
    [myAppointments, todayIso]
  );

  const cancelledAppointments = useMemo(
    () =>
      myAppointments
        .filter((a) => a.status === 'cancelled' || a.status === 'no_show')
        .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [myAppointments]
  );

  const historyAppointments = useMemo(
    () =>
      myAppointments
        .filter((a) => a.status === 'completed')
        .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [myAppointments]
  );

  const myCommissions = useMemo(() => {
    if (!db || !linkedProfessional) return [];
    return db.commissions.filter((c) => c.professionalId === linkedProfessional.id);
  }, [db, linkedProfessional]);

  const selectedApt = useMemo(
    () => myAppointments.find((a) => a.id === selectedAptId) || null,
    [myAppointments, selectedAptId]
  );

  const selectedClient: Client | null = useMemo(() => {
    if (!selectedApt || !db) return null;
    return db.clients.find((c) => c.id === selectedApt.clientId) || null;
  }, [selectedApt, db]);

  const clientPreviousAppointments = useMemo(() => {
    if (!selectedApt) return [];
    return myAppointments
      .filter((a) => a.clientId === selectedApt.clientId && a.id !== selectedApt.id)
      .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));
  }, [myAppointments, selectedApt]);

  const handleProfessionalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!email.trim() || !email.includes('@')) {
      setLoginError('Informe seu e-mail profissional válido.');
      return;
    }
    if (!password || password.length < 6) {
      setLoginError('A senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Credenciais inválidas.');
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setLoginError('Erro de conexão com o servidor de autenticação.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const openDossierModal = (apt: Appointment) => {
    setSelectedAptId(apt.id);
    setTechnicalNotesDraft(apt.notes || '');
    setCustomPhotoUrl('');
    setRescheduleDateDraft(apt.date);
    setRescheduleTimeDraft(apt.startTime);
    setCancelReasonDraft('');
    setShowRescheduleBox(false);
    setShowCancelBox(false);
  };

  const handleUpdateStatus = async (
    apt: Appointment,
    newStatus: Appointment['status'],
    extraPayload?: Record<string, any>
  ) => {
    setIsUpdatingApt(true);
    try {
      const updated = await apiRequest<Appointment>(
        `/api/appointments/${apt.id}`,
        'PUT',
        {
          status: newStatus,
          notes: selectedAptId === apt.id ? technicalNotesDraft : apt.notes,
          ...extraPayload,
        }
      );
      if (updated) {
        const statusLabels: Record<Appointment['status'], string> = {
          requested: 'Solicitado',
          scheduled: 'Solicitado / Agendado',
          confirmed: 'Confirmado',
          in_progress: 'Em Andamento na Cadeira',
          completed: 'Concluído',
          cancelled: 'Cancelado',
          no_show: 'Não Compareceu',
        };
        notify(
          'success',
          'Status do Atendimento Atualizado',
          `${apt.clientName} · ${apt.serviceName} marcado como "${statusLabels[newStatus]}".`
        );
        setShowCancelBox(false);
        await refreshData();
      }
    } finally {
      setIsUpdatingApt(false);
    }
  };

  const handleRescheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt || !rescheduleDateDraft || !rescheduleTimeDraft) return;
    setIsUpdatingApt(true);
    try {
      const updated = await apiRequest<Appointment>(
        `/api/appointments/${selectedApt.id}`,
        'PUT',
        {
          date: rescheduleDateDraft,
          startTime: rescheduleTimeDraft,
          reason: 'Remarcado pelo especialista na bancada técnica',
        }
      );
      if (updated) {
        notify(
          'success',
          'Atendimento Remarcado',
          `Novo horário definido para ${formatDateBR(updated.date)} às ${updated.startTime}.`
        );
        setShowRescheduleBox(false);
        await refreshData();
      }
    } finally {
      setIsUpdatingApt(false);
    }
  };

  const handleSaveTechnicalNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApt) return;
    setIsUpdatingApt(true);
    try {
      const updated = await apiRequest<Appointment>(
        `/api/appointments/${selectedApt.id}`,
        'PUT',
        {
          notes: technicalNotesDraft.trim(),
        }
      );
      if (updated) {
        notify(
          'success',
          'Prontuário Técnico Salvo',
          `As anotações e fórmula do atendimento de ${selectedApt.clientName} foram registradas.`
        );
        await refreshData();
      }
    } finally {
      setIsUpdatingApt(false);
    }
  };

  const handleAddReferencePhoto = async (photoUrl: string) => {
    if (!selectedApt || !photoUrl.trim()) return;
    const currentPhotos = Array.isArray(selectedApt.referencePhotos)
      ? selectedApt.referencePhotos
      : [];
    if (currentPhotos.length >= 6) {
      notify(
        'warning',
        'Limite de Fotos',
        'Cada atendimento comporta até 6 fotos de referência.'
      );
      return;
    }
    setIsUpdatingApt(true);
    try {
      const updated = await apiRequest<Appointment>(
        `/api/appointments/${selectedApt.id}`,
        'PUT',
        {
          referencePhotos: [...currentPhotos, photoUrl.trim()],
        }
      );
      if (updated) {
        setCustomPhotoUrl('');
        notify(
          'success',
          'Foto de Referência Anexada',
          'A imagem de referência foi vinculada ao atendimento.'
        );
        await refreshData();
      }
    } finally {
      setIsUpdatingApt(false);
    }
  };

  const handleRemoveReferencePhoto = async (indexToRemove: number) => {
    if (!selectedApt) return;
    const currentPhotos = Array.isArray(selectedApt.referencePhotos)
      ? selectedApt.referencePhotos
      : [];
    const nextPhotos = currentPhotos.filter((_, idx) => idx !== indexToRemove);
    setIsUpdatingApt(true);
    try {
      const updated = await apiRequest<Appointment>(
        `/api/appointments/${selectedApt.id}`,
        'PUT',
        {
          referencePhotos: nextPhotos,
        }
      );
      if (updated) {
        notify(
          'warning',
          'Foto Removida',
          'A foto de referência foi removida deste atendimento.'
        );
        await refreshData();
      }
    } finally {
      setIsUpdatingApt(false);
    }
  };

  const handleUploadReferenceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('error', 'Formato Inválido', 'Selecione uma imagem JPG, PNG ou WebP.');
      return;
    }
    try {
      const dataUrl = await compressReferenceImage(file);
      await handleAddReferencePhoto(dataUrl);
    } catch {
      notify('error', 'Erro na Imagem', 'Não foi possível processar a foto selecionada.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============================================================================
  // 1. PROFESSIONAL LOGIN SCREEN (Integrated with existing /api/auth/login & RBAC)
  // ============================================================================
  if (!currentUser || currentUser.role !== 'professional') {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 flex flex-col lg:flex-row items-stretch">
        {/* Left Column: Specialist Workspace Context */}
        <div className="lg:w-1/2 bg-zinc-950 text-white p-8 lg:p-16 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="font-serif-display text-2xl font-semibold tracking-tight text-white">
                Lumina Atelier
              </span>
              <p className="text-xs text-amber-400 font-mono-num uppercase tracking-wider mt-1">
                Área Exclusiva do Profissional · Bancada Técnica
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenClientPortal}
                className="px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                ← Área da Cliente
              </button>
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="px-3 py-2 text-xs font-medium text-amber-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Painel ADM
              </button>
            </div>
          </div>

          <div className="my-12 max-w-lg">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono-num uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-400/20 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Prontuário Técnico & Agenda Individual
            </span>
            <h1 className="font-serif-display text-3xl lg:text-5xl font-medium tracking-tight text-white leading-tight">
              Foco absoluto na arte, precisão na fórmula e histórico completo na cadeira.
            </h1>
            <p className="text-sm text-zinc-400 mt-5 leading-relaxed">
              Acesse sua agenda do dia, atendimentos em andamento, fichas de anamnese, restrições químicas e fotos de referência enviadas para cada horário com isolamento de privacidade RBAC no servidor.
            </p>

            <div className="mt-10 pt-8 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Escopo Individual Protegido</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  O especialista visualiza e gerencia estritamente seus próprios agendimentos, comissões e dados técnicos necessários da cliente.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <ImageIcon className="w-4 h-4" />
                  <span>Fotos de Referência & Fórmulas</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  Consulte imagens de inspiração vinculadas ao atendimento e registre a colorimetria ou protocolo aplicado.
                </p>
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-500 flex items-center justify-between border-t border-zinc-900 pt-6">
            <span>Autenticação Unificada HMAC-SHA256</span>
            <span>Proteção de Dados & LGPD</span>
          </div>
        </div>

        {/* Right Column: Specialist Login Form */}
        <div className="lg:w-1/2 p-6 sm:p-12 lg:p-16 flex items-center justify-center">
          <div className="max-w-md w-full">
            {currentUser && currentUser.role !== 'professional' && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200/90 text-xs text-amber-950 space-y-2.5">
                <p className="font-semibold">
                  Sessão atual: {currentUser.name} ({formatRoleLabel(currentUser.role)})
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Esta é a área exclusiva de bancada dos profissionais especialistas. Para testar o escopo RBAC estrito do profissional, autentique-se abaixo com a credencial de especialista ou retorne ao Painel ADM.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onOpenAdminPortal}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    Ir para Painel ADM Completo
                  </button>
                </div>
              </div>
            )}

            <div className="mb-8">
              <span className="text-[11px] font-mono-num uppercase tracking-wider text-amber-800 font-semibold">
                Login do Especialista
              </span>
              <h2 className="font-serif-display text-3xl font-semibold text-zinc-900 mt-1">
                Acessar Minha Bancada
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Entre com sua credencial corporativa de profissional para carregar sua agenda exclusiva e fichas técnicas.
              </p>
            </div>

            {loginError && (
              <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleProfessionalLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  E-mail do Profissional
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="especialista@luminaatelier.com.br"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-900 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <span>
                  {isLoggingIn ? 'Autenticando Especialista...' : 'Entrar na Área do Profissional'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Fill Demo Account */}
            <div className="mt-8 pt-6 border-t border-zinc-200">
              <p className="text-xs font-semibold text-zinc-800 mb-2.5">
                Credencial de Demonstração (Ambiente de Teste):
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmail('rafael@luminaatelier.com.br');
                  setPassword('Prof@2026');
                  setLoginError(null);
                }}
                className="w-full text-left p-3.5 rounded-xl border border-amber-700/40 bg-amber-50/70 hover:bg-amber-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-900">
                    Rafael Albuquerque · Master Hairstylist & Colorista
                  </span>
                  <span className="text-[11px] font-mono-num text-amber-900 font-semibold">
                    prf-1
                  </span>
                </div>
                <p className="text-[11px] font-mono-num text-zinc-600 mt-1">
                  rafael@luminaatelier.com.br · Senha: Prof@2026
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Acesso restrito aos próprios agendamentos, fichas de anamnese, fotos de referência e comissões.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. AUTHENTICATED PROFESSIONAL EXCLUSIVE WORKSPACE
  // ============================================================================
  const filteredList = (() => {
    let base: Appointment[] = [];
    if (activeTab === 'today') base = todayAppointments;
    else if (activeTab === 'in_progress') base = inProgressAppointments;
    else if (activeTab === 'upcoming') base = upcomingAppointments;
    else if (activeTab === 'cancelled') base = cancelledAppointments;
    else if (activeTab === 'history') base = historyAppointments;

    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(
      (a) =>
        a.clientName.toLowerCase().includes(q) ||
        a.serviceName.toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q)
    );
  })();

  const totalApprovedCommissions = myCommissions
    .filter((c) => c.status === 'approved' || c.status === 'paid')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const totalPendingCommissions = myCommissions
    .filter((c) => c.status === 'pending')
    .reduce((acc, c) => acc + c.commissionAmount, 0);

  const renderStatusBadge = (status: Appointment['status']) => {
    const map: Record<
      Appointment['status'],
      { label: string; classes: string }
    > = {
      requested: {
        label: 'Solicitado',
        classes: 'bg-zinc-100 text-zinc-800 border-zinc-300',
      },
      scheduled: {
        label: 'Solicitado',
        classes: 'bg-zinc-100 text-zinc-700 border-zinc-200',
      },
      confirmed: {
        label: 'Confirmado',
        classes: 'bg-blue-50 text-blue-800 border-blue-200',
      },
      in_progress: {
        label: 'Em Andamento',
        classes: 'bg-amber-100 text-amber-950 border-amber-300',
      },
      completed: {
        label: 'Concluído',
        classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      },
      cancelled: {
        label: 'Cancelado',
        classes: 'bg-red-50 text-red-800 border-red-200',
      },
      no_show: {
        label: 'Ausente',
        classes: 'bg-zinc-200 text-zinc-700 border-zinc-300',
      },
    };
    const item = map[status] || map.scheduled;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${item.classes}`}
      >
        {item.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 flex flex-col pb-20 md:pb-0">
      {/* Top Specialist Header */}
      <header className="sticky top-0 z-30 bg-zinc-950 text-white border-b border-zinc-800 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Brand & Specialist Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              name={currentUser.name}
              avatarUrl={currentUser.avatarUrl}
              size="md"
              variant="dark"
              showCameraBadge
              onClick={() => setIsProfileModalOpen(true)}
              title="Visualizar ou atualizar minha foto de perfil"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(true)}
                  className="text-sm font-semibold text-white hover:text-amber-300 transition-colors truncate cursor-pointer"
                >
                  {currentUser.name}
                </button>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono-num uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  {formatRoleLabel(currentUser.role)}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {linkedProfessional?.specialty || 'Especialista Lumina Atelier'} ·{' '}
                {linkedProfessional?.workHours || '09:00 às 19:00'}
              </p>
            </div>
          </div>

          {/* Center: Desktop Specialist Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            {(
              [
                {
                  id: 'today',
                  label: 'Agenda do Dia',
                  count: todayAppointments.length,
                },
                {
                  id: 'in_progress',
                  label: 'Em Andamento',
                  count: inProgressAppointments.length,
                },
                {
                  id: 'upcoming',
                  label: 'Próximos',
                  count: upcomingAppointments.length,
                },
                {
                  id: 'cancelled',
                  label: 'Cancelamentos',
                  count: cancelledAppointments.length,
                },
                {
                  id: 'history',
                  label: 'Histórico',
                  count: historyAppointments.length,
                },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono-num text-[11px] px-1.5 py-0.2 rounded ${
                      active
                        ? 'bg-zinc-950/15 text-zinc-950 font-bold'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenClientPortal}
              className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer hidden sm:inline-flex"
            >
              Área da Cliente
            </button>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Minha Foto
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Encerrar sessão do profissional"
              className="p-2 text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6">
        {/* Specialist Profile & Summary Banner */}
        <section className="bg-white border border-zinc-200/80 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <UserAvatar
                name={currentUser.name}
                avatarUrl={currentUser.avatarUrl}
                size="lg"
                variant="light"
                showCameraBadge
                onClick={() => setIsProfileModalOpen(true)}
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono-num uppercase tracking-wider text-amber-800 font-semibold">
                    Bancada Exclusiva · Escopo RBAC Verificado
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <UserCheck className="w-3 h-3" />
                    Atendimentos Autorizados
                  </span>
                </div>
                <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900 mt-0.5">
                  Olá, {currentUser.name}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {linkedProfessional?.bio ||
                    'Consulte suas clientes do dia, fichas de anamnese e fotos de referência enviadas para cada atendimento.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={refreshData}
                className="px-3.5 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar Agenda</span>
              </button>
              <button
                type="button"
                onClick={onOpenAdminPortal}
                className="px-3.5 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-colors cursor-pointer"
              >
                Módulos Permitidos no ADM
              </button>
            </div>
          </div>

          {/* 5 Interactive KPI Cards matching the 5 sections */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setActiveTab('today')}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'today'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50/70 hover:bg-zinc-100/80 border-zinc-200/80 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    activeTab === 'today' ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  Agenda do Dia
                </span>
                <Calendar
                  className={`w-4 h-4 ${
                    activeTab === 'today' ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                />
              </div>
              <p className="text-2xl font-semibold font-mono-num mt-1">
                {todayAppointments.length}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  activeTab === 'today' ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                Em {formatDateBR(selectedDate)}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('in_progress')}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'in_progress'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-amber-50/60 hover:bg-amber-50 border-amber-200/80 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    activeTab === 'in_progress' ? 'text-zinc-300' : 'text-amber-900'
                  }`}
                >
                  Em Andamento
                </span>
                <Play
                  className={`w-4 h-4 ${
                    activeTab === 'in_progress' ? 'text-amber-400' : 'text-amber-700'
                  }`}
                />
              </div>
              <p className="text-2xl font-semibold font-mono-num mt-1">
                {inProgressAppointments.length}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  activeTab === 'in_progress' ? 'text-zinc-300' : 'text-amber-800'
                }`}
              >
                Na cadeira agora
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50/70 hover:bg-zinc-100/80 border-zinc-200/80 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    activeTab === 'upcoming' ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  Próximos Horários
                </span>
                <Clock
                  className={`w-4 h-4 ${
                    activeTab === 'upcoming' ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                />
              </div>
              <p className="text-2xl font-semibold font-mono-num mt-1">
                {upcomingAppointments.length}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  activeTab === 'upcoming' ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                Confirmados/Agendados
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cancelled')}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                activeTab === 'cancelled'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50/70 hover:bg-zinc-100/80 border-zinc-200/80 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    activeTab === 'cancelled' ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  Cancelamentos
                </span>
                <XCircle
                  className={`w-4 h-4 ${
                    activeTab === 'cancelled' ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                />
              </div>
              <p className="text-2xl font-semibold font-mono-num mt-1">
                {cancelledAppointments.length}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  activeTab === 'cancelled' ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                Desmarcações
              </p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                activeTab === 'history'
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-zinc-50/70 hover:bg-zinc-100/80 border-zinc-200/80 text-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium ${
                    activeTab === 'history' ? 'text-zinc-300' : 'text-zinc-500'
                  }`}
                >
                  Histórico & Repasse
                </span>
                <History
                  className={`w-4 h-4 ${
                    activeTab === 'history' ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                />
              </div>
              <p className="text-2xl font-semibold font-mono-num mt-1">
                {historyAppointments.length}
              </p>
              <p
                className={`text-[11px] font-mono-num mt-0.5 ${
                  activeTab === 'history' ? 'text-amber-300' : 'text-emerald-700 font-semibold'
                }`}
              >
                {formatBRL(totalApprovedCommissions + totalPendingCommissions)} em comissões
              </p>
            </button>
          </div>
        </section>

        {/* Filter Bar: Date Selector, Daily/Weekly/Monthly Switcher & Search */}
        <section className="bg-white border border-zinc-200/80 rounded-xl p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif-display text-xl font-semibold text-zinc-900">
                {activeTab === 'today' &&
                  (calendarMode === 'day'
                    ? 'Agenda Diária'
                    : calendarMode === 'week'
                    ? 'Agenda Semanal'
                    : 'Agenda Mensal')}
                {activeTab === 'in_progress' && 'Atendimentos em Andamento na Cadeira'}
                {activeTab === 'upcoming' && 'Próximos Atendimentos (Solicitados & Confirmados)'}
                {activeTab === 'cancelled' && 'Registro de Cancelamentos'}
                {activeTab === 'history' && 'Histórico de Atendimentos & Comissões'}
              </h2>

              {activeTab === 'today' && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                    {(
                      [
                        { id: 'day', label: 'Diária' },
                        { id: 'week', label: 'Semanal' },
                        { id: 'month', label: 'Mensal' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCalendarMode(m.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                          calendarMode === m.id
                            ? 'bg-zinc-900 text-white font-semibold'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-mono-num bg-zinc-50 border border-zinc-300 rounded-lg"
                  />
                  {selectedDate !== todayIso && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayIso)}
                      className="px-2.5 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer"
                    >
                      Hoje
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, serviço ou fórmula..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          {/* Real Available Slots Strip for the Specialist */}
          {activeTab === 'today' && db && (
            <div className="pt-3 border-t border-zinc-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono-num uppercase tracking-wider text-amber-900 font-semibold">
                  Minhas Vagas Reais Livres ({formatDateBR(selectedDate)}):
                </span>
                <select
                  value={profServiceFilterId}
                  onChange={(e) => setProfServiceFilterId(e.target.value)}
                  className="px-2.5 py-1 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
                >
                  {db.services
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.durationMinutes} min)
                      </option>
                    ))}
                </select>
              </div>

              {!profIsWorkingDay ? (
                <span className="text-xs text-amber-800 font-medium">
                  {profAvailabilityReason || 'Fora da escala de atendimento nesta data.'}
                </span>
              ) : profAvailableSlots.length === 0 ? (
                <span className="text-xs text-amber-800 font-medium">
                  Nenhum horário livre para a duração deste serviço em {formatDateBR(selectedDate)}.
                </span>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {profAvailableSlots.map((slot) => (
                    <span
                      key={slot.startTime}
                      className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono-num text-[11px] font-semibold"
                    >
                      {slot.startTime}–{slot.endTime}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Appointments List */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-zinc-500 bg-white rounded-xl border border-zinc-200">
            Carregando agenda exclusiva do profissional...
          </div>
        ) : filteredList.length === 0 ? (
          <EmptyState
            title="Nenhum atendimento listado nesta visão"
            description="Não há horários correspondentes aos filtros selecionados na sua agenda individual."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredList.map((apt) => {
              const clientObj = db?.clients.find((c) => c.id === apt.clientId);
              const refPhotos = Array.isArray(apt.referencePhotos) ? apt.referencePhotos : [];
              const hasAllergyAlert =
                clientObj?.allergies &&
                clientObj.allergies.toLowerCase() !== 'nenhuma relatada' &&
                clientObj.allergies.toLowerCase() !== 'nenhuma';

              return (
                <div
                  key={apt.id}
                  className={`bg-white rounded-xl border p-5 flex flex-col justify-between gap-4 transition-shadow hover:shadow-xs ${
                    apt.status === 'in_progress'
                      ? 'border-amber-400 ring-1 ring-amber-300/50'
                      : 'border-zinc-200/80'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Time, Date & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white font-mono-num text-xs font-semibold">
                          {apt.startTime} — {apt.endTime}
                        </span>
                        <span className="text-xs font-mono-num text-zinc-500">
                          {formatDateBR(apt.date)}
                        </span>
                      </div>
                      {renderStatusBadge(apt.status)}
                    </div>

                    {/* Client & Service Info */}
                    <div className="flex items-start justify-between gap-3 pt-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          name={apt.clientName}
                          avatarUrl={clientObj?.avatarUrl}
                          size="md"
                          variant="light"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-zinc-900 truncate">
                              {apt.clientName}
                            </h3>
                            {clientObj?.tier && (
                              <span className="px-2 py-0.5 text-[10px] font-mono-num uppercase font-semibold rounded bg-amber-50 text-amber-900 border border-amber-200">
                                {clientObj.tier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-zinc-700 mt-0.5">
                            {apt.serviceName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono-num font-semibold text-zinc-900 block">
                          {formatBRL(apt.price)}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {apt.paymentStatus === 'paid' ? 'Liquidado' : 'A pagar no caixa'}
                        </span>
                      </div>
                    </div>

                    {/* Allergy Warning Banner if client has allergies */}
                    {hasAllergyAlert && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200/80 flex items-start gap-2 text-xs text-red-900">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Restrição / Alergia Registrada: </span>
                          <span>{clientObj?.allergies}</span>
                        </div>
                      </div>
                    )}

                    {/* Technical Formula / Notes Preview */}
                    <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200/70 text-xs text-zinc-700 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500">
                        <span>Observações / Fórmula do Atendimento</span>
                        {clientObj && (
                          <span>{clientObj.visitsCount} visitas no salão</span>
                        )}
                      </div>
                      <p className="text-zinc-800 leading-relaxed">
                        {apt.notes || 'Sem anotações técnicas registradas para este horário.'}
                      </p>
                    </div>

                    {/* Reference Photos Strip Preview */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon className="w-4 h-4 text-amber-800 shrink-0" />
                        <span className="text-xs font-medium text-zinc-700">
                          {refPhotos.length > 0
                            ? `${refPhotos.length} foto(s) de referência anexada(s)`
                            : 'Nenhuma foto de referência enviada'}
                        </span>
                      </div>

                      {refPhotos.length > 0 && (
                        <div className="flex items-center -space-x-2">
                          {refPhotos.slice(0, 3).map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => openDossierModal(apt)}
                              className="w-8 h-8 rounded-lg overflow-hidden border-2 border-white shadow-2xs cursor-pointer"
                              title="Ver fotos de referência"
                            >
                              <img
                                src={url}
                                alt="Referência"
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openDossierModal(apt)}
                      className="px-3 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-800" />
                      <span>Ficha do Cliente & Fotos ({refPhotos.length})</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {(apt.status === 'requested' || apt.status === 'scheduled') && (
                        <button
                          type="button"
                          disabled={isUpdatingApt}
                          onClick={() => handleUpdateStatus(apt, 'confirmed')}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Confirmar
                        </button>
                      )}

                      {(apt.status === 'requested' ||
                        apt.status === 'scheduled' ||
                        apt.status === 'confirmed') && (
                        <button
                          type="button"
                          disabled={isUpdatingApt}
                          onClick={() => handleUpdateStatus(apt, 'in_progress')}
                          className="px-3 py-2 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-700 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Iniciar Atendimento</span>
                        </button>
                      )}

                      {apt.status === 'in_progress' && (
                        <button
                          type="button"
                          disabled={isUpdatingApt}
                          onClick={() => handleUpdateStatus(apt, 'completed')}
                          className="px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Concluir Atendimento</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Specialist Commissions Summary Section (Visible in History Tab) */}
        {activeTab === 'history' && (
          <section className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
              <div>
                <span className="text-[11px] font-mono-num uppercase tracking-wider text-amber-800 font-semibold">
                  Repasse Individual ({linkedProfessional?.defaultCommission || 45}% base)
                </span>
                <h3 className="font-serif-display text-xl font-semibold text-zinc-900">
                  Minhas Comissões Vinculadas
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono-num">
                <span className="text-emerald-700 font-semibold">
                  Aprovadas/Pagas: {formatBRL(totalApprovedCommissions)}
                </span>
                <span className="text-amber-800 font-semibold">
                  Pendentes: {formatBRL(totalPendingCommissions)}
                </span>
              </div>
            </div>

            {myCommissions.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4">
                Nenhuma comissão registrada para o seu perfil até o momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 text-zinc-500">
                      <th className="py-2.5 px-3 font-medium">Data</th>
                      <th className="py-2.5 px-3 font-medium">Comanda</th>
                      <th className="py-2.5 px-3 font-medium">Serviço / Produto</th>
                      <th className="py-2.5 px-3 font-medium">Valor Base</th>
                      <th className="py-2.5 px-3 font-medium">%</th>
                      <th className="py-2.5 px-3 font-medium">Comissão</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {myCommissions.map((cm) => (
                      <tr key={cm.id} className="hover:bg-zinc-50/80">
                        <td className="py-2.5 px-3 font-mono-num text-zinc-600">
                          {formatDateBR(cm.saleDate)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-semibold text-zinc-800">
                          {cm.saleCode}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-900 font-medium">{cm.itemName}</td>
                        <td className="py-2.5 px-3 font-mono-num text-zinc-600">
                          {formatBRL(cm.grossAmount)}
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-zinc-600">
                          {cm.commissionPercentage}%
                        </td>
                        <td className="py-2.5 px-3 font-mono-num font-semibold text-emerald-800">
                          {formatBRL(cm.commissionAmount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              cm.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : cm.status === 'approved'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {cm.status === 'paid'
                              ? 'Pago'
                              : cm.status === 'approved'
                              ? 'Aprovado'
                              : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-zinc-950 text-zinc-400 border-t border-zinc-800 grid grid-cols-5 lg:hidden">
        {(
          [
            { id: 'today', label: 'Hoje', icon: Calendar },
            { id: 'in_progress', label: 'Cadeira', icon: Play },
            { id: 'upcoming', label: 'Próximos', icon: Clock },
            { id: 'cancelled', label: 'Cancelados', icon: XCircle },
            { id: 'history', label: 'Histórico', icon: History },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-2.5 flex flex-col items-center justify-center gap-1 text-[10px] font-medium cursor-pointer ${
                active ? 'text-amber-400 font-semibold' : 'text-zinc-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          MODAL: CLIENT DOSSIER & REFERENCE PHOTOS ("FICHA TÉCNICA & FOTOS")
         ===================================================================== */}
      <Modal
        isOpen={Boolean(selectedApt)}
        onClose={() => setSelectedAptId(null)}
        title={
          selectedApt
            ? `Prontuário & Fotos de Referência · ${selectedApt.clientName}`
            : 'Prontuário do Atendimento'
        }
        maxWidth="max-w-3xl"
      >
        {selectedApt && (
          <div className="space-y-6">
            {/* Top Summary Banner */}
            <div className="p-4 rounded-xl bg-zinc-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <UserAvatar
                  name={selectedApt.clientName}
                  avatarUrl={selectedClient?.avatarUrl}
                  size="lg"
                  variant="dark"
                />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-white">
                      {selectedApt.clientName}
                    </h3>
                    {selectedClient?.tier && (
                      <span className="px-2 py-0.5 text-[10px] font-mono-num uppercase font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        Cliente {selectedClient.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    {selectedApt.serviceName} · {formatDateBR(selectedApt.date)} das{' '}
                    <span className="font-mono-num font-semibold text-amber-300">
                      {selectedApt.startTime} às {selectedApt.endTime}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Dados protegidos por LGPD (CPF: {selectedClient?.cpf || '***.***.***-**'} ·
                    Contato intermediado pela recepção: {selectedClient?.phone || 'Protegido'})
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-2">
                {renderStatusBadge(selectedApt.status)}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(selectedApt.status === 'requested' ||
                    selectedApt.status === 'scheduled') && (
                    <button
                      type="button"
                      disabled={isUpdatingApt}
                      onClick={() => handleUpdateStatus(selectedApt, 'confirmed')}
                      className="px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer"
                    >
                      Confirmar
                    </button>
                  )}
                  {(selectedApt.status === 'requested' ||
                    selectedApt.status === 'scheduled' ||
                    selectedApt.status === 'confirmed') && (
                    <button
                      type="button"
                      disabled={isUpdatingApt}
                      onClick={() => handleUpdateStatus(selectedApt, 'in_progress')}
                      className="px-3 py-1.5 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
                    >
                      Iniciar Atendimento
                    </button>
                  )}
                  {selectedApt.status === 'in_progress' && (
                    <button
                      type="button"
                      disabled={isUpdatingApt}
                      onClick={() => handleUpdateStatus(selectedApt, 'completed')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer"
                    >
                      Concluir Atendimento
                    </button>
                  )}
                  {selectedApt.status !== 'completed' &&
                    selectedApt.status !== 'cancelled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setShowRescheduleBox(!showRescheduleBox);
                            setShowCancelBox(false);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer"
                        >
                          Remarcar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCancelBox(!showCancelBox);
                            setShowRescheduleBox(false);
                          }}
                          className="px-2.5 py-1.5 text-xs font-medium text-red-300 bg-red-950/60 hover:bg-red-900/70 border border-red-800/50 rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                </div>
              </div>
            </div>

            {/* Inline Reschedule Box in Dossier Modal */}
            {showRescheduleBox && (
              <form
                onSubmit={handleRescheduleAppointment}
                className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-950">
                    Remarcar Atendimento (Validação de Conflito e Escala no Servidor)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRescheduleBox(false)}
                    className="text-xs text-zinc-500 hover:text-zinc-800 cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                      Nova Data
                    </label>
                    <input
                      type="date"
                      value={rescheduleDateDraft}
                      onChange={(e) => setRescheduleDateDraft(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                      Novo Horário
                    </label>
                    <input
                      type="time"
                      value={rescheduleTimeDraft}
                      onChange={(e) => setRescheduleTimeDraft(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isUpdatingApt}
                      className="w-full py-1.5 px-3 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
                    >
                      Confirmar Remarcação
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Inline Cancel Box in Dossier Modal */}
            {showCancelBox && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-950">
                    Cancelar Atendimento (Libera vaga imediatamente e notifica fila de espera)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCancelBox(false)}
                    className="text-xs text-red-700 hover:underline cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={cancelReasonDraft}
                    onChange={(e) => setCancelReasonDraft(e.target.value)}
                    placeholder="Informe o motivo do cancelamento para o histórico..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-red-300 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={isUpdatingApt}
                    onClick={() =>
                      handleUpdateStatus(selectedApt, 'cancelled', {
                        cancellationReason:
                          cancelReasonDraft.trim() ||
                          'Cancelado pelo profissional na bancada',
                      })
                    }
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-600 rounded-lg cursor-pointer"
                  >
                    Confirmar Cancelamento
                  </button>
                </div>
              </div>
            )}

            {/* Client Necessary Anamnesis & Restrictions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-red-50/70 border border-red-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Alergias & Restrições Químicas</span>
                </div>
                <p className="text-xs text-red-950 leading-relaxed font-medium">
                  {selectedClient?.allergies || 'Nenhuma alergia relatada na ficha.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-950">
                  <Sparkles className="w-4 h-4 text-amber-800" />
                  <span>Preferências & Notas de Anamnese da Cliente</span>
                </div>
                <p className="text-xs text-zinc-800 leading-relaxed">
                  {selectedClient?.notes ||
                    'Sem observações adicionais no cadastro da cliente.'}
                </p>
              </div>
            </div>

            {/* Reference Photos Sent for this Appointment */}
            <div className="space-y-3 pt-2 border-t border-zinc-200/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-800" />
                    <span>
                      Fotos de Referência deste Atendimento (
                      {(selectedApt.referencePhotos || []).length}/6)
                    </span>
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Imagens enviadas pela cliente ou anexadas na consultoria de visagismo para este horário.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadReferenceFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUpdatingApt}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Enviar Foto</span>
                  </button>
                </div>
              </div>

              {(selectedApt.referencePhotos || []).length === 0 ? (
                <div className="p-6 rounded-xl bg-zinc-50 border border-dashed border-zinc-300 text-center space-y-2">
                  <ImageIcon className="w-6 h-6 text-zinc-400 mx-auto" />
                  <p className="text-xs font-medium text-zinc-700">
                    Nenhuma foto de referência anexada a este atendimento.
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Envie uma imagem do seu dispositivo ou selecione uma referência abaixo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(selectedApt.referencePhotos || []).map((photoUrl, idx) => (
                    <div
                      key={idx}
                      className="group relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-950 aspect-[4/3]"
                    >
                      <img
                        src={photoUrl}
                        alt={`Referência ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2.5">
                        <button
                          type="button"
                          onClick={() => setZoomPhotoUrl(photoUrl)}
                          className="px-2.5 py-1 rounded bg-white/95 text-zinc-900 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>Ampliar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveReferencePhoto(idx)}
                          className="p-1.5 rounded bg-red-600/90 text-white hover:bg-red-600 cursor-pointer"
                          title="Remover foto de referência"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Add Reference Photo via URL or Studio Presets */}
              <div className="pt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPhotoUrl}
                    onChange={(e) => setCustomPhotoUrl(e.target.value)}
                    placeholder="Ou cole a URL de uma foto de referência (https://...)"
                    className="flex-1 px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg"
                  />
                  <button
                    type="button"
                    disabled={!customPhotoUrl.trim() || isUpdatingApt}
                    onClick={() => handleAddReferencePhoto(customPhotoUrl)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Anexar URL</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-zinc-500 mr-1">
                    Referências de Teste Rápido:
                  </span>
                  {REFERENCE_PRESET_PHOTOS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={isUpdatingApt}
                      onClick={() => handleAddReferencePhoto(preset.url)}
                      className="px-2.5 py-1 text-[11px] font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Technical Formula & Service Notes Form */}
            <form
              onSubmit={handleSaveTechnicalNotes}
              className="space-y-3 pt-3 border-t border-zinc-200/80"
            >
              <label className="block text-xs font-semibold text-zinc-900">
                Fórmula Técnica & Registro de Execução deste Atendimento
              </label>
              <textarea
                rows={3}
                value={technicalNotesDraft}
                onChange={(e) => setTechnicalNotesDraft(e.target.value)}
                placeholder="Registre oxidante, numeração de cor, tempo de pausa, tratamento aplicado ou recomendações Home Care..."
                className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 border border-zinc-300 rounded-xl focus:outline-none focus:border-zinc-900"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingApt}
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  {isUpdatingApt
                    ? 'Salvando no Servidor...'
                    : 'Salvar Anotações Técnicas'}
                </button>
              </div>
            </form>

            {/* Appointment Audit & Reschedule History */}
            {Array.isArray(selectedApt.history) && selectedApt.history.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-zinc-200/80">
                <h4 className="text-xs font-semibold text-zinc-900">
                  Histórico de Alterações deste Agendamento ({selectedApt.history.length})
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedApt.history.map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200/70 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900">{h.performedBy}</span>
                        <span className="text-zinc-500"> · {h.reason || h.action}</span>
                        {h.previousDate && h.newDate && (
                          <span className="block font-mono-num text-amber-900">
                            De {formatDateBR(h.previousDate)} ({h.previousStartTime}) para{' '}
                            {formatDateBR(h.newDate)} ({h.newStartTime})
                          </span>
                        )}
                      </div>
                      <span className="font-mono-num text-zinc-400">{h.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Appointments of this Client with this Specialist */}
            {clientPreviousAppointments.length > 0 && (
              <div className="space-y-2.5 pt-3 border-t border-zinc-200/80">
                <h4 className="text-xs font-semibold text-zinc-900">
                  Histórico da Cliente com Você ({clientPreviousAppointments.length})
                </h4>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {clientPreviousAppointments.map((prev) => (
                    <div
                      key={prev.id}
                      className="p-3 rounded-lg bg-zinc-50 border border-zinc-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono-num font-semibold text-zinc-900">
                          {formatDateBR(prev.date)} ({prev.startTime})
                        </span>{' '}
                        — <span className="font-medium text-zinc-800">{prev.serviceName}</span>
                        {prev.notes && (
                          <p className="text-[11px] text-zinc-600 mt-0.5">{prev.notes}</p>
                        )}
                      </div>
                      {renderStatusBadge(prev.status)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Fullscreen Lightbox for Reference Photo Inspection */}
      {zoomPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setZoomPhotoUrl(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomPhotoUrl(null)}
              className="absolute -top-10 right-0 px-3 py-1.5 rounded-lg bg-zinc-800 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Fechar Visualização</span>
            </button>
            <img
              src={zoomPhotoUrl}
              alt="Referência Ampliada"
              className="max-h-[82vh] w-auto rounded-2xl border border-zinc-800 object-contain"
            />
          </div>
        </div>
      )}

      {/* Specialist Profile Photo Modal */}
      <ProfilePhotoModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userName={currentUser.name}
        userEmail={currentUser.email}
        userRoleLabel={formatRoleLabel(currentUser.role)}
        currentAvatarUrl={currentUser.avatarUrl}
        onSave={onSaveProfile}
      />
    </div>
  );
};
