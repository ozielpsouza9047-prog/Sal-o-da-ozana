import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  Download,
  Lock,
  Unlock,
  ShoppingBag,
} from 'lucide-react';
import type {
  AppDatabase,
  ModuleId,
  SaleItem,
  Sale,
  AccountEntry,
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
// 8. VENDAS / PDV (COMANDA INTEGRADA COM ESTOQUE, CAIXA E COMISSÕES)
// ============================================================================
export const SalesModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [clientId, setClientId] = useState(db.clients[0]?.id || '');
  const [itemType, setItemType] = useState<'service' | 'product'>('service');
  const [referenceId, setReferenceId] = useState(db.services[0]?.id || '');
  const [professionalId, setProfessionalId] = useState(db.professionals[0]?.id || '');
  const [quantity, setQuantity] = useState(1);

  const [cart, setCart] = useState<SaleItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('PIX');
  const [installments, setInstallments] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null);

  const handleAddToCart = () => {
    const prof = db.professionals.find((p) => p.id === professionalId);
    if (itemType === 'service') {
      const srv = db.services.find((s) => s.id === referenceId);
      if (!srv) return;
      setCart((prev) => [
        ...prev,
        {
          type: 'service',
          referenceId: srv.id,
          name: srv.name,
          professionalId: prof?.id,
          professionalName: prof?.name,
          quantity: Number(quantity) || 1,
          unitPrice: srv.price,
          totalPrice: srv.price * (Number(quantity) || 1),
        },
      ]);
    } else {
      const prd = db.products.find((p) => p.id === referenceId);
      if (!prd) return;
      if (prd.stock < quantity) {
        notify('error', 'Estoque Insuficiente', `O produto ${prd.name} possui apenas ${prd.stock} un disponíveis.`);
        return;
      }
      setCart((prev) => [
        ...prev,
        {
          type: 'product',
          referenceId: prd.id,
          name: prd.name,
          professionalId: prof?.id,
          professionalName: prof?.name,
          quantity: Number(quantity) || 1,
          unitPrice: prd.salePrice,
          totalPrice: prd.salePrice * (Number(quantity) || 1),
        },
      ]);
    }
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = cart.reduce((acc, it) => acc + it.totalPrice, 0);
  const finalTotal = Math.max(0, subtotal - Number(discount || 0));

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      notify('error', 'Comanda Vazia', 'Adicione ao menos um serviço ou produto para finalizar a venda.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/sales', 'POST', {
        clientId,
        items: cart,
        discount: Number(discount || 0),
        paymentMethod,
        installments: Number(installments || 1),
      });
      if (res) {
        notify(
          'success',
          `Venda ${res.code} Concluída`,
          'Estoque baixado, fluxo de caixa creditado e comissões geradas automaticamente.'
        );
        setCart([]);
        setDiscount(0);
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/sales/${refundTarget.id}/refund`, 'POST');
      if (res) {
        notify('warning', 'Venda Estornada', `O lançamento ${refundTarget.code} foi estornado do caixa.`);
        setRefundTarget(null);
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
          Ponto de Venda (PDV) & Fechamento de Comandas
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          Emissão de comanda integrada com baixa automática de estoque, lançamento no caixa e geração de comissões
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: POS Builder */}
        <div className="lg:col-span-7 bg-white border border-zinc-200/80 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-zinc-900 pb-3 border-b border-zinc-100">
            Montar Comanda de Atendimento
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Cliente da Comanda</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
              >
                {db.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.tier})
                  </option>
                ))}
                <option value="walk-in">Cliente Avulso (Balcão)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Especialista Responsável</label>
              <select
                value={professionalId}
                onChange={(e) => setProfessionalId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
              >
                {db.professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setItemType('service');
                  setReferenceId(db.services[0]?.id || '');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  itemType === 'service' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 border border-zinc-200'
                }`}
              >
                Adicionar Serviço
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemType('product');
                  setReferenceId(db.products[0]?.id || '');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  itemType === 'product' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 border border-zinc-200'
                }`}
              >
                Adicionar Produto Home Care
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                  {itemType === 'service' ? 'Protocolo / Serviço' : 'Produto de Varejo'}
                </label>
                <select
                  value={referenceId}
                  onChange={(e) => setReferenceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg"
                >
                  {itemType === 'service'
                    ? db.services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} — {formatBRL(s.price)}
                        </option>
                      ))
                    : db.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.stock} un) — {formatBRL(p.salePrice)}
                        </option>
                      ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-zinc-500 mb-1">Qtd</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white border border-zinc-300 rounded-lg font-mono-num"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Incluir</span>
                </button>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-700 mb-2">
              Itens na Comanda ({cart.length})
            </h3>
            {cart.length === 0 ? (
              <div className="p-6 border border-dashed border-zinc-200 rounded-lg text-center text-xs text-zinc-400">
                Nenhum item incluído na comanda ainda. Selecione serviços ou produtos acima.
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                {cart.map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-zinc-900">
                        {it.quantity}x {it.name}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {it.type === 'service' ? 'Serviço' : 'Produto'} · Profissional: {it.professionalName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num font-semibold text-zinc-900">
                        {formatBRL(it.totalPrice)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="text-zinc-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: Checkout & Payment */}
        <form
          onSubmit={handleCheckout}
          className="lg:col-span-5 bg-white border border-zinc-200/80 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-zinc-900 pb-3 border-b border-zinc-100">
            Resumo Financeiro & Pagamento
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Meio de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as Sale['paymentMethod'])}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
              >
                <option value="PIX">PIX Instantâneo</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Espécie (Dinheiro)</option>
                <option value="Link de Pagamento">Link de Pagamento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                disabled={paymentMethod !== 'Cartão de Crédito'}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg font-mono-num disabled:opacity-50"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}x sem juros
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Desconto Concedido (R$)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg font-mono-num"
            />
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal dos Itens</span>
              <span className="font-mono-num">{formatBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Desconto Aplicado</span>
              <span className="font-mono-num text-amber-700">- {formatBRL(discount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-zinc-900 pt-2 border-t border-zinc-200">
              <span>Total a Receber</span>
              <span className="font-mono-num">{formatBRL(finalTotal)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || cart.length === 0}
            className="w-full py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{isSubmitting ? 'Processando Venda...' : 'Finalizar Venda & Emitir Recibo'}</span>
          </button>
        </form>
      </div>

      {/* Sales History */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900">Histórico de Comandas e Vendas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Código & Data</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Itens da Comanda</th>
                <th className="py-3 px-4">Pagamento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total Líquido</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {db.sales.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/70">
                  <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">
                    <p className="font-semibold text-zinc-900">{s.code}</p>
                    <p className="text-[11px] text-zinc-500">{formatDateBR(s.createdAt)}</p>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-zinc-900">{s.clientName}</td>
                  <td className="py-3.5 px-4 max-w-md">
                    {s.items.map((it, i) => (
                      <div key={i} className="text-zinc-700">
                        {it.quantity}x {it.name}{' '}
                        <span className="text-zinc-400">({it.professionalName})</span>
                      </div>
                    ))}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-zinc-700">
                    {s.paymentMethod} ({s.installments}x)
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        s.status === 'completed' ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {s.status === 'completed' ? 'Concluída' : 'Estornada'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                    {formatBRL(s.total)}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    {s.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => setRefundTarget(s)}
                        className="px-2.5 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Estornar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(refundTarget)}
        title="Estornar Venda PDV"
        description={`Confirmar estorno da venda ${refundTarget?.code} (${formatBRL(refundTarget?.total || 0)})? O sistema lançará saída compensatória no caixa e cancelará comissões pendentes vinculadas.`}
        confirmLabel="Confirmar Estorno"
        onConfirm={handleRefund}
        onCancel={() => setRefundTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 9. FLUXO DE CAIXA (TESOURARIA & ABERTURA/FECHAMENTO DE CAIXA)
// ============================================================================
export const CashFlowModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Despesas Operacionais');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(150);
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totals = useMemo(() => {
    const incomes = db.cashFlow
      .filter((c) => c.type === 'income')
      .reduce((acc, c) => acc + c.amount, 0);
    const expenses = db.cashFlow
      .filter((c) => c.type === 'expense')
      .reduce((acc, c) => acc + c.amount, 0);
    const net = incomes - expenses;
    const drawerTotal = db.cashRegister.openingBalance + net;
    return { incomes, expenses, net, drawerTotal };
  }, [db.cashFlow, db.cashRegister]);

  const filtered = useMemo(() => {
    return db.cashFlow.filter((c) => (typeFilter === 'all' ? true : c.type === typeFilter));
  }, [db.cashFlow, typeFilter]);

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || amount <= 0) {
      notify('error', 'Validação', 'Descrição e valor positivo são obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/cashflow', 'POST', {
        type,
        category,
        description,
        amount: Number(amount),
        paymentMethod,
      });
      if (res) {
        notify('success', 'Lançamento Registrado', 'O fluxo de caixa foi atualizado.');
        setIsModalOpen(false);
        setDescription('');
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCashRegister = async () => {
    const nextAction = db.cashRegister.isOpen ? 'close' : 'open';
    const res = await apiRequest('/api/cashflow/register', 'POST', {
      action: nextAction,
      openingBalance: 600,
    });
    if (res) {
      notify(
        'success',
        nextAction === 'open' ? 'Caixa Diário Aberto' : 'Caixa Diário Encerrado',
        nextAction === 'open'
          ? 'Caixa iniciado com fundo de troco padrão.'
          : 'Conferência de fechamento registrada no log de auditoria.'
      );
      await refreshData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Fluxo de Caixa & Tesouraria Diária
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Controle de entradas, sangrias, despesas operacionais e abertura/fechamento de gaveta
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCashRegister}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              db.cashRegister.isOpen
                ? 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50'
                : 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {db.cashRegister.isOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{db.cashRegister.isOpen ? 'Encerrar Caixa do Dia' : 'Abrir Caixa do Dia'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento / Sangria</span>
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Total de Entradas</p>
          <p className="text-2xl font-semibold font-mono-num text-emerald-700 mt-1.5">
            + {formatBRL(totals.incomes)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Total de Saídas / Pagamentos</p>
          <p className="text-2xl font-semibold font-mono-num text-red-600 mt-1.5">
            - {formatBRL(totals.expenses)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Resultado Operacional Líquido</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-1.5">
            {formatBRL(totals.net)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Saldo Consolidado (+ Troco Inicial)</p>
          <p className="text-2xl font-semibold font-mono-num text-zinc-900 mt-1.5">
            {formatBRL(totals.drawerTotal)}
          </p>
        </div>
      </div>

      {/* Filter & Table */}
      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Extrato de Movimentações Financeiras</h2>
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'Todos' },
                { id: 'income', label: 'Entradas' },
                { id: 'expense', label: 'Saídas' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                  typeFilter === t.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Descrição do Lançamento</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Meio</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/70">
                  <td className="py-3 px-4 font-mono-num text-zinc-500 whitespace-nowrap">
                    {formatDateBR(c.date)}
                  </td>
                  <td className="py-3 px-4 font-medium text-zinc-900">{c.description}</td>
                  <td className="py-3 px-4 text-zinc-600">{c.category}</td>
                  <td className="py-3 px-4 text-zinc-600">{c.paymentMethod}</td>
                  <td className="py-3 px-4 text-zinc-600">{c.createdBy}</td>
                  <td
                    className={`py-3 px-4 text-right font-mono-num font-semibold whitespace-nowrap ${
                      c.type === 'income' ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {c.type === 'income' ? '+' : '-'} {formatBRL(c.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        title="Novo Lançamento no Fluxo de Caixa"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSaveEntry} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Natureza *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'income' | 'expense')}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="expense">Saída / Sangria / Despesa</option>
                <option value="income">Entrada / Suprimento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Categoria *</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Descrição Detalhada *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Compra de flores recepção / Adiantamento lavanderia..."
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro (Gaveta)</option>
                <option value="Cartão de Débito">Cartão Corporativo</option>
              </select>
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
              {isSubmitting ? 'Salvando...' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ============================================================================
// 10. CONTAS A PAGAR E RECEBER
// ============================================================================
export const AccountsModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [tab, setTab] = useState<'all' | 'payable' | 'receivable'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [type, setType] = useState<'payable' | 'receivable'>('payable');
  const [title, setTitle] = useState('');
  const [entityName, setEntityName] = useState('');
  const [category, setCategory] = useState('Fornecedores e Insumos');
  const [dueDate, setDueDate] = useState('2026-11-15');
  const [amount, setAmount] = useState(1200);
  const [notes, setNotes] = useState('');

  const filtered = useMemo(() => {
    return db.accounts.filter((a) => (tab === 'all' ? true : a.type === tab));
  }, [db.accounts, tab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !entityName.trim() || amount <= 0) {
      notify('error', 'Validação', 'Preencha descrição, favorecido/cliente e valor válido.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/api/accounts', 'POST', {
        type,
        title,
        entityName,
        category,
        dueDate,
        amount: Number(amount),
        notes,
      });
      if (res) {
        notify('success', 'Título Registrado', `${title} foi incluído no financeiro.`);
        setIsModalOpen(false);
        setTitle('');
        setEntityName('');
        await refreshData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettle = async (acc: AccountEntry) => {
    const res = await apiRequest(`/api/accounts/${acc.id}/settle`, 'POST', {
      paymentMethod: 'PIX',
    });
    if (res) {
      notify(
        'success',
        'Título Liquidado',
        `${acc.title} foi baixado e integrado automaticamente ao Fluxo de Caixa.`
      );
      await refreshData();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest(`/api/accounts/${deleteTarget.id}`, 'DELETE');
      if (res) {
        notify('warning', 'Título Excluído', `${deleteTarget.title} foi removido.`);
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
            Contas a Pagar e a Receber
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Gestão de compromissos com fornecedores, custos fixos e recebíveis de pacotes de noivas/eventos
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Título Financeiro</span>
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 bg-zinc-200/70 rounded-lg w-fit">
        {(
          [
            { id: 'all', label: 'Todos os Títulos' },
            { id: 'payable', label: 'Contas a Pagar' },
            { id: 'receivable', label: 'Contas a Receber' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              tab === t.id ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum título registrado nesta visão"
          description="Cadastre contas a pagar de fornecedores ou parcelas a receber de clientes."
          actionLabel="Novo Título"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Título & Favorecido / Cliente</th>
                  <th className="py-3 px-4">Tipo & Categoria</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-50/70">
                    <td className="py-3.5 px-4 font-mono-num whitespace-nowrap font-medium text-zinc-900">
                      {formatDateBR(a.dueDate)}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-zinc-900">{a.title}</p>
                      <p className="text-[11px] text-zinc-500">{a.entityName}</p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          a.type === 'payable' ? 'text-amber-800' : 'text-emerald-700'
                        }`}
                      >
                        {a.type === 'payable' ? 'A Pagar' : 'A Receber'}
                      </span>
                      <span className="text-zinc-400 mx-1">·</span>
                      <span className="text-zinc-600">{a.category}</span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          a.status === 'paid'
                            ? 'text-emerald-700'
                            : a.status === 'overdue'
                            ? 'text-red-600'
                            : 'text-amber-700'
                        }`}
                      >
                        {a.status === 'paid'
                          ? 'Liquidado'
                          : a.status === 'overdue'
                          ? 'Vencido'
                          : 'Em Aberto'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900 whitespace-nowrap">
                      {formatBRL(a.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {a.status !== 'paid' && (
                          <button
                            type="button"
                            onClick={() => handleSettle(a)}
                            className="px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Dar Baixa</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(a)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 rounded-md cursor-pointer"
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
        title="Cadastrar Título Financeiro"
        onClose={() => setIsModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Tipo de Conta *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'payable' | 'receivable')}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              >
                <option value="payable">Conta a Pagar (Fornecedor/Custo)</option>
                <option value="receivable">Conta a Receber (Cliente/Contrato)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Vencimento *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Descrição do Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Fatura Kérastase Outubro / Contrato Dia da Noiva"
              className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Fornecedor ou Cliente *</label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-zinc-300 rounded-lg font-mono-num"
                required
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
              {isSubmitting ? 'Salvando...' : 'Salvar Título'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Excluir Título Financeiro"
        description={`Confirmar exclusão de "${deleteTarget?.title}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isSubmitting}
      />
    </div>
  );
};

// ============================================================================
// 11. COMISSÕES (REPASSES LEI SALÃO-PARCEIRO)
// ============================================================================
export const CommissionsModule: React.FC<ModuleProps> = ({
  db,
  apiRequest,
  refreshData,
  notify,
}) => {
  const [profFilter, setProfFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPayingBatch, setIsPayingBatch] = useState(false);

  const filtered = useMemo(() => {
    return db.commissions.filter((c) => {
      if (profFilter !== 'all' && c.professionalId !== profFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      return true;
    });
  }, [db.commissions, profFilter, statusFilter]);

  const summary = useMemo(() => {
    const pending = filtered
      .filter((c) => c.status !== 'paid')
      .reduce((acc, c) => acc + c.commissionAmount, 0);
    const paid = filtered
      .filter((c) => c.status === 'paid')
      .reduce((acc, c) => acc + c.commissionAmount, 0);
    return { pending, paid };
  }, [filtered]);

  const handleStatusChange = async (id: string, status: 'approved' | 'paid') => {
    const res = await apiRequest(`/api/commissions/${id}/status`, 'POST', { status });
    if (res) {
      notify(
        'success',
        status === 'paid' ? 'Comissão Paga' : 'Comissão Aprovada',
        status === 'paid'
          ? 'O repasse foi liquidado e lançado automaticamente no Fluxo de Caixa.'
          : 'Comissão conferida e pronta para pagamento.'
      );
      await refreshData();
    }
  };

  const handlePayBatch = async () => {
    setIsPayingBatch(true);
    try {
      const res = await apiRequest('/api/commissions/pay-batch', 'POST', {
        professionalId: profFilter,
      });
      if (res) {
        notify(
          'success',
          'Fechamento de Comissões Concluído',
          `${res.count} comissões liquidadas totalizando ${formatBRL(res.totalPaid)}.`
        );
        await refreshData();
      }
    } finally {
      setIsPayingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Gestão de Comissões & Repasses (Salão-Parceiro)
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Apuração automática sobre serviços e vendas Home Care, conferência e liquidação em lote
          </p>
        </div>
        <button
          type="button"
          onClick={handlePayBatch}
          disabled={isPayingBatch || summary.pending <= 0}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
        >
          {isPayingBatch
            ? 'Liquidando Lote...'
            : `Liquidar Pendentes (${formatBRL(summary.pending)})`}
        </button>
      </div>

      {/* Filters & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Saldo Pendente / Aprovado</p>
          <p className="text-2xl font-semibold font-mono-num text-amber-700 mt-1">
            {formatBRL(summary.pending)}
          </p>
        </div>
        <div className="bg-white border border-zinc-200/80 rounded-xl p-5">
          <p className="text-xs text-zinc-500">Total Já Liquidado</p>
          <p className="text-2xl font-semibold font-mono-num text-emerald-700 mt-1">
            {formatBRL(summary.paid)}
          </p>
        </div>
        <div className="lg:col-span-2 bg-white border border-zinc-200/80 rounded-xl p-5 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Filtrar Especialista</label>
            <select
              value={profFilter}
              onChange={(e) => setProfFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
            >
              <option value="all">Todos os Especialistas</option>
              {db.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-zinc-500 mb-1">Status do Repasse</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendentes de Conferência</option>
              <option value="approved">Aprovados para Repasse</option>
              <option value="paid">Pagos / Liquidados</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/60 text-[11px] font-semibold text-zinc-500">
                <th className="py-3 px-4">Data & Comanda</th>
                <th className="py-3 px-4">Especialista</th>
                <th className="py-3 px-4">Item / Procedimento</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">%</th>
                <th className="py-3 px-4 text-right">Valor Comissão</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-xs">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/70">
                  <td className="py-3.5 px-4 font-mono-num whitespace-nowrap">
                    <p className="font-semibold text-zinc-900">{c.saleCode}</p>
                    <p className="text-[11px] text-zinc-500">{formatDateBR(c.saleDate)}</p>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-zinc-900">{c.professionalName}</td>
                  <td className="py-3.5 px-4 text-zinc-700">{c.itemName}</td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-zinc-600">
                    {formatBRL(c.grossAmount)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-zinc-600">
                    {c.commissionPercentage}%
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num font-semibold text-zinc-900">
                    {formatBRL(c.commissionAmount)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        c.status === 'paid'
                          ? 'text-emerald-700'
                          : c.status === 'approved'
                          ? 'text-amber-700'
                          : 'text-zinc-600'
                      }`}
                    >
                      {c.status === 'paid' ? 'Pago' : c.status === 'approved' ? 'Aprovado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {c.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(c.id, 'approved')}
                          className="px-2.5 py-1 text-[11px] font-medium text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-md cursor-pointer"
                        >
                          Aprovar
                        </button>
                      )}
                      {c.status !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(c.id, 'paid')}
                          className="px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                        >
                          Pagar Agora
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
    </div>
  );
};

// ============================================================================
// 12. RELATÓRIOS & DRE GERENCIAL (COM EXPORTAÇÃO CSV REAL)
// ============================================================================
export const ReportsModule: React.FC<ModuleProps> = ({ db, notify }) => {
  const dre = useMemo(() => {
    const grossSales = db.sales
      .filter((s) => s.status === 'completed')
      .reduce((acc, s) => acc + s.subtotal, 0);
    const discounts = db.sales
      .filter((s) => s.status === 'completed')
      .reduce((acc, s) => acc + s.discount, 0);
    const netRevenue = grossSales - discounts;
    const commissionsTotal = db.commissions.reduce((acc, c) => acc + c.commissionAmount, 0);
    const operatingExpenses = db.cashFlow
      .filter((c) => c.type === 'expense' && c.category !== 'Repasse de Comissões')
      .reduce((acc, c) => acc + c.amount, 0);
    const ebitda = netRevenue - commissionsTotal - operatingExpenses;

    return { grossSales, discounts, netRevenue, commissionsTotal, operatingExpenses, ebitda };
  }, [db]);

  const handleExportCSV = () => {
    const headers = ['Codigo_Venda', 'Data', 'Cliente', 'Meio_Pagamento', 'Subtotal', 'Desconto', 'Total_Liquido', 'Status'];
    const rows = db.sales.map((s) => [
      s.code,
      s.createdAt,
      `"${s.clientName}"`,
      `"${s.paymentMethod}"`,
      s.subtotal.toFixed(2),
      s.discount.toFixed(2),
      s.total.toFixed(2),
      s.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_financeiro_lumina_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('success', 'Relatório Exportado', 'Arquivo CSV gerado com sucesso para contabilidade.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl font-semibold text-zinc-900">
            Relatórios Gerenciais & DRE Contábil
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Demonstrativo de Resultado do Exercício, performance por especialista e exportação de dados
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Exportar Vendas (CSV)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DRE Table */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-6">
          <h2 className="text-base font-semibold text-zinc-900 pb-4 border-b border-zinc-100">
            DRE Simplificado — Competência Atual
          </h2>
          <div className="divide-y divide-zinc-100 text-xs mt-2">
            <div className="py-3 flex justify-between">
              <span className="font-medium text-zinc-700">(+) Receita Bruta de Serviços e Produtos</span>
              <span className="font-mono-num font-semibold text-zinc-900">{formatBRL(dre.grossSales)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-zinc-500">(-) Descontos Comerciais Concedidos</span>
              <span className="font-mono-num text-amber-700">- {formatBRL(dre.discounts)}</span>
            </div>
            <div className="py-3 flex justify-between bg-zinc-50/70 px-2 rounded">
              <span className="font-semibold text-zinc-900">(=) Receita Operacional Líquida</span>
              <span className="font-mono-num font-semibold text-zinc-900">{formatBRL(dre.netRevenue)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-zinc-600">(-) Repasses de Comissões (Cota-Parte Parceiros)</span>
              <span className="font-mono-num text-red-600">- {formatBRL(dre.commissionsTotal)}</span>
            </div>
            <div className="py-3 flex justify-between">
              <span className="text-zinc-600">(-) Despesas Operacionais & Fornecedores</span>
              <span className="font-mono-num text-red-600">- {formatBRL(dre.operatingExpenses)}</span>
            </div>
            <div className="py-4 flex justify-between text-sm font-semibold text-zinc-900 border-t-2 border-zinc-200">
              <span>(=) Lucro Operacional (EBITDA Salão)</span>
              <span className={`font-mono-num ${dre.ebitda >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {formatBRL(dre.ebitda)}
              </span>
            </div>
          </div>
        </div>

        {/* Ranking de Produtividade */}
        <div className="bg-white border border-zinc-200/80 rounded-xl p-6">
          <h2 className="text-base font-semibold text-zinc-900 pb-4 border-b border-zinc-100">
            Produtividade & Receita Gerada por Especialista
          </h2>
          <div className="space-y-4 mt-4">
            {db.professionals.map((p) => {
              const profCommissions = db.commissions.filter((c) => c.professionalId === p.id);
              const generatedGross = profCommissions.reduce((acc, c) => acc + c.grossAmount, 0);
              const earnedComm = profCommissions.reduce((acc, c) => acc + c.commissionAmount, 0);
              return (
                <div key={p.id} className="p-3.5 rounded-lg border border-zinc-200/70 bg-zinc-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-zinc-900">{p.name}</p>
                      <p className="text-[11px] text-zinc-500">{p.specialty}</p>
                    </div>
                    <div className="text-right font-mono-num">
                      <p className="text-xs font-semibold text-zinc-900">{formatBRL(generatedGross)}</p>
                      <p className="text-[11px] text-zinc-500">Comissão: {formatBRL(earnedComm)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
