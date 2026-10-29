import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import type {
  AppDatabase,
  ModuleId,
  ServiceItem,
  ProductItem,
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
// 5. SERVIÇOS (MENU DE PROTOCOLOS & PREÇOS)
// ============================================================================
export const ServicesModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSrv, setEditingSrv] = useState<ServiceItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<ServiceItem['category']>('Cabelo');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [price, setPrice] = useState(250);
  const [commissionRate, setCommissionRate] = useState(40);
  const [description, setDescription] = useState('');

  const categories: ServiceItem['category'][] = [
    'Cabelo',
    'Coloração',
    'Estética Facial',
    'Estética Corporal',
    'Unhas',
    'Maquiagem & Noivas',
  ];

  const filtered = useMemo(() => {
    return db.services.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [db.services, categoryFilter, search]);

  const openCreate = () => {
    setEditingSrv(null);
    setName('');
    setCategory('Cabelo');
    setDurationMinutes(60);
    setPrice(250);
    setCommissionRate(40);
    setDescription('');
    setIsModalOpen(true);
  };

  const openEdit = (s: ServiceItem) => {
    setEditingSrv(s);
    setName(s.name);
    setCategory(s.category);
    setDurationMinutes(s.durationMinutes);
    setPrice(s.price);
    setCommissionRate(s.commissionRate);
    setDescription(s.description);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3 || price <= 0 || durationMinutes <= 0) {
      notify('error', 'Validação', 'Nome, duração e preço maior que zero são obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        category,
        durationMinutes: Number(durationMinutes),
        price: Number(price),
        commissionRate: Number(commissionRate),
        description,
      };
      if (editingSrv) {
        const res = await apiRequest(`/api/services/${editingSrv.id}`, 'PUT', payload);
        if (res) {
          notify('success', 'Serviço Atualizado', `O protocolo ${name} foi atualizado.`);
          setIsModalOpen(false);
          await refreshData();
        }
      } else {
        const res = await apiRequest('/api/services', 'POST', payload);
        if (res) {
          notify('success', 'Serviço Criado', `Novo protocolo ${name} adicionado ao menu.`);
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
      const res = await apiRequest(`/api/services/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Serviço Excluído', `${deleteTarget.name} foi removido do catálogo.`);
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
            Menu de Serviços & Protocolos
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Tabela de preços, tempo estimado de cadeira e taxa de comissão por procedimento
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Serviço</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar protocolo ou descrição técnica..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
              categoryFilter === 'all' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum serviço encontrado"
          description="Adicione protocolos capilares ou estéticos ao menu do salão."
          actionLabel="Adicionar Serviço"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                  <th className="py-3 px-4">Serviço / Protocolo</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-right">Duração</th>
                  <th className="py-3 px-4 text-right">Comissão</th>
                  <th className="py-3 px-4 text-right">Preço Tabela</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="font-semibold text-zinc-900">{s.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{s.description}</p>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-700 whitespace-nowrap">{s.category}</td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-zinc-700 whitespace-nowrap">
                      {s.durationMinutes} min
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num text-zinc-700 whitespace-nowrap">
                      {s.commissionRate}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                      {formatBRL(s.price)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md cursor-pointer"
                          title="Editar serviço"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
                          title="Excluir serviço"
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
        title={editingSrv ? 'Editar Serviço' : 'Novo Serviço / Protocolo'}
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nome do Protocolo *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Categoria *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceItem['category'])}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Duração (min) *</label>
              <input
                type="number"
                min={15}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Preço (R$) *</label>
              <input
                type="number"
                min={1}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Comissão (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Descrição Técnica</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              {isSubmitting ? 'Salvando...' : 'Salvar Protocolo'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Excluir Serviço"
        description={`Confirmar exclusão do serviço "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 6. PRODUTOS (CATÁLOGO HOME CARE & BACKBAR)
// ============================================================================
export const ProductsModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [search, setSearch] = useState('');
  const [usageFilter, setUsageFilter] = useState<'all' | 'retail' | 'internal' | 'both'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrd, setEditingPrd] = useState<ProductItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<ProductItem['category']>('Home Care');
  const [usageType, setUsageType] = useState<ProductItem['usageType']>('both');
  const [costPrice, setCostPrice] = useState(120);
  const [salePrice, setSalePrice] = useState(240);
  const [stock, setStock] = useState(10);
  const [minStock, setMinStock] = useState(5);
  const [supplier, setSupplier] = useState('');
  const [batch, setBatch] = useState('');
  const [expiryDate, setExpiryDate] = useState('2028-06-01');

  const filtered = useMemo(() => {
    return db.products.filter((p) => {
      if (usageFilter !== 'all' && p.usageType !== usageFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [db.products, usageFilter, search]);

  const openCreate = () => {
    setEditingPrd(null);
    setSku(`LUM-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setBrand('Kérastase');
    setCategory('Home Care');
    setUsageType('both');
    setCostPrice(140);
    setSalePrice(289);
    setStock(12);
    setMinStock(5);
    setSupplier('L’Oréal Produtos Profissionais Brasil');
    setBatch('L2610B');
    setExpiryDate('2028-08-01');
    setIsModalOpen(true);
  };

  const openEdit = (p: ProductItem) => {
    setEditingPrd(p);
    setSku(p.sku);
    setName(p.name);
    setBrand(p.brand);
    setCategory(p.category);
    setUsageType(p.usageType);
    setCostPrice(p.costPrice);
    setSalePrice(p.salePrice);
    setStock(p.stock);
    setMinStock(p.minStock);
    setSupplier(p.supplier);
    setBatch(p.batch);
    setExpiryDate(p.expiryDate);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || name.trim().length < 3) {
      notify('error', 'Validação', 'SKU e nome do produto são obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        sku,
        name,
        brand,
        category,
        usageType,
        costPrice: Number(costPrice),
        salePrice: Number(salePrice),
        stock: Number(stock),
        minStock: Number(minStock),
        supplier,
        batch,
        expiryDate,
      };
      if (editingPrd) {
        const res = await apiRequest(`/api/products/${editingPrd.id}`, 'PUT', payload);
        if (res) {
          notify('success', 'Produto Atualizado', `${name} foi atualizado.`);
          setIsModalOpen(false);
          await refreshData();
        }
      } else {
        const res = await apiRequest('/api/products', 'POST', payload);
        if (res) {
          notify('success', 'Produto Cadastrado', `${name} foi incluído no catálogo.`);
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
      const res = await apiRequest(`/api/products/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Produto Excluído', `${deleteTarget.name} foi removido.`);
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
            Catálogo de Produtos (Varejo & Backbar)
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Precificação de custo/venda, margem de contribuição, fornecedores, lotes e validades
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Produto</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-zinc-200/80 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por SKU, nome ou marca (Kérastase, Wella, Olaplex)..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-900"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'retail', label: 'Revenda Home Care' },
              { id: 'internal', label: 'Uso Profissional' },
              { id: 'both', label: 'Híbrido' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setUsageFilter(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                usageFilter === t.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto localizado"
          description="Cadastre produtos de revenda ou insumos técnicos de lavatório/colorimetria."
          actionLabel="Cadastrar Produto"
          onAction={openCreate}
        />
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                  <th className="py-3 px-4">SKU & Produto</th>
                  <th className="py-3 px-4">Marca & Finalidade</th>
                  <th className="py-3 px-4">Lote & Validade</th>
                  <th className="py-3 px-4 text-right">Custo</th>
                  <th className="py-3 px-4 text-right">Preço Venda</th>
                  <th className="py-3 px-4 text-right">Saldo Atual</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filtered.map((p) => {
                  const isLow = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-zinc-900">{p.name}</p>
                        <p className="text-[11px] font-mono-num text-zinc-500">
                          {p.sku} · {p.supplier}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-medium text-zinc-800">{p.brand}</p>
                        <p className="text-[11px] text-zinc-500">
                          {p.category} ·{' '}
                          {p.usageType === 'retail'
                            ? 'Revenda'
                            : p.usageType === 'internal'
                            ? 'Uso Interno'
                            : 'Revenda & Interno'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">
                        <p className="text-zinc-800">{p.batch}</p>
                        <p className="text-[11px] text-zinc-500">Val: {formatDateBR(p.expiryDate)}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num text-zinc-600 whitespace-nowrap">
                        {formatBRL(p.costPrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                        {formatBRL(p.salePrice)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-num whitespace-nowrap">
                        <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-emerald-700'}`}>
                          {p.stock} {p.unit}
                        </span>
                        <span className="block text-[10px] text-zinc-400">mín: {p.minStock}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-zinc-500 hover:text-zinc-900 rounded-md cursor-pointer"
                            title="Editar produto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
                            title="Excluir produto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        title={editingPrd ? 'Editar Produto' : 'Cadastrar Novo Produto'}
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Código SKU *</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num uppercase"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-700 mb-1">Nome do Produto *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Marca</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductItem['category'])}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="Home Care">Home Care</option>
                <option value="Uso Profissional">Uso Profissional</option>
                <option value="Coloração">Coloração</option>
                <option value="Finalizadores">Finalizadores</option>
                <option value="Descartáveis">Descartáveis</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Destinação</label>
              <select
                value={usageType}
                onChange={(e) => setUsageType(e.target.value as ProductItem['usageType'])}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="both">Ambos (Revenda + Interno)</option>
                <option value="retail">Apenas Revenda</option>
                <option value="internal">Apenas Uso Profissional</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Preço Custo (R$)</label>
              <input
                type="number"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Preço Venda (R$)</label>
              <input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Estoque Inicial</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Estoque Mínimo</label>
              <input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Fornecedor</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Lote</label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Validade</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
              />
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
              {isSubmitting ? 'Salvando...' : 'Salvar Produto'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Excluir Produto"
        description={`Confirmar exclusão do produto "${deleteTarget?.name}" (${deleteTarget?.sku})?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 7. ESTOQUE (CONTROLE DE MOVIMENTAÇÕES, ENTRADAS, BAIXAS E INVENTÁRIO)
// ============================================================================
export const InventoryModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [filterLowOnly, setFilterLowOnly] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [productId, setProductId] = useState(db.products[0]?.id || '');
  const [type, setType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [quantity, setQuantity] = useState(5);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inventoryMetrics = useMemo(() => {
    const totalCostValue = db.products.reduce((acc, p) => acc + p.costPrice * p.stock, 0);
    const totalSaleValue = db.products.reduce((acc, p) => acc + p.salePrice * p.stock, 0);
    const lowStockItems = db.products.filter((p) => p.stock <= p.minStock);
    return { totalCostValue, totalSaleValue, lowStockCount: lowStockItems.length };
  }, [db.products]);

  const displayedProducts = useMemo(() => {
    if (!filterLowOnly) return db.products;
    return db.products.filter((p) => p.stock <= p.minStock);
  }, [db.products, filterLowOnly]);

  const openMovementFor = (pId: string, movType: 'in' | 'out' | 'adjustment') => {
    setProductId(pId);
    setType(movType);
    setQuantity(movType === 'in' ? 6 : 1);
    setReason('');
    setIsMovementModalOpen(true);
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || quantity <= 0 || reason.trim().length < 3) {
      notify('error', 'Validação de Estoque', 'Informe quantidade válida e justificativa/nota fiscal.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/inventory/movements', 'POST', {
        productId,
        type,
        quantity: Number(quantity),
        reason,
      });
      if (res) {
        notify('success', 'Estoque Atualizado', 'A movimentação foi registrada no kardex e auditada.');
        setIsMovementModalOpen(false);
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
            Controle de Estoque & Kardex
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Entradas de notas fiscais, baixas de consumo técnico em bancada e auditoria de saldos
          </p>
        </div>
        <button
          type="button"
          onClick={() => openMovementFor(db.products[0]?.id || '', 'in')}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sliders className="w-4 h-4" />
          <span>Registrar Movimentação</span>
        </button>
      </div>

      {/* Valuation Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Custo Imobilizado em Estoque</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-1.5">
            {formatBRL(inventoryMetrics.totalCostValue)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Valor Potencial de Venda (Varejo)</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-1.5">
            {formatBRL(inventoryMetrics.totalSaleValue)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">Itens Abaixo do Mínimo</p>
            <p className="text-2xl font-semibold font-mono-num text-amber-700 mt-1.5">
              {inventoryMetrics.lowStockCount} produtos
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilterLowOnly(!filterLowOnly)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              filterLowOnly
                ? 'bg-amber-900 text-white border-amber-900'
                : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {filterLowOnly ? 'Mostrar Todos' : 'Filtrar Críticos'}
          </button>
        </div>
      </div>

      {/* Stock Position Table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Posição Física por SKU</h2>
          <span className="text-xs text-zinc-500">{displayedProducts.length} itens listados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">SKU & Produto</th>
                <th className="py-3 px-4">Status de Nível</th>
                <th className="py-3 px-4 text-right">Estoque Atual</th>
                <th className="py-3 px-4 text-right">Mínimo Segurança</th>
                <th className="py-3 px-4 text-right">Custo Total</th>
                <th className="py-3 px-4 text-right">Operação Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {displayedProducts.map((p) => {
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-zinc-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-zinc-900">{p.name}</p>
                      <p className="text-[11px] font-mono-num text-zinc-500">
                        {p.sku} · Lote {p.batch}
                      </p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Reposição Necessária</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Nível Adequado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num font-semibold text-zinc-900">
                      {p.stock} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-zinc-500">
                      {p.minStock} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-num text-zinc-800">
                      {formatBRL(p.stock * p.costPrice)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openMovementFor(p.id, 'in')}
                          className="px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Entrada</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openMovementFor(p.id, 'out')}
                          className="px-2.5 py-1 text-[11px] font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowDownCircle className="w-3.5 h-3.5" />
                          <span>Baixa Técnica</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kardex History */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">
            Histórico de Movimentações (Kardex Auditado)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4 text-right">Qtd</th>
                <th className="py-3 px-4 text-right">Saldo Ant. → Novo</th>
                <th className="py-3 px-4">Motivo / Justificativa</th>
                <th className="py-3 px-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {db.stockMovements.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50/70">
                  <td className="py-3 px-4 font-mono-num text-zinc-500 whitespace-nowrap">
                    {formatDateBR(m.createdAt)}
                  </td>
                  <td className="py-3 px-4 font-medium text-zinc-900">{m.productName}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        m.type === 'in'
                          ? 'text-emerald-700'
                          : m.type === 'out'
                          ? 'text-amber-700'
                          : 'text-zinc-700'
                      }`}
                    >
                      {m.type === 'in' ? 'Entrada NF' : m.type === 'out' ? 'Saída / Consumo' : 'Balanço'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num font-semibold text-zinc-900">
                    {m.type === 'in' ? `+${m.quantity}` : m.type === 'out' ? `-${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-num text-zinc-600">
                    {m.previousStock} → <strong className="text-zinc-900">{m.newStock}</strong>
                  </td>
                  <td className="py-3 px-4 text-zinc-600">{m.reason}</td>
                  <td className="py-3 px-4 text-zinc-700 whitespace-nowrap">{m.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isMovementModalOpen}
        title="Registrar Movimentação de Estoque"
        subtitle="Toda movimentação altera o saldo imediato do produto e gera registro no Kardex."
        onClose={() => setIsMovementModalOpen(false)}
      >
        <form onSubmit={handleMovementSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Produto *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            >
              {db.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Saldo atual: {p.stock} {p.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo de Operação *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'in' | 'out' | 'adjustment')}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="in">Entrada (Compra / Reposição NF)</option>
                <option value="out">Saída (Consumo Interno / Lavatório)</option>
                <option value="adjustment">Ajuste de Inventário (Definir Saldo Final)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                {type === 'adjustment' ? 'Novo Saldo Físico Contado *' : 'Quantidade Movimentada *'}
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Justificativa / Número da Nota Fiscal *
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: NF #50122 L'Oréal ou Uso em bancada colorimetria..."
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsMovementModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-700 bg-zinc-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 rounded-lg"
            >
              {isSubmitting ? 'Processando...' : 'Confirmar Movimentação'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
