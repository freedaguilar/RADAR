import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCircle,
  KeyRound,
  User,
  Sparkles,
  ArrowRight,
  Loader2,
  Shield,
  Briefcase,
  Camera,
  BookOpen,
} from 'lucide-react';
import { User as UserType } from '../types';
import { supabase } from '../lib/supabase';
import { INITIAL_USERS } from '../mockData';

interface LoginProps {
  onLoginSuccess: (user: UserType) => void;
  availableUsers?: UserType[];
}

export function Login({ onLoginSuccess, availableUsers = INITIAL_USERS }: LoginProps) {
  // Mode selection: 'guest' (name only, no password) or 'credentials' (corporate email + password)
  const [loginMode, setLoginMode] = useState<'guest' | 'credentials'>('guest');

  // Credentials mode states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [credError, setCredError] = useState('');
  const [isCredLoading, setIsCredLoading] = useState(false);

  // Guest mode states
  const [guestName, setGuestName] = useState('');
  const [guestError, setGuestError] = useState('');
  const [isGuestLoading, setIsGuestLoading] = useState(false);

  // Success message feedback
  const [successMessage, setSuccessMessage] = useState('');

  // Combined pool of registered users for fallback authentication
  const allUsers = React.useMemo(() => {
    const list = [...availableUsers];
    INITIAL_USERS.forEach((initUser) => {
      if (!list.some((u) => u.email && initUser.email && u.email.toLowerCase() === initUser.email.toLowerCase())) {
        list.push(initUser);
      }
    });
    return list;
  }, [availableUsers]);

  // Handle standard corporate credentials login
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredError('');
    setSuccessMessage('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setCredError('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setIsCredLoading(true);

    try {
      let authenticatedUser: UserType | null = null;

      // 1. Attempt Supabase direct check on app_users if configured
      try {
        const { data: profile } = await supabase
          .from('app_users')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (profile) {
          if (!profile.active) {
            throw new Error(
              'Este usuário está inativo no sistema. Entre em contato com o administrador.'
            );
          }

          const expectedPassword = profile.password || '123';
          if (password !== expectedPassword) {
            throw new Error('Senha incorreta. Verifique suas credenciais.');
          }

          authenticatedUser = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            active: profile.active,
            avatarUrl: profile.avatar_url,
            password: profile.password,
          };
        }
      } catch (sbErr: any) {
        if (sbErr.message && (sbErr.message.includes('Senha incorreta') || sbErr.message.includes('inativo'))) {
          throw sbErr;
        }
        console.debug('Supabase direct check skipped or unconfigured:', sbErr);
      }

      // 2. Fallback to registered users in state/mockData
      if (!authenticatedUser) {
        const matched = allUsers.find(
          (u) => u.email && u.email.toLowerCase() === cleanEmail
        );

        if (!matched) {
          throw new Error(
            'E-mail não cadastrado. Verifique o endereço digitado.'
          );
        }

        if (!matched.active) {
          throw new Error(
            'Este usuário está inativo no sistema. Entre em contato com o administrador.'
          );
        }

        // Strictly validate password matching user's stored password
        const expectedPassword = matched.password || '123';
        if (password !== expectedPassword) {
          throw new Error('Senha incorreta. Verifique suas credenciais.');
        }

        authenticatedUser = matched;
      }

      setSuccessMessage(`Bem-vindo de volta, ${authenticatedUser.name}!`);
      setTimeout(() => {
        onLoginSuccess(authenticatedUser!);
      }, 400);
    } catch (err: any) {
      setCredError(err.message || 'Erro ao realizar login.');
      setIsCredLoading(false);
    }
  };

  // Handle Guest login: user only enters their name, no password required!
  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError('');

    const cleanName = guestName.trim();
    if (!cleanName || cleanName.length < 2) {
      setGuestError('Por favor, digite seu nome (mínimo 2 caracteres).');
      return;
    }

    setIsGuestLoading(true);
    setSuccessMessage(`Olá, ${cleanName}! Acessando como Convidado...`);

    // Compute initials for avatar (e.g. "João Silva" -> "JS")
    const parts = cleanName.split(/\s+/).filter(Boolean);
    const initials =
      parts.length === 1
        ? parts[0].substring(0, 2).toUpperCase()
        : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();

    // Create safe guest slug
    const normalizedSlug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '.');

    const guestUser: UserType = {
      id: `guest-${Date.now()}`,
      name: cleanName,
      email: `${normalizedSlug || 'visitante'}.convidado@radar.com`,
      role: 'vendedor', // Field auditor/researcher privileges
      active: true,
      avatarUrl: initials,
      isGuest: true,
    };

    setTimeout(() => {
      onLoginSuccess(guestUser);
    }, 400);
  };

  return (
    <div
      className="min-h-screen bg-[#F5F5F5] flex flex-col justify-between"
      id="login-container"
    >
      <div className="h-2"></div>

      <div className="w-full max-w-md mx-auto p-4 my-auto">
        {/* Brand Header */}
        <div className="text-center mb-6" id="login-brand-header">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 p-2 overflow-hidden mb-3">
            <img
              src="https://i.imgur.com/TGgcoZg.png"
              alt="PriceHub Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-sans">
            <span className="text-[#0F379A]">Price</span>
            <span className="text-[#E91617]">Hub</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase font-mono tracking-wider">
            Monitoramento de Preços
          </p>
        </div>

        {/* Main Login Card */}
        <div
          className="bg-white rounded-3xl border border-[#E0E0E0] shadow-sm p-6 sm:p-8"
          id="login-card"
        >
          {/* Mode Switcher Tabs */}
          <div className="flex bg-[#F5F5F5] p-1 rounded-2xl mb-6 border border-gray-200">
            <button
              type="button"
              id="tab-guest-login"
              onClick={() => {
                setLoginMode('guest');
                setCredError('');
                setGuestError('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                loginMode === 'guest'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-gray-200/80'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-amber-600" />
              <span>Convidado</span>
            </button>

            <button
              type="button"
              id="tab-credentials-login"
              onClick={() => {
                setLoginMode('credentials');
                setCredError('');
                setGuestError('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                loginMode === 'credentials'
                  ? 'bg-white text-[#1A1A1A] shadow-xs border border-gray-200/80'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#D40511]" />
              <span>Gestor</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {successMessage && (
            <div
              className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in"
              id="login-success-alert"
            >
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {credError && loginMode === 'credentials' && (
            <div
              className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2.5 text-xs font-medium"
              id="login-error-alert"
            >
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-[#D40511]" />
              <span>{credError}</span>
            </div>
          )}

          {guestError && loginMode === 'guest' && (
            <div
              className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2.5 text-xs font-medium"
              id="guest-error-alert"
            >
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-[#D40511]" />
              <span>{guestError}</span>
            </div>
          )}

          {/* ============================================================
              TAB 1: GUEST LOGIN (Convidado)
             ============================================================ */}
          {loginMode === 'guest' && (
            <div id="guest-login-panel">
              {/* Guest Form */}
              <form onSubmit={handleGuestSubmit} className="space-y-4" id="guest-login-form">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Como deseja ser chamado(a)?
                  </label>
                  <div className="relative">
                    <input
                      id="guest-name-input"
                      type="text"
                      placeholder="Ex: Carlos Silva, Juliana Santos..."
                      value={guestName}
                      onChange={(e) => {
                        setGuestName(e.target.value);
                        if (guestError) setGuestError('');
                      }}
                      disabled={isGuestLoading}
                      autoFocus
                      required
                      maxLength={50}
                      className="w-full px-3.5 py-3 pl-10 bg-[#F5F5F5] border border-[#E0E0E0] rounded-xl text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all font-sans"
                    />
                    <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                {/* Tutorial para coleta em campo */}
                <div className="p-3.5 bg-gray-50 border border-gray-200/70 rounded-2xl text-[11px] text-gray-600 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-gray-800">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>Tutorial para coleta em campo</span>
                  </div>
                  <ol className="space-y-1 text-gray-600 pl-5 list-decimal marker:text-amber-600 marker:font-bold">
                    <li>Selecione o estado da pesquisa</li>
                    <li>Selecione a rede para a pesquisa</li>
                    <li>Tire a foto da etiqueta do produto solicitado</li>
                    <li>Insira o valor do produto</li>
                    <li>Confira e conclua a pesquisa</li>
                  </ol>
                </div>

                <button
                  id="guest-submit-btn"
                  type="submit"
                  disabled={isGuestLoading || !guestName.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 hover:text-black py-3 rounded-xl text-sm font-bold transition-all focus:ring-2 focus:ring-amber-500/40 flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {isGuestLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-900" />
                      <span>Preparando acesso...</span>
                    </>
                  ) : (
                    <>
                      <span>{guestName.trim() ? `Entrar como ${guestName.trim()}` : 'Entrar como Convidado'}</span>
                      <ArrowRight className="w-4 h-4 text-amber-900" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================
              TAB 2: CREDENTIALS LOGIN (Gestor - Email + Senha)
             ============================================================ */}
          {loginMode === 'credentials' && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-bold text-[#1A1A1A]">
                  Acesso Gestor
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Insira seu e-mail corporativo e senha cadastrada
                </p>
              </div>

              <form onSubmit={handleCredentialsSubmit} className="space-y-4" id="login-form">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">
                    E-mail corporativo
                  </label>
                  <input
                    id="login-email-input"
                    type="email"
                    placeholder="exemplo@oetker.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isCredLoading}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-xl text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511] focus:bg-white transition-all font-sans"
                  />
                </div>

                <div>
                  <div className="mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600">
                      Senha de acesso
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isCredLoading}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-xl text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511] focus:bg-white pr-10 transition-all font-sans"
                    />
                    <button
                      id="toggle-password-btn"
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isCredLoading}
                  className="w-full bg-[#D40511] text-white py-3 rounded-xl text-sm font-bold hover:bg-[#b0040e] transition-colors focus:ring-2 focus:ring-[#D40511]/40 flex items-center justify-center gap-2 cursor-pointer shadow-xs mt-2 disabled:opacity-70"
                >
                  {isCredLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <>
                      <span>Entrar no PriceHub</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Footer with version beta and credits */}
      <footer className="py-4 text-center border-t border-[#E0E0E0] bg-white/50" id="login-footer">
        <p className="text-xs text-gray-500 font-sans">
          PriceHub - Sistema de Monitoria de Preços{' '}
          <span className="font-mono text-[10px] bg-red-100 text-[#D40511] px-1.5 py-0.5 rounded ml-1 font-bold">
            BETA v0.1
          </span>
        </p>
        <p className="text-[10px] text-gray-400 mt-1 font-sans">
          © 2026 aquilas.tech • Todos os direitos reservados 
        </p>
      </footer>
    </div>
  );
}
