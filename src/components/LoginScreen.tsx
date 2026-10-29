import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import type { UserAccount } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: UserAccount) => void;
}

const DEMO_ACCOUNTS = [
  {
    label: 'Administrador Master (Acesso Total)',
    email: 'admin@luminaatelier.com.br',
    pass: 'Admin@2026',
    roleDesc: 'Todos os 16 módulos · RBAC · Segurança · Configurações',
  },
  {
    label: 'Gerente Operacional',
    email: 'gerencia@luminaatelier.com.br',
    pass: 'Gerente@2026',
    roleDesc: 'Agenda · Estoque · Financeiro · Relatórios (Sem Usuários/Segurança)',
  },
  {
    label: 'Recepção & Concierge',
    email: 'recepcao@luminaatelier.com.br',
    pass: 'Recepcao@2026',
    roleDesc: 'Agenda · Clientes · PDV Vendas · Caixa Diário',
  },
  {
    label: 'Profissional Especialista',
    email: 'rafael@luminaatelier.com.br',
    pass: 'Prof@2026',
    roleDesc: 'Agenda Própria · Clientes · Serviços · Comissões',
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@luminaatelier.com.br');
  const [password, setPassword] = useState('Admin@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Informe um endereço de e-mail corporativo válido.');
      return;
    }
    if (!password || password.length < 6) {
      setError('A senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Falha na autenticação.');
      } else {
        onLoginSuccess(data.token, data.user);
      }
    } catch {
      setError('Erro de conexão com o servidor de autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-zinc-900 flex flex-col lg:flex-row items-stretch">
      {/* Left Column: Brand & Security Context */}
      <div className="lg:w-1/2 bg-zinc-950 text-white p-8 lg:p-16 flex flex-col justify-between">
        <div>
          <span className="font-serif-display text-2xl font-semibold tracking-tight text-white">
            Lumina Atelier
          </span>
          <p className="text-xs text-zinc-400 mt-1">
            Gestão Integrada para Salões de Alta Beleza & Bem-Estar
          </p>
        </div>

        <div className="my-12 max-w-lg">
          <h1 className="font-serif-display text-3xl lg:text-5xl font-medium tracking-tight text-white leading-tight">
            Excelência operacional, precisão financeira e hospitalidade em cada atendimento.
          </h1>
          <p className="text-sm text-zinc-400 mt-6 leading-relaxed">
            Plataforma corporativa com controle de agenda inteligente, ponto de venda integrado ao estoque técnico e varejo, repasse automatizado de comissões e governança de acesso verificada em servidor.
          </p>

          <div className="mt-10 pt-8 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Autenticação & RBAC Real</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Tokens assinados via HMAC-SHA256 e validação de permissões por perfil diretamente nas rotas da API.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <KeyRound className="w-4 h-4" />
                <span>Trilha de Auditoria Imutável</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                Registro automático de todas as operações administrativas, financeiras e tentativas de acesso.
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-500 flex items-center justify-between border-t border-zinc-900 pt-6">
          <span>Jardins Flagship · São Paulo, SP</span>
          <span>Ambiente Seguro SSL/TLS</span>
        </div>
      </div>

      {/* Right Column: Login Form & Credential Switcher */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-16 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="mb-8">
            <h2 className="font-serif-display text-3xl font-semibold text-zinc-900">
              Acesso ao Painel ADM
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Insira suas credenciais corporativas ou selecione um perfil abaixo para testar as permissões de acesso.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@luminaatelier.com.br"
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
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isLoading ? 'Autenticando no Servidor...' : 'Entrar no Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Role Testing Selector */}
          <div className="mt-8 pt-6 border-t border-zinc-200">
            <p className="text-xs font-semibold text-zinc-800 mb-3">
              Credenciais Rápidas por Nível de Permissão (Teste RBAC):
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const isSelected = email === acc.email;
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleQuickFill(acc.email, acc.pass)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/70 border-amber-700/40 text-zinc-900'
                        : 'bg-white border-zinc-200/80 hover:border-zinc-300 text-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900">{acc.label}</span>
                      <span className="text-[11px] font-mono-num text-zinc-500">{acc.email}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{acc.roleDesc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
