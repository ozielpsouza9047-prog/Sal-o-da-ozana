import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home,
  Calendar,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  LogOut,
  Lock,
  Mail,
  RefreshCw,
  ListPlus,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import type {
  BannerSlide,
  ServiceItem,
  Client,
  Appointment,
  WaitlistEntry,
} from '../types';
import {
  formatBRL,
  formatDateBR,
  Modal,
  ConfirmDialog,
  EmptyState,
  UserAvatar,
  ProfilePhotoModal,
} from './CommonUI';

interface PublicCatalogResponse {
  salon: {
    salonName: string;
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    city: string;
    state: string;
    openingTime: string;
    closingTime: string;
    slotIntervalMinutes: number;
    allowOnlineBooking: boolean;
    cancellationNoticeHours: number;
  };
  banners: BannerSlide[];
  services: ServiceItem[];
  professionals: Array<{
    id: string;
    name: string;
    specialty: string;
    workDays: string[];
    workHours: string;
    rating: number;
    bio: string;
  }>;
}

interface AvailabilityResponse {
  date: string;
  dayLabel: string;
  isWorkingDay: boolean;
  reason?: string;
  availableSlots: Array<{ startTime: string; endTime: string }>;
  occupiedIntervals: Array<{ startTime: string; endTime: string }>;
}

interface ClientPortalProps {
  onSwitchToAdmin: () => void;
  onSwitchToProfessional?: () => void;
  notify: (type: 'success' | 'error' | 'warning', title: string, message: string) => void;
}

type ClientTab = 'home' | 'book' | 'appointments' | 'profile';
type AuthSubTab = 'login' | 'register' | 'recover';

const FALLBACK_BANNER_IMAGE =
  '/src/assets/images/salon_banner_couture_interior_1793234470450.jpg';

export const ClientPortal: React.FC<ClientPortalProps> = ({
  onSwitchToAdmin,
  onSwitchToProfessional,
  notify,
}) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('home');
  const [catalog, setCatalog] = useState<PublicCatalogResponse | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);

  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Client Auth state
  const [clientToken, setClientToken] = useState<string | null>(() =>
    localStorage.getItem('lumina_client_token')
  );
  const [clientProfile, setClientProfile] = useState<Client | null>(null);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [myWaitlist, setMyWaitlist] = useState<WaitlistEntry[]>([]);
  const [isLoadingMe, setIsLoadingMe] = useState<boolean>(false);

  // Catalog filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Booking Wizard state
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedProfId, setSelectedProfId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingRefPhotos, setBookingRefPhotos] = useState<string[]>([]);
  const [bookingRefInput, setBookingRefInput] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [isBookingSubmitting, setIsBookingSubmitting] = useState<boolean>(false);
  const [lastBookedConfirmation, setLastBookedConfirmation] = useState<Appointment | null>(null);

  // Waitlist form state
  const [showWaitlistForm, setShowWaitlistForm] = useState<boolean>(false);
  const [waitlistPeriod, setWaitlistPeriod] =
    useState<WaitlistEntry['preferredPeriod']>('Qualquer Horário');
  const [waitlistNotes, setWaitlistNotes] = useState<string>('');
  const [isWaitlistSubmitting, setIsWaitlistSubmitting] = useState<boolean>(false);

  // My Appointments filter, Cancel & Reschedule state
  const [aptHistoryFilter, setAptHistoryFilter] = useState<'upcoming' | 'history'>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleProfId, setRescheduleProfId] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('');
  const [rescheduleAvailability, setRescheduleAvailability] =
    useState<AvailabilityResponse | null>(null);
  const [isLoadingRescheduleSlots, setIsLoadingRescheduleSlots] = useState<boolean>(false);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);

  // Auth / Profile forms state
  const [authTab, setAuthTab] = useState<AuthSubTab>('login');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState<boolean>(false);

  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regCpf, setRegCpf] = useState<string>('');
  const [regBirthDate, setRegBirthDate] = useState<string>('');
  const [regAllergies, setRegAllergies] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');

  const [recEmail, setRecEmail] = useState<string>('');
  const [recVerification, setRecVerification] = useState<string>('');
  const [recNewPassword, setRecNewPassword] = useState<string>('');

  // Profile Edit state
  const [profName, setProfName] = useState<string>('');
  const [profPhone, setProfPhone] = useState<string>('');
  const [profBirthDate, setProfBirthDate] = useState<string>('');
  const [profAllergies, setProfAllergies] = useState<string>('');
  const [profNotes, setProfNotes] = useState<string>('');
  const [profNewPassword, setProfNewPassword] = useState<string>('');
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [isClientPhotoModalOpen, setIsClientPhotoModalOpen] = useState<boolean>(false);

  // Load Public Catalog
  const fetchCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    try {
      const res = await fetch('/api/public/catalog');
      if (res.ok) {
        const data: PublicCatalogResponse = await res.json();
        setCatalog(data);
        if (data.services.length > 0 && !selectedServiceId) {
          setSelectedServiceId(data.services[0].id);
        }
        if (data.professionals.length > 0 && !selectedProfId) {
          setSelectedProfId(data.professionals[0].id);
        }
      }
    } catch {
      notify('error', 'Erro de Conexão', 'Não foi possível carregar o catálogo do salão.');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [notify, selectedServiceId, selectedProfId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Automatic Carousel Timer
  const banners = useMemo(() => {
    if (!catalog?.banners || catalog.banners.length === 0) {
      return [
        {
          id: 'default-1',
          title: 'Alta Beleza & Rituais Capilares Sob Medida',
          subtitle: 'Diagnóstico personalizado e protocolos internacionais no coração dos Jardins.',
          ctaLabel: 'Agendar Experiência',
          imageUrl: FALLBACK_BANNER_IMAGE,
          active: true,
          order: 1,
        },
      ];
    }
    return catalog.banners;
  }, [catalog]);

  useEffect(() => {
    if (banners.length <= 1 || isCarouselPaused || activeTab !== 'home') return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length, isCarouselPaused, activeTab]);

  // Authenticated Client API Helper
  const clientApiRequest = useCallback(
    async <T = any>(
      url: string,
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
      body?: any
    ): Promise<T | null> => {
      if (!clientToken) return null;
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clientToken}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('lumina_client_token');
          setClientToken(null);
          setClientProfile(null);
          notify('warning', 'Sessão Encerrada', data.error || 'Faça login novamente para continuar.');
          return null;
        }
        if (!res.ok) {
          notify('error', 'Atenção', data.error || 'Não foi possível concluir a solicitação.');
          return null;
        }
        return data as T;
      } catch {
        notify('error', 'Erro de Rede', 'Falha de comunicação com o servidor.');
        return null;
      }
    },
    [clientToken, notify]
  );

  const fetchClientMe = useCallback(async () => {
    if (!clientToken) return;
    setIsLoadingMe(true);
    const data = await clientApiRequest<{
      client: Client;
      appointments: Appointment[];
      waitlist: WaitlistEntry[];
    }>('/api/client-portal/me', 'GET');
    if (data) {
      setClientProfile(data.client);
      setMyAppointments(data.appointments);
      setMyWaitlist(data.waitlist);
      setProfName(data.client.name);
      setProfPhone(data.client.phone);
      setProfBirthDate(data.client.birthDate || '');
      setProfAllergies(data.client.allergies || '');
      setProfNotes(data.client.notes || '');
    }
    setIsLoadingMe(false);
  }, [clientToken, clientApiRequest]);

  useEffect(() => {
    if (clientToken) {
      fetchClientMe();
    }
  }, [clientToken, fetchClientMe]);

  // Fetch Real Availability whenever Service, Professional, or Date changes
  const fetchAvailability = useCallback(async () => {
    if (!selectedServiceId || !selectedProfId || !selectedDate) return;
    setIsLoadingSlots(true);
    setSelectedSlot('');
    try {
      const params = new URLSearchParams({
        serviceId: selectedServiceId,
        professionalId: selectedProfId,
        date: selectedDate,
      });
      const res = await fetch(`/api/public/availability?${params.toString()}`);
      const data: AvailabilityResponse = await res.json();
      if (res.ok) {
        setAvailability(data);
        if (data.availableSlots && data.availableSlots.length > 0) {
          setSelectedSlot(data.availableSlots[0].startTime);
        }
      } else {
        setAvailability(null);
      }
    } catch {
      setAvailability(null);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [selectedServiceId, selectedProfId, selectedDate]);

  useEffect(() => {
    if (selectedServiceId && selectedProfId && selectedDate) {
      fetchAvailability();
    }
  }, [selectedServiceId, selectedProfId, selectedDate, fetchAvailability]);

  // Fetch Availability for Reschedule Modal
  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleProfId) return;
    let active = true;
    const loadRescheduleSlots = async () => {
      setIsLoadingRescheduleSlots(true);
      setRescheduleSlot('');
      try {
        const params = new URLSearchParams({
          serviceId: rescheduleTarget.serviceId,
          professionalId: rescheduleProfId,
          date: rescheduleDate,
          excludeAppointmentId: rescheduleTarget.id,
        });
        const res = await fetch(`/api/public/availability?${params.toString()}`);
        const data: AvailabilityResponse = await res.json();
        if (active && res.ok) {
          setRescheduleAvailability(data);
          if (data.availableSlots?.length > 0) {
            setRescheduleSlot(data.availableSlots[0].startTime);
          }
        }
      } finally {
        if (active) setIsLoadingRescheduleSlots(false);
      }
    };
    loadRescheduleSlots();
    return () => {
      active = false;
    };
  }, [rescheduleTarget, rescheduleDate, rescheduleProfId]);

  // Quick 7-day strip helper
  const nextDaysStrip = useMemo(() => {
    const days: Array<{ iso: string; dayNum: string; weekShort: string; monthShort: string }> = [];
    const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const monthNames = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    for (let i = 0; i < 8; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const iso = d.toISOString().split('T')[0];
      const utcDate = new Date(`${iso}T12:00:00Z`);
      days.push({
        iso,
        dayNum: String(utcDate.getUTCDate()).padStart(2, '0'),
        weekShort: weekNames[utcDate.getUTCDay()],
        monthShort: monthNames[utcDate.getUTCMonth()],
      });
    }
    return days;
  }, []);

  // Handlers: Start booking from a specific service or professional
  const handleSelectServiceAndBook = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setLastBookedConfirmation(null);
    setActiveTab('book');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProfAndBook = (profId: string) => {
    setSelectedProfId(profId);
    setLastBookedConfirmation(null);
    setActiveTab('book');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers: Client Login, Register, Password Recovery
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setIsAuthSubmitting(true);
    try {
      const res = await fetch('/api/client-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('error', 'Falha no Login', data.error || 'Credenciais inválidas.');
      } else {
        localStorage.setItem('lumina_client_token', data.token);
        setClientToken(data.token);
        setClientProfile(data.client);
        notify('success', 'Bem-vinda(o)!', `Olá, ${data.client.name}. Seu acesso está ativo.`);
      }
    } catch {
      notify('error', 'Erro', 'Falha ao conectar com o servidor.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPhone.trim() || regPassword.length < 6) {
      notify('error', 'Validação', 'Preencha nome, e-mail, telefone e senha (mínimo 6 caracteres).');
      return;
    }
    setIsAuthSubmitting(true);
    try {
      const res = await fetch('/api/client-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          phone: regPhone,
          cpf: regCpf,
          birthDate: regBirthDate,
          allergies: regAllergies,
          password: regPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('error', 'Não foi possível cadastrar', data.error || 'Verifique os dados informados.');
      } else {
        localStorage.setItem('lumina_client_token', data.token);
        setClientToken(data.token);
        setClientProfile(data.client);
        notify('success', 'Cadastro Concluído', `Bem-vinda(o) ao Lumina Atelier, ${data.client.name}!`);
      }
    } catch {
      notify('error', 'Erro', 'Falha ao comunicar com o servidor.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recEmail.trim() || !recVerification.trim() || recNewPassword.length < 6) {
      notify('error', 'Validação', 'Informe o e-mail, os dígitos de verificação e a nova senha.');
      return;
    }
    setIsAuthSubmitting(true);
    try {
      const res = await fetch('/api/client-auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: recEmail,
          verificationValue: recVerification,
          newPassword: recNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('error', 'Recuperação Recusada', data.error || 'Dados não conferem.');
      } else {
        notify('success', 'Senha Redefinida', data.message);
        setLoginEmail(recEmail);
        setLoginPassword(recNewPassword);
        setAuthTab('login');
      }
    } catch {
      notify('error', 'Erro', 'Falha de conexão com o servidor.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleClientLogout = () => {
    localStorage.removeItem('lumina_client_token');
    setClientToken(null);
    setClientProfile(null);
    setMyAppointments([]);
    setMyWaitlist([]);
    notify('warning', 'Sessão Encerrada', 'Você saiu da sua conta de cliente.');
  };

  // Handler: Confirm Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToken || !clientProfile) {
      notify(
        'warning',
        'Identificação Necessária',
        'Entre na sua conta ou cadastre-se rapidamente para confirmar o horário.'
      );
      setActiveTab('profile');
      return;
    }
    if (!selectedServiceId || !selectedProfId || !selectedDate || !selectedSlot) {
      notify(
        'error',
        'Seleção Incompleta',
        'Selecione o serviço, especialista, data e horário disponível.'
      );
      return;
    }
    setIsBookingSubmitting(true);
    try {
      const res = await clientApiRequest<Appointment>('/api/client-portal/appointments', 'POST', {
        serviceId: selectedServiceId,
        professionalId: selectedProfId,
        date: selectedDate,
        startTime: selectedSlot,
        notes: bookingNotes,
        referencePhotos: bookingRefPhotos,
      });
      if (res) {
        setLastBookedConfirmation(res);
        setBookingNotes('');
        setBookingRefPhotos([]);
        setBookingRefInput('');
        notify(
          'success',
          'Agendamento Confirmado!',
          `${res.serviceName} agendado para ${formatDateBR(res.date)} às ${res.startTime}.`
        );
        await fetchClientMe();
        await fetchAvailability();
      }
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  // Handler: Join Waitlist
  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToken || !clientProfile) {
      notify(
        'warning',
        'Identificação Necessária',
        'Faça login ou crie sua conta para entrar na fila de espera.'
      );
      setActiveTab('profile');
      return;
    }
    if (!selectedServiceId || !selectedDate) {
      notify('error', 'Dados Obrigatórios', 'Selecione o serviço e a data desejada.');
      return;
    }
    setIsWaitlistSubmitting(true);
    try {
      const res = await clientApiRequest<WaitlistEntry>('/api/client-portal/waitlist', 'POST', {
        serviceId: selectedServiceId,
        professionalId: selectedProfId,
        desiredDate: selectedDate,
        preferredPeriod: waitlistPeriod,
        notes: waitlistNotes,
      });
      if (res) {
        notify(
          'success',
          'Solicitação Registrada na Fila de Espera',
          `Avisaremos prioritariamente caso surja vaga em ${formatDateBR(res.desiredDate)} (${
            res.preferredPeriod
          }).`
        );
        setShowWaitlistForm(false);
        setWaitlistNotes('');
        await fetchClientMe();
      }
    } finally {
      setIsWaitlistSubmitting(false);
    }
  };

  // Handler: Cancel Appointment
  const handleConfirmCancelAppointment = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const res = await clientApiRequest(
        `/api/client-portal/appointments/${cancelTarget.id}/cancel`,
        'POST'
      );
      if (res) {
        notify(
          'warning',
          'Horário Cancelado',
          `Seu agendamento de ${cancelTarget.serviceName} foi cancelado.`
        );
        setCancelTarget(null);
        await fetchClientMe();
        await fetchAvailability();
      }
    } finally {
      setIsCancelling(false);
    }
  };

  // Handler: Reschedule Appointment
  const openRescheduleModal = (apt: Appointment) => {
    setRescheduleTarget(apt);
    setRescheduleDate(apt.date);
    setRescheduleProfId(apt.professionalId);
    setRescheduleSlot('');
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleDate || !rescheduleSlot) return;
    setIsRescheduling(true);
    try {
      const res = await clientApiRequest<Appointment>(
        `/api/client-portal/appointments/${rescheduleTarget.id}/reschedule`,
        'POST',
        {
          date: rescheduleDate,
          startTime: rescheduleSlot,
          professionalId: rescheduleProfId,
        }
      );
      if (res) {
        notify(
          'success',
          'Agendamento Remarcado',
          `Novo horário confirmado para ${formatDateBR(res.date)} às ${res.startTime}.`
        );
        setRescheduleTarget(null);
        await fetchClientMe();
        await fetchAvailability();
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  // Handler: Remove Waitlist Entry
  const handleRemoveWaitlist = async (id: string) => {
    const res = await clientApiRequest(`/api/client-portal/waitlist/${id}`, 'DELETE');
    if (res) {
      notify('warning', 'Fila de Espera', 'Sua solicitação de vaga foi encerrada.');
      await fetchClientMe();
    }
  };

  // Handler: Update Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await clientApiRequest<{ client: Client }>('/api/client-portal/profile', 'PUT', {
        name: profName,
        phone: profPhone,
        birthDate: profBirthDate,
        allergies: profAllergies,
        notes: profNotes,
        newPassword: profNewPassword || undefined,
      });
      if (res && res.client) {
        setClientProfile(res.client);
        setProfNewPassword('');
        notify('success', 'Perfil Atualizado', 'Seus dados pessoais e preferências foram salvos.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveClientPhotoModal = async (newAvatarUrl: string, newName?: string) => {
    if (!clientProfile) return;
    const res = await clientApiRequest<{ client: Client }>('/api/client-portal/profile', 'PUT', {
      name: newName || clientProfile.name,
      phone: clientProfile.phone,
      avatarUrl: newAvatarUrl,
    });
    if (res && res.client) {
      setClientProfile(res.client);
      setProfName(res.client.name);
      notify(
        'success',
        'Foto de Perfil Atualizada',
        'Sua foto e identificação foram atualizadas com sucesso.'
      );
    }
  };

  const filteredServices = useMemo(() => {
    if (!catalog) return [];
    if (categoryFilter === 'all') return catalog.services;
    return catalog.services.filter((s) => s.category === categoryFilter);
  }, [catalog, categoryFilter]);

  const activeAppointmentsList = useMemo(() => {
    return myAppointments.filter((a) =>
      aptHistoryFilter === 'upcoming'
        ? a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'in_progress'
        : a.status === 'completed' || a.status === 'cancelled'
    );
  }, [myAppointments, aptHistoryFilter]);

  const activeSlideObj = banners[currentSlide] || banners[0];
  const selectedServiceObj = catalog?.services.find((s) => s.id === selectedServiceId);
  const selectedProfObj = catalog?.professionals.find((p) => p.id === selectedProfId);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 flex flex-col pb-20 md:pb-0">
      {/* Top Navigation Header — 3-Zone Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-zinc-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-left group cursor-pointer shrink-0"
          >
            <span className="font-serif-display text-xl sm:text-2xl font-semibold tracking-tight text-zinc-950 block">
              {catalog?.salon.salonName || 'Lumina Atelier'}
            </span>
            <span className="text-[11px] text-zinc-500 hidden sm:block">
              Jardins Flagship · Experiência & Agendamento Online
            </span>
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium">
            {(
              [
                { id: 'home', label: 'Início & Catálogo' },
                { id: 'book', label: 'Agendar Horário' },
                {
                  id: 'appointments',
                  label: `Meus Horários${
                    myAppointments.filter(
                      (a) => a.status !== 'cancelled' && a.status !== 'completed'
                    ).length > 0
                      ? ` (${
                          myAppointments.filter(
                            (a) => a.status !== 'cancelled' && a.status !== 'completed'
                          ).length
                        })`
                      : ''
                  }`,
                },
                {
                  id: 'profile',
                  label: clientProfile ? `Olá, ${clientProfile.name.split(' ')[0]}` : 'Minha Conta',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 transition-colors whitespace-nowrap cursor-pointer border-b-2 ${
                  activeTab === item.id
                    ? 'border-zinc-900 text-zinc-950 font-semibold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: User Profile Badge (Photo + Name + Role) & ADM Switch */}
          <div className="flex items-center gap-2.5 shrink-0">
            {!clientProfile ? (
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserAvatar size="xs" variant="light" />
                <span>Entrar / Cadastrar</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsClientPhotoModalOpen(true)}
                  title="Visualizar ou alterar foto de perfil"
                  className="inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200/80 transition-colors cursor-pointer"
                >
                  <UserAvatar
                    name={clientProfile.name}
                    avatarUrl={clientProfile.avatarUrl}
                    size="sm"
                    variant="light"
                  />
                  <div className="text-left leading-tight hidden sm:block">
                    <p className="text-xs font-semibold text-zinc-900 truncate max-w-[130px]">
                      {clientProfile.name}
                    </p>
                    <p className="text-[10px] font-mono-num uppercase text-amber-900 font-semibold">
                      Cliente · {clientProfile.tier}
                    </p>
                  </div>
                </button>
              </div>
            )}

            {onSwitchToProfessional && (
              <button
                type="button"
                onClick={onSwitchToProfessional}
                className="px-3 py-2 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                title="Acessar Área Exclusiva do Profissional"
              >
                Área do Profissional
              </button>
            )}

            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="px-3 py-2 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              title="Acessar Painel Administrativo (ADM)"
            >
              Painel ADM
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {/* ===================================================================
            TAB 1: INÍCIO (HERO CAROUSEL, CATÁLOGO DE SERVIÇOS, ESPECIALISTAS)
           =================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-12">
            {/* Automatic Photographic Hero Carousel */}
            <section
              className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-900 shadow-sm"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
            >
              <div className="relative h-[380px] sm:h-[460px] lg:h-[520px] w-full">
                {banners.map((slide, index) => {
                  const isActive = index === currentSlide;
                  return (
                    <div
                      key={slide.id}
                      className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                      }`}
                    >
                      <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = FALLBACK_BANNER_IMAGE;
                        }}
                        className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000"
                      />
                      {/* High-Contrast Gradient Scrim */}
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/50 to-zinc-950/20" />
                    </div>
                  );
                })}

                {/* Slide Text Overlay */}
                <div className="relative z-20 h-full flex flex-col justify-end p-6 sm:p-10 lg:p-14 max-w-3xl">
                  <p className="text-[11px] sm:text-xs font-mono-num uppercase tracking-widest text-amber-300 mb-2">
                    {catalog?.salon.salonName || 'Lumina Atelier'} · Alta Beleza & Bem-Estar
                  </p>
                  <h1
                    className="font-serif-display text-3xl sm:text-5xl lg:text-6xl font-medium text-white leading-[1.08] tracking-tight"
                    style={{ textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}
                  >
                    {activeSlideObj.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-200 mt-3 sm:mt-4 max-w-xl leading-relaxed">
                    {activeSlideObj.subtitle}
                  </p>

                  <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('book')}
                      className="px-6 py-3 text-xs sm:text-sm font-semibold text-zinc-950 bg-white hover:bg-zinc-100 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>{activeSlideObj.ctaLabel || 'Agendar Agora'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('catalogo-servicos');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-5 py-3 text-xs sm:text-sm font-medium text-white bg-white/10 hover:bg-white/20 backdrop-blur-xs border border-white/20 rounded-xl transition-colors cursor-pointer"
                    >
                      Explorar Catálogo & Preços
                    </button>
                  </div>
                </div>

                {/* Carousel Controls (Prev/Next + Indicators) */}
                {banners.length > 1 && (
                  <>
                    <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length)
                        }
                        aria-label="Slide anterior"
                        className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentSlide((prev) => (prev + 1) % banners.length)}
                        aria-label="Próximo slide"
                        className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/70 text-white border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
                      {banners.map((b, idx) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setCurrentSlide(idx)}
                          aria-label={`Ir para slide ${idx + 1}`}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            idx === currentSlide
                              ? 'w-8 bg-amber-400'
                              : 'w-2 bg-white/40 hover:bg-white/70'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Salon Highlights & Hospitality Strip */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 flex items-start gap-3.5">
                <MapPin className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-zinc-900">Endereço & Hospitalidade</h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    {catalog?.salon.address || 'Rua Oscar Freire, 1420 — Jardins, São Paulo - SP'}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 flex items-start gap-3.5">
                <Clock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-zinc-900">Horário de Funcionamento</h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    Terça a Sábado, das {catalog?.salon.openingTime || '09:00'} às{' '}
                    {catalog?.salon.closingTime || '20:00'} · Concierge:{' '}
                    <span className="font-mono-num">
                      {catalog?.salon.phone || '(11) 3088-4590'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-white border border-zinc-200/80 rounded-xl p-5 flex items-start gap-3.5">
                <ShieldCheck className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-zinc-900">
                    Política Flexível de Agendamento
                  </h2>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                    Reagende ou cancele online sem taxas com até{' '}
                    <strong className="font-mono-num">
                      {catalog?.salon.cancellationNoticeHours ?? 4} horas
                    </strong>{' '}
                    de antecedência.
                  </p>
                </div>
              </div>
            </section>

            {/* Service Catalog with Real Prices */}
            <section id="catalogo-servicos" className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
                    Catálogo de Serviços & Protocolos
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Valores reais, duração estimada de cadeira e agendamento imediato
                  </p>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {[
                    'all',
                    'Cabelo',
                    'Coloração',
                    'Estética Facial',
                    'Unhas',
                    'Maquiagem & Noivas',
                  ].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white border border-zinc-200/80 text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {cat === 'all' ? 'Todos os Serviços' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingCatalog ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div
                      key={n}
                      className="h-44 rounded-xl bg-zinc-200/60 animate-pulse border border-zinc-200"
                    />
                  ))}
                </div>
              ) : filteredServices.length === 0 ? (
                <EmptyState
                  title="Nenhum serviço nesta categoria"
                  description="Selecione outra categoria para visualizar os protocolos disponíveis."
                  actionLabel="Ver Todos"
                  onAction={() => setCategoryFilter('all')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredServices.map((srv) => (
                    <div
                      key={srv.id}
                      className="bg-white border border-zinc-200/80 rounded-xl p-6 flex flex-col justify-between hover:border-zinc-400 transition-colors"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                          <span className="font-semibold text-amber-900">{srv.category}</span>
                          <span className="font-mono-num">{srv.durationMinutes} min de duração</span>
                        </div>
                        <h3 className="font-serif-display text-xl font-semibold text-zinc-900 mt-2">
                          {srv.name}
                        </h3>
                        <p className="text-xs text-zinc-600 mt-2 leading-relaxed line-clamp-3">
                          {srv.description}
                        </p>
                      </div>

                      <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Investimento</span>
                          <span className="text-lg font-semibold font-mono-num text-zinc-900">
                            {formatBRL(srv.price)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectServiceAndBook(srv.id)}
                          className="px-4 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Agendar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Specialists Showcase */}
            <section className="space-y-6">
              <div>
                <h2 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
                  Nossos Especialistas
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Profissionais residentes com agenda integrada em tempo real
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(catalog?.professionals || []).map((prof) => (
                  <div
                    key={prof.id}
                    className="bg-white border border-zinc-200/80 rounded-xl p-5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-10 h-10 rounded-full bg-zinc-900 text-amber-300 font-serif-display text-base font-semibold flex items-center justify-center">
                        {prof.name
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-900 mt-3">{prof.name}</h3>
                      <p className="text-xs text-amber-900 font-medium mt-0.5">{prof.specialty}</p>
                      <p className="text-[11px] text-zinc-500 mt-3">
                        Dias:{' '}
                        <span className="text-zinc-700 font-medium">
                          {prof.workDays.join(', ')}
                        </span>
                      </p>
                      <p className="text-[11px] text-zinc-500 font-mono-num mt-0.5">
                        Horário: {prof.workHours}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectProfAndBook(prof.id)}
                      className="mt-5 w-full py-2 px-3 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Ver Horários de {prof.name.split(' ')[0]}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB 2: AGENDAR HORÁRIO & FILA DE ESPERA (REAL AVAILABILITY)
           =================================================================== */}
        {activeTab === 'book' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
                  Agendamento Online em Tempo Real
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Horários calculados diretamente da grade oficial dos especialistas do salão
                </p>
              </div>
              {!clientProfile && (
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="px-3.5 py-2 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer self-start"
                >
                  Já possui conta? Entre aqui
                </button>
              )}
            </div>

            {lastBookedConfirmation && (
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-serif-display text-xl font-semibold text-emerald-950">
                      Horário Reservado com Sucesso!
                    </h2>
                    <p className="text-xs text-emerald-900 mt-1">
                      Protocolo <strong>{lastBookedConfirmation.serviceName}</strong> com{' '}
                      <strong>{lastBookedConfirmation.professionalName}</strong> confirmado para{' '}
                      <strong className="font-mono-num">
                        {formatDateBR(lastBookedConfirmation.date)} das{' '}
                        {lastBookedConfirmation.startTime} às {lastBookedConfirmation.endTime}
                      </strong>{' '}
                      ({formatBRL(lastBookedConfirmation.price)}).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('appointments')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-800 rounded-lg cursor-pointer"
                  >
                    Ver em Meus Agendamentos
                  </button>
                  <button
                    type="button"
                    onClick={() => setLastBookedConfirmation(null)}
                    className="px-4 py-2 text-xs font-medium text-emerald-900 bg-white border border-emerald-300 rounded-lg cursor-pointer"
                  >
                    Fazer Outro Agendamento
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 8 Cols: Step-by-Step Selection */}
              <div className="lg:col-span-8 space-y-6">
                {/* Step 1: Select Service */}
                <div className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    1. Escolha o Serviço ou Ritual
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(catalog?.services || []).map((srv) => {
                      const isSelected = selectedServiceId === srv.id;
                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => setSelectedServiceId(srv.id)}
                          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-zinc-50/60 hover:bg-zinc-100/80 text-zinc-900 border-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] font-medium ${
                                isSelected ? 'text-amber-300' : 'text-zinc-500'
                              }`}
                            >
                              {srv.category} · {srv.durationMinutes} min
                            </span>
                            <span
                              className={`text-xs font-mono-num font-semibold ${
                                isSelected ? 'text-white' : 'text-zinc-900'
                              }`}
                            >
                              {formatBRL(srv.price)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold mt-1.5">{srv.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Select Professional */}
                <div className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    2. Selecione o(a) Especialista
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(catalog?.professionals || []).map((prof) => {
                      const isSelected = selectedProfId === prof.id;
                      return (
                        <button
                          key={prof.id}
                          type="button"
                          onClick={() => setSelectedProfId(prof.id)}
                          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-zinc-50/60 hover:bg-zinc-100/80 text-zinc-900 border-zinc-200'
                          }`}
                        >
                          <p className="text-xs font-semibold">{prof.name}</p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              isSelected ? 'text-amber-300' : 'text-zinc-500'
                            }`}
                          >
                            {prof.specialty}
                          </p>
                          <p
                            className={`text-[11px] mt-2 font-mono-num ${
                              isSelected ? 'text-zinc-300' : 'text-zinc-500'
                            }`}
                          >
                            Atende: {prof.workDays.join(', ')} ({prof.workHours})
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 3: Select Date & Available Slot */}
                <div className="bg-white border border-zinc-200/80 rounded-xl p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        3. Escolha a Data e o Horário Disponível
                      </h2>
                      <p className="text-xs text-zinc-500">
                        Apenas horários livres e sem conflito de agenda são exibidos abaixo
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-500" />
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg font-mono-num"
                      />
                    </div>
                  </div>

                  {/* Quick Horizontal Date Strip */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {nextDaysStrip.map((d) => {
                      const isSelected = selectedDate === d.iso;
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setSelectedDate(d.iso)}
                          className={`min-w-[68px] py-2.5 px-3 rounded-xl border text-center transition-colors shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}
                        >
                          <span
                            className={`text-[10px] uppercase block ${
                              isSelected ? 'text-amber-300' : 'text-zinc-400'
                            }`}
                          >
                            {d.weekShort}
                          </span>
                          <span className="text-base font-semibold font-mono-num block mt-0.5">
                            {d.dayNum}
                          </span>
                          <span
                            className={`text-[10px] block ${
                              isSelected ? 'text-zinc-300' : 'text-zinc-500'
                            }`}
                          >
                            {d.monthShort}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Slots Grid */}
                  {isLoadingSlots ? (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <div
                          key={n}
                          className="h-10 rounded-lg bg-zinc-100 animate-pulse border border-zinc-200"
                        />
                      ))}
                    </div>
                  ) : !availability?.isWorkingDay ? (
                    <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-3">
                      <p className="font-semibold">
                        {availability?.reason ||
                          'Este especialista não atende neste dia da semana.'}
                      </p>
                      <p className="text-amber-800">
                        Selecione outra data acima ou inscreva-se na Fila de Espera caso deseje um encaixe especial.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowWaitlistForm(true)}
                        className="px-3.5 py-2 text-xs font-semibold text-amber-950 bg-amber-200/70 hover:bg-amber-200 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ListPlus className="w-4 h-4" />
                        <span>Solicitar Vaga na Fila de Espera</span>
                      </button>
                    </div>
                  ) : availability.availableSlots.length === 0 ? (
                    <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 space-y-3">
                      <p className="font-semibold">
                        Agenda completa para {selectedProfObj?.name || 'o especialista'} em{' '}
                        {formatDateBR(selectedDate)}.
                      </p>
                      <p className="text-amber-800">
                        Todos os horários desta data estão preenchidos. Entre na Fila de Espera para ser avisada(o) prioritariamente em caso de desistência.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowWaitlistForm(true)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ListPlus className="w-4 h-4" />
                        <span>Entrar na Fila de Espera para {formatDateBR(selectedDate)}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                        {availability.availableSlots.map((slotObj) => {
                          const isSelected = selectedSlot === slotObj.startTime;
                          return (
                            <button
                              key={slotObj.startTime}
                              type="button"
                              onClick={() => setSelectedSlot(slotObj.startTime)}
                              className={`py-2.5 px-3 rounded-lg font-mono-num text-xs font-semibold border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-zinc-900 text-white border-zinc-900'
                                  : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:border-zinc-400'
                              }`}
                            >
                              {slotObj.startTime}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[11px] text-zinc-500">
                        <span>
                          {availability.availableSlots.length} horários livres encontrados para{' '}
                          {formatDateBR(selectedDate)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowWaitlistForm(!showWaitlistForm)}
                          className="text-amber-900 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span>Não encontrou seu horário ideal? Fila de Espera</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Waitlist Request Box */}
                  {showWaitlistForm && (
                    <form
                      onSubmit={handleJoinWaitlist}
                      className="mt-4 p-5 rounded-xl bg-zinc-50 border border-zinc-200/90 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xs font-semibold text-zinc-900">
                            Solicitação de Vaga — Fila de Espera Oficial
                          </h3>
                          <p className="text-[11px] text-zinc-500">
                            Nossa recepção notificará você caso um horário seja liberado em{' '}
                            {formatDateBR(selectedDate)}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowWaitlistForm(false)}
                          className="text-xs text-zinc-400 hover:text-zinc-700 cursor-pointer"
                        >
                          Fechar
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                            Período de Preferência
                          </label>
                          <select
                            value={waitlistPeriod}
                            onChange={(e) =>
                              setWaitlistPeriod(
                                e.target.value as WaitlistEntry['preferredPeriod']
                              )
                            }
                            className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                          >
                            <option value="Qualquer Horário">Qualquer Horário</option>
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                            Observação (Opcional)
                          </label>
                          <input
                            type="text"
                            value={waitlistNotes}
                            onChange={(e) => setWaitlistNotes(e.target.value)}
                            placeholder="Ex.: Posso chegar em 20 minutos se surgir vaga"
                            className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isWaitlistSubmitting}
                          className="px-4 py-2 text-xs font-semibold text-white bg-amber-900 hover:bg-amber-800 rounded-lg cursor-pointer"
                        >
                          {isWaitlistSubmitting
                            ? 'Registrando...'
                            : 'Confirmar Solicitação na Fila de Espera'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Right 4 Cols: Booking Summary & Confirmation Card */}
              <div className="lg:col-span-4 bg-white border border-zinc-200/80 rounded-xl p-6 space-y-5 sticky top-24">
                <div className="pb-4 border-b border-zinc-100">
                  <span className="text-[11px] font-mono-num uppercase tracking-wider text-amber-800 font-semibold">
                    Resumo da Reserva
                  </span>
                  <h2 className="font-serif-display text-2xl font-semibold text-zinc-900 mt-1">
                    Confirmação de Horário
                  </h2>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Cliente:</span>
                    <span className="font-semibold text-zinc-900 text-right">
                      {clientProfile ? clientProfile.name : 'Não identificada(o)'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Serviço:</span>
                    <span className="font-semibold text-zinc-900 text-right">
                      {selectedServiceObj?.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Especialista:</span>
                    <span className="font-medium text-zinc-800 text-right">
                      {selectedProfObj?.name || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Data & Horário:</span>
                    <span className="font-mono-num font-semibold text-zinc-900 text-right">
                      {formatDateBR(selectedDate)} {selectedSlot ? `às ${selectedSlot}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-500">Duração Estimada:</span>
                    <span className="font-mono-num text-zinc-700">
                      {selectedServiceObj?.durationMinutes || 0} min
                    </span>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-900">Valor do Protocolo</span>
                    <span className="text-xl font-semibold font-mono-num text-zinc-900">
                      {formatBRL(selectedServiceObj?.price || 0)}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleConfirmBooking} className="space-y-4 pt-2">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                      Preferências ou Observações para o Especialista (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Ex.: Sensibilidade no couro cabeludo, preferência por água morna..."
                      className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg"
                    />
                  </div>

                  {/* Optional Reference Photos for the Professional */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] font-medium text-zinc-600">
                      Fotos de Referência para o Atendimento ({bookingRefPhotos.length}/4)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={bookingRefInput}
                        onChange={(e) => setBookingRefInput(e.target.value)}
                        placeholder="URL da foto ou selecione abaixo..."
                        className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (bookingRefInput.trim() && bookingRefPhotos.length < 4) {
                            setBookingRefPhotos((prev) => [...prev, bookingRefInput.trim()]);
                            setBookingRefInput('');
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
                      >
                        Anexar
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const url =
                            '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg';
                          if (bookingRefPhotos.length < 4 && !bookingRefPhotos.includes(url)) {
                            setBookingRefPhotos((prev) => [...prev, url]);
                          }
                        }}
                        className="px-2 py-1 text-[10px] font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer"
                      >
                        + Ref. Mechas Contour
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url =
                            '/src/assets/images/salon_banner_facial_spa_1793234472494.jpg';
                          if (bookingRefPhotos.length < 4 && !bookingRefPhotos.includes(url)) {
                            setBookingRefPhotos((prev) => [...prev, url]);
                          }
                        }}
                        className="px-2 py-1 text-[10px] font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded cursor-pointer"
                      >
                        + Ref. Glow Spa
                      </button>
                    </div>
                    {bookingRefPhotos.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        {bookingRefPhotos.map((pUrl, idx) => (
                          <div
                            key={idx}
                            className="relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-300"
                          >
                            <img src={pUrl} alt="Ref" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() =>
                                setBookingRefPhotos((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-zinc-900/80 text-white text-[10px] flex items-center justify-center cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!clientProfile ? (
                    <div className="space-y-2.5">
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                        Para garantir sua segurança e isolamento dos seus dados, identifique-se antes de concluir a reserva.
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className="w-full py-3 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                      >
                        Entrar ou Criar Conta para Confirmar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={!selectedSlot || isBookingSubmitting}
                      className="w-full py-3 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 rounded-xl transition-colors cursor-pointer"
                    >
                      {isBookingSubmitting
                        ? 'Confirmando Agendamento...'
                        : selectedSlot
                        ? `Confirmar Agendamento às ${selectedSlot}`
                        : 'Selecione um Horário Disponível'}
                    </button>
                  )}

                  <p className="text-[11px] text-zinc-400 leading-relaxed text-center">
                    Cancelamento ou reagendamento gratuito até{' '}
                    {catalog?.salon.cancellationNoticeHours ?? 4}h antes do horário marcado.
                  </p>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: MEUS AGENDAMENTOS & FILA DE ESPERA (CLIENT DATA ISOLATION)
           =================================================================== */}
        {activeTab === 'appointments' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
                  Meus Agendamentos & Histórico
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Acompanhe seus horários exclusivos, reagende ou solicite cancelamento conforme regras do salão
                </p>
              </div>

              {clientProfile && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchClientMe}
                    className="px-3 py-2 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Atualizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('book')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
                  >
                    Novo Horário
                  </button>
                </div>
              )}
            </div>

            {!clientProfile ? (
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto">
                <Lock className="w-8 h-8 text-amber-800 mx-auto mb-3" />
                <h2 className="font-serif-display text-2xl font-semibold text-zinc-900">
                  Acesso Exclusivo e Protegido
                </h2>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  Para proteger sua privacidade, cada cliente visualiza apenas seus próprios agendamentos e solicitações após autenticação segura.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="mt-6 px-6 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
                >
                  Entrar na Minha Conta
                </button>
              </div>
            ) : (
              <>
                {/* Filter Tabs */}
                <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAptHistoryFilter('upcoming')}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        aptHistoryFilter === 'upcoming'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-900'
                      }`}
                    >
                      Próximos / Ativos (
                      {
                        myAppointments.filter(
                          (a) =>
                            a.status === 'scheduled' ||
                            a.status === 'confirmed' ||
                            a.status === 'in_progress'
                        ).length
                      }
                      )
                    </button>
                    <button
                      type="button"
                      onClick={() => setAptHistoryFilter('history')}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                        aptHistoryFilter === 'history'
                          ? 'bg-zinc-900 text-white'
                          : 'bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-900'
                      }`}
                    >
                      Concluídos & Cancelados (
                      {
                        myAppointments.filter(
                          (a) => a.status === 'completed' || a.status === 'cancelled'
                        ).length
                      }
                      )
                    </button>
                  </div>

                  <span className="text-[11px] text-zinc-500 hidden sm:inline">
                    Antecedência mínima para alteração:{' '}
                    {catalog?.salon.cancellationNoticeHours ?? 4}h
                  </span>
                </div>

                {isLoadingMe ? (
                  <div className="space-y-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="h-28 bg-zinc-200/60 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : activeAppointmentsList.length === 0 ? (
                  <EmptyState
                    title={
                      aptHistoryFilter === 'upcoming'
                        ? 'Você não possui agendamentos futuros ativos'
                        : 'Nenhum histórico de atendimento concluído ou cancelado'
                    }
                    description="Reserve um novo horário no catálogo de serviços para cuidar de você no Lumina Atelier."
                    actionLabel="Agendar Agora"
                    onAction={() => setActiveTab('book')}
                  />
                ) : (
                  <div className="space-y-4">
                    {activeAppointmentsList.map((apt) => {
                      const canModify =
                        apt.status === 'scheduled' || apt.status === 'confirmed';
                      return (
                        <div
                          key={apt.id}
                          className="bg-white border border-zinc-200/80 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono-num font-semibold text-zinc-900">
                                {formatDateBR(apt.date)} · {apt.startTime} às {apt.endTime}
                              </span>
                              <span className="text-zinc-300">·</span>
                              <span
                                className={`font-semibold ${
                                  apt.status === 'completed'
                                    ? 'text-emerald-700'
                                    : apt.status === 'cancelled'
                                    ? 'text-red-600'
                                    : apt.status === 'confirmed'
                                    ? 'text-amber-800'
                                    : 'text-zinc-800'
                                }`}
                              >
                                {apt.status === 'scheduled'
                                  ? 'Agendado'
                                  : apt.status === 'confirmed'
                                  ? 'Confirmado'
                                  : apt.status === 'in_progress'
                                  ? 'Em Atendimento'
                                  : apt.status === 'completed'
                                  ? 'Concluído'
                                  : 'Cancelado'}
                              </span>
                            </div>

                            <h3 className="font-serif-display text-xl font-semibold text-zinc-900">
                              {apt.serviceName}
                            </h3>

                            <p className="text-xs text-zinc-600">
                              Especialista: <strong>{apt.professionalName}</strong> · Valor:{' '}
                              <span className="font-mono-num font-semibold text-zinc-900">
                                {formatBRL(apt.price)}
                              </span>
                            </p>

                            {apt.notes && (
                              <p className="text-[11px] text-zinc-500 pt-1">{apt.notes}</p>
                            )}
                          </div>

                          {canModify && (
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openRescheduleModal(apt)}
                                className="px-3.5 py-2 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Reagendar
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelTarget(apt)}
                                className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* My Waitlist Requests */}
                <div className="pt-6 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      Minhas Solicitações na Fila de Espera ({myWaitlist.length})
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Pedidos de encaixe caso surjam desistências na agenda
                    </p>
                  </div>

                  {myWaitlist.length === 0 ? (
                    <div className="bg-white border border-zinc-200/70 rounded-xl p-5 text-xs text-zinc-500">
                      Você não possui solicitações ativas na fila de espera no momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myWaitlist.map((w) => (
                        <div
                          key={w.id}
                          className="bg-white border border-zinc-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-900">{w.serviceName}</span>
                              <span className="text-zinc-300">·</span>
                              <span className="font-mono-num text-amber-900 font-medium">
                                Data desejada: {formatDateBR(w.desiredDate)} ({w.preferredPeriod})
                              </span>
                            </div>
                            <p className="text-zinc-500 mt-1">
                              Especialista: {w.professionalName} · Status:{' '}
                              <strong className="text-zinc-800">
                                {w.status === 'waiting'
                                  ? 'Aguardando Vaga'
                                  : w.status === 'notified'
                                  ? 'Vaga Notificada'
                                  : w.status === 'booked'
                                  ? 'Convertido em Agendamento'
                                  : 'Encerrado'}
                              </strong>
                            </p>
                          </div>
                          {w.status === 'waiting' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveWaitlist(w.id)}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 self-start sm:self-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover da Fila</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 4: PERFIL DA CLIENTE (LOGIN, CADASTRO, RECUPERAÇÃO, MEUS DADOS)
           =================================================================== */}
        {activeTab === 'profile' && (
          <div className="max-w-xl mx-auto">
            {!clientProfile ? (
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-8 space-y-6">
                <div>
                  <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
                    Área Exclusiva da Cliente
                  </h1>
                  <p className="text-xs text-zinc-500 mt-1">
                    Gerencie seus agendamentos, histórico de protocolos e preferências de atendimento com privacidade.
                  </p>
                </div>

                {/* Auth Mode Switcher */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 rounded-xl text-xs font-medium">
                  {(
                    [
                      { id: 'login', label: 'Entrar' },
                      { id: 'register', label: 'Criar Cadastro' },
                      { id: 'recover', label: 'Recuperar Senha' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAuthTab(t.id)}
                      className={`py-2 rounded-lg transition-colors cursor-pointer ${
                        authTab === t.id
                          ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* SUBTAB: LOGIN */}
                {authTab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Seu E-mail *
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="seu.email@exemplo.com"
                          className="w-full pl-10 pr-3 py-2.5 text-xs bg-white border border-zinc-300 rounded-lg"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Senha *
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-3 py-2.5 text-xs bg-white border border-zinc-300 rounded-lg"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthSubmitting}
                      className="w-full py-3 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                      {isAuthSubmitting ? 'Autenticando...' : 'Entrar na Minha Conta'}
                    </button>

                    {/* Demo Client Account Quick Fill */}
                    <div className="pt-4 border-t border-zinc-100">
                      <p className="text-[11px] font-medium text-zinc-500 mb-2">
                        Conta de Cliente Demonstrativa (para teste imediato do fluxo):
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail('beatriz.barros@email.com');
                          setLoginPassword('Cliente@2026');
                        }}
                        className="w-full text-left p-3 rounded-lg bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between font-semibold text-zinc-900">
                          <span>Beatriz Monteiro de Barros (Cliente Signature)</span>
                          <span className="font-mono-num text-[11px] text-amber-900">
                            Preencher 1-Click
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-600 font-mono-num mt-0.5">
                          beatriz.barros@email.com · Senha: Cliente@2026
                        </p>
                      </button>
                    </div>
                  </form>
                )}

                {/* SUBTAB: REGISTER */}
                {authTab === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Nome Completo *
                        </label>
                        <input
                          type="text"
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Maria Eduarda Silva"
                          className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="text"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          placeholder="(11) 99999-0000"
                          className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          E-mail *
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="maria@email.com"
                          className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Senha de Acesso (mín. 6 caracteres) *
                        </label>
                        <input
                          type="password"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          CPF (Opcional — útil para recuperação)
                        </label>
                        <input
                          type="text"
                          value={regCpf}
                          onChange={(e) => setRegCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">
                          Data de Nascimento
                        </label>
                        <input
                          type="date"
                          value={regBirthDate}
                          onChange={(e) => setRegBirthDate(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Alergias ou Sensibilidades Cosméticas (Anamnese)
                      </label>
                      <input
                        type="text"
                        value={regAllergies}
                        onChange={(e) => setRegAllergies(e.target.value)}
                        placeholder="Ex.: Nenhuma, ou sensibilidade a amônia / fragrâncias"
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthSubmitting}
                      className="w-full py-3 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                      {isAuthSubmitting ? 'Criando Cadastro...' : 'Concluir Cadastro e Acessar'}
                    </button>
                  </form>
                )}

                {/* SUBTAB: RECOVER PASSWORD */}
                {authTab === 'recover' && (
                  <form onSubmit={handleRecoverPassword} className="space-y-4">
                    <div className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs text-zinc-600 leading-relaxed">
                      Informe seu e-mail cadastrado e os{' '}
                      <strong>4 últimos dígitos do seu telefone</strong> (ou os 4 primeiros dígitos
                      do seu CPF) para redefinir sua senha imediatamente.
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        E-mail Cadastrado *
                      </label>
                      <input
                        type="email"
                        value={recEmail}
                        onChange={(e) => setRecEmail(e.target.value)}
                        placeholder="seu.email@exemplo.com"
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        4 Últimos Dígitos do Telefone (ou 4 primeiros do CPF) *
                      </label>
                      <input
                        type="text"
                        maxLength={14}
                        value={recVerification}
                        onChange={(e) => setRecVerification(e.target.value)}
                        placeholder="Ex.: 2211"
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Nova Senha (mín. 6 caracteres) *
                      </label>
                      <input
                        type="password"
                        value={recNewPassword}
                        onChange={(e) => setRecNewPassword(e.target.value)}
                        placeholder="Nova senha segura"
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isAuthSubmitting}
                      className="w-full py-3 px-4 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                      {isAuthSubmitting ? 'Validando...' : 'Redefinir Minha Senha'}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* AUTHENTICATED CLIENT PROFILE */
              <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-5">
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      name={clientProfile.name}
                      avatarUrl={clientProfile.avatarUrl}
                      size="lg"
                      variant="light"
                      showCameraBadge
                      onClick={() => setIsClientPhotoModalOpen(true)}
                      title="Clique para alterar sua foto de perfil"
                    />
                    <div>
                      <span className="text-[11px] font-mono-num uppercase text-amber-800 font-semibold">
                        Papel: Cliente · {clientProfile.tier}
                      </span>
                      <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
                        {clientProfile.name}
                      </h1>
                      <p className="text-xs text-zinc-500">{clientProfile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setIsClientPhotoModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
                    >
                      Alterar Foto
                    </button>
                    <button
                      type="button"
                      onClick={handleClientLogout}
                      className="px-3.5 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                    <span className="text-zinc-500 block">Visitas Realizadas</span>
                    <span className="text-lg font-semibold font-mono-num text-zinc-900 mt-0.5 block">
                      {clientProfile.visitsCount}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70">
                    <span className="text-zinc-500 block">Última Visita</span>
                    <span className="text-sm font-semibold font-mono-num text-zinc-900 mt-1 block">
                      {formatDateBR(clientProfile.lastVisit)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 col-span-2 sm:col-span-1">
                    <span className="text-zinc-500 block">Horários Ativos</span>
                    <span className="text-lg font-semibold font-mono-num text-zinc-900 mt-0.5 block">
                      {
                        myAppointments.filter(
                          (a) => a.status === 'scheduled' || a.status === 'confirmed'
                        ).length
                      }
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Meus Dados & Ficha de Anamnese
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={profName}
                        onChange={(e) => setProfName(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Telefone / WhatsApp *
                      </label>
                      <input
                        type="text"
                        value={profPhone}
                        onChange={(e) => setProfPhone(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Data de Nascimento
                      </label>
                      <input
                        type="date"
                        value={profBirthDate}
                        onChange={(e) => setProfBirthDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Alterar Senha (Opcional)
                      </label>
                      <input
                        type="password"
                        value={profNewPassword}
                        onChange={(e) => setProfNewPassword(e.target.value)}
                        placeholder="Manter senha atual"
                        className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Alergias ou Restrições Químicas
                    </label>
                    <input
                      type="text"
                      value={profAllergies}
                      onChange={(e) => setProfAllergies(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Preferências de Hospitalidade (Bebidas, Temperatura, Observações)
                    </label>
                    <textarea
                      rows={2}
                      value={profNotes}
                      onChange={(e) => setProfNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer"
                    >
                      {isSavingProfile ? 'Salvando...' : 'Salvar Meus Dados'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block border-t border-zinc-200/80 bg-white py-6 px-8 mt-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-zinc-500">
          <div>
            <span className="font-serif-display font-semibold text-zinc-900">
              {catalog?.salon.salonName || 'Lumina Atelier'}
            </span>{' '}
            · {catalog?.salon.address}
          </div>
          <div className="flex items-center gap-4">
            <span>Recepção: {catalog?.salon.phone}</span>
            <span>·</span>
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="text-zinc-800 font-medium hover:underline cursor-pointer"
            >
              Acesso Restrito ADM
            </button>
          </div>
        </div>
      </footer>

      {/* =====================================================================
          MOBILE BOTTOM NAVIGATION BAR (Início, Agendar, Meus Horários, Perfil)
         ===================================================================== */}
      <nav
        aria-label="Navegação Principal Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200/90 px-2 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
          {(
            [
              { id: 'home', label: 'Início', icon: Home },
              { id: 'book', label: 'Agendar', icon: Sparkles },
              { id: 'appointments', label: 'Meus Horários', icon: Calendar },
              { id: 'profile', label: 'Perfil', icon: User },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const activeCount =
              item.id === 'appointments'
                ? myAppointments.filter(
                    (a) => a.status === 'scheduled' || a.status === 'confirmed'
                  ).length
                : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`min-h-[56px] py-2 px-1 flex flex-col items-center justify-center gap-1 rounded-lg transition-colors relative cursor-pointer ${
                  isActive ? 'text-zinc-950 font-semibold' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <div className="relative">
                  {item.id === 'profile' ? (
                    <UserAvatar
                      name={clientProfile?.name}
                      avatarUrl={clientProfile?.avatarUrl}
                      size="xs"
                      variant="light"
                    />
                  ) : (
                    <Icon className={`w-5 h-5 ${isActive ? 'text-amber-800' : 'text-zinc-500'}`} />
                  )}
                  {activeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 rounded-full bg-amber-800 text-white font-mono-num text-[10px] flex items-center justify-center">
                      {activeCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-none tracking-tight truncate max-w-[72px]">
                  {item.id === 'profile' && clientProfile
                    ? clientProfile.name.split(' ')[0]
                    : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* =====================================================================
          MODALS: RESCHEDULE & CANCEL CONFIRMATION
         ===================================================================== */}
      <Modal
        isOpen={Boolean(rescheduleTarget)}
        title="Reagendar Horário"
        subtitle={
          rescheduleTarget
            ? `Protocolo: ${rescheduleTarget.serviceName} · Antecedência mínima: ${
                catalog?.salon.cancellationNoticeHours ?? 4
              }h`
            : ''
        }
        onClose={() => setRescheduleTarget(null)}
      >
        <form onSubmit={handleConfirmReschedule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Especialista *
              </label>
              <select
                value={rescheduleProfId}
                onChange={(e) => setRescheduleProfId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
              >
                {(catalog?.professionals || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.specialty})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nova Data *</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-2">
              Horários Livres na Nova Data *
            </label>
            {isLoadingRescheduleSlots ? (
              <p className="text-xs text-zinc-500">Consultando disponibilidade real...</p>
            ) : !rescheduleAvailability?.isWorkingDay ? (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                {rescheduleAvailability?.reason || 'O especialista não atende nesta data.'}
              </p>
            ) : rescheduleAvailability.availableSlots.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
                Não há horários livres nesta data para o especialista selecionado.
              </p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {rescheduleAvailability.availableSlots.map((slotObj) => (
                  <button
                    key={slotObj.startTime}
                    type="button"
                    onClick={() => setRescheduleSlot(slotObj.startTime)}
                    className={`py-2 px-2.5 rounded-lg font-mono-num text-xs font-semibold border cursor-pointer ${
                      rescheduleSlot === slotObj.startTime
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-800 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {slotObj.startTime}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setRescheduleTarget(null)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={!rescheduleSlot || isRescheduling}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 rounded-lg cursor-pointer"
            >
              {isRescheduling ? 'Reagendando...' : 'Confirmar Novo Horário'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        title="Confirmar Cancelamento de Agendamento"
        description={
          cancelTarget
            ? `Deseja realmente cancelar o protocolo "${cancelTarget.serviceName}" agendado para ${formatDateBR(
                cancelTarget.date
              )} às ${cancelTarget.startTime}? O salão exige antecedência mínima de ${
                catalog?.salon.cancellationNoticeHours ?? 4
              } horas.`
            : ''
        }
        confirmLabel="Confirmar Cancelamento"
        onConfirm={handleConfirmCancelAppointment}
        onCancel={() => setCancelTarget(null)}
        isLoading={isCancelling}
      />

      {clientProfile && (
        <ProfilePhotoModal
          isOpen={isClientPhotoModalOpen}
          onClose={() => setIsClientPhotoModalOpen(false)}
          userName={clientProfile.name}
          userEmail={clientProfile.email}
          userRoleLabel={`Cliente · ${clientProfile.tier}`}
          currentAvatarUrl={clientProfile.avatarUrl}
          onSave={handleSaveClientPhotoModal}
        />
      )}
    </div>
  );
};
