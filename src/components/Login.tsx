import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, CheckCircle } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setSuccess(true);

    try {
      // 1. Auth via Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('E-mail ou senha incorretos.');
        }
        throw new Error(authError.message);
      }

      const userEmail = authData.user?.email;

      // 2. Fetch profile from app_users
      const { data: profile, error: profileError } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', userEmail)
        .single();

      if (profileError || !profile) {
        throw new Error('Perfil de usuário não encontrado.');
      }

      // Map Supabase profile to App User type
      const user: User = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        active: profile.active,
        avatarUrl: profile.avatar_url,
      };

      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Erro ao realizar login.');
      setSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col justify-between" id="login-container">
      {/* Header spacing */}
      <div className="h-4"></div>

      <div className="w-full max-w-md mx-auto p-4">
        {/* Logo and Brand Header */}
        <div className="text-center mb-8" id="login-brand-header">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 p-2 overflow-hidden mb-3">
            <img
              src="https://i.imgur.com/TGgcoZg.png"
              alt="PriceHub Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-sans">
            <span className="text-[#0F379A]">Price</span><span className="text-[#E91617]">Hub</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase font-mono tracking-wider">
            Pesquisa & Auditoria de Preços
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm p-8" id="login-card">
          <h2 className="text-xl font-bold text-[#1A1A1A] mb-6 text-center">
            Acessar Plataforma
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2 text-sm" id="login-error-alert">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2 text-sm" id="login-success-alert">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Autenticando credenciais...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                E-mail corporativo
              </label>
              <input
                id="login-email-input"
                type="email"
                placeholder="exemplo@oetker.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={success}
                className="w-full px-3 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511] transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Senha de acesso
                </label>
              </div>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={success}
                  className="w-full px-3 py-2.5 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511] pr-10 transition-all"
                />
                <button
                  id="toggle-password-btn"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={success}
              className="w-full bg-[#D40511] text-white py-3 rounded-lg text-sm font-semibold hover:bg-[#b0040e] transition-colors focus:ring-2 focus:ring-[#D40511]/40 flex items-center justify-center cursor-pointer mt-6"
            >
              {success ? 'Entrando...' : 'Entrar no PriceHub'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer with version beta and credits */}
      <footer className="py-6 text-center border-t border-[#E0E0E0]" id="login-footer">
        <p className="text-xs text-gray-500 font-sans">
          PriceHub - Sistema de Monitoria de Preços <span className="font-mono text-[10px] bg-red-100 text-[#D40511] px-1.5 py-0.5 rounded ml-1 font-bold">BETA v0.1</span>
        </p>
        <p className="text-[10px] text-gray-400 mt-1 font-sans">
          Desenvolvido por Jessé A. Santos para pesquisa e auditoria de preços em campo.
        </p>
      </footer>
    </div>
  );
}
