import React, { useState } from 'react';
import { Eye, EyeOff, ShieldAlert, CheckCircle } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
  users: User[];
}

export function Login({ onLoginSuccess, users }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    // Since it is a demo, let's find if state has a user with this email or simulate it.
    // If we type some email that matches any of the mock users list, logging in as that user, otherwise logging as the first manager user.
    const matchedUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    setSuccess(true);
    setTimeout(() => {
      if (matchedUser) {
        onLoginSuccess(matchedUser);
      } else {
        // Create an on-the-fly demo user or login as first
        const administrator = users[0];
        onLoginSuccess({
          ...administrator,
          email: email, // use their inputted email to make it realistic
          name: email.split('@')[0].toUpperCase() || 'Usuário Beta'
        });
      }
    }, 850);
  };

  const handleQuickLogin = (user: User) => {
    setEmail(user.email);
    setPassword('demo1234');
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
              src="https://i.imgur.com/yFECwYD.png"
              alt="Radar Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A] font-sans">
            RADAR<span className="text-[#D40511] font-semibold">.</span>
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
              {success ? 'Entrando...' : 'Entrar no RADAR'}
            </button>
          </form>

          {/* Quick Login Helpers */}
          <div className="mt-8 border-t border-[#E0E0E0] pt-6" id="quick-login-hints">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-3 text-center">
              Acesso Demonstrativo Rápido
            </span>
            <div className="grid grid-cols-2 gap-2" id="quick-login-buttons">
              {users.map((user) => (
                <button
                  id={`quick-login-${user.id}`}
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickLogin(user)}
                  className="px-2 py-1.5 border border-[#E0E0E0] bg-[#F5F5F5] rounded-md text-left transition-colors hover:border-[#D40511] group"
                >
                  <p className="text-[11px] font-bold text-gray-700 truncate group-hover:text-[#D40511]">
                    {user.name}
                  </p>
                  <p className="text-[9px] text-gray-400 font-mono truncate">
                    {user.role === 'gestor' ? 'Gestor' : 'Vendedor/Campo'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with version beta and credits */}
      <footer className="py-6 text-center border-t border-[#E0E0E0]" id="login-footer">
        <p className="text-xs text-gray-500 font-sans">
          RADAR - Sistema de Monitoria de Preços <span className="font-mono text-[10px] bg-red-100 text-[#D40511] px-1.5 py-0.5 rounded ml-1 font-bold">BETA v1.4</span>
        </p>
        <p className="text-[10px] text-gray-400 mt-1 font-sans">
          Inspirado na identidade de prestígio Dr. Oetker. Desenvolvido para auditoria rápida em campo.
        </p>
      </footer>
    </div>
  );
}
