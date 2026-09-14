import React, { useState, useMemo } from 'react';
import { X, PackageX, Search, Store, User, Clock, Calendar } from 'lucide-react';
import { Product, Chain } from '../../types';
import { ResearchSession } from '../../lib/researchSessions';

interface OutOfStockModalProps {
  session: ResearchSession;
  products: Product[];
  chains?: Chain[];
  onClose: () => void;
  onPreviewProduct?: (product: Product) => void;
}

export function OutOfStockModal({
  session,
  products,
  chains,
  onClose,
  onPreviewProduct,
}: OutOfStockModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const chain = chains ? chains.find((c) => c.id === session.chainId) : undefined;

  // Map product details from session's out of stock list
  const outOfStockItems = useMemo(() => {
    return session.outOfStockProductIds.map((id, index) => {
      const prod = products.find((p) => p.id === id);
      const fallbackName = session.outOfStockProductNames[index] || 'Produto não catalogado';
      return {
        id,
        name: prod?.name || fallbackName,
        category: prod?.category || 'Geral',
        subcategory: prod?.subcategory || '',
        weight: prod?.weight || '',
        brand: prod?.brand || 'Sem marca',
        imageUrl: prod?.imageUrl || '',
      };
    });
  }, [session.outOfStockProductIds, session.outOfStockProductNames, products]);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return outOfStockItems;
    const term = searchTerm.toLowerCase();
    return outOfStockItems.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.brand.toLowerCase().includes(term)
    );
  }, [outOfStockItems, searchTerm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-150 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0">
              <PackageX className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  Produtos Marcados como "Não tem"
                </h3>
                <span className="text-[11px] font-mono font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  {outOfStockItems.length} {outOfStockItems.length === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Ruptura de estoque identificada pelo pesquisador nesta pesquisa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-150 transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Session context strip */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-150 text-[11px] text-slate-600 flex flex-wrap items-center gap-y-1.5 gap-x-4">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{session.chainName}</span>
            <span className="text-[10px] font-medium text-slate-500 bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
              {session.state}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-600">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{session.userName}</span>
            <span className="text-[10px] text-slate-500">({session.userRole})</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{session.timeDisplay}</span>
            <span>•</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{session.date}</span>
          </div>
        </div>

        {/* Search bar inside modal if > 3 items */}
        {outOfStockItems.length > 3 && (
          <div className="px-6 pt-4 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por nome, categoria ou marca..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>
        )}

        {/* List of out of stock products */}
        <div className="p-6 overflow-y-auto space-y-2.5 max-h-[50vh] divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhum produto encontrado com o filtro aplicado.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <PackageX className="w-5 h-5 text-rose-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate leading-snug group-hover:text-rose-700 transition">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-semibold text-slate-600">{item.brand}</span>
                      {item.weight && <span>• {item.weight}</span>}
                      {item.category && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-sm">
                          {item.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full whitespace-nowrap">
                    Sem Estoque no PDV
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-150 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
