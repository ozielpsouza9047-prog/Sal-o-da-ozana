export type Role = 'admin' | 'manager' | 'receptionist' | 'professional';

export type ModuleId =
  | 'overview'
  | 'agenda'
  | 'clients'
  | 'inventory'
  | 'products'
  | 'services'
  | 'professionals'
  | 'sales'
  | 'cashflow'
  | 'accounts'
  | 'commissions'
  | 'reports'
  | 'users'
  | 'security'
  | 'notifications'
  | 'settings';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'active' | 'inactive' | 'blocked';
  phone: string;
  avatarUrl?: string;
  lastLogin: string;
  twoFactorEnabled: boolean;
  permissions: ModuleId[];
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birthDate: string;
  avatarUrl?: string;
  tier: 'Standard' | 'Gold' | 'Signature';
  totalSpent: number;
  visitsCount: number;
  lastVisit: string;
  notes: string;
  allergies: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: 'Cabelo' | 'Coloração' | 'Estética Facial' | 'Estética Corporal' | 'Unhas' | 'Maquiagem & Noivas';
  durationMinutes: number;
  price: number;
  commissionRate: number; // percentage e.g. 40
  description: string;
  status: 'active' | 'inactive';
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: 'Home Care' | 'Uso Profissional' | 'Coloração' | 'Finalizadores' | 'Descartáveis';
  usageType: 'retail' | 'internal' | 'both';
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  unit: 'un' | 'ml' | 'g' | 'kit';
  supplier: string;
  batch: string;
  expiryDate: string;
  status: 'active' | 'inactive';
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  documentRegistry: string;
  defaultCommission: number;
  workDays: string[];
  workHours: string;
  rating: number;
  completedAppointments: number;
  status: 'active' | 'vacation' | 'inactive';
  bio: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  price: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'paid';
  notes: string;
  referencePhotos?: string[];
  createdAt: string;
}

export interface SaleItem {
  type: 'service' | 'product';
  referenceId: string;
  name: string;
  professionalId?: string;
  professionalName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  code: string;
  clientId: string;
  clientName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'PIX' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Dinheiro' | 'Link de Pagamento';
  installments: number;
  status: 'completed' | 'refunded' | 'pending';
  appointmentId?: string;
  createdBy: string;
  createdAt: string;
}

export interface CashFlowEntry {
  id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  date: string;
  referenceId?: string;
  createdBy: string;
  createdAt: string;
}

export interface CashRegisterStatus {
  isOpen: boolean;
  openedAt: string;
  openedBy: string;
  openingBalance: number;
  currentBalance: number;
}

export interface AccountEntry {
  id: string;
  type: 'payable' | 'receivable';
  title: string;
  entityName: string; // Supplier or Client
  category: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string;
  paymentMethod?: string;
  notes: string;
  createdAt: string;
}

export interface CommissionEntry {
  id: string;
  professionalId: string;
  professionalName: string;
  saleId: string;
  saleCode: string;
  itemName: string;
  saleDate: string;
  grossAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: Role;
  action: string;
  module: ModuleId | 'auth';
  targetId?: string;
  details: string;
  ipAddress: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'stock' | 'agenda' | 'finance' | 'security' | 'system';
  read: boolean;
  actionModule?: ModuleId;
  createdAt: string;
}

export interface BannerSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
  active: boolean;
  order: number;
}

export interface WaitlistEntry {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  professionalId: string;
  professionalName: string;
  desiredDate: string;
  preferredPeriod: 'Manhã' | 'Tarde' | 'Noite' | 'Qualquer Horário';
  notes: string;
  status: 'waiting' | 'notified' | 'booked' | 'cancelled';
  createdAt: string;
}

export interface SalonSettings {
  salonName: string;
  legalName: string;
  cnpj: string;
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
  requireDepositForHighTicket: boolean;
  depositPercentage: number;
  autoDeductStockOnSale: boolean;
  autoGenerateCommission: boolean;
  taxRegime: 'Simples Nacional' | 'Lucro Presumido' | 'MEI';
  pixKey: string;
  currency: 'BRL';
  sessionTimeoutMinutes: number;
  enforceStrongPassword: boolean;
  ipRestrictionEnabled: boolean;
  cancellationNoticeHours?: number;
  banners?: BannerSlide[];
}

export interface AppDatabase {
  users: UserAccount[];
  clients: Client[];
  services: ServiceItem[];
  products: ProductItem[];
  stockMovements: StockMovement[];
  professionals: Professional[];
  appointments: Appointment[];
  sales: Sale[];
  cashFlow: CashFlowEntry[];
  cashRegister: {
    isOpen: boolean;
    openedAt: string;
    openedBy: string;
    openingBalance: number;
  };
  accounts: AccountEntry[];
  commissions: CommissionEntry[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  settings: SalonSettings;
  waitlist?: WaitlistEntry[];
}
