import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AppDatabase,
  Role,
  ModuleId,
  UserAccount,
  AuditLog,
  NotificationItem,
  Sale,
  CommissionEntry,
  CashFlowEntry,
  StockMovement,
  BannerSlide,
  WaitlistEntry,
  Client,
} from './src/types';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'salon_db.json');
const DB_BAK_PATH = path.join(DATA_DIR, 'salon_db.bak.json');
const CREDENTIALS_PATH = path.join(DATA_DIR, 'credentials.json');
const CREDENTIALS_BAK_PATH = path.join(DATA_DIR, 'credentials.bak.json');

const DEFAULT_FALLBACK_SECRET = 'lumina-atelier-hmac-secret-key-2026-secure';
const JWT_SECRET = process.env.SESSION_SECRET || DEFAULT_FALLBACK_SECRET;
const PASSWORD_SALT = process.env.PASSWORD_SALT || 'lumina_salt_2026';

if (process.env.NODE_ENV === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === DEFAULT_FALLBACK_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.warn('[SECURITY GATE] SESSION_SECRET ausente ou fraco em produção. Configure uma chave >= 32 bytes.');
}

const DEMO_DEFAULT_PASSWORDS: Record<string, string> = {
  'usr-1': 'Admin@2026',
  'usr-2': 'Gerente@2026',
  'usr-3': 'Recepcao@2026',
  'usr-4': 'Prof@2026',
};

const DEFAULT_CLIENT_BANNERS: BannerSlide[] = [
  {
    id: 'bnr-1',
    title: 'Alta Beleza & Visagismo Autoral nos Jardins',
    subtitle: 'Protocolos exclusivos Kérastase, Wella Professionals e estética avançada com hora marcada.',
    ctaLabel: 'Agendar Experiência',
    imageUrl: '/src/assets/images/salon_banner_couture_interior_1793234470450.jpg',
    active: true,
    order: 1,
  },
  {
    id: 'bnr-2',
    title: 'Mechas Couture & Diagnóstico Capilar',
    subtitle: 'Iluminação sob medida com preservação integral da fibra capilar e finalização de salão.',
    ctaLabel: 'Reservar Horário',
    imageUrl: '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg',
    active: true,
    order: 2,
  },
  {
    id: 'bnr-3',
    title: 'Rituais de Bem-Estar & Estética Facial',
    subtitle: 'Dermocosméticos de alta performance e drenagem facial em suítes privativas.',
    ctaLabel: 'Conhecer Protocolos',
    imageUrl: '/src/assets/images/salon_banner_facial_spa_1793234472494.jpg',
    active: true,
    order: 3,
  },
];

const WEEKDAY_MAP: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

const ALL_MODULES: ModuleId[] = [
  'overview',
  'agenda',
  'clients',
  'inventory',
  'products',
  'services',
  'professionals',
  'sales',
  'cashflow',
  'accounts',
  'commissions',
  'reports',
  'users',
  'security',
  'notifications',
  'settings',
];

const ROLE_DEFAULT_PERMISSIONS: Record<Role, ModuleId[]> = {
  admin: ALL_MODULES,
  manager: [
    'overview',
    'agenda',
    'clients',
    'inventory',
    'products',
    'services',
    'professionals',
    'sales',
    'cashflow',
    'accounts',
    'commissions',
    'reports',
    'notifications',
  ],
  receptionist: [
    'overview',
    'agenda',
    'clients',
    'products',
    'services',
    'professionals',
    'sales',
    'cashflow',
    'notifications',
  ],
  professional: ['overview', 'agenda', 'clients', 'services', 'commissions', 'notifications'],
};

function hashPassword(password: string, salt = PASSWORD_SALT): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function isStrongPassword(pw: string): boolean {
  if (!pw || typeof pw !== 'string' || pw.length < 8) return false;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

function timeToMinutes(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function signToken(payload: { userId: string; email: string; role: Role | 'client'; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): { userId: string; email: string; role: Role | 'client'; exp: number } | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function getInitialDatabase(): AppDatabase {
  const today = getTodayStr();
  return {
    users: [
      {
        id: 'usr-1',
        name: 'Helena Vasconcelos',
        email: 'admin@luminaatelier.com.br',
        role: 'admin',
        status: 'active',
        phone: '(11) 99812-4400',
        lastLogin: new Date().toISOString(),
        twoFactorEnabled: true,
        permissions: ROLE_DEFAULT_PERMISSIONS.admin,
        createdAt: '2026-01-10T10:00:00Z',
      },
      {
        id: 'usr-2',
        name: 'Camila Andrade',
        email: 'gerencia@luminaatelier.com.br',
        role: 'manager',
        status: 'active',
        phone: '(11) 98741-2310',
        lastLogin: new Date(Date.now() - 3600000 * 4).toISOString(),
        twoFactorEnabled: true,
        permissions: ROLE_DEFAULT_PERMISSIONS.manager,
        createdAt: '2026-02-01T09:00:00Z',
      },
      {
        id: 'usr-3',
        name: 'Bianca Moura',
        email: 'recepcao@luminaatelier.com.br',
        role: 'receptionist',
        status: 'active',
        phone: '(11) 97612-8890',
        lastLogin: new Date(Date.now() - 3600000 * 2).toISOString(),
        twoFactorEnabled: false,
        permissions: ROLE_DEFAULT_PERMISSIONS.receptionist,
        createdAt: '2026-02-15T11:30:00Z',
      },
      {
        id: 'usr-4',
        name: 'Rafael Albuquerque',
        email: 'rafael@luminaatelier.com.br',
        role: 'professional',
        status: 'active',
        phone: '(11) 99123-7788',
        lastLogin: new Date(Date.now() - 3600000 * 18).toISOString(),
        twoFactorEnabled: false,
        permissions: ROLE_DEFAULT_PERMISSIONS.professional,
        createdAt: '2026-03-01T08:00:00Z',
      },
    ],
    clients: [
      {
        id: 'cli-1',
        name: 'Beatriz Monteiro de Barros',
        email: 'beatriz.barros@email.com',
        phone: '(11) 99410-2211',
        cpf: '348.912.408-12',
        birthDate: '1989-05-14',
        tier: 'Signature',
        totalSpent: 4890.0,
        visitsCount: 14,
        lastVisit: today,
        notes: 'Prefere atendimento no período da manhã. Gosta de chá branco com gengibre.',
        allergies: 'Sensibilidade a amônia em alta concentração',
        status: 'active',
        createdAt: '2026-01-15T14:20:00Z',
      },
      {
        id: 'cli-2',
        name: 'Carolina Mendes Fontes',
        email: 'carolina.fontes@email.com',
        phone: '(11) 98821-3390',
        cpf: '412.887.109-44',
        birthDate: '1993-09-22',
        tier: 'Gold',
        totalSpent: 2640.0,
        visitsCount: 8,
        lastVisit: '2026-10-20',
        notes: 'Faz cronograma capilar Kérastase mensalmente.',
        allergies: 'Nenhuma relatada',
        status: 'active',
        createdAt: '2026-02-10T16:00:00Z',
      },
      {
        id: 'cli-3',
        name: 'Fernanda Siqueira Lima',
        email: 'fernanda.lima@email.com',
        phone: '(11) 99104-5567',
        cpf: '289.541.338-09',
        birthDate: '1985-12-03',
        tier: 'Signature',
        totalSpent: 6120.0,
        visitsCount: 19,
        lastVisit: '2026-10-25',
        notes: 'Cliente VIP. Agendamentos sempre com Rafael Albuquerque.',
        allergies: 'Alergia a esmaltes com tolueno',
        status: 'active',
        createdAt: '2026-01-20T11:00:00Z',
      },
      {
        id: 'cli-4',
        name: 'Mariana Duarte Costa',
        email: 'mariana.costa@email.com',
        phone: '(11) 97433-1122',
        cpf: '391.224.765-80',
        birthDate: '1997-03-19',
        tier: 'Standard',
        totalSpent: 780.0,
        visitsCount: 3,
        lastVisit: '2026-10-12',
        notes: 'Conheceu o salão pelo Instagram.',
        allergies: 'Nenhuma relatada',
        status: 'active',
        createdAt: '2026-06-05T15:30:00Z',
      },
      {
        id: 'cli-5',
        name: 'Gabriela Peixoto Nogueira',
        email: 'gabriela.nogueira@email.com',
        phone: '(11) 98219-6045',
        cpf: '455.109.882-31',
        birthDate: '1991-07-29',
        tier: 'Gold',
        totalSpent: 1950.0,
        visitsCount: 6,
        lastVisit: '2026-10-18',
        notes: 'Foco em tratamentos faciais e design de sobrancelhas.',
        allergies: 'Sensibilidade a ácidos glicólicos >10%',
        status: 'active',
        createdAt: '2026-04-12T10:15:00Z',
      },
    ],
    services: [
      {
        id: 'srv-1',
        name: 'Mechas Contour & Balayage Couture',
        category: 'Coloração',
        durationMinutes: 180,
        price: 980.0,
        commissionRate: 45,
        description: 'Técnica personalizada de iluminação com diagnóstico de visagismo, plex protetor e tonalização gloss.',
        status: 'active',
      },
      {
        id: 'srv-2',
        name: 'Corte Autoral & Escova Modelada',
        category: 'Cabelo',
        durationMinutes: 60,
        price: 320.0,
        commissionRate: 40,
        description: 'Corte técnico personalizado com lavagem relaxante no lavatório spa e finalização.',
        status: 'active',
      },
      {
        id: 'srv-3',
        name: 'Ritual Chronologiste Kérastase',
        category: 'Cabelo',
        durationMinutes: 75,
        price: 490.0,
        commissionRate: 35,
        description: 'Regeneração capilar profunda do couro cabeludo aos fios com pérolas de caviar mimético e massagem.',
        status: 'active',
      },
      {
        id: 'srv-4',
        name: 'Protocolo Facial Glow Dermocosmético',
        category: 'Estética Facial',
        durationMinutes: 90,
        price: 440.0,
        commissionRate: 40,
        description: 'Higienização ultrassônica, peeling enzimático, vitamina C pura estabilizada e drenagem linfática facial.',
        status: 'active',
      },
      {
        id: 'srv-5',
        name: 'Manicure & Pedicure Spa Russa Gel',
        category: 'Unhas',
        durationMinutes: 90,
        price: 210.0,
        commissionRate: 50,
        description: 'Cuticulagem a seco com brocas diamantadas, esmaltação em gel hipoalergênico de longa duração e esfoliação.',
        status: 'active',
      },
      {
        id: 'srv-6',
        name: 'Produção Beauty Social (Make + Penteado)',
        category: 'Maquiagem & Noivas',
        durationMinutes: 120,
        price: 680.0,
        commissionRate: 45,
        description: 'Maquiagem blindada HD com produtos importados e penteado estruturado para eventos.',
        status: 'active',
      },
    ],
    products: [
      {
        id: 'prd-1',
        sku: 'KER-CHR-200',
        name: 'Máscara Kérastase Chronologiste Masque Intense',
        brand: 'Kérastase',
        category: 'Home Care',
        usageType: 'both',
        costPrice: 245.0,
        salePrice: 459.0,
        stock: 14,
        minStock: 5,
        unit: 'un',
        supplier: 'L’Oréal Produtos Profissionais Brasil',
        batch: 'L2608A',
        expiryDate: '2028-04-30',
        status: 'active',
      },
      {
        id: 'prd-2',
        sku: 'OLP-NO3-100',
        name: 'Olaplex Nº.3 Hair Perfector 100ml',
        brand: 'Olaplex',
        category: 'Home Care',
        usageType: 'retail',
        costPrice: 138.0,
        salePrice: 269.0,
        stock: 3,
        minStock: 6,
        unit: 'un',
        supplier: 'Beleza Pro Distribuidora',
        batch: 'OL9921',
        expiryDate: '2027-11-15',
        status: 'active',
      },
      {
        id: 'prd-3',
        sku: 'WEL-BLD-800',
        name: 'Pó Descolorante Wella Blondor Multi Blonde 800g',
        brand: 'Wella Professionals',
        category: 'Coloração',
        usageType: 'internal',
        costPrice: 165.0,
        salePrice: 290.0,
        stock: 4,
        minStock: 5,
        unit: 'un',
        supplier: 'Wella Company Brasil',
        batch: 'WB4410',
        expiryDate: '2027-09-01',
        status: 'active',
      },
      {
        id: 'prd-4',
        sku: 'KER-ELX-100',
        name: 'Óleo Capilar Kérastase Elixir Ultime L’Huile Originale',
        brand: 'Kérastase',
        category: 'Finalizadores',
        usageType: 'both',
        costPrice: 160.0,
        salePrice: 319.0,
        stock: 19,
        minStock: 8,
        unit: 'un',
        supplier: 'L’Oréal Produtos Profissionais Brasil',
        batch: 'L2609C',
        expiryDate: '2028-06-20',
        status: 'active',
      },
      {
        id: 'prd-5',
        sku: 'BIO-CLN-500',
        name: 'Solução Micelar Dermatológica Sensibio H2O 500ml',
        brand: 'Bioderma',
        category: 'Uso Profissional',
        usageType: 'internal',
        costPrice: 68.0,
        salePrice: 129.0,
        stock: 2,
        minStock: 4,
        unit: 'un',
        supplier: 'DermaMed Suprimentos',
        batch: 'BD1102',
        expiryDate: '2027-05-10',
        status: 'active',
      },
    ],
    stockMovements: [
      {
        id: 'mov-1',
        productId: 'prd-1',
        productName: 'Máscara Kérastase Chronologiste Masque Intense',
        type: 'in',
        quantity: 10,
        previousStock: 5,
        newStock: 15,
        reason: 'Nota Fiscal #48921 - Reposição mensal L’Oréal',
        performedBy: 'Camila Andrade',
        createdAt: '2026-10-20T10:15:00Z',
      },
      {
        id: 'mov-2',
        productId: 'prd-1',
        productName: 'Máscara Kérastase Chronologiste Masque Intense',
        type: 'out',
        quantity: 1,
        previousStock: 15,
        newStock: 14,
        reason: 'Venda PDV #VND-1001 para Beatriz Monteiro',
        performedBy: 'Bianca Moura',
        createdAt: `${today}T11:30:00Z`,
      },
      {
        id: 'mov-3',
        productId: 'prd-3',
        productName: 'Pó Descolorante Wella Blondor Multi Blonde 800g',
        type: 'out',
        quantity: 2,
        previousStock: 6,
        newStock: 4,
        reason: 'Consumo interno bancada técnica - Colorimetria',
        performedBy: 'Rafael Albuquerque',
        createdAt: '2026-10-26T16:40:00Z',
      },
    ],
    professionals: [
      {
        id: 'prf-1',
        name: 'Rafael Albuquerque',
        specialty: 'Master Hairstylist & Colorista Internacional',
        email: 'rafael@luminaatelier.com.br',
        phone: '(11) 99123-7788',
        documentRegistry: 'MEI 32.198.441/0001-90',
        defaultCommission: 45,
        workDays: ['Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        workHours: '09:00 às 19:00',
        rating: 4.98,
        completedAppointments: 412,
        status: 'active',
        bio: 'Especialista em mechas criativas, visagismo e cortes estruturados com formação em Paris e Londres.',
      },
      {
        id: 'prf-2',
        name: 'Juliana Vasconcelos',
        specialty: 'Terapeuta Capilar & Tricologista',
        email: 'juliana@luminaatelier.com.br',
        phone: '(11) 98445-1029',
        documentRegistry: 'CRBM 44102-SP',
        defaultCommission: 40,
        workDays: ['Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        workHours: '10:00 às 20:00',
        rating: 4.95,
        completedAppointments: 289,
        status: 'active',
        bio: 'Focada em recuperação de fibra capilar sensibilizada e protocolos de saúde do couro cabeludo.',
      },
      {
        id: 'prf-3',
        name: 'Larissa Koury',
        specialty: 'Esteticista Facial & Cosmetóloga',
        email: 'larissa@luminaatelier.com.br',
        phone: '(11) 97721-9080',
        documentRegistry: 'CBO 3221-30',
        defaultCommission: 40,
        workDays: ['Qua', 'Qui', 'Sex', 'Sáb'],
        workHours: '09:00 às 18:00',
        rating: 4.92,
        completedAppointments: 198,
        status: 'active',
        bio: 'Especialista em rejuvenescimento não-invasivo, drenagem linfática método Renata França e dermocosméticos.',
      },
      {
        id: 'prf-4',
        name: 'Amanda Salles',
        specialty: 'Nail Designer Especialista em Cuticulagem Russa',
        email: 'amanda@luminaatelier.com.br',
        phone: '(11) 96540-3321',
        documentRegistry: 'MEI 41.882.109/0001-12',
        defaultCommission: 50,
        workDays: ['Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
        workHours: '09:00 às 19:00',
        rating: 4.90,
        completedAppointments: 520,
        status: 'active',
        bio: 'Referência em manicure russa, blindagem de unhas naturais e esmaltação em gel.',
      },
    ],
    appointments: [
      {
        id: 'apt-1',
        clientId: 'cli-1',
        clientName: 'Beatriz Monteiro de Barros',
        clientPhone: '(11) 99410-2211',
        professionalId: 'prf-1',
        professionalName: 'Rafael Albuquerque',
        serviceId: 'srv-1',
        serviceName: 'Mechas Contour & Balayage Couture',
        date: today,
        startTime: '09:30',
        endTime: '12:30',
        price: 980.0,
        status: 'completed',
        paymentStatus: 'paid',
        notes: 'Fórmula: Blondor + Ox 20vol na raiz, tonalizante 9.89 Wella Illumina.',
        referencePhotos: [
          '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg',
          '/src/assets/images/salon_banner_couture_interior_1793234470450.jpg',
        ],
        createdAt: '2026-10-24T14:00:00Z',
      },
      {
        id: 'apt-2',
        clientId: 'cli-2',
        clientName: 'Carolina Mendes Fontes',
        clientPhone: '(11) 98821-3390',
        professionalId: 'prf-2',
        professionalName: 'Juliana Vasconcelos',
        serviceId: 'srv-3',
        serviceName: 'Ritual Chronologiste Kérastase',
        date: today,
        startTime: '14:00',
        endTime: '15:15',
        price: 490.0,
        status: 'in_progress',
        paymentStatus: 'pending',
        notes: 'Aplicar ampola Fusio-Dose complementar se necessário.',
        referencePhotos: ['/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg'],
        createdAt: '2026-10-25T10:00:00Z',
      },
      {
        id: 'apt-3',
        clientId: 'cli-3',
        clientName: 'Fernanda Siqueira Lima',
        clientPhone: '(11) 99104-5567',
        professionalId: 'prf-1',
        professionalName: 'Rafael Albuquerque',
        serviceId: 'srv-2',
        serviceName: 'Corte Autoral & Escova Modelada',
        date: today,
        startTime: '16:00',
        endTime: '17:00',
        price: 320.0,
        status: 'confirmed',
        paymentStatus: 'pending',
        notes: 'Manter comprimento e renovar camadas frontais.',
        referencePhotos: ['/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg'],
        createdAt: '2026-10-26T11:20:00Z',
      },
      {
        id: 'apt-4',
        clientId: 'cli-5',
        clientName: 'Gabriela Peixoto Nogueira',
        clientPhone: '(11) 98219-6045',
        professionalId: 'prf-3',
        professionalName: 'Larissa Koury',
        serviceId: 'srv-4',
        serviceName: 'Protocolo Facial Glow Dermocosmético',
        date: today,
        startTime: '17:30',
        endTime: '19:00',
        price: 440.0,
        status: 'scheduled',
        paymentStatus: 'pending',
        notes: 'Evitar ácido glicólico acima de 10%.',
        createdAt: '2026-10-27T09:15:00Z',
      },
      {
        id: 'apt-5',
        clientId: 'cli-4',
        clientName: 'Mariana Duarte Costa',
        clientPhone: '(11) 97433-1122',
        professionalId: 'prf-4',
        professionalName: 'Amanda Salles',
        serviceId: 'srv-5',
        serviceName: 'Manicure & Pedicure Spa Russa Gel',
        date: today,
        startTime: '15:00',
        endTime: '16:30',
        price: 210.0,
        status: 'confirmed',
        paymentStatus: 'pending',
        notes: 'Preferência por tons nude rosados.',
        createdAt: '2026-10-27T16:45:00Z',
      },
    ],
    sales: [
      {
        id: 'sal-1',
        code: 'VND-1001',
        clientId: 'cli-1',
        clientName: 'Beatriz Monteiro de Barros',
        items: [
          {
            type: 'service',
            referenceId: 'srv-1',
            name: 'Mechas Contour & Balayage Couture',
            professionalId: 'prf-1',
            professionalName: 'Rafael Albuquerque',
            quantity: 1,
            unitPrice: 980.0,
            totalPrice: 980.0,
          },
          {
            type: 'product',
            referenceId: 'prd-1',
            name: 'Máscara Kérastase Chronologiste Masque Intense',
            professionalId: 'prf-1',
            professionalName: 'Rafael Albuquerque',
            quantity: 1,
            unitPrice: 459.0,
            totalPrice: 459.0,
          },
        ],
        subtotal: 1439.0,
        discount: 39.0,
        total: 1400.0,
        paymentMethod: 'PIX',
        installments: 1,
        status: 'completed',
        appointmentId: 'apt-1',
        createdBy: 'Bianca Moura',
        createdAt: `${today}T12:40:00Z`,
      },
      {
        id: 'sal-2',
        code: 'VND-1000',
        clientId: 'cli-3',
        clientName: 'Fernanda Siqueira Lima',
        items: [
          {
            type: 'service',
            referenceId: 'srv-6',
            name: 'Produção Beauty Social (Make + Penteado)',
            professionalId: 'prf-1',
            professionalName: 'Rafael Albuquerque',
            quantity: 1,
            unitPrice: 680.0,
            totalPrice: 680.0,
          },
          {
            type: 'service',
            referenceId: 'srv-5',
            name: 'Manicure & Pedicure Spa Russa Gel',
            professionalId: 'prf-4',
            professionalName: 'Amanda Salles',
            quantity: 1,
            unitPrice: 210.0,
            totalPrice: 210.0,
          },
        ],
        subtotal: 890.0,
        discount: 0,
        total: 890.0,
        paymentMethod: 'Cartão de Crédito',
        installments: 2,
        status: 'completed',
        createdBy: 'Bianca Moura',
        createdAt: '2026-10-25T18:10:00Z',
      },
    ],
    cashFlow: [
      {
        id: 'cf-1',
        type: 'income',
        category: 'Vendas e Serviços',
        description: 'Recebimento PDV #VND-1001 - Beatriz Monteiro de Barros',
        amount: 1400.0,
        paymentMethod: 'PIX',
        date: today,
        referenceId: 'sal-1',
        createdBy: 'Bianca Moura',
        createdAt: `${today}T12:40:00Z`,
      },
      {
        id: 'cf-2',
        type: 'income',
        category: 'Vendas e Serviços',
        description: 'Recebimento PDV #VND-1000 - Fernanda Siqueira Lima',
        amount: 890.0,
        paymentMethod: 'Cartão de Crédito',
        date: '2026-10-25',
        referenceId: 'sal-2',
        createdBy: 'Bianca Moura',
        createdAt: '2026-10-25T18:10:00Z',
      },
      {
        id: 'cf-3',
        type: 'expense',
        category: 'Fornecedores e Insumos',
        description: 'Pagamento 1ª parcela L’Oréal Produtos Profissionais NF #48921',
        amount: 1850.0,
        paymentMethod: 'PIX',
        date: '2026-10-22',
        createdBy: 'Camila Andrade',
        createdAt: '2026-10-22T15:00:00Z',
      },
      {
        id: 'cf-4',
        type: 'expense',
        category: 'Hospitalidade & Copa',
        description: 'Nespresso Professional - Cápsulas e Chás Orgânicos',
        amount: 340.0,
        paymentMethod: 'Cartão de Débito',
        date: today,
        createdBy: 'Camila Andrade',
        createdAt: `${today}T09:15:00Z`,
      },
    ],
    cashRegister: {
      isOpen: true,
      openedAt: `${today}T08:30:00Z`,
      openedBy: 'Bianca Moura',
      openingBalance: 600.0,
    },
    accounts: [
      {
        id: 'acc-1',
        type: 'payable',
        title: 'Locação Comercial - Jardins Flagship',
        entityName: 'Patrimônio Imóveis S.A.',
        category: 'Infraestrutura & Aluguel',
        dueDate: '2026-11-05',
        amount: 8500.0,
        status: 'pending',
        notes: 'Boleto bancário Itaú cadastrado em DDA.',
        createdAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'acc-2',
        type: 'payable',
        title: 'Fatura Wella Company Brasil - Lote Outubro',
        entityName: 'Wella Company Brasil',
        category: 'Fornecedores e Insumos',
        dueDate: '2026-10-26',
        amount: 2190.0,
        status: 'overdue',
        notes: 'Aguardando conferência de bonificação de oxidantes.',
        createdAt: '2026-10-05T11:30:00Z',
      },
      {
        id: 'acc-3',
        type: 'receivable',
        title: 'Pacote Noiva Exclusive - Contrato #NV-204',
        entityName: 'Beatriz Monteiro de Barros',
        category: 'Pacotes e Eventos',
        dueDate: '2026-11-10',
        amount: 3200.0,
        status: 'pending',
        notes: '2ª parcela do Dia da Noiva + 3 madrinhas.',
        createdAt: '2026-10-12T16:00:00Z',
      },
      {
        id: 'acc-4',
        type: 'payable',
        title: 'Energia Elétrica & Climatização - Enel SP',
        entityName: 'Enel Distribuição São Paulo',
        category: 'Utilidades',
        dueDate: '2026-10-20',
        amount: 1120.0,
        status: 'paid',
        paidAt: '2026-10-19T14:10:00Z',
        paymentMethod: 'PIX',
        notes: 'Pago dentro do vencimento.',
        createdAt: '2026-10-02T09:00:00Z',
      },
    ],
    commissions: [
      {
        id: 'com-1',
        professionalId: 'prf-1',
        professionalName: 'Rafael Albuquerque',
        saleId: 'sal-1',
        saleCode: 'VND-1001',
        itemName: 'Mechas Contour & Balayage Couture',
        saleDate: today,
        grossAmount: 980.0,
        commissionPercentage: 45,
        commissionAmount: 441.0,
        status: 'approved',
      },
      {
        id: 'com-2',
        professionalId: 'prf-1',
        professionalName: 'Rafael Albuquerque',
        saleId: 'sal-1',
        saleCode: 'VND-1001',
        itemName: 'Venda Home Care: Máscara Kérastase Chronologiste',
        saleDate: today,
        grossAmount: 459.0,
        commissionPercentage: 10,
        commissionAmount: 45.9,
        status: 'pending',
      },
      {
        id: 'com-3',
        professionalId: 'prf-1',
        professionalName: 'Rafael Albuquerque',
        saleId: 'sal-2',
        saleCode: 'VND-1000',
        itemName: 'Produção Beauty Social (Make + Penteado)',
        saleDate: '2026-10-25',
        grossAmount: 680.0,
        commissionPercentage: 45,
        commissionAmount: 306.0,
        status: 'paid',
        paidAt: '2026-10-26T17:00:00Z',
      },
      {
        id: 'com-4',
        professionalId: 'prf-4',
        professionalName: 'Amanda Salles',
        saleId: 'sal-2',
        saleCode: 'VND-1000',
        itemName: 'Manicure & Pedicure Spa Russa Gel',
        saleDate: '2026-10-25',
        grossAmount: 210.0,
        commissionPercentage: 50,
        commissionAmount: 105.0,
        status: 'paid',
        paidAt: '2026-10-26T17:00:00Z',
      },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        userId: 'usr-1',
        userName: 'Helena Vasconcelos',
        userRole: 'admin',
        action: 'AUTH_LOGIN_SUCCESS',
        module: 'auth',
        details: 'Autenticação administrativa realizada com token assinado HMAC-SHA256.',
        ipAddress: '189.44.112.90',
        severity: 'info',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'aud-2',
        userId: 'usr-3',
        userName: 'Bianca Moura',
        userRole: 'receptionist',
        action: 'SALE_COMPLETED',
        module: 'sales',
        targetId: 'sal-1',
        details: 'Venda #VND-1001 registrada no valor de R$ 1.400,00 com baixa automática de estoque.',
        ipAddress: '189.44.112.90',
        severity: 'info',
        timestamp: `${today}T12:40:00Z`,
      },
      {
        id: 'aud-3',
        userId: 'usr-2',
        userName: 'Camila Andrade',
        userRole: 'manager',
        action: 'STOCK_ADJUSTMENT',
        module: 'inventory',
        targetId: 'prd-3',
        details: 'Baixa técnica de 2 unidades de Pó Descolorante Wella Blondor (Estoque abaixo do mínimo).',
        ipAddress: '189.44.112.90',
        severity: 'warning',
        timestamp: '2026-10-26T16:40:00Z',
      },
    ],
    notifications: [
      {
        id: 'not-1',
        title: 'Estoque Crítico: 3 itens abaixo do mínimo',
        message: 'Olaplex Nº.3 (3 un), Wella Blondor 800g (4 un) e Bioderma Sensibio (2 un) atingiram nível de reposição.',
        category: 'stock',
        read: false,
        actionModule: 'inventory',
        createdAt: `${today}T08:45:00Z`,
      },
      {
        id: 'not-2',
        title: 'Conta a Pagar Vencida',
        message: 'A fatura Wella Company Brasil (R$ 2.190,00) venceu em 26/10 e aguarda baixa.',
        category: 'finance',
        read: false,
        actionModule: 'accounts',
        createdAt: `${today}T09:00:00Z`,
      },
      {
        id: 'not-3',
        title: 'Agendamento VIP Hoje às 16:00',
        message: 'Cliente Signature Fernanda Siqueira Lima confirmou presença com Rafael Albuquerque.',
        category: 'agenda',
        read: true,
        actionModule: 'agenda',
        createdAt: `${today}T08:00:00Z`,
      },
    ],
    settings: {
      salonName: 'Lumina Atelier Beauty & Spa',
      legalName: 'Lumina Atelier Estética Avançada Ltda.',
      cnpj: '42.819.304/0001-77',
      phone: '(11) 3062-8800',
      whatsapp: '(11) 99812-4400',
      email: 'concierge@luminaatelier.com.br',
      address: 'Rua Oscar Freire, 1420 - Jardins',
      city: 'São Paulo',
      state: 'SP',
      openingTime: '09:00',
      closingTime: '20:00',
      slotIntervalMinutes: 30,
      allowOnlineBooking: true,
      requireDepositForHighTicket: true,
      depositPercentage: 30,
      autoDeductStockOnSale: true,
      autoGenerateCommission: true,
      taxRegime: 'Simples Nacional',
      pixKey: '42.819.304/0001-77',
      currency: 'BRL',
      sessionTimeoutMinutes: 480,
      enforceStrongPassword: true,
      ipRestrictionEnabled: false,
      cancellationNoticeHours: 4,
      banners: DEFAULT_CLIENT_BANNERS,
    },
    waitlist: [],
  };
}

function atomicWriteJson(targetPath: string, backupPath: string, dataObj: unknown) {
  const serialized = JSON.stringify(dataObj, null, 2);
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
  fs.writeFileSync(tmpPath, serialized, { encoding: 'utf8', mode: 0o600 });
  if (fs.existsSync(targetPath)) {
    try {
      fs.copyFileSync(targetPath, backupPath);
    } catch {
      // ignore copy error if concurrent
    }
  }
  fs.renameSync(tmpPath, targetPath);
}

function ensureStorage(): { db: AppDatabase; credentials: Record<string, string> } {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  }
  let db: AppDatabase;
  if (!fs.existsSync(DB_PATH)) {
    db = getInitialDatabase();
    atomicWriteJson(DB_PATH, DB_BAK_PATH, db);
  } else {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
      // Automatic recovery from last valid backup before falling back to initial
      if (fs.existsSync(DB_BAK_PATH)) {
        try {
          db = JSON.parse(fs.readFileSync(DB_BAK_PATH, 'utf8'));
          atomicWriteJson(DB_PATH, DB_BAK_PATH, db);
        } catch {
          db = getInitialDatabase();
          atomicWriteJson(DB_PATH, DB_BAK_PATH, db);
        }
      } else {
        db = getInitialDatabase();
        atomicWriteJson(DB_PATH, DB_BAK_PATH, db);
      }
    }
  }

  let dbChanged = false;
  if (!Array.isArray(db.settings.banners) || db.settings.banners.length === 0) {
    db.settings.banners = DEFAULT_CLIENT_BANNERS;
    dbChanged = true;
  }
  if (db.settings.cancellationNoticeHours === undefined) {
    db.settings.cancellationNoticeHours = 4;
    dbChanged = true;
  }
  if (!Array.isArray(db.waitlist)) {
    db.waitlist = [];
    dbChanged = true;
  }

  // Ensure existing appointments have referencePhotos array and seed non-destructive test states for prf-1
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  for (const apt of db.appointments) {
    if (!Array.isArray(apt.referencePhotos)) {
      if (apt.id === 'apt-1') {
        apt.referencePhotos = [
          '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg',
          '/src/assets/images/salon_banner_couture_interior_1793234470450.jpg',
        ];
      } else if (apt.id === 'apt-3') {
        apt.referencePhotos = ['/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg'];
      } else if (apt.id === 'apt-4') {
        apt.referencePhotos = ['/src/assets/images/salon_banner_facial_spa_1793234472494.jpg'];
      } else {
        apt.referencePhotos = [];
      }
      dbChanged = true;
    }
  }

  if (!db.appointments.some((a) => a.id === 'apt-prof-inprog')) {
    db.appointments.push({
      id: 'apt-prof-inprog',
      clientId: 'cli-1',
      clientName: 'Beatriz Monteiro de Barros',
      clientPhone: '(11) 99410-2211',
      professionalId: 'prf-1',
      professionalName: 'Rafael Albuquerque',
      serviceId: 'srv-3',
      serviceName: 'Ritual Chronologiste Kérastase',
      date: todayStr,
      startTime: '13:30',
      endTime: '14:45',
      price: 490.0,
      status: 'in_progress',
      paymentStatus: 'pending',
      notes: 'Cadeira 01: Enxágue morno e massagem capilar relaxante com óleo perfumado.',
      referencePhotos: [
        '/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg',
        '/src/assets/images/salon_banner_facial_spa_1793234472494.jpg',
      ],
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    });
    dbChanged = true;
  }

  if (!db.appointments.some((a) => a.id === 'apt-prof-next')) {
    db.appointments.push({
      id: 'apt-prof-next',
      clientId: 'cli-5',
      clientName: 'Gabriela Peixoto Nogueira',
      clientPhone: '(11) 98219-6045',
      professionalId: 'prf-1',
      professionalName: 'Rafael Albuquerque',
      serviceId: 'srv-1',
      serviceName: 'Mechas Contour & Balayage Couture',
      date: tomorrowStr,
      startTime: '10:30',
      endTime: '13:30',
      price: 980.0,
      status: 'confirmed',
      paymentStatus: 'pending',
      notes: 'Cliente enviou fotos de referência para iluminação frontal em tom mel dourado.',
      referencePhotos: ['/src/assets/images/salon_banner_hair_ritual_1793234472028.jpg'],
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    });
    dbChanged = true;
  }

  if (!db.appointments.some((a) => a.id === 'apt-prof-canc')) {
    db.appointments.push({
      id: 'apt-prof-canc',
      clientId: 'cli-3',
      clientName: 'Fernanda Siqueira Lima',
      clientPhone: '(11) 99104-5567',
      professionalId: 'prf-1',
      professionalName: 'Rafael Albuquerque',
      serviceId: 'srv-2',
      serviceName: 'Corte Autoral & Escova Modelada',
      date: todayStr,
      startTime: '18:00',
      endTime: '19:00',
      price: 320.0,
      status: 'cancelled',
      paymentStatus: 'pending',
      notes: 'Cancelado com antecedência pela cliente devido a viagem corporativa (reagendado para 16:00).',
      referencePhotos: [],
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    });
    dbChanged = true;
  }

  if (dbChanged) {
    atomicWriteJson(DB_PATH, DB_BAK_PATH, db);
  }

  let credentials: Record<string, string>;
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    credentials = {
      'usr-1': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-1']),
      'usr-2': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-2']),
      'usr-3': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-3']),
      'usr-4': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-4']),
      'cli-1': hashPassword('Cliente@2026'),
      'cli-2': hashPassword('Cliente@2026'),
      'cli-3': hashPassword('Cliente@2026'),
    };
    atomicWriteJson(CREDENTIALS_PATH, CREDENTIALS_BAK_PATH, credentials);
  } else {
    try {
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    } catch {
      if (fs.existsSync(CREDENTIALS_BAK_PATH)) {
        try {
          credentials = JSON.parse(fs.readFileSync(CREDENTIALS_BAK_PATH, 'utf8'));
          atomicWriteJson(CREDENTIALS_PATH, CREDENTIALS_BAK_PATH, credentials);
        } catch {
          credentials = {
            'usr-1': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-1']),
            'usr-2': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-2']),
            'usr-3': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-3']),
            'usr-4': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-4']),
            'cli-1': hashPassword('Cliente@2026'),
          };
          atomicWriteJson(CREDENTIALS_PATH, CREDENTIALS_BAK_PATH, credentials);
        }
      } else {
        credentials = {
          'usr-1': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-1']),
          'usr-2': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-2']),
          'usr-3': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-3']),
          'usr-4': hashPassword(DEMO_DEFAULT_PASSWORDS['usr-4']),
          'cli-1': hashPassword('Cliente@2026'),
        };
        atomicWriteJson(CREDENTIALS_PATH, CREDENTIALS_BAK_PATH, credentials);
      }
    }
  }
  if (!credentials['cli-1']) {
    credentials['cli-1'] = hashPassword('Cliente@2026');
    atomicWriteJson(CREDENTIALS_PATH, CREDENTIALS_BAK_PATH, credentials);
  }

  return { db, credentials };
}

function saveDb(db: AppDatabase) {
  atomicWriteJson(DB_PATH, DB_BAK_PATH, db);
}

function saveCredentials(credentials: Record<string, string>) {
  atomicWriteJson(CREDENTIALS_PATH, CREDENTIALS_BAK_PATH, credentials);
}

interface AuthenticatedRequest extends Request {
  user?: UserAccount;
  client?: Client;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const { db, credentials } = ensureStorage();

  function logAudit(
    user: UserAccount | { id: string; name: string; role: Role },
    action: string,
    module: ModuleId | 'auth',
    details: string,
    severity: 'info' | 'warning' | 'critical' = 'info',
    targetId?: string,
    req?: Request
  ) {
    const entry: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      module,
      targetId,
      details,
      ipAddress: (req?.headers['x-forwarded-for'] as string) || req?.socket.remoteAddress || '127.0.0.1',
      severity,
      timestamp: new Date().toISOString(),
    };
    db.auditLogs.unshift(entry);
    if (db.auditLogs.length > 500) db.auditLogs.pop();
    saveDb(db);
  }

  function addNotification(
    title: string,
    message: string,
    category: NotificationItem['category'],
    actionModule?: ModuleId
  ) {
    const notif: NotificationItem = {
      id: `not-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      message,
      category,
      read: false,
      actionModule,
      createdAt: new Date().toISOString(),
    };
    db.notifications.unshift(notif);
    saveDb(db);
  }

  // Authentication Middleware
  function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Sessão não autenticada. Faça login para acessar este recurso.' });
      return;
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Token de sessão inválido ou expirado.' });
      return;
    }
    const user = db.users.find((u) => u.id === payload.userId);
    if (!user || user.status !== 'active') {
      res.status(403).json({ error: 'Conta de usuário inativa ou bloqueada pelo administrador.' });
      return;
    }
    req.user = user;
    next();
  }

  // Backend RBAC Authorization Middleware
  function requireModulePermission(moduleId: ModuleId, allowedRoles?: Role[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Não autenticado.' });
        return;
      }
      const hasModuleAccess = user.permissions.includes(moduleId);
      const hasRoleAccess = !allowedRoles || allowedRoles.includes(user.role);

      if (!hasModuleAccess || !hasRoleAccess) {
        logAudit(
          user,
          'ACCESS_DENIED_RBAC',
          'security',
          `Tentativa bloqueada no backend: usuário (${user.role}) tentou acessar/alterar módulo '${moduleId}' (${req.method} ${req.originalUrl}).`,
          'warning',
          undefined,
          req
        );
        res.status(403).json({
          error: `Permissão negada no servidor: seu perfil (${user.role.toUpperCase()}) não possui autorização para executar esta operação em '${moduleId}'.`,
        });
        return;
      }
      next();
    };
  }

  // --- AUTH ROUTES ---
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
      return;
    }
    if (user.status !== 'active') {
      logAudit(
        user,
        'AUTH_BLOCKED_ACCOUNT',
        'auth',
        `Tentativa de login em conta com status '${user.status}'.`,
        'warning',
        user.id,
        req
      );
      res.status(403).json({ error: 'Esta conta está inativa ou bloqueada. Contate a administração.' });
      return;
    }
    const expectedHash = credentials[user.id];
    const providedHash = hashPassword(password);
    if (!expectedHash || expectedHash !== providedHash) {
      logAudit(
        user,
        'AUTH_LOGIN_FAILED',
        'auth',
        `Falha de autenticação por senha incorreta para ${user.email}.`,
        'warning',
        user.id,
        req
      );
      res.status(401).json({ error: 'Credenciais inválidas. Verifique seu e-mail e senha.' });
      return;
    }

    // Block default demo passwords if DISABLE_DEMO_ACCOUNTS is active or in production
    const isUsingDefaultDemoPassword =
      DEMO_DEFAULT_PASSWORDS[user.id] &&
      expectedHash === hashPassword(DEMO_DEFAULT_PASSWORDS[user.id]);

    if (
      isUsingDefaultDemoPassword &&
      (process.env.DISABLE_DEMO_ACCOUNTS === 'true' || process.env.NODE_ENV === 'production')
    ) {
      logAudit(
        user,
        'AUTH_DEMO_CREDENTIAL_BLOCKED',
        'security',
        `Login bloqueado em produção: a conta ${user.email} ainda utiliza a senha demonstrativa padrão.`,
        'critical',
        user.id,
        req
      );
      res.status(403).json({
        error:
          'Bloqueio de Segurança de Produção: Credenciais demonstrativas padrão não são permitidas em produção. Redefina as senhas dos operadores.',
      });
      return;
    }

    user.lastLogin = new Date().toISOString();
    saveDb(db);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + 1000 * 60 * (db.settings.sessionTimeoutMinutes || 480),
    });

    logAudit(
      user,
      'AUTH_LOGIN_SUCCESS',
      'auth',
      `Login efetuado com sucesso (${user.role}).`,
      'info',
      user.id,
      req
    );

    res.json({ token, user, mustChangeDefaultPassword: Boolean(isUsingDefaultDemoPassword) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  function validateAvatarInput(avatarUrl: unknown): { valid: boolean; sanitized?: string; error?: string } {
    if (avatarUrl === undefined) return { valid: true };
    if (avatarUrl === null || avatarUrl === '') return { valid: true, sanitized: '' };
    if (typeof avatarUrl !== 'string') {
      return { valid: false, error: 'Formato de imagem de perfil inválido.' };
    }
    const trimmed = avatarUrl.trim();
    if (trimmed.length > 900_000) {
      return { valid: false, error: 'A imagem de perfil excede o tamanho máximo permitido (máx. 800KB).' };
    }
    const isAllowed =
      trimmed === '' ||
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('/');
    if (!isAllowed) {
      return { valid: false, error: 'URL ou formato de foto de perfil não suportado.' };
    }
    return { valid: true, sanitized: trimmed };
  }

  function getLinkedProfessional(user: UserAccount) {
    return db.professionals.find(
      (p) =>
        p.email.toLowerCase() === user.email.toLowerCase() ||
        p.name.toLowerCase() === user.name.toLowerCase()
    );
  }

  function validateReferencePhotosInput(
    photos: unknown
  ): { valid: boolean; sanitized?: string[]; error?: string } {
    if (photos === undefined) return { valid: true };
    if (!Array.isArray(photos)) {
      return { valid: false, error: 'As fotos de referência devem ser enviadas em formato de lista.' };
    }
    if (photos.length > 6) {
      return { valid: false, error: 'É permitido anexar no máximo 6 fotos de referência por atendimento.' };
    }
    const sanitized: string[] = [];
    for (const item of photos) {
      const check = validateAvatarInput(item);
      if (!check.valid) {
        return { valid: false, error: check.error || 'Foto de referência inválida.' };
      }
      if (check.sanitized) {
        sanitized.push(check.sanitized);
      }
    }
    return { valid: true, sanitized };
  }

  // Self-profile update for authenticated ADM/Professional user (Strictly own profile only)
  app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const currentUser = req.user!;
    const { id, userId, targetUserId, name, phone, avatarUrl } = req.body;

    // Prevent modifying another user's profile without admin authorization
    const requestedTargetId = id || userId || targetUserId;
    if (requestedTargetId && requestedTargetId !== currentUser.id && currentUser.role !== 'admin') {
      logAudit(
        currentUser,
        'ACCESS_DENIED_PROFILE_TAMPER',
        'security',
        `Bloqueado: operador '${currentUser.email}' (${currentUser.role}) tentou alterar perfil de outro usuário (${requestedTargetId}).`,
        'warning',
        requestedTargetId,
        req
      );
      res.status(403).json({
        error: 'Permissão negada: você não possui autorização para alterar o perfil de outro usuário.',
      });
      return;
    }

    const targetId =
      requestedTargetId && currentUser.role === 'admin' ? requestedTargetId : currentUser.id;
    const targetUser = db.users.find((u) => u.id === targetId);
    if (!targetUser) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    const avatarCheck = validateAvatarInput(avatarUrl);
    if (!avatarCheck.valid) {
      res.status(400).json({ error: avatarCheck.error });
      return;
    }

    const linkedProf = getLinkedProfessional(targetUser);

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 3) {
        res.status(400).json({ error: 'O nome deve possuir pelo menos 3 caracteres.' });
        return;
      }
      targetUser.name = name.trim();
      if (linkedProf) {
        linkedProf.name = name.trim();
      }
    }
    if (phone !== undefined && typeof phone === 'string') {
      targetUser.phone = phone.trim();
      if (linkedProf) {
        linkedProf.phone = phone.trim();
      }
    }
    if (avatarCheck.sanitized !== undefined) {
      targetUser.avatarUrl = avatarCheck.sanitized;
      if (linkedProf) {
        linkedProf.avatarUrl = avatarCheck.sanitized;
      }
    }

    saveDb(db);
    logAudit(
      currentUser,
      'USER_PROFILE_UPDATED',
      'auth',
      `Foto/dados de perfil de '${targetUser.name}' (${targetUser.role}) atualizados.`,
      'info',
      targetUser.id,
      req
    );
    res.json({ user: targetUser });
  });

  // --- BOOTSTRAP DATA ROUTE (Filtered by user permissions, professional scope & LGPD PII masking) ---
  app.get('/api/bootstrap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const canSeeUsers = user.permissions.includes('users') || user.role === 'admin';
    const canSeeSecurity = user.permissions.includes('security') || user.role === 'admin';
    const canSeeFullPII = ['admin', 'manager', 'receptionist'].includes(user.role);

    if (user.role === 'professional') {
      const linkedProf = getLinkedProfessional(user);
      const myAppointments = linkedProf
        ? db.appointments.filter((a) => a.professionalId === linkedProf.id)
        : [];
      const authorizedClientIds = new Set(myAppointments.map((a) => a.clientId));
      const authorizedClients = db.clients
        .filter((c) => authorizedClientIds.has(c.id))
        .map((c) => ({
          ...c,
          cpf: c.cpf ? '***.***.***-**' : '',
          email: c.email ? c.email.replace(/^(..).*(@.*)$/, '$1***$2') : '',
          phone: c.phone ? c.phone.replace(/(\(\d{2}\)\s?\d{2})\d{3}(-\d{4})/, '$1***$2') : '',
          totalSpent: 0,
        }));
      const myCommissions = linkedProf
        ? db.commissions.filter((cm) => cm.professionalId === linkedProf.id)
        : [];

      res.json({
        user,
        linkedProfessionalId: linkedProf?.id || null,
        clients: authorizedClients,
        services: db.services,
        products: [],
        stockMovements: [],
        professionals: linkedProf ? [linkedProf] : [],
        appointments: myAppointments,
        sales: [],
        cashFlow: [],
        cashRegister: db.cashRegister,
        accounts: [],
        commissions: myCommissions,
        auditLogs: [],
        notifications: db.notifications.filter((n) => n.category === 'agenda'),
        settings: db.settings,
        users: [user],
        waitlist: (db.waitlist || []).filter(
          (w) => linkedProf && (w.professionalId === linkedProf.id || w.professionalId === 'any')
        ),
      });
      return;
    }

    res.json({
      user,
      clients: canSeeFullPII
        ? db.clients
        : db.clients.map((c) => ({
            ...c,
            cpf: c.cpf ? '***.***.***-**' : '',
            email: c.email ? c.email.replace(/^(..).*(@.*)$/, '$1***$2') : '',
          })),
      services: db.services,
      products: db.products,
      stockMovements: db.stockMovements,
      professionals: db.professionals,
      appointments: db.appointments,
      sales: db.sales,
      cashFlow: db.cashFlow,
      cashRegister: db.cashRegister,
      accounts: db.accounts,
      commissions: db.commissions,
      auditLogs: canSeeSecurity ? db.auditLogs : db.auditLogs.slice(0, 15),
      notifications: db.notifications,
      settings: db.settings,
      users: canSeeUsers
        ? db.users
        : db.users.map((u) => ({
            ...u,
            phone: '***',
          })),
      waitlist: db.waitlist || [],
    });
  });

  // --- CLIENTS CRUD ---
  app.post('/api/clients', requireAuth, requireModulePermission('clients', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const { name, email, phone, cpf, birthDate, tier, notes, allergies, status } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      res.status(400).json({ error: 'O nome completo da cliente deve ter pelo menos 3 caracteres.' });
      return;
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      res.status(400).json({ error: 'Informe um telefone/WhatsApp válido.' });
      return;
    }
    const newClient = {
      id: `cli-${Date.now()}`,
      name: name.trim(),
      email: (email || '').trim(),
      phone: phone.trim(),
      cpf: (cpf || '').trim(),
      birthDate: birthDate || '1990-01-01',
      tier: tier || 'Standard',
      totalSpent: 0,
      visitsCount: 0,
      lastVisit: '-',
      notes: (notes || '').trim(),
      allergies: (allergies || 'Nenhuma relatada').trim(),
      status: status || 'active',
      createdAt: new Date().toISOString(),
    };
    db.clients.unshift(newClient);
    saveDb(db);
    logAudit(req.user!, 'CLIENT_CREATED', 'clients', `Cliente '${newClient.name}' cadastrada.`, 'info', newClient.id, req);
    res.status(201).json(newClient);
  });

  app.put('/api/clients/:id', requireAuth, requireModulePermission('clients', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.clients.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Cliente não encontrada.' });
      return;
    }
    const { name, phone } = req.body;
    if (!name || name.trim().length < 3 || !phone || phone.trim().length < 8) {
      res.status(400).json({ error: 'Nome e telefone válidos são obrigatórios.' });
      return;
    }
    db.clients[idx] = { ...db.clients[idx], ...req.body, id: db.clients[idx].id };
    saveDb(db);
    logAudit(req.user!, 'CLIENT_UPDATED', 'clients', `Cadastro da cliente '${db.clients[idx].name}' atualizado.`, 'info', db.clients[idx].id, req);
    res.json(db.clients[idx]);
  });

  app.delete('/api/clients/:id', requireAuth, requireModulePermission('clients', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.clients.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Cliente não encontrada.' });
      return;
    }
    const removed = db.clients.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'CLIENT_DELETED', 'clients', `Cliente '${removed.name}' removida permanentemente.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  // --- SERVICES CRUD ---
  app.post('/api/services', requireAuth, requireModulePermission('services', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const { name, category, durationMinutes, price, commissionRate, description, status } = req.body;
    if (!name || name.trim().length < 3) {
      res.status(400).json({ error: 'Informe o nome do serviço.' });
      return;
    }
    if (Number(price) <= 0 || Number(durationMinutes) <= 0) {
      res.status(400).json({ error: 'Preço e duração devem ser maiores que zero.' });
      return;
    }
    const srv = {
      id: `srv-${Date.now()}`,
      name: name.trim(),
      category: category || 'Cabelo',
      durationMinutes: Number(durationMinutes),
      price: Number(price),
      commissionRate: Number(commissionRate ?? 40),
      description: (description || '').trim(),
      status: status || 'active',
    };
    db.services.unshift(srv);
    saveDb(db);
    logAudit(req.user!, 'SERVICE_CREATED', 'services', `Serviço '${srv.name}' criado (R$ ${srv.price.toFixed(2)}).`, 'info', srv.id, req);
    res.status(201).json(srv);
  });

  app.put('/api/services/:id', requireAuth, requireModulePermission('services', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.services.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }
    db.services[idx] = {
      ...db.services[idx],
      ...req.body,
      price: Number(req.body.price ?? db.services[idx].price),
      durationMinutes: Number(req.body.durationMinutes ?? db.services[idx].durationMinutes),
      commissionRate: Number(req.body.commissionRate ?? db.services[idx].commissionRate),
      id: db.services[idx].id,
    };
    saveDb(db);
    logAudit(req.user!, 'SERVICE_UPDATED', 'services', `Serviço '${db.services[idx].name}' atualizado.`, 'info', db.services[idx].id, req);
    res.json(db.services[idx]);
  });

  app.delete('/api/services/:id', requireAuth, requireModulePermission('services', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.services.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Serviço não encontrado.' });
      return;
    }
    const removed = db.services.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'SERVICE_DELETED', 'services', `Serviço '${removed.name}' excluído.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  // --- PRODUCTS & INVENTORY ---
  app.post('/api/products', requireAuth, requireModulePermission('products', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const { sku, name, brand, category, usageType, costPrice, salePrice, stock, minStock, unit, supplier, batch, expiryDate, status } = req.body;
    if (!name || name.trim().length < 3 || !sku) {
      res.status(400).json({ error: 'Nome do produto e código SKU são obrigatórios.' });
      return;
    }
    if (Number(salePrice) < 0 || Number(costPrice) < 0) {
      res.status(400).json({ error: 'Valores de custo e venda não podem ser negativos.' });
      return;
    }
    const prd = {
      id: `prd-${Date.now()}`,
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      brand: (brand || 'Geral').trim(),
      category: category || 'Home Care',
      usageType: usageType || 'both',
      costPrice: Number(costPrice),
      salePrice: Number(salePrice),
      stock: Number(stock ?? 0),
      minStock: Number(minStock ?? 5),
      unit: unit || 'un',
      supplier: (supplier || '').trim(),
      batch: (batch || 'LOTE-01').trim(),
      expiryDate: expiryDate || '2028-01-01',
      status: status || 'active',
    };
    db.products.unshift(prd);
    saveDb(db);
    logAudit(req.user!, 'PRODUCT_CREATED', 'products', `Produto '${prd.name}' (${prd.sku}) cadastrado com estoque inicial ${prd.stock}.`, 'info', prd.id, req);
    res.status(201).json(prd);
  });

  app.put('/api/products/:id', requireAuth, requireModulePermission('products', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }
    db.products[idx] = {
      ...db.products[idx],
      ...req.body,
      costPrice: Number(req.body.costPrice ?? db.products[idx].costPrice),
      salePrice: Number(req.body.salePrice ?? db.products[idx].salePrice),
      stock: Number(req.body.stock ?? db.products[idx].stock),
      minStock: Number(req.body.minStock ?? db.products[idx].minStock),
      id: db.products[idx].id,
    };
    saveDb(db);
    logAudit(req.user!, 'PRODUCT_UPDATED', 'products', `Produto '${db.products[idx].name}' atualizado.`, 'info', db.products[idx].id, req);
    res.json(db.products[idx]);
  });

  app.delete('/api/products/:id', requireAuth, requireModulePermission('products', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }
    const removed = db.products.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'PRODUCT_DELETED', 'products', `Produto '${removed.name}' excluído do catálogo.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  app.post('/api/inventory/movements', requireAuth, requireModulePermission('inventory', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const { productId, type, quantity, reason } = req.body;
    const product = db.products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado para movimentação.' });
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      res.status(400).json({ error: 'A quantidade deve ser maior que zero.' });
      return;
    }
    if (!reason || reason.trim().length < 3) {
      res.status(400).json({ error: 'Informe a justificativa ou nota fiscal da movimentação.' });
      return;
    }
    const previousStock = product.stock;
    let newStock = previousStock;
    if (type === 'in') {
      newStock = previousStock + qty;
    } else if (type === 'out') {
      if (previousStock < qty) {
        res.status(400).json({ error: `Saldo insuficiente em estoque (${previousStock} disponíveis).` });
        return;
      }
      newStock = previousStock - qty;
    } else if (type === 'adjustment') {
      newStock = qty;
    }

    product.stock = newStock;
    const movement: StockMovement = {
      id: `mov-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      type,
      quantity: qty,
      previousStock,
      newStock,
      reason: reason.trim(),
      performedBy: req.user!.name,
      createdAt: new Date().toISOString(),
    };
    db.stockMovements.unshift(movement);

    if (newStock <= product.minStock) {
      addNotification(
        `Alerta de Estoque Mínimo: ${product.name}`,
        `O produto ${product.name} (${product.sku}) está com ${newStock} ${product.unit} (mínimo: ${product.minStock}).`,
        'stock',
        'inventory'
      );
    }

    saveDb(db);
    logAudit(
      req.user!,
      'INVENTORY_MOVEMENT',
      'inventory',
      `Movimentação (${type.toUpperCase()}) em '${product.name}': ${previousStock} -> ${newStock} (${reason}).`,
      newStock <= product.minStock ? 'warning' : 'info',
      product.id,
      req
    );
    res.status(201).json({ movement, product });
  });

  // --- PROFESSIONALS CRUD ---
  app.post('/api/professionals', requireAuth, requireModulePermission('professionals', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const { name, specialty, email, phone, documentRegistry, defaultCommission, workDays, workHours, status, bio } = req.body;
    if (!name || name.trim().length < 3 || !specialty) {
      res.status(400).json({ error: 'Nome e especialidade do profissional são obrigatórios.' });
      return;
    }
    const prof = {
      id: `prf-${Date.now()}`,
      name: name.trim(),
      specialty: specialty.trim(),
      email: (email || '').trim(),
      phone: (phone || '').trim(),
      documentRegistry: (documentRegistry || '').trim(),
      defaultCommission: Number(defaultCommission ?? 40),
      workDays: Array.isArray(workDays) && workDays.length > 0 ? workDays : ['Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
      workHours: workHours || '09:00 às 19:00',
      rating: 5.0,
      completedAppointments: 0,
      status: status || 'active',
      bio: (bio || '').trim(),
    };
    db.professionals.unshift(prof);
    saveDb(db);
    logAudit(req.user!, 'PROFESSIONAL_CREATED', 'professionals', `Profissional '${prof.name}' cadastrado.`, 'info', prof.id, req);
    res.status(201).json(prof);
  });

  app.put('/api/professionals/:id', requireAuth, requireModulePermission('professionals', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.professionals.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Profissional não encontrado.' });
      return;
    }
    db.professionals[idx] = {
      ...db.professionals[idx],
      ...req.body,
      defaultCommission: Number(req.body.defaultCommission ?? db.professionals[idx].defaultCommission),
      id: db.professionals[idx].id,
    };
    saveDb(db);
    logAudit(req.user!, 'PROFESSIONAL_UPDATED', 'professionals', `Dados de '${db.professionals[idx].name}' atualizados.`, 'info', db.professionals[idx].id, req);
    res.json(db.professionals[idx]);
  });

  app.delete('/api/professionals/:id', requireAuth, requireModulePermission('professionals', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.professionals.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Profissional não encontrado.' });
      return;
    }
    const removed = db.professionals.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'PROFESSIONAL_DELETED', 'professionals', `Profissional '${removed.name}' removido do quadro.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  // --- AGENDA / APPOINTMENTS ---
  app.post('/api/appointments', requireAuth, requireModulePermission('agenda'), (req: AuthenticatedRequest, res: Response) => {
    const { clientId, professionalId, serviceId, date, startTime, notes, status, referencePhotos } = req.body;
    const currentUser = req.user!;

    if (currentUser.role === 'professional') {
      const linkedProf = getLinkedProfessional(currentUser);
      if (!linkedProf || professionalId !== linkedProf.id) {
        logAudit(
          currentUser,
          'ACCESS_DENIED_PROFESSIONAL_SCOPE',
          'security',
          `Bloqueado: profissional '${currentUser.name}' tentou criar agendamento em nome de outro especialista (${professionalId}).`,
          'warning',
          professionalId,
          req
        );
        res.status(403).json({
          error: 'Permissão negada: você só possui autorização para registrar atendimentos em sua própria agenda.',
        });
        return;
      }
    }

    const photosCheck = validateReferencePhotosInput(referencePhotos);
    if (!photosCheck.valid) {
      res.status(400).json({ error: photosCheck.error });
      return;
    }

    const client = db.clients.find((c) => c.id === clientId);
    const prof = db.professionals.find((p) => p.id === professionalId);
    const srv = db.services.find((s) => s.id === serviceId);

    if (!client || !prof || !srv || !date || !startTime) {
      res.status(400).json({ error: 'Selecione cliente, profissional, serviço, data e horário válidos.' });
      return;
    }

    // Calculate endTime
    const [hh, mm] = startTime.split(':').map(Number);
    if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      res.status(400).json({ error: 'Formato de horário inválido (use HH:mm).' });
      return;
    }
    const newStartMin = hh * 60 + mm;
    const newEndMin = newStartMin + srv.durationMinutes;
    const endH = String(Math.floor(newEndMin / 60) % 24).padStart(2, '0');
    const endM = String(newEndMin % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    // Full time-window overlap check for same professional on same date
    const conflict = db.appointments.find((a) => {
      if (a.professionalId !== professionalId || a.date !== date || a.status === 'cancelled') {
        return false;
      }
      const existStart = timeToMinutes(a.startTime);
      const existEnd = timeToMinutes(a.endTime);
      return newStartMin < existEnd && newEndMin > existStart;
    });
    if (conflict) {
      res.status(409).json({
        error: `Conflito de agenda: ${prof.name} já possui atendimento das ${conflict.startTime} às ${conflict.endTime} (${conflict.clientName}).`,
      });
      return;
    }

    const apt = {
      id: `apt-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      professionalId: prof.id,
      professionalName: prof.name,
      serviceId: srv.id,
      serviceName: srv.name,
      date,
      startTime,
      endTime,
      price: srv.price,
      status: status || 'scheduled',
      paymentStatus: 'pending' as const,
      notes: (notes || '').trim(),
      referencePhotos: photosCheck.sanitized || [],
      createdAt: new Date().toISOString(),
    };

    db.appointments.unshift(apt);
    saveDb(db);
    logAudit(
      req.user!,
      'APPOINTMENT_CREATED',
      'agenda',
      `Agendamento criado: ${client.name} com ${prof.name} (${srv.name}) em ${date} das ${startTime} às ${endTime}.`,
      'info',
      apt.id,
      req
    );
    res.status(201).json(apt);
  });

  app.put('/api/appointments/:id', requireAuth, requireModulePermission('agenda'), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.appointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    const current = db.appointments[idx];
    const currentUser = req.user!;

    // Strict RBAC isolation for professionals: only own appointments can be accessed/updated
    if (currentUser.role === 'professional') {
      const linkedProf = getLinkedProfessional(currentUser);
      if (
        !linkedProf ||
        current.professionalId !== linkedProf.id ||
        (req.body.professionalId && req.body.professionalId !== linkedProf.id)
      ) {
        logAudit(
          currentUser,
          'ACCESS_DENIED_PROFESSIONAL_SCOPE',
          'security',
          `Bloqueado: profissional '${currentUser.name}' tentou alterar atendimento '${current.id}' pertencente a '${current.professionalName}'.`,
          'warning',
          current.id,
          req
        );
        res.status(403).json({
          error: 'Permissão negada: você só possui autorização para acessar e gerenciar seus próprios atendimentos.',
        });
        return;
      }
    }

    const photosCheck = validateReferencePhotosInput(req.body.referencePhotos);
    if (!photosCheck.valid) {
      res.status(400).json({ error: photosCheck.error });
      return;
    }

    const targetProfId = req.body.professionalId || current.professionalId;
    const targetDate = req.body.date || current.date;
    const targetStartTime = req.body.startTime || current.startTime;
    const targetServiceId = req.body.serviceId || current.serviceId;
    const targetStatus = req.body.status || current.status;

    const srv = db.services.find((s) => s.id === targetServiceId);
    const duration = srv ? srv.durationMinutes : 60;
    const newStartMin = timeToMinutes(targetStartTime);
    const newEndMin = newStartMin + duration;
    const endH = String(Math.floor(newEndMin / 60) % 24).padStart(2, '0');
    const endM = String(newEndMin % 60).padStart(2, '0');
    const computedEndTime = req.body.startTime || req.body.serviceId ? `${endH}:${endM}` : current.endTime;

    if (targetStatus !== 'cancelled') {
      const conflict = db.appointments.find((a) => {
        if (a.id === current.id || a.professionalId !== targetProfId || a.date !== targetDate || a.status === 'cancelled') {
          return false;
        }
        const existStart = timeToMinutes(a.startTime);
        const existEnd = timeToMinutes(a.endTime);
        return newStartMin < existEnd && newEndMin > existStart;
      });
      if (conflict) {
        res.status(409).json({
          error: `Conflito de agenda na edição: horário colide com atendimento das ${conflict.startTime} às ${conflict.endTime} (${conflict.clientName}).`,
        });
        return;
      }
    }

    db.appointments[idx] = {
      ...current,
      ...req.body,
      referencePhotos:
        photosCheck.sanitized !== undefined ? photosCheck.sanitized : current.referencePhotos || [],
      endTime: computedEndTime,
      id: current.id,
    };
    saveDb(db);
    logAudit(
      req.user!,
      'APPOINTMENT_UPDATED',
      'agenda',
      `Status/dados do agendamento de '${db.appointments[idx].clientName}' atualizado para '${db.appointments[idx].status}'.`,
      'info',
      db.appointments[idx].id,
      req
    );
    res.json(db.appointments[idx]);
  });

  app.delete('/api/appointments/:id', requireAuth, requireModulePermission('agenda', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.appointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    const removed = db.appointments.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'APPOINTMENT_DELETED', 'agenda', `Agendamento de '${removed.clientName}' (${removed.date} ${removed.startTime}) excluído.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  // --- SALES (PDV) WITH AUTOMATIC STOCK DEDUCTION, CASHFLOW & COMMISSIONS ---
  app.post('/api/sales', requireAuth, requireModulePermission('sales', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const { clientId, items, discount, paymentMethod, installments, appointmentId } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Adicione pelo menos um serviço ou produto à comanda de venda.' });
      return;
    }
    const client = db.clients.find((c) => c.id === clientId);
    const clientName = client ? client.name : 'Cliente Avulso';

    // Validate item quantities & prices before processing sale
    for (const it of items) {
      const qty = Number(it.quantity);
      const uPrice = Number(it.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(uPrice) || uPrice < 0) {
        res.status(400).json({ error: 'Quantidade e preço unitário dos itens devem ser números positivos válidos.' });
        return;
      }
    }

    // Validate product stock if autoDeductStockOnSale is enabled (aggregating duplicate product lines)
    if (db.settings.autoDeductStockOnSale) {
      const requestedByProduct: Record<string, number> = {};
      for (const item of items) {
        if (item.type === 'product') {
          requestedByProduct[item.referenceId] = (requestedByProduct[item.referenceId] || 0) + Number(item.quantity);
        }
      }
      for (const [prdId, totalReqQty] of Object.entries(requestedByProduct)) {
        const prd = db.products.find((p) => p.id === prdId);
        if (!prd) {
          res.status(400).json({ error: `Produto (${prdId}) não encontrado no catálogo.` });
          return;
        }
        if (prd.stock < totalReqQty) {
          res.status(400).json({
            error: `Estoque insuficiente para '${prd.name}': disponível ${prd.stock}, solicitado ${totalReqQty}.`,
          });
          return;
        }
      }
    }

    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.unitPrice) * Number(it.quantity), 0);
    const numDiscount = Number(discount || 0);
    if (!Number.isFinite(numDiscount) || numDiscount < 0 || numDiscount > subtotal) {
      res.status(400).json({ error: 'Desconto inválido: não pode ser negativo nem superior ao subtotal da venda.' });
      return;
    }
    const total = Math.max(0, Number((subtotal - numDiscount).toFixed(2)));
    const saleCode = `VND-${1000 + db.sales.length + 1}`;
    const today = getTodayStr();

    const newSale: Sale = {
      id: `sal-${Date.now()}`,
      code: saleCode,
      clientId: client ? client.id : 'walk-in',
      clientName,
      items: items.map((it: any) => ({
        type: it.type,
        referenceId: it.referenceId,
        name: it.name,
        professionalId: it.professionalId,
        professionalName: it.professionalName,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        totalPrice: Number((Number(it.unitPrice) * Number(it.quantity)).toFixed(2)),
      })),
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(numDiscount.toFixed(2)),
      total,
      paymentMethod: paymentMethod || 'PIX',
      installments: Number(installments || 1),
      status: 'completed',
      appointmentId,
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
    };

    db.sales.unshift(newSale);

    // Update Client stats
    if (client) {
      client.totalSpent = Number((client.totalSpent + total).toFixed(2));
      client.visitsCount += 1;
      client.lastVisit = today;
      if (client.totalSpent >= 4500) client.tier = 'Signature';
      else if (client.totalSpent >= 1800) client.tier = 'Gold';
    }

    // Update linked appointment if any
    if (appointmentId) {
      const apt = db.appointments.find((a) => a.id === appointmentId);
      if (apt) {
        apt.status = 'completed';
        apt.paymentStatus = 'paid';
      }
    }

    // Deduct stock & create stock movement
    if (db.settings.autoDeductStockOnSale) {
      for (const item of newSale.items) {
        if (item.type === 'product') {
          const prd = db.products.find((p) => p.id === item.referenceId);
          if (prd) {
            const prev = prd.stock;
            prd.stock = Math.max(0, prev - item.quantity);
            db.stockMovements.unshift({
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              productId: prd.id,
              productName: prd.name,
              type: 'out',
              quantity: item.quantity,
              previousStock: prev,
              newStock: prd.stock,
              reason: `Baixa automática PDV #${saleCode} (${clientName})`,
              performedBy: req.user!.name,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Generate Commissions (proportional to net discount ratio)
    if (db.settings.autoGenerateCommission) {
      const discountRatio = subtotal > 0 ? total / subtotal : 1;
      for (const item of newSale.items) {
        if (item.professionalId) {
          const prof = db.professionals.find((p) => p.id === item.professionalId);
          if (prof) {
            let rate = prof.defaultCommission;
            if (item.type === 'service') {
              const srv = db.services.find((s) => s.id === item.referenceId);
              if (srv) rate = srv.commissionRate;
              prof.completedAppointments += 1;
            } else {
              rate = 10; // 10% retail commission
            }
            const netItemBase = Number((item.totalPrice * discountRatio).toFixed(2));
            const commAmount = Number(((netItemBase * rate) / 100).toFixed(2));
            const comm: CommissionEntry = {
              id: `com-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              professionalId: prof.id,
              professionalName: prof.name,
              saleId: newSale.id,
              saleCode: newSale.code,
              itemName: item.name,
              saleDate: today,
              grossAmount: netItemBase,
              commissionPercentage: rate,
              commissionAmount: commAmount,
              status: 'pending',
            };
            db.commissions.unshift(comm);
          }
        }
      }
    }

    // Add CashFlow entry
    const cfEntry: CashFlowEntry = {
      id: `cf-${Date.now()}`,
      type: 'income',
      category: 'Vendas e Serviços',
      description: `Recebimento PDV #${saleCode} - ${clientName}`,
      amount: total,
      paymentMethod: newSale.paymentMethod,
      date: today,
      referenceId: newSale.id,
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
    };
    db.cashFlow.unshift(cfEntry);

    saveDb(db);
    logAudit(
      req.user!,
      'SALE_CREATED',
      'sales',
      `Venda #${saleCode} concluída para '${clientName}' no valor de R$ ${total.toFixed(2)} (${newSale.paymentMethod}).`,
      'info',
      newSale.id,
      req
    );
    res.status(201).json(newSale);
  });

  app.post('/api/sales/:id/refund', requireAuth, requireModulePermission('sales', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const sale = db.sales.find((s) => s.id === req.params.id);
    if (!sale) {
      res.status(404).json({ error: 'Venda não encontrada.' });
      return;
    }
    if (sale.status === 'refunded') {
      res.status(400).json({ error: 'Esta venda já foi estornada anteriormente.' });
      return;
    }
    sale.status = 'refunded';

    // Restore product stock & log Kardex return movement
    if (db.settings.autoDeductStockOnSale) {
      for (const item of sale.items) {
        if (item.type === 'product') {
          const prd = db.products.find((p) => p.id === item.referenceId);
          if (prd) {
            const prev = prd.stock;
            prd.stock = prev + item.quantity;
            db.stockMovements.unshift({
              id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              productId: prd.id,
              productName: prd.name,
              type: 'in',
              quantity: item.quantity,
              previousStock: prev,
              newStock: prd.stock,
              reason: `Devolução de estoque por estorno PDV #${sale.code}`,
              performedBy: req.user!.name,
              createdAt: new Date().toISOString(),
            });
          }
        } else if (item.type === 'service' && item.professionalId) {
          const prof = db.professionals.find((p) => p.id === item.professionalId);
          if (prof && prof.completedAppointments > 0) {
            prof.completedAppointments -= 1;
          }
        }
      }
    }

    // Reverse Client stats
    if (sale.clientId && sale.clientId !== 'walk-in') {
      const client = db.clients.find((c) => c.id === sale.clientId);
      if (client) {
        client.totalSpent = Math.max(0, Number((client.totalSpent - sale.total).toFixed(2)));
        client.visitsCount = Math.max(0, client.visitsCount - 1);
      }
    }

    // Reverse linked appointment paymentStatus if any
    if (sale.appointmentId) {
      const apt = db.appointments.find((a) => a.id === sale.appointmentId);
      if (apt) {
        apt.paymentStatus = 'pending';
      }
    }

    // Reverse CashFlow
    db.cashFlow.unshift({
      id: `cf-${Date.now()}`,
      type: 'expense',
      category: 'Estorno de Venda',
      description: `Estorno PDV #${sale.code} - ${sale.clientName}`,
      amount: sale.total,
      paymentMethod: sale.paymentMethod,
      date: getTodayStr(),
      referenceId: sale.id,
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });

    // Remove commissions from this sale
    db.commissions = db.commissions.filter((c) => c.saleId !== sale.id);

    saveDb(db);
    logAudit(
      req.user!,
      'SALE_REFUNDED',
      'sales',
      `Venda #${sale.code} (R$ ${sale.total.toFixed(2)}) estornada com devolução de estoque e reversão financeira por ${req.user!.name}.`,
      'critical',
      sale.id,
      req
    );
    res.json(sale);
  });

  // --- CASH FLOW & REGISTER ---
  app.post('/api/cashflow', requireAuth, requireModulePermission('cashflow', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const { type, category, description, amount, paymentMethod, date } = req.body;
    if (!description || Number(amount) <= 0) {
      res.status(400).json({ error: 'Informe uma descrição válida e valor maior que zero.' });
      return;
    }
    const entry: CashFlowEntry = {
      id: `cf-${Date.now()}`,
      type: type === 'expense' ? 'expense' : 'income',
      category: category || 'Operacional',
      description: description.trim(),
      amount: Number(amount),
      paymentMethod: paymentMethod || 'PIX',
      date: date || getTodayStr(),
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
    };
    db.cashFlow.unshift(entry);
    saveDb(db);
    logAudit(
      req.user!,
      'CASHFLOW_ENTRY_ADDED',
      'cashflow',
      `Lançamento no caixa (${entry.type.toUpperCase()}): ${entry.description} - R$ ${entry.amount.toFixed(2)}.`,
      'info',
      entry.id,
      req
    );
    res.status(201).json(entry);
  });

  app.post('/api/cashflow/register', requireAuth, requireModulePermission('cashflow', ['admin', 'manager', 'receptionist']), (req: AuthenticatedRequest, res: Response) => {
    const { action, openingBalance } = req.body;
    if (action === 'open') {
      db.cashRegister = {
        isOpen: true,
        openedAt: new Date().toISOString(),
        openedBy: req.user!.name,
        openingBalance: Number(openingBalance ?? 0),
      };
      logAudit(req.user!, 'CASH_REGISTER_OPENED', 'cashflow', `Caixa diário aberto com fundo de troco de R$ ${db.cashRegister.openingBalance.toFixed(2)}.`, 'info', undefined, req);
    } else {
      db.cashRegister.isOpen = false;
      logAudit(req.user!, 'CASH_REGISTER_CLOSED', 'cashflow', `Caixa diário encerrado e conferido por ${req.user!.name}.`, 'info', undefined, req);
    }
    saveDb(db);
    res.json(db.cashRegister);
  });

  app.delete('/api/cashflow/:id', requireAuth, requireModulePermission('cashflow', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.cashFlow.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Lançamento não encontrado.' });
      return;
    }
    const removed = db.cashFlow.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'CASHFLOW_ENTRY_DELETED', 'cashflow', `Lançamento '${removed.description}' (R$ ${removed.amount.toFixed(2)}) excluído.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  // --- ACCOUNTS PAYABLE & RECEIVABLE ---
  app.post('/api/accounts', requireAuth, requireModulePermission('accounts', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const { type, title, entityName, category, dueDate, amount, notes } = req.body;
    if (!title || !entityName || Number(amount) <= 0 || !dueDate) {
      res.status(400).json({ error: 'Preencha título, fornecedor/cliente, vencimento e valor maior que zero.' });
      return;
    }
    const acc = {
      id: `acc-${Date.now()}`,
      type: type === 'receivable' ? ('receivable' as const) : ('payable' as const),
      title: title.trim(),
      entityName: entityName.trim(),
      category: category || 'Geral',
      dueDate,
      amount: Number(amount),
      status: 'pending' as const,
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString(),
    };
    db.accounts.unshift(acc);
    saveDb(db);
    logAudit(req.user!, 'ACCOUNT_CREATED', 'accounts', `Título (${acc.type}) '${acc.title}' registrado no valor de R$ ${acc.amount.toFixed(2)}.`, 'info', acc.id, req);
    res.status(201).json(acc);
  });

  app.post('/api/accounts/:id/settle', requireAuth, requireModulePermission('accounts', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const acc = db.accounts.find((a) => a.id === req.params.id);
    if (!acc) {
      res.status(404).json({ error: 'Título financeiro não encontrado.' });
      return;
    }
    if (acc.status === 'paid') {
      res.status(400).json({ error: 'Este título já consta como liquidado.' });
      return;
    }
    acc.status = 'paid';
    acc.paidAt = new Date().toISOString();
    acc.paymentMethod = req.body.paymentMethod || 'PIX';

    // Automatically reflect in CashFlow
    db.cashFlow.unshift({
      id: `cf-${Date.now()}`,
      type: acc.type === 'payable' ? 'expense' : 'income',
      category: acc.category,
      description: `${acc.type === 'payable' ? 'Pagamento' : 'Recebimento'} Título: ${acc.title} (${acc.entityName})`,
      amount: acc.amount,
      paymentMethod: acc.paymentMethod!,
      date: getTodayStr(),
      referenceId: acc.id,
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });

    saveDb(db);
    logAudit(req.user!, 'ACCOUNT_SETTLED', 'accounts', `Título '${acc.title}' liquidado (R$ ${acc.amount.toFixed(2)} via ${acc.paymentMethod}).`, 'info', acc.id, req);
    res.json(acc);
  });

  app.delete('/api/accounts/:id', requireAuth, requireModulePermission('accounts', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.accounts.findIndex((a) => a.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Título não encontrado.' });
      return;
    }
    const removed = db.accounts.splice(idx, 1)[0];
    saveDb(db);
    logAudit(req.user!, 'ACCOUNT_DELETED', 'accounts', `Título '${removed.title}' excluído.`, 'warning', removed.id, req);
    res.json({ success: true });
  });

  // --- COMMISSIONS ---
  app.post('/api/commissions/:id/status', requireAuth, requireModulePermission('commissions', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const comm = db.commissions.find((c) => c.id === req.params.id);
    if (!comm) {
      res.status(404).json({ error: 'Registro de comissão não encontrado.' });
      return;
    }
    const { status } = req.body;
    comm.status = status;
    if (status === 'paid') {
      comm.paidAt = new Date().toISOString();
      db.cashFlow.unshift({
        id: `cf-${Date.now()}`,
        type: 'expense',
        category: 'Repasse de Comissões',
        description: `Pagamento comissão ${comm.professionalName} (${comm.itemName} - #${comm.saleCode})`,
        amount: comm.commissionAmount,
        paymentMethod: 'PIX',
        date: getTodayStr(),
        referenceId: comm.id,
        createdBy: req.user!.name,
        createdAt: new Date().toISOString(),
      });
    }
    saveDb(db);
    logAudit(req.user!, 'COMMISSION_STATUS_UPDATED', 'commissions', `Comissão de ${comm.professionalName} (R$ ${comm.commissionAmount.toFixed(2)}) alterada para '${status}'.`, 'info', comm.id, req);
    res.json(comm);
  });

  app.post('/api/commissions/pay-batch', requireAuth, requireModulePermission('commissions', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const { professionalId } = req.body;
    const targetList = db.commissions.filter(
      (c) => c.status !== 'paid' && (!professionalId || professionalId === 'all' || c.professionalId === professionalId)
    );
    if (targetList.length === 0) {
      res.status(400).json({ error: 'Não há comissões pendentes/aprovadas para liquidar neste filtro.' });
      return;
    }
    let totalPaid = 0;
    for (const c of targetList) {
      c.status = 'paid';
      c.paidAt = new Date().toISOString();
      totalPaid += c.commissionAmount;
    }
    db.cashFlow.unshift({
      id: `cf-${Date.now()}`,
      type: 'expense',
      category: 'Repasse de Comissões',
      description: `Fechamento de Comissões em Lote (${targetList.length} lançamentos)`,
      amount: Number(totalPaid.toFixed(2)),
      paymentMethod: 'PIX',
      date: getTodayStr(),
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    logAudit(req.user!, 'COMMISSION_BATCH_PAID', 'commissions', `Lote de ${targetList.length} comissões pago totalizando R$ ${totalPaid.toFixed(2)}.`, 'info', undefined, req);
    res.json({ count: targetList.length, totalPaid });
  });

  // --- USERS & RBAC MANAGEMENT ---
  app.post('/api/users', requireAuth, requireModulePermission('users', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    const { name, email, password, role, phone, twoFactorEnabled, permissions } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      return;
    }
    if (db.settings.enforceStrongPassword && !isStrongPassword(password)) {
      res.status(400).json({
        error: 'Política de Senha Forte: a senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.',
      });
      return;
    }
    if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
      return;
    }
    const validRole: Role = ['admin', 'manager', 'receptionist', 'professional'].includes(role) ? role : 'receptionist';
    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: validRole,
      status: 'active',
      phone: (phone || '').trim(),
      lastLogin: '-',
      twoFactorEnabled: Boolean(twoFactorEnabled),
      permissions: Array.isArray(permissions) && permissions.length > 0 ? permissions : ROLE_DEFAULT_PERMISSIONS[validRole],
      createdAt: new Date().toISOString(),
    };
    db.users.unshift(newUser);
    credentials[newUser.id] = hashPassword(password);
    saveDb(db);
    saveCredentials(credentials);
    logAudit(req.user!, 'USER_CREATED', 'users', `Novo operador '${newUser.name}' (${newUser.role}) provisionado.`, 'warning', newUser.id, req);
    res.status(201).json(newUser);
  });

  app.put('/api/users/:id', requireAuth, requireModulePermission('users', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const { name, role, status, phone, avatarUrl, twoFactorEnabled, permissions, newPassword } = req.body;
    if (db.users[idx].id === 'usr-1' && status && status !== 'active') {
      res.status(400).json({ error: 'Não é permitido bloquear a conta Administrador Master principal.' });
      return;
    }
    const avatarCheck = validateAvatarInput(avatarUrl);
    if (!avatarCheck.valid) {
      res.status(400).json({ error: avatarCheck.error });
      return;
    }
    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0) {
      if (db.settings.enforceStrongPassword && !isStrongPassword(newPassword)) {
        res.status(400).json({
          error: 'Política de Senha Forte: a nova senha deve ter no mínimo 8 caracteres, maiúscula, minúscula, número e símbolo.',
        });
        return;
      }
      credentials[db.users[idx].id] = hashPassword(newPassword);
      saveCredentials(credentials);
    }
    const updatedRole: Role = role || db.users[idx].role;
    db.users[idx] = {
      ...db.users[idx],
      name: name ? name.trim() : db.users[idx].name,
      role: updatedRole,
      status: status || db.users[idx].status,
      phone: phone !== undefined ? phone : db.users[idx].phone,
      avatarUrl: avatarCheck.sanitized !== undefined ? avatarCheck.sanitized : db.users[idx].avatarUrl,
      twoFactorEnabled: twoFactorEnabled !== undefined ? Boolean(twoFactorEnabled) : db.users[idx].twoFactorEnabled,
      permissions: Array.isArray(permissions) ? permissions : db.users[idx].permissions,
    };
    saveDb(db);
    logAudit(req.user!, 'USER_PERMISSIONS_UPDATED', 'users', `Permissões/cadastro do usuário '${db.users[idx].name}' (${db.users[idx].role}) atualizados.`, 'warning', db.users[idx].id, req);
    res.json(db.users[idx]);
  });

  app.delete('/api/users/:id', requireAuth, requireModulePermission('users', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    if (req.params.id === 'usr-1' || req.params.id === req.user!.id) {
      res.status(400).json({ error: 'Você não pode excluir sua própria conta ativa ou o Administrador Master.' });
      return;
    }
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const removed = db.users.splice(idx, 1)[0];
    delete credentials[removed.id];
    saveDb(db);
    saveCredentials(credentials);
    logAudit(req.user!, 'USER_DELETED', 'users', `Conta de usuário '${removed.name}' (${removed.email}) revogada e excluída.`, 'critical', removed.id, req);
    res.json({ success: true });
  });

  // --- NOTIFICATIONS ---
  app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const notif = db.notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.read = true;
      saveDb(db);
    }
    res.json({ success: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    db.notifications.forEach((n) => {
      n.read = true;
    });
    saveDb(db);
    res.json({ success: true });
  });

  app.post('/api/notifications', requireAuth, requireModulePermission('notifications', ['admin', 'manager']), (req: AuthenticatedRequest, res: Response) => {
    const { title, message, category, actionModule } = req.body;
    if (!title || !message) {
      res.status(400).json({ error: 'Título e mensagem do comunicado são obrigatórios.' });
      return;
    }
    addNotification(title.trim(), message.trim(), category || 'system', actionModule);
    logAudit(req.user!, 'NOTIFICATION_BROADCAST', 'notifications', `Comunicado interno enviado: '${title}'.`, 'info', undefined, req);
    res.status(201).json(db.notifications[0]);
  });

  app.delete('/api/notifications/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const idx = db.notifications.findIndex((n) => n.id === req.params.id);
    if (idx !== -1) {
      db.notifications.splice(idx, 1);
      saveDb(db);
    }
    res.json({ success: true });
  });

  // --- SETTINGS, SECURITY & BACKUP/RECOVERY ---
  app.put('/api/settings', requireAuth, requireModulePermission('settings', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    db.settings = {
      ...db.settings,
      ...req.body,
    };
    saveDb(db);
    logAudit(req.user!, 'SETTINGS_UPDATED', 'settings', `Configurações globais do salão e políticas operacionais atualizadas.`, 'warning', undefined, req);
    res.json(db.settings);
  });

  app.post('/api/security/test-rbac', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.user!.role !== 'admin') {
      logAudit(
        req.user!,
        'SECURITY_RBAC_PROBE_BLOCKED',
        'security',
        `Teste de intrusão/permissão bloqueado pelo backend para o papel '${req.user!.role}'.`,
        'warning',
        undefined,
        req
      );
      res.status(403).json({
        error: `Bloqueio Real de Backend Ativo: O perfil '${req.user!.role.toUpperCase()}' foi rejeitado pelo middleware HTTP 403.`,
      });
      return;
    }
    logAudit(req.user!, 'SECURITY_AUDIT_VERIFIED', 'security', 'Verificação de integridade de segurança executada pelo Administrador.', 'info', undefined, req);
    res.json({ message: 'Acesso administrativo verificado com sucesso pelo servidor.' });
  });

  app.get('/api/security/readiness', requireAuth, requireModulePermission('security', ['admin']), (_req: AuthenticatedRequest, res: Response) => {
    const demoUsersStillActive = db.users
      .filter((u) => DEMO_DEFAULT_PASSWORDS[u.id] && credentials[u.id] === hashPassword(DEMO_DEFAULT_PASSWORDS[u.id]))
      .map((u) => u.email);

    const hasCustomSessionSecret = Boolean(
      process.env.SESSION_SECRET &&
        process.env.SESSION_SECRET !== DEFAULT_FALLBACK_SECRET &&
        process.env.SESSION_SECRET.length >= 32
    );

    const backups = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort().reverse()
      : [];

    res.json({
      readyForProduction: demoUsersStillActive.length === 0 && hasCustomSessionSecret,
      hasCustomSessionSecret,
      demoAccountsWithDefaultPassword: demoUsersStillActive,
      disableDemoAccountsEnv: process.env.DISABLE_DEMO_ACCOUNTS === 'true',
      hasAutomaticBackupFile: fs.existsSync(DB_BAK_PATH),
      snapshots: backups,
    });
  });

  app.post('/api/security/backup', requireAuth, requireModulePermission('security', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot_${stamp}.json`;
    const target = path.join(BACKUP_DIR, filename);
    const payload = {
      createdAt: new Date().toISOString(),
      createdBy: req.user!.email,
      checksumSha256: crypto.createHash('sha256').update(JSON.stringify(db)).digest('hex'),
      db,
    };
    fs.writeFileSync(target, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
    logAudit(req.user!, 'BACKUP_CREATED', 'security', `Snapshot de segurança '${filename}' gerado (SHA-256: ${payload.checksumSha256.slice(0, 12)}...).`, 'info', filename, req);
    res.status(201).json({ filename, createdAt: payload.createdAt, checksumSha256: payload.checksumSha256 });
  });

  app.post('/api/security/restore', requireAuth, requireModulePermission('security', ['admin']), (req: AuthenticatedRequest, res: Response) => {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string' || filename.includes('..') || filename.includes('/')) {
      res.status(400).json({ error: 'Nome de arquivo de snapshot inválido.' });
      return;
    }
    const sourcePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(sourcePath)) {
      res.status(404).json({ error: 'Snapshot de backup não encontrado.' });
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
      const restoredDb: AppDatabase = parsed.db || parsed;
      if (!restoredDb.users || !restoredDb.clients || !restoredDb.sales) {
        res.status(400).json({ error: 'Estrutura de backup corrompida ou incompatível.' });
        return;
      }
      const computedHash = crypto.createHash('sha256').update(JSON.stringify(restoredDb)).digest('hex');
      if (parsed.checksumSha256 && parsed.checksumSha256 !== computedHash) {
        res.status(400).json({ error: 'Falha de integridade: checksum SHA-256 do backup não confere.' });
        return;
      }
      Object.assign(db, restoredDb);
      saveDb(db);
      logAudit(req.user!, 'BACKUP_RESTORED', 'security', `Banco de dados restaurado com sucesso a partir do snapshot '${filename}'.`, 'critical', filename, req);
      res.json({ success: true, filename, checksumSha256: computedHash });
    } catch {
      res.status(500).json({ error: 'Erro ao processar arquivo de restauração.' });
    }
  });

  // ==========================================================================
  // CLIENT PORTAL ROUTES (SEPARATED FROM ADM, CLIENT-SCOPED & VALIDATED)
  // ==========================================================================
  function requireClientAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Sessão de cliente não autenticada. Entre na sua conta para continuar.' });
      return;
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'client') {
      res.status(401).json({ error: 'Token de sessão inválido ou expirado.' });
      return;
    }
    const client = db.clients.find((c) => c.id === payload.userId);
    if (!client || client.status !== 'active') {
      res.status(403).json({ error: 'Cadastro de cliente inativo.' });
      return;
    }
    req.client = client;
    next();
  }

  // Public Catalog & Banners for Client Portal
  app.get('/api/public/catalog', (_req: Request, res: Response) => {
    const activeBanners = (db.settings.banners || DEFAULT_CLIENT_BANNERS)
      .filter((b) => b.active)
      .sort((a, b) => a.order - b.order);

    res.json({
      salon: {
        salonName: db.settings.salonName,
        phone: db.settings.phone,
        whatsapp: db.settings.whatsapp,
        email: db.settings.email,
        address: db.settings.address,
        city: db.settings.city,
        state: db.settings.state,
        openingTime: db.settings.openingTime,
        closingTime: db.settings.closingTime,
        slotIntervalMinutes: db.settings.slotIntervalMinutes || 30,
        allowOnlineBooking: db.settings.allowOnlineBooking,
        cancellationNoticeHours: db.settings.cancellationNoticeHours ?? 4,
      },
      banners: activeBanners,
      services: db.services.filter((s) => s.status === 'active'),
      professionals: db.professionals
        .filter((p) => p.status === 'active')
        .map((p) => ({
          id: p.id,
          name: p.name,
          specialty: p.specialty,
          workDays: p.workDays,
          workHours: p.workHours,
          rating: p.rating,
          bio: p.bio,
        })),
    });
  });

  // Real Slot Availability Engine (Computed from Professional workHours, workDays, and non-cancelled Appointments)
  app.get('/api/public/availability', (req: Request, res: Response) => {
    const { date, professionalId, serviceId, excludeAppointmentId } = req.query as Record<string, string>;
    if (!date || !professionalId || !serviceId) {
      res.status(400).json({ error: 'Informe data, especialista e serviço para consultar horários.' });
      return;
    }
    const prof = db.professionals.find((p) => p.id === professionalId && p.status === 'active');
    const srv = db.services.find((s) => s.id === serviceId && s.status === 'active');
    if (!prof || !srv) {
      res.status(404).json({ error: 'Especialista ou serviço indisponível.' });
      return;
    }

    // Parse date weekday in local representation
    const [yy, mm, dd] = date.split('-').map(Number);
    const dateObj = new Date(yy, (mm || 1) - 1, dd || 1);
    const dayLabel = WEEKDAY_MAP[dateObj.getDay()];

    if (Array.isArray(prof.workDays) && prof.workDays.length > 0 && !prof.workDays.includes(dayLabel)) {
      res.json({
        date,
        dayLabel,
        isWorkingDay: false,
        reason: `${prof.name} não atende às/aos ${dayLabel}s (Dias de atendimento: ${prof.workDays.join(', ')}).`,
        availableSlots: [],
        occupiedIntervals: [],
      });
      return;
    }

    // Parse workHours e.g. "09:00 às 19:00"
    const match = (prof.workHours || '').match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
    const openTime = match ? match[1] : db.settings.openingTime || '09:00';
    const closeTime = match ? match[2] : db.settings.closingTime || '20:00';
    const startWindow = timeToMinutes(openTime);
    const endWindow = timeToMinutes(closeTime);
    const step = Math.max(15, Number(db.settings.slotIntervalMinutes || 30));
    const duration = srv.durationMinutes;

    const dayAppointments = db.appointments.filter(
      (a) =>
        a.professionalId === prof.id &&
        a.date === date &&
        a.status !== 'cancelled' &&
        a.id !== excludeAppointmentId
    );

    const availableSlots: { startTime: string; endTime: string }[] = [];
    for (let t = startWindow; t + duration <= endWindow; t += step) {
      const candidateStart = t;
      const candidateEnd = t + duration;
      const hasOverlap = dayAppointments.some((a) => {
        const exStart = timeToMinutes(a.startTime);
        const exEnd = timeToMinutes(a.endTime);
        return candidateStart < exEnd && candidateEnd > exStart;
      });
      if (!hasOverlap) {
        const sh = String(Math.floor(candidateStart / 60)).padStart(2, '0');
        const sm = String(candidateStart % 60).padStart(2, '0');
        const eh = String(Math.floor(candidateEnd / 60)).padStart(2, '0');
        const em = String(candidateEnd % 60).padStart(2, '0');
        availableSlots.push({ startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` });
      }
    }

    res.json({
      date,
      dayLabel,
      isWorkingDay: true,
      availableSlots,
      occupiedIntervals: dayAppointments.map((a) => ({
        startTime: a.startTime,
        endTime: a.endTime,
      })),
    });
  });

  // Client Registration
  app.post('/api/client-auth/register', (req: Request, res: Response) => {
    const { name, email, phone, cpf, birthDate, password, allergies, notes } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      res.status(400).json({ error: 'Informe seu nome completo (mínimo 3 caracteres).' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Informe um e-mail válido.' });
      return;
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      res.status(400).json({ error: 'Informe seu WhatsApp/telefone com DDD.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Crie uma senha com pelo menos 6 caracteres.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    let client = db.clients.find((c) => c.email.toLowerCase() === normalizedEmail);
    if (client && credentials[client.id]) {
      res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail. Faça login ou recupere sua senha.' });
      return;
    }

    if (!client) {
      client = {
        id: `cli-${Date.now()}`,
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        cpf: (cpf || '').trim(),
        birthDate: birthDate || '1995-01-01',
        tier: 'Standard',
        totalSpent: 0,
        visitsCount: 0,
        lastVisit: '-',
        notes: (notes || '').trim(),
        allergies: (allergies || 'Nenhuma relatada').trim(),
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      db.clients.unshift(client);
    } else {
      client.name = name.trim();
      client.phone = phone.trim();
      if (cpf) client.cpf = cpf.trim();
      if (birthDate) client.birthDate = birthDate;
      if (allergies) client.allergies = allergies.trim();
    }

    credentials[client.id] = hashPassword(password);
    saveDb(db);
    saveCredentials(credentials);

    const token = signToken({
      userId: client.id,
      email: client.email,
      role: 'client',
      exp: Date.now() + 1000 * 60 * 60 * 24,
    });

    res.status(201).json({ token, client });
  });

  // Client Login
  app.post('/api/client-auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Informe seu e-mail e senha.' });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const client = db.clients.find((c) => c.email.toLowerCase() === normalizedEmail);
    if (!client) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }
    if (client.status !== 'active') {
      res.status(403).json({ error: 'Seu cadastro encontra-se inativo. Contate a recepção do salão.' });
      return;
    }
    const expectedHash = credentials[client.id];
    const providedHash = hashPassword(password);
    if (!expectedHash || expectedHash !== providedHash) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const token = signToken({
      userId: client.id,
      email: client.email,
      role: 'client',
      exp: Date.now() + 1000 * 60 * 60 * 24,
    });

    res.json({ token, client });
  });

  // Client Password Recovery (Verifies email + phone digits or CPF digits)
  app.post('/api/client-auth/recover', (req: Request, res: Response) => {
    const { email, verificationValue, newPassword } = req.body;
    if (!email || !verificationValue || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({
        error: 'Informe seu e-mail, telefone/CPF cadastrado e uma nova senha de pelo menos 6 caracteres.',
      });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const client = db.clients.find((c) => c.email.toLowerCase() === normalizedEmail);
    if (!client) {
      res.status(404).json({ error: 'Nenhuma conta localizada para os dados informados.' });
      return;
    }

    const cleanInput = String(verificationValue).replace(/\D/g, '');
    const cleanPhone = (client.phone || '').replace(/\D/g, '');
    const cleanCpf = (client.cpf || '').replace(/\D/g, '');

    const matchesPhone = cleanInput.length >= 4 && cleanPhone.endsWith(cleanInput.slice(-4));
    const matchesCpf = cleanInput.length >= 4 && cleanCpf.startsWith(cleanInput.slice(0, 4));

    if (!matchesPhone && !matchesCpf) {
      res.status(400).json({
        error: 'Os dígitos de verificação (Telefone ou CPF) não conferem com o cadastro.',
      });
      return;
    }

    credentials[client.id] = hashPassword(newPassword);
    saveCredentials(credentials);

    res.json({
      success: true,
      message: 'Sua senha foi redefinida com sucesso. Você já pode acessar sua conta.',
    });
  });

  // Authenticated Client Portal Data (Strictly scoped to req.client.id)
  app.get('/api/client-portal/me', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    const myAppointments = db.appointments
      .filter((a) => a.clientId === client.id)
      .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`));

    const myWaitlist = (db.waitlist || [])
      .filter((w) => w.clientId === client.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      client,
      appointments: myAppointments,
      waitlist: myWaitlist,
    });
  });

  // Client Profile Update (Strictly scoped to authenticated client)
  app.put('/api/client-portal/profile', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    const { id, clientId, targetClientId, name, phone, cpf, birthDate, allergies, notes, avatarUrl, newPassword } = req.body;

    const requestedTargetId = id || clientId || targetClientId;
    if (requestedTargetId && requestedTargetId !== client.id) {
      res.status(403).json({
        error: 'Acesso negado: você não possui autorização para alterar o perfil de outro usuário.',
      });
      return;
    }

    if (!name || String(name).trim().length < 3 || !phone || String(phone).trim().length < 8) {
      res.status(400).json({ error: 'Nome completo e telefone válido são obrigatórios.' });
      return;
    }

    const avatarCheck = validateAvatarInput(avatarUrl);
    if (!avatarCheck.valid) {
      res.status(400).json({ error: avatarCheck.error });
      return;
    }

    client.name = String(name).trim();
    client.phone = String(phone).trim();
    if (cpf !== undefined) client.cpf = String(cpf).trim();
    if (birthDate !== undefined) client.birthDate = String(birthDate);
    if (allergies !== undefined) client.allergies = String(allergies).trim();
    if (notes !== undefined) client.notes = String(notes).trim();
    if (avatarCheck.sanitized !== undefined) {
      client.avatarUrl = avatarCheck.sanitized;
    }

    if (newPassword && typeof newPassword === 'string' && newPassword.trim().length > 0) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
        return;
      }
      credentials[client.id] = hashPassword(newPassword);
      saveCredentials(credentials);
    }

    saveDb(db);
    res.json({ client });
  });

  // Client Create Appointment
  app.post('/api/client-portal/appointments', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    if (!db.settings.allowOnlineBooking) {
      res.status(403).json({ error: 'O agendamento online está temporariamente pausado pelo salão.' });
      return;
    }
    const { professionalId, serviceId, date, startTime, notes, referencePhotos } = req.body;
    const prof = db.professionals.find((p) => p.id === professionalId && p.status === 'active');
    const srv = db.services.find((s) => s.id === serviceId && s.status === 'active');

    if (!prof || !srv || !date || !startTime) {
      res.status(400).json({ error: 'Selecione serviço, especialista, data e horário disponíveis.' });
      return;
    }

    const photosCheck = validateReferencePhotosInput(referencePhotos);
    if (!photosCheck.valid) {
      res.status(400).json({ error: photosCheck.error });
      return;
    }

    const [hh, mm] = String(startTime).split(':').map(Number);
    if (isNaN(hh) || isNaN(mm)) {
      res.status(400).json({ error: 'Horário inválido.' });
      return;
    }
    const newStartMin = hh * 60 + mm;
    const newEndMin = newStartMin + srv.durationMinutes;
    const endH = String(Math.floor(newEndMin / 60) % 24).padStart(2, '0');
    const endM = String(newEndMin % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    // Verify workDay
    const [yy, mo, dd] = String(date).split('-').map(Number);
    const dateObj = new Date(yy, (mo || 1) - 1, dd || 1);
    const dayLabel = WEEKDAY_MAP[dateObj.getDay()];
    if (Array.isArray(prof.workDays) && prof.workDays.length > 0 && !prof.workDays.includes(dayLabel)) {
      res.status(400).json({
        error: `${prof.name} não realiza atendimentos às/aos ${dayLabel}s.`,
      });
      return;
    }

    // Verify overlap conflict
    const conflict = db.appointments.find((a) => {
      if (a.professionalId !== prof.id || a.date !== date || a.status === 'cancelled') return false;
      const exStart = timeToMinutes(a.startTime);
      const exEnd = timeToMinutes(a.endTime);
      return newStartMin < exEnd && newEndMin > existEndOrStart(exStart);
    });

    function existEndOrStart(v: number) {
      return v;
    }

    if (conflict) {
      res.status(409).json({
        error: `Este horário (${startTime}) acabou de ser preenchido na agenda de ${prof.name}. Escolha outro horário ou entre na Fila de Espera.`,
      });
      return;
    }

    const apt = {
      id: `apt-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      professionalId: prof.id,
      professionalName: prof.name,
      serviceId: srv.id,
      serviceName: srv.name,
      date,
      startTime,
      endTime,
      price: srv.price,
      status: 'confirmed' as const,
      paymentStatus: 'pending' as const,
      notes: (notes || '').trim(),
      referencePhotos: photosCheck.sanitized || [],
      createdAt: new Date().toISOString(),
    };

    db.appointments.unshift(apt);
    addNotification(
      `Novo Agendamento Online: ${client.name}`,
      `${client.name} agendou ${srv.name} com ${prof.name} para ${date} às ${startTime}.`,
      'agenda',
      'agenda'
    );
    saveDb(db);
    res.status(201).json(apt);
  });

  // Client Attach/Update Reference Photos on Own Appointment
  app.put('/api/client-portal/appointments/:id/reference-photos', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    const apt = db.appointments.find((a) => a.id === req.params.id);
    if (!apt) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    if (apt.clientId !== client.id) {
      res.status(403).json({ error: 'Acesso negado: você só pode enviar fotos de referência para seus próprios agendamentos.' });
      return;
    }
    const photosCheck = validateReferencePhotosInput(req.body.referencePhotos);
    if (!photosCheck.valid) {
      res.status(400).json({ error: photosCheck.error });
      return;
    }
    apt.referencePhotos = photosCheck.sanitized || [];
    saveDb(db);
    res.json(apt);
  });

  // Helper to check salon cancellation/reschedule window rule
  function checkAppointmentModificationRule(apt: { date: string; startTime: string; status: string }): string | null {
    if (apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'in_progress') {
      return 'Este agendamento já foi concluído, cancelado ou está em atendimento.';
    }
    const minHours = Number(db.settings.cancellationNoticeHours ?? 4);
    const aptTimestamp = new Date(`${apt.date}T${apt.startTime}:00`).getTime();
    const nowTimestamp = Date.now();
    const diffHours = (aptTimestamp - nowTimestamp) / (1000 * 60 * 60);
    if (diffHours >= 0 && diffHours < minHours) {
      return `Conforme política do salão, cancelamentos ou reagendamentos exigem antecedência mínima de ${minHours} horas. Entre em contato com a recepção pelo WhatsApp ${db.settings.whatsapp}.`;
    }
    return null;
  }

  // Client Cancel Own Appointment
  app.post('/api/client-portal/appointments/:id/cancel', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    const apt = db.appointments.find((a) => a.id === req.params.id);
    if (!apt) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    if (apt.clientId !== client.id) {
      res.status(403).json({ error: 'Acesso negado: você só pode gerenciar seus próprios agendamentos.' });
      return;
    }

    const ruleError = checkAppointmentModificationRule(apt);
    if (ruleError) {
      res.status(400).json({ error: ruleError });
      return;
    }

    apt.status = 'cancelled';
    addNotification(
      `Cancelamento Online: ${client.name}`,
      `A cliente ${client.name} cancelou o horário de ${apt.serviceName} (${apt.date} às ${apt.startTime}).`,
      'agenda',
      'agenda'
    );
    saveDb(db);
    res.json(apt);
  });

  // Client Reschedule Own Appointment
  app.post('/api/client-portal/appointments/:id/reschedule', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    const apt = db.appointments.find((a) => a.id === req.params.id);
    if (!apt) {
      res.status(404).json({ error: 'Agendamento não encontrado.' });
      return;
    }
    if (apt.clientId !== client.id) {
      res.status(403).json({ error: 'Acesso negado: você só pode reagendar seus próprios horários.' });
      return;
    }

    const ruleError = checkAppointmentModificationRule(apt);
    if (ruleError) {
      res.status(400).json({ error: ruleError });
      return;
    }

    const { date, startTime, professionalId } = req.body;
    if (!date || !startTime) {
      res.status(400).json({ error: 'Informe a nova data e horário para reagendamento.' });
      return;
    }

    const targetProfId = professionalId || apt.professionalId;
    const prof = db.professionals.find((p) => p.id === targetProfId && p.status === 'active');
    const srv = db.services.find((s) => s.id === apt.serviceId);
    if (!prof || !srv) {
      res.status(400).json({ error: 'Especialista ou serviço inválido.' });
      return;
    }

    const newStartMin = timeToMinutes(startTime);
    const newEndMin = newStartMin + srv.durationMinutes;
    const endH = String(Math.floor(newEndMin / 60) % 24).padStart(2, '0');
    const endM = String(newEndMin % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    const conflict = db.appointments.find((a) => {
      if (a.id === apt.id || a.professionalId !== prof.id || a.date !== date || a.status === 'cancelled') return false;
      const exStart = timeToMinutes(a.startTime);
      const exEnd = timeToMinutes(a.endTime);
      return newStartMin < exEnd && newEndMin > exStart;
    });
    if (conflict) {
      res.status(409).json({
        error: `Horário indisponível: ${prof.name} já possui atendimento das ${conflict.startTime} às ${conflict.endTime}.`,
      });
      return;
    }

    apt.date = date;
    apt.startTime = startTime;
    apt.endTime = endTime;
    apt.professionalId = prof.id;
    apt.professionalName = prof.name;
    apt.status = 'confirmed';

    addNotification(
      `Reagendamento Online: ${client.name}`,
      `${client.name} reagendou ${apt.serviceName} para ${date} às ${startTime} com ${prof.name}.`,
      'agenda',
      'agenda'
    );
    saveDb(db);
    res.json(apt);
  });

  // Client Waitlist Request
  app.post('/api/client-portal/waitlist', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    const { serviceId, professionalId, desiredDate, preferredPeriod, notes } = req.body;
    const srv = db.services.find((s) => s.id === serviceId);
    const prof = db.professionals.find((p) => p.id === professionalId);
    if (!srv || !desiredDate) {
      res.status(400).json({ error: 'Selecione o serviço e a data desejada para a fila de espera.' });
      return;
    }

    const entry: WaitlistEntry = {
      id: `wlt-${Date.now()}`,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: srv.id,
      serviceName: srv.name,
      professionalId: prof ? prof.id : 'any',
      professionalName: prof ? prof.name : 'Qualquer Especialista',
      desiredDate,
      preferredPeriod: preferredPeriod || 'Qualquer Horário',
      notes: (notes || '').trim(),
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };

    if (!Array.isArray(db.waitlist)) db.waitlist = [];
    db.waitlist.unshift(entry);

    addNotification(
      `Nova Solicitação na Fila de Espera`,
      `${client.name} solicitou vaga para ${srv.name} em ${desiredDate} (${entry.preferredPeriod}).`,
      'agenda',
      'agenda'
    );
    saveDb(db);
    res.status(201).json(entry);
  });

  app.delete('/api/client-portal/waitlist/:id', requireClientAuth, (req: AuthenticatedRequest, res: Response) => {
    const client = req.client!;
    if (!Array.isArray(db.waitlist)) db.waitlist = [];
    const idx = db.waitlist.findIndex((w) => w.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Solicitação de fila de espera não encontrada.' });
      return;
    }
    if (db.waitlist[idx].clientId !== client.id) {
      res.status(403).json({ error: 'Acesso negado: você só pode remover suas próprias solicitações.' });
      return;
    }
    db.waitlist[idx].status = 'cancelled';
    saveDb(db);
    res.json({ success: true });
  });

  // Vite middleware in dev / static in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumina Atelier Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
