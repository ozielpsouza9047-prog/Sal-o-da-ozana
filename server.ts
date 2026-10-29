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
} from './src/types';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'salon_db.json');
const CREDENTIALS_PATH = path.join(DATA_DIR, 'credentials.json');
const JWT_SECRET = process.env.SESSION_SECRET || 'lumina-atelier-hmac-secret-key-2026-secure';

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

function hashPassword(password: string, salt = 'lumina_salt_2026'): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signToken(payload: { userId: string; email: string; role: Role; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): { userId: string; email: string; role: Role; exp: number } | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    if (sig !== expectedSig) return null;
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
    },
  };
}

function ensureStorage(): { db: AppDatabase; credentials: Record<string, string> } {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  let db: AppDatabase;
  if (!fs.existsSync(DB_PATH)) {
    db = getInitialDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  } else {
    try {
      db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {
      db = getInitialDatabase();
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    }
  }

  let credentials: Record<string, string>;
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    credentials = {
      'usr-1': hashPassword('Admin@2026'),
      'usr-2': hashPassword('Gerente@2026'),
      'usr-3': hashPassword('Recepcao@2026'),
      'usr-4': hashPassword('Prof@2026'),
    };
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf8');
  } else {
    try {
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    } catch {
      credentials = {
        'usr-1': hashPassword('Admin@2026'),
        'usr-2': hashPassword('Gerente@2026'),
        'usr-3': hashPassword('Recepcao@2026'),
        'usr-4': hashPassword('Prof@2026'),
      };
      fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf8');
    }
  }

  return { db, credentials };
}

function saveDb(db: AppDatabase) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function saveCredentials(credentials: Record<string, string>) {
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), 'utf8');
}

interface AuthenticatedRequest extends Request {
  user?: UserAccount;
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

    res.json({ token, user });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // --- BOOTSTRAP DATA ROUTE (Filtered by user permissions) ---
  app.get('/api/bootstrap', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const canSeeUsers = user.permissions.includes('users') || user.role === 'admin';
    const canSeeSecurity = user.permissions.includes('security') || user.role === 'admin';

    res.json({
      user,
      clients: db.clients,
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
    const { clientId, professionalId, serviceId, date, startTime, notes, status } = req.body;
    const client = db.clients.find((c) => c.id === clientId);
    const prof = db.professionals.find((p) => p.id === professionalId);
    const srv = db.services.find((s) => s.id === serviceId);

    if (!client || !prof || !srv || !date || !startTime) {
      res.status(400).json({ error: 'Selecione cliente, profissional, serviço, data e horário válidos.' });
      return;
    }

    // Calculate endTime
    const [hh, mm] = startTime.split(':').map(Number);
    const totalMinutes = hh * 60 + mm + srv.durationMinutes;
    const endH = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const endM = String(totalMinutes % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    // Conflict check for same professional on same date
    const conflict = db.appointments.find(
      (a) =>
        a.professionalId === professionalId &&
        a.date === date &&
        a.status !== 'cancelled' &&
        a.startTime === startTime
    );
    if (conflict) {
      res.status(409).json({
        error: `Conflito de agenda: ${prof.name} já possui agendamento às ${startTime} (${conflict.clientName}).`,
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
      createdAt: new Date().toISOString(),
    };

    db.appointments.unshift(apt);
    saveDb(db);
    logAudit(
      req.user!,
      'APPOINTMENT_CREATED',
      'agenda',
      `Agendamento criado: ${client.name} com ${prof.name} (${srv.name}) em ${date} às ${startTime}.`,
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
    db.appointments[idx] = { ...db.appointments[idx], ...req.body, id: db.appointments[idx].id };
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

    // Validate product stock if autoDeductStockOnSale is enabled
    if (db.settings.autoDeductStockOnSale) {
      for (const item of items) {
        if (item.type === 'product') {
          const prd = db.products.find((p) => p.id === item.referenceId);
          if (!prd) {
            res.status(400).json({ error: `Produto '${item.name}' não encontrado no catálogo.` });
            return;
          }
          if (prd.stock < item.quantity) {
            res.status(400).json({
              error: `Estoque insuficiente para '${prd.name}': disponível ${prd.stock}, solicitado ${item.quantity}.`,
            });
            return;
          }
        }
      }
    }

    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.unitPrice) * Number(it.quantity), 0);
    const numDiscount = Math.max(0, Number(discount || 0));
    const total = Math.max(0, subtotal - numDiscount);
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
        totalPrice: Number(it.unitPrice) * Number(it.quantity),
      })),
      subtotal,
      discount: numDiscount,
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
      client.totalSpent += total;
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

    // Generate Commissions
    if (db.settings.autoGenerateCommission) {
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
            const commAmount = Number(((item.totalPrice * rate) / 100).toFixed(2));
            const comm: CommissionEntry = {
              id: `com-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              professionalId: prof.id,
              professionalName: prof.name,
              saleId: newSale.id,
              saleCode: newSale.code,
              itemName: item.name,
              saleDate: today,
              grossAmount: item.totalPrice,
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

    // Remove pending commissions from this sale
    db.commissions = db.commissions.filter((c) => c.saleId !== sale.id);

    saveDb(db);
    logAudit(
      req.user!,
      'SALE_REFUNDED',
      'sales',
      `Venda #${sale.code} (R$ ${sale.total.toFixed(2)}) estornada por ${req.user!.name}.`,
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
    if (!name || !email || !password || password.length < 6) {
      res.status(400).json({ error: 'Nome, e-mail e senha (mínimo 6 caracteres) são obrigatórios.' });
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
    const { name, role, status, phone, twoFactorEnabled, permissions, newPassword } = req.body;
    if (db.users[idx].id === 'usr-1' && status && status !== 'active') {
      res.status(400).json({ error: 'Não é permitido bloquear a conta Administrador Master principal.' });
      return;
    }
    const updatedRole: Role = role || db.users[idx].role;
    db.users[idx] = {
      ...db.users[idx],
      name: name ? name.trim() : db.users[idx].name,
      role: updatedRole,
      status: status || db.users[idx].status,
      phone: phone !== undefined ? phone : db.users[idx].phone,
      twoFactorEnabled: twoFactorEnabled !== undefined ? Boolean(twoFactorEnabled) : db.users[idx].twoFactorEnabled,
      permissions: Array.isArray(permissions) ? permissions : db.users[idx].permissions,
    };
    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
      credentials[db.users[idx].id] = hashPassword(newPassword);
      saveCredentials(credentials);
    }
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

  // --- SETTINGS & SECURITY ---
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
    // Endpoint that allows any logged-in user to test if backend blocks admin-only action
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
