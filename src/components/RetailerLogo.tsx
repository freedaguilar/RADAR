import React from 'react';
import { Chain } from '../types';

export function RetailerLogo({
  chain,
  size = 'md',
}: {
  chain: Chain;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const getInitialsAndColors = (name: string) => {
    const uppercase = name.toUpperCase();
    if (uppercase.includes('CARREFOUR'))
      return { text: 'C', bg: 'bg-blue-600', border: 'border-blue-700/50', textCol: 'text-white' };
    if (
      uppercase.includes('PÃO DE AÇÚCAR') ||
      uppercase.includes('PAO DE ACUCAR') ||
      uppercase.includes('GPA')
    ) {
      return { text: 'PA', bg: 'bg-emerald-700', border: 'border-emerald-800/50', textCol: 'text-white' };
    }
    if (uppercase.includes('SONDA'))
      return { text: 'SD', bg: 'bg-red-500', border: 'border-red-600/50', textCol: 'text-white' };
    if (uppercase.includes('MAMBO'))
      return { text: 'MB', bg: 'bg-amber-500', border: 'border-amber-600/50', textCol: 'text-amber-950' };
    if (uppercase.includes('HIROTA'))
      return { text: 'HR', bg: 'bg-orange-600', border: 'border-orange-700/50', textCol: 'text-white' };
    if (uppercase.includes('BH') || uppercase.includes('BELO HORIZONTE'))
      return { text: 'BH', bg: 'bg-amber-400', border: 'border-amber-500/50', textCol: 'text-blue-900' };
    if (uppercase.includes('ASSAÍ') || uppercase.includes('ASSAI'))
      return { text: 'AS', bg: 'bg-orange-500', border: 'border-orange-600/50', textCol: 'text-white' };
    if (uppercase.includes('ATACADÃO') || uppercase.includes('ATACADAO'))
      return { text: 'AT', bg: 'bg-red-600', border: 'border-red-750', textCol: 'text-white' };
    if (uppercase.includes('VILLEFORT'))
      return { text: 'VF', bg: 'bg-sky-600', border: 'border-sky-700', textCol: 'text-white' };

    const parts = name.split(' ').filter(Boolean);
    const initials = parts
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
    return {
      text: initials || '?',
      bg: chain.logoColor || 'bg-gray-600',
      border: 'border-gray-500/20',
      textCol: 'text-white',
    };
  };

  const { text, bg, border, textCol } = getInitialsAndColors(chain.name);
  const sizeClasses =
    size === 'sm'
      ? 'w-5 h-5 text-[8px] font-bold rounded'
      : size === 'lg'
      ? 'w-11 h-11 text-base font-black rounded-xl'
      : size === 'xl'
      ? 'w-14 h-14 text-lg font-black rounded-2xl'
      : 'w-7 h-7 text-xs font-black rounded-lg';

  if (chain.logoUrl) {
    return (
      <div
        className={`overflow-hidden border border-gray-200 shrink-0 bg-white flex items-center justify-center ${sizeClasses}`}
      >
        <img
          src={chain.logoUrl}
          alt={chain.name}
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div
      className={`border shrink-0 flex items-center justify-center font-sans tracking-tight shadow-xs ${bg} ${border} ${textCol} ${sizeClasses}`}
    >
      <span>{text}</span>
    </div>
  );
}
