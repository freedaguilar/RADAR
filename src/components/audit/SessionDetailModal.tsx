import React, { useState, useMemo } from 'react';
import { X, Store, User, Clock, Calendar, AlertTriangle, CheckCircle2, PackageX, ExternalLink, Image as ImageIcon, Trash2, Edit3, ArrowUpRight, Search, Check, Sparkles, CheckSquare, Square } from 'lucide-react';
import { ResearchSession, formatDateBR } from '../../lib/researchSessions';
import { Product, PriceRecord, Chain } from '../../types';
import { stripSessionMetaPrefix, getCleanObserverNotes } from '../../lib/textUtils';

interface SessionDetailModalProps {
  session: ResearchSession;
  products: Product[];
  chains: Chain[];
  onClose: () => void;
  onOpenRecordLightbox?: (recordId: string) => void;
  onSelectRecord?: (recordId: string) => void;
  onPreviewImage?: (record: PriceRecord) => void;
  onPreviewProduct?: (product: Product) => void;
  onOpenOutOfStock?: (session: ResearchSession) => void;
  onDeleteRecord?: (recordId: string) => void;
  onDeleteSession?: (session: ResearchSession) => void;
  onUpdateRecord?: (record: PriceRecord) => void;
}

export function SessionDetailModal({
  session,
  products,
  chains,
  onClose,
  onOpenRecordLightbox,
  onSelectRecord,
  onPreviewImage,
  onPreviewProduct,
  onOpenOutOfStock,
  onDeleteRecord,
  onDeleteSession,
  onUpdateRecord,
}: SessionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'audited' | 'outofstock'>('audited');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showDeleteSelectedModal, setShowDeleteSelectedModal] = useState(false);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Out of stock product objects
  const outOfStockItems = useMemo(() => {
    return session.outOfStockProductIds.map((id, index) => {
      const prod = productMap.get(id);
      const fallbackName = session.outOfStockProductNames[index] || 'Produto não catalogado';
      return {
        id,
        name: prod?.name || fallbackName,
        category: prod?.category || 'Geral',
        weight: prod?.weight || '',
        brand: prod?.brand || '',
        imageUrl: prod?.imageUrl || '',
      };
    });
  }, [session.outOfStockProductIds, session.outOfStockProductNames, productMap]);

  // Filtered audited records
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return session.consolidatedRecords;
    const term = searchTerm.toLowerCase();
    return session.consolidatedRecords.filter((rec) => {
      const prod = productMap.get(rec.productId);
      const prodName = prod?.name?.toLowerCase() || '';
      const notes = rec.notes?.toLowerCase() || '';
      return prodName.includes(term) || notes.includes(term);
    });
  }, [session.consolidatedRecords, productMap, searchTerm]);

  // Filtered out of stock items
  const filteredOutOfStock = useMemo(() => {
    if (!searchTerm.trim()) return outOfStockItems;
    const term = searchTerm.toLowerCase();
    return outOfStockItems.filter((item) => {
      return (
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.brand.toLowerCase().includes(term)
      );
    });
  }, [outOfStockItems, searchTerm]);

  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected =
    filteredRecords.length > 0 &&
    filteredRecords.every((r) => selectedRecordIds.has(r.id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        filteredRecords.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRecordIds((prev) => {
        const next = new Set(prev);
        filteredRecords.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleDeleteSelected = () => {
    if (!onDeleteRecord) return;
    selectedRecordIds.forEach((id) => {
      onDeleteRecord(id);
    });
    setSelectedRecordIds(new Set());
    setShowDeleteSelectedModal(false);
  };

  const handleDeleteAll = () => {
    if (onDeleteSession) {
      onDeleteSession(session);
    } else if (onDeleteRecord) {
      const allRecords = session.records && session.records.length > 0
        ? session.records
        : [...session.consolidatedRecords, ...session.pendingRecords];
      allRecords.forEach((r) => {
        onDeleteRecord(r.id);
      });
    }
    setSelectedRecordIds(new Set());
    setShowDeleteAllModal(false);
    onClose();
  };

  const handleStartEditPrice = (record: PriceRecord) => {
    setEditingRecordId(record.id);
    setEditPriceValue(record.price.toFixed(2).replace('.', ','));
  };

  const handleSaveEditPrice = (record: PriceRecord) => {
    if (!onUpdateRecord) return;
    const numPrice = parseFloat(editPriceValue.replace(',', '.'));
    if (isNaN(numPrice) || numPrice < 0) return;

    onUpdateRecord({
      ...record,
      price: numPrice,
    });
    setEditingRecordId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-150 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base text-white shrink-0 shadow-xs border border-black/5"
              style={{ backgroundColor: session.chainColor || '#475569' }}
            >
              {session.chainLogoUrl ? (
                <img
                  src={session.chainLogoUrl}
                  alt={session.chainName}
                  className="w-full h-full object-cover rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                session.chainName.substring(0, 2).toUpperCase()
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {session.chainName}
                </h2>
                <span className="text-[11px] font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                  {session.state}
                </span>
                <span className="text-[11px] font-mono font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
                  Pesquisa Consolidada
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap font-medium">
                <div className="flex items-center gap-1.5 text-slate-800">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold">{session.userName}</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.2 rounded-sm">
                    {session.userRole}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Horário: <strong>{session.timeDisplay}</strong></span>
                </div>

                <div className="flex items-center gap-1 text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Data: <strong>{formatDateBR(session.date)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-150 transition cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detailed Survey Status Banner */}
        <div className="px-6 py-3.5 bg-slate-100/60 border-b border-slate-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          {/* Queue completion alert / In-progress alert */}
          <div className="flex items-center gap-2">
            {!session.isConcluded ? (
              <div className="flex items-center gap-2 text-sky-900 bg-sky-50 border border-sky-300 px-3 py-1.5 rounded-xl font-medium">
                <Clock className="w-4 h-4 text-sky-600 shrink-0 animate-pulse" />
                <span>
                  <strong>Pesquisa em Andamento:</strong> O usuário ainda não concluiu a pesquisa (fotos registradas em tempo real).
                </span>
              </div>
            ) : session.completedEarly ? (
              <div className="flex items-center gap-2 text-amber-900 bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-xl font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Conclusão Antecipada:</strong> O pesquisador finalizou a pesquisa com{' '}
                  <strong>{session.remainingQueueCount} {session.remainingQueueCount === 1 ? 'item restante' : 'itens restantes'}</strong> na fila de recomendação.
                </span>
              </div>
            ) : session.queueTotal > 0 ? (
              <div className="flex items-center gap-2 text-emerald-900 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Fila 100% Concluída:</strong> Todos os produtos da listagem recomendada foram auditados ou reportados.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-medium">
                <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Auditoria de campo registrada e arquivada com sucesso.</span>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-slate-600 font-medium shrink-0">
            <div>
              Total auditado: <strong className="text-slate-900">{session.consolidatedRecords.length} itens</strong>
            </div>
            {session.averagePrice > 0 && (
              <div>
                Preço médio: <strong className="text-slate-900 font-mono">R$ {session.averagePrice.toFixed(2).replace('.', ',')}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Tabs & Search Navigation */}
        <div className="px-6 pt-4 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('audited')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'audited'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Produtos Auditados ({session.consolidatedRecords.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('outofstock')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'outofstock'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageX className="w-3.5 h-3.5 text-rose-600" />
              <span>Sem Estoque / "Não Tem" ({session.outOfStockProductIds.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar nesta pesquisa..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#D40511]/20 focus:border-[#D40511]"
            />
          </div>
        </div>

        {/* Action / Selection Bar for Audited Records */}
        {activeTab === 'audited' && onDeleteRecord && session.consolidatedRecords.length > 0 && (
          <div className="px-6 py-2 bg-slate-50/90 border-y border-slate-150 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900 transition cursor-pointer select-none"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-[#D40511]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  {isAllFilteredSelected
                    ? 'Desmarcar todos'
                    : `Selecionar todos (${filteredRecords.length})`}
                </span>
              </button>

              {selectedRecordIds.size > 0 && (
                <span className="text-[11px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                  {selectedRecordIds.size} {selectedRecordIds.size === 1 ? 'selecionado' : 'selecionados'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedRecordIds.size > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowDeleteSelectedModal(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir selecionados ({selectedRecordIds.size})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRecordIds(new Set())}
                    className="px-2.5 py-1.5 text-slate-500 hover:text-slate-800 rounded-xl font-medium text-xs transition cursor-pointer"
                  >
                    Limpar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(true)}
                  className="px-3 py-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  title="Excluir todos os registros desta pesquisa"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Excluir toda a pesquisa ({session.consolidatedRecords.length})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[60vh]">
          {activeTab === 'audited' ? (
            <div>
              {session.consolidatedRecords.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400 border border-slate-200">
                    <Trash2 className="w-7 h-7 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    Nenhum produto auditado nesta pesquisa
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Os registros desta pesquisa foram excluídos ou ainda não foram catalogados.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  Nenhum produto auditado encontrado com os termos de busca.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredRecords.map((rec) => {
                    const prod = productMap.get(rec.productId);
                    const cleanNotes = getCleanObserverNotes(rec.notes);
                    const isEditing = editingRecordId === rec.id;
                    const isSelected = selectedRecordIds.has(rec.id);

                    return (
                      <div
                        key={rec.id}
                        className={`border rounded-2xl p-3.5 flex gap-3.5 transition-all group ${
                          isSelected
                            ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-200'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Thumbnail image with checkbox & click-to-lightbox */}
                        <div className="relative shrink-0">
                          {onDeleteRecord && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectRecord(rec.id);
                              }}
                              className={`absolute top-1.5 left-1.5 z-10 w-5 h-5 rounded-md flex items-center justify-center transition shadow-xs cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white/90 text-slate-400 hover:text-slate-700 border border-slate-300'
                              }`}
                              title="Selecionar para exclusão"
                            >
                              {isSelected ? (
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              ) : (
                                <span className="w-2 h-2 rounded-xs border border-slate-400" />
                              )}
                            </button>
                          )}
                          <div
                            onClick={() => {
                              onSelectRecord?.(rec.id);
                              onOpenRecordLightbox?.(rec.id);
                            }}
                            className="w-18 h-18 sm:w-20 sm:h-20 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 cursor-pointer relative group/img hover:ring-2 hover:ring-[#D40511]/30 transition"
                            title="Clique para ver evidência fotográfica em alta resolução"
                          >
                            {rec.imageUrl ? (
                              <img
                                src={rec.imageUrl}
                                alt={prod?.name || 'Foto'}
                                className="w-full h-full object-cover group-hover/img:scale-105 transition"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white">
                              <ExternalLink className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        {/* Product details and price */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-snug line-clamp-2">
                              {prod?.name || 'Produto não identificado'}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                              {prod?.brand && <span className="font-semibold text-slate-600">{prod.brand}</span>}
                              {prod?.weight && <span>• {prod.weight}</span>}
                              {prod?.category && (
                                <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 py-0.2 rounded-sm">
                                  {prod.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500">R$</span>
                                <input
                                  type="text"
                                  value={editPriceValue}
                                  onChange={(e) => setEditPriceValue(e.target.value)}
                                  className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditPrice(rec)}
                                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                  title="Salvar preço"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRecordId(null)}
                                  className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-black text-slate-950 font-mono">
                                  R$ {rec.price.toFixed(2).replace('.', ',')}
                                </span>
                                {prod?.basePrice && prod.basePrice > 0 && (
                                  <span className="text-[10px] text-slate-400 font-mono line-through">
                                    R$ {prod.basePrice.toFixed(2).replace('.', ',')}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              {!isEditing && onUpdateRecord && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPrice(rec)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition cursor-pointer"
                                  title="Editar Preço"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {onDeleteRecord && (
                                recordToDelete === rec.id ? (
                                  <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl shadow-xs">
                                    <span className="text-[10px] font-bold text-rose-800">Excluir?</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onDeleteRecord(rec.id);
                                        setRecordToDelete(null);
                                        setSelectedRecordIds((prev) => {
                                          const next = new Set(prev);
                                          next.delete(rec.id);
                                          return next;
                                        });
                                      }}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-black transition cursor-pointer shadow-2xs"
                                      title="Confirmar exclusão deste registro"
                                    >
                                      Sim
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRecordToDelete(null)}
                                      className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition cursor-pointer"
                                      title="Cancelar"
                                    >
                                      Não
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setRecordToDelete(rec.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                    title="Excluir este registro"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          {cleanNotes && (
                            <p className="text-[10px] text-slate-500 italic mt-1 truncate">
                              "{cleanNotes}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Out of Stock Tab */
            <div>
              {filteredOutOfStock.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                  {outOfStockItems.length === 0
                    ? 'Nenhum produto foi marcado como ausente ou sem estoque nesta pesquisa.'
                    : 'Nenhum produto encontrado com os termos de busca.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredOutOfStock.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-white border border-rose-200 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <PackageX className="w-5 h-5 text-rose-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 leading-snug truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {item.brand} {item.weight && `• ${item.weight}`}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100/90 border border-rose-200 px-2 py-0.5 rounded-full shrink-0">
                        Sem Estoque no PDV
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-150 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium">
            Pesquisa realizada em <strong>{session.chainName} ({session.state})</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition cursor-pointer shadow-xs"
          >
            Fechar Detalhes
          </button>
        </div>

        {/* Delete Selected Confirmation Modal */}
        {showDeleteSelectedModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    Excluir {selectedRecordIds.size} {selectedRecordIds.size === 1 ? 'registro selecionado' : 'registros selecionados'}?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-150">
                Os registros de preço e fotos selecionados serão permanentemente removidos da auditoria desta pesquisa.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteSelectedModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer shadow-xs"
                >
                  Sim, Excluir ({selectedRecordIds.size})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete All Confirmation Modal */}
        {showDeleteAllModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    Excluir todos os {session.consolidatedRecords.length} registros?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pesquisa em {session.chainName} ({session.state})
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-200/80">
                Todos os registros consolidados de preços e evidências fotográficas desta pesquisa serão removidos permanentemente.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition cursor-pointer shadow-xs"
                >
                  Sim, Excluir Todos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
