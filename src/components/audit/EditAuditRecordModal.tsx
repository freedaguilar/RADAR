import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Check, 
  Edit3, 
  Package, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Store, 
  Calendar, 
  User, 
  Image as ImageIcon, 
  AlertCircle,
  Sparkles,
  Tag
} from 'lucide-react';
import { PriceRecord, Product, Chain } from '../../types';
import { formatDateBR } from '../../lib/researchSessions';
import { getCleanObserverNotes } from '../../lib/textUtils';

interface EditAuditRecordModalProps {
  isOpen: boolean;
  record: PriceRecord | null;
  products: Product[];
  chains: Chain[];
  onClose: () => void;
  onSave: (updatedRecord: PriceRecord) => void;
}

export function EditAuditRecordModal({
  isOpen,
  record,
  products,
  chains,
  onClose,
  onSave,
}: EditAuditRecordModalProps) {
  if (!isOpen || !record) return null;

  const chain = useMemo(() => {
    return chains.find((c) => c.id === record.chainId);
  }, [chains, record.chainId]);

  // Current selected product in the modal
  const [selectedProductId, setSelectedProductId] = useState<string>(record.productId);
  const [priceInput, setPriceInput] = useState<string>(
    record.price > 0 ? record.price.toFixed(2).replace('.', ',') : '0,00'
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<'all' | 'droetker' | 'competitor'>('all');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [notesInput, setNotesInput] = useState<string>(record.notes || '');

  // Reset state when record changes
  useEffect(() => {
    if (record) {
      setSelectedProductId(record.productId);
      setPriceInput(record.price > 0 ? record.price.toFixed(2).replace('.', ',') : '0,00');
      setSearchQuery('');
      setBrandFilter('all');
      setZoomLevel(1);
      setNotesInput(record.notes || '');
    }
  }, [record]);

  // ESC to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Map of products for fast lookup
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const currentlySelectedProduct = useMemo(() => {
    return productMap.get(selectedProductId) || products.find((p) => p.id === selectedProductId) || null;
  }, [productMap, products, selectedProductId]);

  const originalProduct = useMemo(() => {
    return productMap.get(record.productId) || products.find((p) => p.id === record.productId) || null;
  }, [productMap, products, record.productId]);

  // Filter products list based on search and brand filter
  const filteredProducts = useMemo(() => {
    let list = products;

    // Brand filter
    if (brandFilter === 'droetker') {
      list = list.filter((p) => (p.brand || '').toLowerCase().includes('oetker'));
    } else if (brandFilter === 'competitor') {
      list = list.filter((p) => !(p.brand || '').toLowerCase().includes('oetker'));
    }

    if (!searchQuery.trim()) {
      // Put currently selected product at the top, then first 25 products
      const selected = list.find((p) => p.id === selectedProductId);
      const others = list.filter((p) => p.id !== selectedProductId);
      return selected ? [selected, ...others.slice(0, 24)] : others.slice(0, 25);
    }

    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return list
      .filter((p) => {
        const name = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const brand = (p.brand || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cat = (p.category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const code = (p.internalCode || '').toLowerCase();
        return name.includes(q) || brand.includes(q) || cat.includes(q) || code.includes(q);
      })
      .slice(0, 30);
  }, [products, brandFilter, searchQuery, selectedProductId]);

  // Digit calculator style price input
  const handlePriceChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) {
      setPriceInput('0,00');
      return;
    }
    const cents = parseInt(digits, 10);
    setPriceInput((cents / 100).toFixed(2).replace('.', ','));
  };

  const handleSave = () => {
    const numPrice = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(numPrice) || numPrice < 0) return;

    onSave({
      ...record,
      productId: selectedProductId,
      price: numPrice,
      notes: notesInput,
    });
    onClose();
  };

  const cleanObserverNotes = getCleanObserverNotes(record.notes);

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  Editar Registro de Auditoria
                </h2>
                <span className="text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  Consolidado
                </span>
                {selectedProductId !== record.productId && (
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                    Novo produto selecionado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{chain?.name || 'Rede'} ({record.state || 'UF'})</span>
                <span>&bull;</span>
                <span className="font-mono">{formatDateBR(record.date)}</span>
                {record.userName && (
                  <>
                    <span>&bull;</span>
                    <span>Auditor: <strong className="text-slate-700">{record.userName}</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer shrink-0"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - 2 Columns (Image Evidence & Edit Controls) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-y-auto">
          {/* Left Column: Evidence Photo with Zoom */}
          <div className="md:col-span-5 bg-slate-900 p-4 sm:p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
            <div>
              <div className="flex items-center justify-between text-slate-300 text-xs mb-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">
                  Evidência Fotográfica Coletada
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.5))}
                    disabled={zoomLevel <= 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 cursor-pointer"
                    title="Diminuir zoom"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono px-1 text-slate-400">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.5))}
                    disabled={zoomLevel >= 3}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 cursor-pointer"
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  {zoomLevel > 1 && (
                    <button
                      type="button"
                      onClick={() => setZoomLevel(1)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="Resetar zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Image Frame */}
              <div className="relative rounded-2xl bg-black overflow-hidden flex items-center justify-center min-h-[220px] max-h-[340px] border border-slate-800 shadow-inner group">
                {record.imageUrl ? (
                  <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
                    <img
                      src={record.imageUrl}
                      alt="Evidência"
                      referrerPolicy="no-referrer"
                      style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease' }}
                      className="max-h-[320px] object-contain rounded-lg select-none"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 p-8">
                    <ImageIcon className="w-10 h-10 mb-2 stroke-[1.5]" />
                    <span className="text-xs">Foto indisponível</span>
                  </div>
                )}
              </div>
            </div>

            {/* Context Info Box */}
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Ponto de Venda:</span>
                <span className="font-bold text-slate-200">{chain?.name || 'Rede não catalogada'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Estado / UF:</span>
                <span className="font-medium text-slate-300">{record.state || 'Não informado'}</span>
              </div>
              {cleanObserverNotes && (
                <div className="mt-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700">
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                    Anotação do Promotor:
                  </span>
                  <p className="text-slate-300 text-xs italic">"{cleanObserverNotes}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Product Selector & Price Input */}
          <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between space-y-5 bg-white">
            <div className="space-y-4">
              {/* 1. SELEÇÃO DE PRODUTO */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    1. Alterar Produto Selecionado
                  </label>
                  {selectedProductId !== record.productId && (
                    <button
                      type="button"
                      onClick={() => setSelectedProductId(record.productId)}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Reverter para original
                    </button>
                  )}
                </div>

                {/* Currently Selected Product Highlight Card */}
                {currentlySelectedProduct ? (
                  <div className="p-3 bg-emerald-50/70 border-2 border-emerald-300 rounded-2xl flex items-center gap-3 shadow-2xs mb-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-emerald-200 p-1 flex items-center justify-center shrink-0">
                      {currentlySelectedProduct.imageUrl ? (
                        <img
                          src={currentlySelectedProduct.imageUrl}
                          alt={currentlySelectedProduct.name}
                          className="w-full h-full object-contain rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-emerald-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 bg-emerald-600 text-white rounded-md">
                          Selecionado
                        </span>
                        <span className="text-[11px] font-bold text-emerald-900 truncate">
                          {currentlySelectedProduct.brand || 'Dr. Oetker'}
                        </span>
                      </div>
                      <p className="text-xs font-black text-slate-900 leading-tight truncate mt-0.5">
                        {currentlySelectedProduct.name} {currentlySelectedProduct.weight ? `(${currentlySelectedProduct.weight})` : ''}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                        <span>{currentlySelectedProduct.category}</span>
                        {currentlySelectedProduct.basePrice && currentlySelectedProduct.basePrice > 0 && (
                          <span>&bull; Sugerido: <strong>R$ {currentlySelectedProduct.basePrice.toFixed(2).replace('.', ',')}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-rose-800 text-xs font-bold mb-3">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Nenhum produto associado a este registro. Selecione um abaixo.</span>
                  </div>
                )}

                {/* Search & Brand Filter Toolbar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Buscar produto por nome, marca ou código..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8.5 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Brand quick filter */}
                    <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-xl shrink-0 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setBrandFilter('all')}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                          brandFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-2xs font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandFilter('droetker')}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                          brandFilter === 'droetker'
                            ? 'bg-emerald-600 text-white shadow-2xs font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Dr. Oetker
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrandFilter('competitor')}
                        className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                          brandFilter === 'competitor'
                            ? 'bg-amber-600 text-white shadow-2xs font-black'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Concorrentes
                      </button>
                    </div>
                  </div>

                  {/* Scrollable list of products */}
                  <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/70 border border-slate-200 rounded-2xl p-2 shadow-inner">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => {
                        const isThisSelected = p.id === selectedProductId;
                        return (
                          <div
                            key={p.id}
                            onClick={() => setSelectedProductId(p.id)}
                            className={`p-2 rounded-xl flex items-center justify-between gap-2.5 transition cursor-pointer border ${
                              isThisSelected
                                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300 text-emerald-950 font-bold shadow-2xs'
                                : 'bg-white hover:bg-slate-100/80 border-slate-200/80 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0">
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="w-full h-full object-contain rounded"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Package className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold leading-tight truncate">
                                  {p.name} {p.weight ? `(${p.weight})` : ''}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                                  <span className="font-semibold text-slate-700">{p.brand || 'Dr. Oetker'}</span>
                                  <span>&bull;</span>
                                  <span>{p.category}</span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {isThisSelected ? (
                                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-700 border border-slate-200 rounded-md px-1.5 py-0.5 bg-white">
                                  Escolher
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Nenhum produto cadastrado corresponde aos termos da busca.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. ALTERAÇÃO DE PREÇO */}
              <div className="pt-3 border-t border-slate-150">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    2. Alterar Preço Coletado (R$)
                  </label>
                  {currentlySelectedProduct?.basePrice && currentlySelectedProduct.basePrice > 0 && (
                    <button
                      type="button"
                      onClick={() => setPriceInput(currentlySelectedProduct.basePrice!.toFixed(2).replace('.', ','))}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition"
                      title="Usar preço base sugerido deste produto"
                    >
                      Preencher preço sugerido (R$ {currentlySelectedProduct.basePrice.toFixed(2).replace('.', ',')})
                    </button>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    value={priceInput}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSave();
                      }
                    }}
                    placeholder="0,00"
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-mono font-black text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-150 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedProductId || !priceInput || priceInput === '0,00'}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Salvar Produto & Preço
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
