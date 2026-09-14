import React, { useState, useMemo } from 'react';
import { Store, User, Clock, Calendar, AlertTriangle, CheckCircle2, PackageX, ChevronDown, ChevronUp, Check, Sparkles, Trash2, Eye, RefreshCw, ZoomIn, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { ResearchSession, formatDateBR } from '../../lib/researchSessions';
import { Product, PriceRecord, Chain } from '../../types';
import { parsePriceRecordMeta, searchAndRankProducts, stripSessionMetaPrefix } from '../../lib/textUtils';

interface PendingSessionCardProps {
  key?: React.Key;
  session: ResearchSession;
  chains: Chain[];
  products: Product[];
  records: PriceRecord[];
  isInitiallyExpanded?: boolean;
  onOpenOutOfStock: (session: ResearchSession) => void;
  onPreviewImage: (record: PriceRecord) => void;
  onPreviewProduct: (product: Product) => void;
  onConfirmRecord: (params: {
    record: PriceRecord;
    productId: string;
    chainId: string;
    priceNum: number;
    notes?: string;
    suggestedName?: string | null;
    suggestedProdId?: string | null;
  }) => void;
  onDeleteRecord: (recordId: string) => void;
  onReanalyze: (record: PriceRecord) => Promise<void>;
  analyzingRecords: Record<string, boolean>;
}

export function PendingSessionCard({
  session,
  chains,
  products,
  records,
  isInitiallyExpanded = true,
  onOpenOutOfStock,
  onPreviewImage,
  onPreviewProduct,
  onConfirmRecord,
  onDeleteRecord,
  onReanalyze,
  analyzingRecords,
}: PendingSessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  // Per-item local edit states
  const [itemStates, setItemStates] = useState<Record<string, {
    productId: string | null;
    searchQuery: string;
    price: string;
    chainId: string;
    notes: string;
    isDropdownOpen: boolean;
    showDeleteConfirm: boolean;
  }>>({});

  // Helper to get or initialize item state
  const getItemState = (rec: PriceRecord) => {
    if (itemStates[rec.id]) return itemStates[rec.id];

    const meta = parsePriceRecordMeta(rec.notes);
    let initPrice = '0,00';
    if (rec.price && rec.price > 0) {
      initPrice = rec.price.toFixed(2).replace('.', ',');
    } else if (meta.aiPriceSuggested && meta.aiPriceSuggested > 0) {
      initPrice = meta.aiPriceSuggested.toFixed(2).replace('.', ',');
    }

    let initialChainId = rec.chainId || session.chainId || chains[0]?.id || '';

    let initProductId: string | null = rec.productId || null;
    let initQuery = '';
    if (!initProductId && meta.aiProductSuggested) {
      const ranked = searchAndRankProducts(products, meta.aiProductSuggested);
      if (ranked.length > 0) {
        initProductId = ranked[0].id;
      } else {
        initQuery = meta.aiProductSuggested;
      }
    }

    return {
      productId: initProductId,
      searchQuery: initQuery,
      price: initPrice,
      chainId: initialChainId,
      notes: meta.originalNotes || '',
      isDropdownOpen: false,
      showDeleteConfirm: false,
    };
  };

  const updateItemState = (recordId: string, partial: Partial<{
    productId: string | null;
    searchQuery: string;
    price: string;
    chainId: string;
    notes: string;
    isDropdownOpen: boolean;
    showDeleteConfirm: boolean;
  }>) => {
    setItemStates((prev) => {
      const rec = session.pendingRecords.find((r) => r.id === recordId);
      const current = prev[recordId] || (rec ? getItemState(rec) : {
        productId: null,
        searchQuery: '',
        price: '0,00',
        chainId: session.chainId,
        notes: '',
        isDropdownOpen: false,
        showDeleteConfirm: false,
      });
      return {
        ...prev,
        [recordId]: {
          ...current,
          ...partial,
        },
      };
    });
  };

  // Calculator price formatter
  const handlePriceChange = (recordId: string, rawVal: string) => {
    const digits = rawVal.replace(/\D/g, '');
    if (!digits) {
      updateItemState(recordId, { price: '0,00' });
      return;
    }
    const cents = parseInt(digits, 10);
    const formatted = (cents / 100).toFixed(2).replace('.', ',');
    updateItemState(recordId, { price: formatted });
  };

  // Helper to find previous recorded price for a product in this chain
  const getLastPriceForProduct = (productId: string, chainId: string): number | null => {
    const matched = records
      .filter((r) => r.productId === productId && r.chainId === chainId && r.price > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (matched.length > 0) {
      return matched[0].price;
    }
    const prod = products.find((p) => p.id === productId);
    return prod?.basePrice || null;
  };

  // Check how many items are ready to approve in this session
  const readyToApproveCount = useMemo(() => {
    let count = 0;
    for (const rec of session.pendingRecords) {
      const state = itemStates[rec.id] || getItemState(rec);
      const priceNum = parseFloat(state.price.replace(',', '.'));
      if (state.productId && priceNum > 0) {
        count++;
      }
    }
    return count;
  }, [session.pendingRecords, itemStates]);

  // Batch approve all ready items in this session
  const handleApproveAllReadyInSession = () => {
    session.pendingRecords.forEach((rec) => {
      const state = itemStates[rec.id] || getItemState(rec);
      const priceNum = parseFloat(state.price.replace(',', '.'));
      if (state.productId && priceNum > 0) {
        const meta = parsePriceRecordMeta(rec.notes);
        onConfirmRecord({
          record: rec,
          productId: state.productId,
          chainId: state.chainId,
          priceNum,
          notes: state.notes,
          suggestedName: meta.aiProductSuggested,
          suggestedProdId: rec.productId,
        });
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden mb-5">
      {/* Session Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:p-5 border-b border-amber-100 bg-amber-50/40 hover:bg-amber-50/70 transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0 shadow-xs border border-black/5"
            style={{ backgroundColor: session.chainColor || '#475569' }}
          >
            {session.chainLogoUrl ? (
              <img
                src={session.chainLogoUrl}
                alt={session.chainName}
                className="w-full h-full object-cover rounded-xl"
                referrerPolicy="no-referrer"
              />
            ) : (
              session.chainName.substring(0, 2).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {session.chainName}
              </h3>
              <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                {session.state}
              </span>
              <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {session.pendingRecords.length} {session.pendingRecords.length === 1 ? 'foto pendente' : 'fotos pendentes'}
              </span>
              {!session.isConcluded && (
                <span className="text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse" title="O usuário ainda está no processo de pesquisa e não clicou no botão Concluir Pesquisa">
                  <Clock className="w-3 h-3 text-sky-600" />
                  <span>Pesquisa em andamento</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
              <div className="flex items-center gap-1.5 text-slate-800">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-bold">{session.userName}</span>
                <span className="text-[10px] bg-slate-200/80 text-slate-700 font-semibold px-1.5 py-0.2 rounded-sm">
                  {session.userRole}
                </span>
              </div>

              <div className="flex items-center gap-1 text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{session.timeDisplay}</span>
              </div>

              <div className="flex items-center gap-1 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatDateBR(session.date)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side controls: Out of stock badge + Batch approve + Accordion toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/50">
          {/* Out of Stock ("Não tem") badge */}
          {session.outOfStockProductIds.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenOutOfStock(session);
              }}
              className="text-[11px] font-bold bg-rose-100/90 hover:bg-rose-200 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              title="Ver produtos marcados como 'Não tem na loja'"
            >
              <PackageX className="w-3.5 h-3.5 text-rose-600" />
              <span>{session.outOfStockProductIds.length} sem estoque</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Sem rupturas
            </span>
          )}

          {/* Quick batch approve button */}
          {readyToApproveCount > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleApproveAllReadyInSession();
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Confirmar todos os itens que já possuem produto e preço preenchidos"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aprovar {readyToApproveCount} Prontos</span>
            </button>
          )}

          {/* Toggle Expand */}
          <button
            type="button"
            className="p-1.5 rounded-xl bg-white border border-amber-200 text-slate-600 hover:text-slate-900 transition"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div>
          {/* Survey Metadata Details Bar */}
          <div className="px-5 py-3 bg-amber-50/30 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600">
            {/* Queue Completion Status / In-progress Status */}
            <div className="flex items-center gap-2">
              {!session.isConcluded ? (
                <span className="inline-flex items-center gap-1.5 text-sky-900 font-bold bg-sky-50 border border-sky-300 px-2.5 py-1 rounded-lg">
                  <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0 animate-pulse" />
                  <span>Pesquisa em andamento: O usuário ainda não concluiu a pesquisa</span>
                </span>
              ) : session.completedEarly ? (
                <span className="inline-flex items-center gap-1.5 text-amber-900 font-bold bg-amber-100/80 border border-amber-300 px-2.5 py-1 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Fila Incompleta: Pesquisa encerrada com {session.remainingQueueCount} produtos restantes na fila recomendada</span>
                </span>
              ) : session.queueTotal > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-900 font-bold bg-emerald-50 border border-emerald-300 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Fila 100% Concluída: O pesquisador passou por toda a listagem</span>
                </span>
              ) : (
                <span className="text-slate-500 font-medium">
                  Auditoria de campo com registros para análise de gestor
                </span>
              )}
            </div>

            {/* Out of Stock summary link */}
            {session.outOfStockProductIds.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenOutOfStock(session)}
                className="text-[11px] text-rose-700 hover:text-rose-800 font-bold underline flex items-center gap-1 cursor-pointer"
              >
                <PackageX className="w-3 h-3 text-rose-600" />
                <span>Ver os {session.outOfStockProductIds.length} produtos em ruptura</span>
              </button>
            )}
          </div>

          {/* Pending records list */}
          <div className="p-4 sm:p-5 space-y-4">
            {session.pendingRecords.map((rec) => {
              const itemState = getItemState(rec);
              const meta = parsePriceRecordMeta(rec.notes);
              const matchedProduct = itemState.productId
                ? products.find((p) => p.id === itemState.productId)
                : null;
              const isAnalyzing = Boolean(analyzingRecords[rec.id]);
              const priceNum = parseFloat(itemState.price.replace(',', '.'));
              const isValidToConfirm = Boolean(itemState.productId && !isNaN(priceNum) && priceNum > 0);

              // Filter products for dropdown
              const rankedProducts = !itemState.isDropdownOpen
                ? []
                : !itemState.searchQuery.trim()
                ? products.slice(0, 15)
                : searchAndRankProducts(products, itemState.searchQuery).slice(0, 15);

              // Check last price
              const lastPrice = itemState.productId
                ? getLastPriceForProduct(itemState.productId, itemState.chainId)
                : null;

              return (
                <div
                  key={rec.id}
                  className="bg-slate-50/60 border border-slate-200 rounded-2xl p-4 sm:p-5 transition-all hover:bg-white hover:border-slate-300 shadow-2xs"
                >
                  <div className="flex flex-col md:flex-row items-start gap-4 sm:gap-6">
                    {/* Thumbnail */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <div
                        onClick={() => onPreviewImage(rec)}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden relative border border-slate-200 bg-slate-100 cursor-pointer shrink-0 group/img shadow-2xs"
                        title="Clique para visualizar a foto da evidência em alta resolução"
                      >
                        {rec.imageUrl ? (
                          <img
                            src={rec.imageUrl}
                            alt="Evidência"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-5 h-5 drop-shadow-md" />
                        </div>
                        <div className="absolute top-1 left-1 bg-amber-500 text-white font-black text-[8px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
                          Pendente
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatDateBR(rec.date)}
                      </span>
                    </div>

                    {/* Controls Grid */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start w-full">
                      {/* 1. Chain */}
                      <div className="sm:col-span-1 lg:col-span-4">
                        <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 font-sans">
                          1. Rede / Loja
                        </label>
                        <select
                          value={itemState.chainId}
                          onChange={(e) => updateItemState(rec.id, { chainId: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:border-[#D40511] h-9 shadow-2xs"
                        >
                          {chains.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Product */}
                      <div className="sm:col-span-1 lg:col-span-5 relative">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 font-sans">
                            2. Produto Vinculado
                          </label>
                          {matchedProduct && (
                            <button
                              type="button"
                              onClick={() => updateItemState(rec.id, { productId: null, searchQuery: '', isDropdownOpen: true })}
                              className="text-[9.5px] text-[#D40511] hover:underline font-bold cursor-pointer transition-colors"
                            >
                              Alterar
                            </button>
                          )}
                        </div>

                        {matchedProduct ? (
                          <div
                            onClick={() => {
                              if (matchedProduct.imageUrl) onPreviewProduct(matchedProduct);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1 bg-emerald-50/80 border border-emerald-200 rounded-lg h-9 shadow-2xs transition-all ${
                              matchedProduct.imageUrl ? 'hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer' : ''
                            }`}
                          >
                            {matchedProduct.imageUrl ? (
                              <img
                                src={matchedProduct.imageUrl}
                                alt={matchedProduct.name}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 object-contain bg-white rounded border border-slate-100 shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded bg-white flex items-center justify-center border border-slate-200 shrink-0">
                                <ImageIcon className="w-3 h-3 text-slate-400" />
                              </div>
                            )}
                            <span className="text-xs font-bold text-slate-800 truncate flex-1">
                              {matchedProduct.name}
                            </span>
                            {matchedProduct.imageUrl && (
                              <span className="text-[9px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                <span className="hidden sm:inline">Ver</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Buscar produto no catálogo..."
                              value={itemState.searchQuery}
                              onChange={(e) => updateItemState(rec.id, { searchQuery: e.target.value, isDropdownOpen: true })}
                              onFocus={() => updateItemState(rec.id, { isDropdownOpen: true })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-[#D40511] h-9 shadow-2xs"
                            />

                            {itemState.isDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => updateItemState(rec.id, { isDropdownOpen: false })}
                                />
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-56 overflow-y-auto divide-y divide-slate-100">
                                  {rankedProducts.length === 0 ? (
                                    <div className="p-3 text-xs text-slate-400 text-center">
                                      Nenhum produto encontrado.
                                    </div>
                                  ) : (
                                    rankedProducts.map((p) => (
                                      <div
                                        key={p.id}
                                        onClick={() => updateItemState(rec.id, { productId: p.id, isDropdownOpen: false })}
                                        className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition-colors"
                                      >
                                        <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                          {p.imageUrl ? (
                                            <img
                                              src={p.imageUrl}
                                              alt={p.name}
                                              referrerPolicy="no-referrer"
                                              className="w-full h-full object-contain"
                                            />
                                          ) : (
                                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                          )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="text-xs font-bold text-slate-800 truncate">{p.name}</p>
                                          <p className="text-[10px] text-slate-500 truncate">
                                            {p.brand} {p.weight && `• ${p.weight}`}
                                          </p>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 3. Price Calculator & Keep Price Button */}
                      <div className="sm:col-span-1 lg:col-span-3">
                        <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 font-sans">
                          3. Preço Auditado
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={itemState.price}
                              onChange={(e) => handlePriceChange(rec.id, e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-[#D40511] h-9 shadow-2xs"
                            />
                          </div>

                          {/* Quick keep last price button */}
                          {lastPrice && lastPrice > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                updateItemState(rec.id, {
                                  price: lastPrice.toFixed(2).replace('.', ','),
                                });
                              }}
                              className="h-9 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 shrink-0"
                              title={`Manter último preço registrado: R$ ${lastPrice.toFixed(2).replace('.', ',')}`}
                            >
                              <span>R$ {lastPrice.toFixed(2).replace('.', ',')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex items-center md:flex-col gap-2 shrink-0 w-full md:w-auto justify-end md:justify-start">
                      {/* Confirm Audit */}
                      <button
                        type="button"
                        disabled={!isValidToConfirm}
                        onClick={() => {
                          onConfirmRecord({
                            record: rec,
                            productId: itemState.productId!,
                            chainId: itemState.chainId,
                            priceNum,
                            notes: itemState.notes,
                            suggestedName: meta.aiProductSuggested,
                            suggestedProdId: rec.productId,
                          });
                        }}
                        className={`w-full md:w-auto px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                          isValidToConfirm
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title={isValidToConfirm ? 'Confirmar auditoria deste produto' : 'Selecione o produto e defina o preço antes de confirmar'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar</span>
                      </button>

                      {/* Delete item */}
                      {itemState.showDeleteConfirm ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(rec.id)}
                            className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold"
                          >
                            Excluir
                          </button>
                          <button
                            type="button"
                            onClick={() => updateItemState(rec.id, { showDeleteConfirm: false })}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateItemState(rec.id, { showDeleteConfirm: true })}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Excluir evidência"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
