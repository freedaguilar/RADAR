import React, { useState, useMemo, useEffect } from 'react';
import {
  ListOrdered,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Save,
  Check,
  AlertCircle,
  Sparkles,
  Info,
  Database,
  Cloud,
  Copy,
  Terminal,
  X,
  Target,
  ChevronRight,
  Filter,
  CheckCircle2,
  Loader2,
  MoveUp,
  MoveDown,
  GripVertical,
} from 'lucide-react';
import {
  Product,
  Chain,
  PriceRecord,
  User,
  GuidedCampaign,
  CustomTraditionalQueue,
  RESEARCH_STATES,
  getChainStates,
} from '../types';
import {
  computeDefaultTraditionalQueue,
  findCustomTraditionalQueue,
  CUSTOM_TRADITIONAL_QUEUES_SQL,
  isStateMatch,
} from '../lib/traditionalQueue';
import { supabase } from '../lib/supabase';
import { RetailerLogo } from './RetailerLogo';

interface TraditionalQueueSettingsProps {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  currentUser?: User | null;
  guidedCampaigns?: GuidedCampaign[];
  customTraditionalQueues?: CustomTraditionalQueue[];
  onSaveCustomQueue: (queue: CustomTraditionalQueue) => void;
  onResetCustomQueue: (chainId: string, state: string) => void;
}

export function TraditionalQueueSettings({
  products,
  chains,
  records,
  currentUser,
  guidedCampaigns = [],
  customTraditionalQueues = [],
  onSaveCustomQueue,
  onResetCustomQueue,
}: TraditionalQueueSettingsProps) {
  // Estado selecionado para configuração
  const [selectedChainId, setSelectedChainId] = useState<string>(() => {
    return chains.length > 0 ? chains[0].id : '';
  });

  const selectedChain = useMemo(() => {
    return chains.find((c) => c.id === selectedChainId) || chains[0] || null;
  }, [chains, selectedChainId]);

  const chainStates = useMemo(() => {
    if (!selectedChain) return ['Minas Gerais'];
    const s = getChainStates(selectedChain);
    return s.length > 0 ? s : ['Minas Gerais'];
  }, [selectedChain]);

  const [selectedState, setSelectedState] = useState<string>(() => {
    return chainStates[0] || 'Minas Gerais';
  });

  // Ajusta estado se a rede mudar e o estado não fizer parte dela
  useEffect(() => {
    if (chainStates.length > 0 && !chainStates.includes(selectedState)) {
      setSelectedState(chainStates[0]);
    }
  }, [chainStates, selectedState]);

  // Lista de produtos na fila editável atual (estado local antes de salvar)
  const [currentQueueProductIds, setCurrentQueueProductIds] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Estados de drag-and-drop da fila
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [dragOverProductId, setDragOverProductId] = useState<string | null>(null);

  // Busca se já existe uma fila customizada salva
  const savedCustomQueue = useMemo(() => {
    if (!selectedChainId) return null;
    return findCustomTraditionalQueue(selectedChainId, selectedState, customTraditionalQueues);
  }, [selectedChainId, selectedState, customTraditionalQueues]);

  // Fila calculada automaticamente pelo sistema com base nos registros
  const autoDefaultQueue = useMemo(() => {
    if (!selectedChainId) return [];
    return computeDefaultTraditionalQueue(
      products,
      chains,
      records,
      selectedChainId,
      selectedState
    );
  }, [products, chains, records, selectedChainId, selectedState]);

  // Carrega os IDs da fila atual quando a rede, estado ou customTraditionalQueues mudam
  useEffect(() => {
    if (savedCustomQueue && savedCustomQueue.productIds) {
      setCurrentQueueProductIds(savedCustomQueue.productIds);
    } else {
      setCurrentQueueProductIds(autoDefaultQueue.map((p) => p.id));
    }
    setHasUnsavedChanges(false);
    setSaveSuccessMsg(false);
  }, [selectedChainId, selectedState, savedCustomQueue, autoDefaultQueue]);

  // Filtros da busca de produtos para adicionar
  const [addSearchText, setAddSearchText] = useState('');
  const [addCategoryFilter, setAddCategoryFilter] = useState('Todas');
  const [addBrandFilter, setAddBrandFilter] = useState<'all' | 'oetker' | 'mavalerio' | 'competitor'>('all');

  // Filtro de texto para a fila atual
  const [queueSearchText, setQueueSearchText] = useState('');

  // Status do banco de dados para a tabela custom_traditional_queues
  const [dbStatus, setDbStatus] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  // Verifica se a tabela custom_traditional_queues existe no Supabase
  const checkDatabaseStatus = async () => {
    try {
      setDbStatus('checking');
      const { error } = await supabase.from('custom_traditional_queues').select('id').limit(1);
      if (error) {
        setDbStatus('missing');
      } else {
        setDbStatus('ready');
      }
    } catch {
      setDbStatus('missing');
    }
  };

  useEffect(() => {
    checkDatabaseStatus();
  }, []);

  const copySqlToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(CUSTOM_TRADITIONAL_QUEUES_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2500);
    } catch {
      setSqlCopied(false);
    }
  };

  // Contagem de registros por produto nesta rede e estado
  const productRecordStats = useMemo(() => {
    const stats: Record<string, number> = {};
    if (!selectedChainId) return stats;

    records.forEach((r) => {
      if (r.price <= 0) return;
      if (r.chainId === selectedChainId) {
        const recState = r.state || 'Minas Gerais';
        if (isStateMatch(recState, selectedState)) {
          stats[r.productId] = (stats[r.productId] || 0) + 1;
        }
      }
    });

    return stats;
  }, [records, selectedChainId, selectedState]);

  // Mapeamento dos produtos na fila atual
  const queueProducts = useMemo(() => {
    const prodMap = new Map<string, Product>();
    products.forEach((p) => prodMap.set(p.id, p));

    const list: Product[] = [];
    currentQueueProductIds.forEach((id) => {
      const p = prodMap.get(id);
      if (p) list.push(p);
    });

    return list;
  }, [products, currentQueueProductIds]);

  // Produtos filtrados na fila atual
  const filteredQueueProducts = useMemo(() => {
    if (!queueSearchText.trim()) return queueProducts;
    const q = queueSearchText.toLowerCase();
    return queueProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.internalCode && p.internalCode.toLowerCase().includes(q))
    );
  }, [queueProducts, queueSearchText]);

  // Categorias disponíveis no catálogo
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.filter((p) => p.active).forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Produtos do catálogo disponíveis para adicionar (que NÃO estão na fila atual)
  const availableToAddProducts = useMemo(() => {
    const inQueueSet = new Set(currentQueueProductIds);
    return products
      .filter((p) => p.active && !inQueueSet.has(p.id))
      .filter((p) => {
        if (addCategoryFilter !== 'Todas' && p.category !== addCategoryFilter) return false;
        if (addBrandFilter === 'oetker' && (p.isCompetitor || !p.brand?.toLowerCase().includes('oetker'))) return false;
        if (addBrandFilter === 'mavalerio' && (p.isCompetitor || !p.brand?.toLowerCase().includes('mavalerio'))) return false;
        if (addBrandFilter === 'competitor' && !p.isCompetitor) return false;
        if (addSearchText.trim()) {
          const q = addSearchText.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.category && p.category.toLowerCase().includes(q)) ||
            (p.internalCode && p.internalCode.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Prioriza produtos que já têm registros nesta rede
        const recA = productRecordStats[a.id] || 0;
        const recB = productRecordStats[b.id] || 0;
        if (recB !== recA) return recB - recA;
        return a.name.localeCompare(b.name);
      });
  }, [
    products,
    currentQueueProductIds,
    addCategoryFilter,
    addBrandFilter,
    addSearchText,
    productRecordStats,
  ]);

  // Verifica se há uma pesquisa guiada ativa para esta mesma rede e estado
  const activeGuidedCampaign = useMemo(() => {
    if (!guidedCampaigns || guidedCampaigns.length === 0 || !selectedChainId) return null;
    return guidedCampaigns.find((c) => {
      if (!c.active) return false;
      const cChain = c.chainId;
      if (cChain !== selectedChainId) return false;
      return isStateMatch(c.state, selectedState);
    });
  }, [guidedCampaigns, selectedChainId, selectedState]);

  // Handlers para manipular a ordem e itens da fila
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setCurrentQueueProductIds((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleMoveDown = (index: number) => {
    if (index >= currentQueueProductIds.length - 1) return;
    setCurrentQueueProductIds((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleMoveToTop = (index: number) => {
    if (index <= 0) return;
    setCurrentQueueProductIds((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleMoveToBottom = (index: number) => {
    if (index >= currentQueueProductIds.length - 1) return;
    setCurrentQueueProductIds((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.push(item);
      return next;
    });
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleReorderProducts = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setCurrentQueueProductIds((prev) => {
      const fromIndex = prev.indexOf(fromId);
      const toIndex = prev.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [movedItem] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedItem);
      return next;
    });
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleRemoveProduct = (productId: string) => {
    setCurrentQueueProductIds((prev) => prev.filter((id) => id !== productId));
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleAddProduct = (productId: string) => {
    if (currentQueueProductIds.includes(productId)) return;
    setCurrentQueueProductIds((prev) => [...prev, productId]);
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  const handleAddAllFiltered = () => {
    const toAdd = availableToAddProducts.map((p) => p.id);
    if (toAdd.length === 0) return;
    setCurrentQueueProductIds((prev) => [...prev, ...toAdd]);
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  // Restaurar fila padrão automática (baseada em registros)
  const handleResetToAutoDefault = () => {
    const defaultIds = autoDefaultQueue.map((p) => p.id);
    setCurrentQueueProductIds(defaultIds);
    setHasUnsavedChanges(true);
    setSaveSuccessMsg(false);
  };

  // Salvar a customização da fila
  const handleSave = () => {
    if (!selectedChainId) return;

    const queueId = `queue-${selectedChainId}-${selectedState.toLowerCase().replace(/\s+/g, '-')}`;
    const customQueue: CustomTraditionalQueue = {
      id: queueId,
      chainId: selectedChainId,
      state: selectedState,
      productIds: currentQueueProductIds,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Gestor',
    };

    onSaveCustomQueue(customQueue);
    setHasUnsavedChanges(false);
    setSaveSuccessMsg(true);

    setTimeout(() => {
      setSaveSuccessMsg(false);
    }, 4000);
  };

  // Remover a customização e voltar permanentemente ao padrão automático
  const handleClearCustomization = () => {
    if (window.confirm(`Deseja remover a personalização da fila de ${selectedChain?.name} (${selectedState}) e voltar à regra automática padrão?`)) {
      onResetCustomQueue(selectedChainId, selectedState);
      setCurrentQueueProductIds(autoDefaultQueue.map((p) => p.id));
      setHasUnsavedChanges(false);
      setSaveSuccessMsg(false);
    }
  };

  return (
    <div className="space-y-6" id="traditional-queue-settings-container">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden border border-slate-700">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-slate-200 text-xs font-mono font-bold uppercase tracking-wider mb-3 backdrop-blur-xs border border-white/10">
            <ListOrdered className="w-3.5 h-3.5 text-red-400" />
            <span>Gestão Operacional de Filas de Auditoria</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
            Ajuste da Fila Tradicional por Rede e Estado
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium leading-relaxed">
            Ajuste a ordem exata, remova itens (mesmo se já tiverem registros anteriores) ou adicione novos produtos do portfólio para compor a fila padrão da rede.
          </p>
        </div>
      </div>

      {/* Database Status Alert Banner */}
      {dbStatus === 'missing' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-amber-950 block">
                Tabela <code>custom_traditional_queues</code> não encontrada no Supabase
              </span>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                Suas personalizações estão gravadas em cache local. Para sincronizar em tempo real com todos os dispositivos e convidados, crie a tabela no Supabase.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={copySqlToClipboard}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{sqlCopied ? 'Copiado!' : 'Copiar SQL'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Ver SQL</span>
            </button>
          </div>
        </div>
      )}

      {dbStatus === 'ready' && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-950 font-medium shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-lg bg-emerald-600 text-white shrink-0">
              <Cloud className="w-3.5 h-3.5" />
            </div>
            <span className="truncate">
              <strong>Nuvem Ativa:</strong> Tabela <code>custom_traditional_queues</code> conectada. Filas sincronizadas instantaneamente com todos os usuários e convidados.
            </span>
          </div>
          <button
            type="button"
            onClick={checkDatabaseStatus}
            className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold underline shrink-0 ml-2 cursor-pointer"
          >
            Sincronizar
          </button>
        </div>
      )}

      {/* Selectors Bar: Rede & Estado */}
      <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Seleção de Rede */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              1. Selecionar Rede / Loja
            </label>
            <div className="relative">
              <select
                id="select-queue-chain"
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-bold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-[#D40511] transition-all cursor-pointer"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Seleção de Estado */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              2. Selecionar Estado ({chainStates.length} atendido{chainStates.length > 1 ? 's' : ''})
            </label>
            <div className="flex flex-wrap gap-2">
              {chainStates.map((st) => {
                const uf = RESEARCH_STATES.find((s) => s.name === st)?.uf || st.substring(0, 2).toUpperCase();
                const isSelected = selectedState === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedState(st)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#D40511] text-white shadow-xs'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                    }`}
                  >
                    <span className="font-mono text-[10px]">{uf}</span>
                    <span>{st}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Informação contextual sobre a fila desta rede e estado */}
        <div className="pt-3 border-t border-gray-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {selectedChain && <RetailerLogo chain={selectedChain} size="sm" />}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-gray-900">{selectedChain?.name}</span>
                <span className="text-gray-400">&bull;</span>
                <span className="text-gray-600 font-bold">{selectedState}</span>
                {savedCustomQueue ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Fila Personalizada Ativa
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                    <Info className="w-3 h-3 text-blue-600" />
                    Fila Automática (Histórico &ge; 1 registro)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {savedCustomQueue?.updatedAt
                  ? `Última personalização salva em ${new Date(savedCustomQueue.updatedAt).toLocaleDateString('pt-BR')} por ${savedCustomQueue.updatedBy || 'Gestor'}.`
                  : 'Fila padrão calculada automaticamente pelo sistema com base no histórico de registros na rede.'}
              </p>
            </div>
          </div>

          {/* Botões de Ação Principais da Fila */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {savedCustomQueue && (
              <button
                type="button"
                onClick={handleClearCustomization}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Excluir personalização e voltar ao padrão automático"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Voltar ao Padrão</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetToAutoDefault}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Carregar produtos da regra automática na lista de edição"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar Fila Padrão</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!hasUnsavedChanges}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-[#D40511] hover:bg-[#b0040e] active:scale-98 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>{hasUnsavedChanges ? 'Salvar Ajustes' : 'Salvo'}</span>
            </button>
          </div>
        </div>

        {/* Feedback visual de alteração não salva ou de sucesso */}
        {hasUnsavedChanges && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-bold flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Você possui alterações não salvas na ordem ou composição da fila desta rede.</span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
            >
              Salvar Agora
            </button>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Fila tradicional de {selectedChain?.name} ({selectedState}) salva com sucesso! Os pesquisadores e convidados seguirão esta ordem.</span>
          </div>
        )}

        {/* Alerta se houver Pesquisa Guiada ativa */}
        {activeGuidedCampaign && (
          <div className="p-3 bg-gradient-to-r from-amber-50 via-red-50/30 to-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
            <Target className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                Pesquisa Guiada Ativa no momento: "{activeGuidedCampaign.title}"
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Enquanto esta pesquisa guiada estiver ativada, ela terá prioridade exclusiva na câmera. Assim que for desativada pelo gestor, a fila tradicional personalizada abaixo entrará em vigor imediatamente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace: 2 Colunas (Fila Atual à esquerda, Adicionar do Portfólio à direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA: Fila de Produtos da Rede (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Header da Fila */}
          <div className="p-4 sm:p-5 border-b border-gray-150 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-gray-900">
                  Fila de Auditoria ({currentQueueProductIds.length} produtos)
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                  Ordem de Apresentação
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                Esta é a ordem exata em que os itens serão auditados no modo de câmera sequencial. Arraste os produtos ou use as setas para reordenar a fila.
              </p>
            </div>

            {/* Input de filtro dentro da fila */}
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar na fila..."
                value={queueSearchText}
                onChange={(e) => setQueueSearchText(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-250 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Lista de Itens na Fila */}
          <div className="flex-1 p-3 sm:p-4 overflow-y-auto max-h-[620px] space-y-2">
            {filteredQueueProducts.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-250 space-y-2">
                <ListOrdered className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-xs font-bold text-gray-700">Nenhum produto nesta fila</p>
                <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
                  {queueSearchText
                    ? 'Nenhum item corresponde ao filtro digitado.'
                    : 'Adicione produtos do painel ao lado ou clique em "Restaurar Fila Padrão".'}
                </p>
              </div>
            ) : (
              filteredQueueProducts.map((product) => {
                const realIndex = currentQueueProductIds.indexOf(product.id);
                const recCount = productRecordStats[product.id] || 0;
                const isFirst = realIndex === 0;
                const isLast = realIndex === currentQueueProductIds.length - 1;
                const isDragging = draggedProductId === product.id;
                const isDragOver = dragOverProductId === product.id;

                return (
                  <div
                    key={product.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedProductId(product.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', product.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverProductId !== product.id) {
                        setDragOverProductId(product.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverProductId === product.id) {
                        setDragOverProductId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedProductId && draggedProductId !== product.id) {
                        handleReorderProducts(draggedProductId, product.id);
                      }
                      setDraggedProductId(null);
                      setDragOverProductId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedProductId(null);
                      setDragOverProductId(null);
                    }}
                    className={`p-3 bg-white rounded-xl transition-all flex items-center gap-2.5 sm:gap-3 group select-none cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? 'opacity-40 scale-[0.98] border-2 border-dashed border-[#D40511] bg-red-50/40 shadow-inner'
                        : isDragOver
                        ? 'border-2 border-[#D40511] bg-red-50/20 shadow-md ring-2 ring-red-400/20'
                        : 'border border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                    }`}
                  >
                    {/* Grip Handle para arrastar */}
                    <div
                      className="text-gray-300 group-hover:text-gray-600 hover:text-gray-900 p-1 rounded transition shrink-0"
                      title="Arraste para reposicionar este produto na fila"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Posição na fila (#1, #2, etc.) */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-mono font-black text-xs flex items-center justify-center shrink-0">
                      {realIndex + 1}
                    </div>

                    {/* Imagem do Produto */}
                    <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-150 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-contain pointer-events-none"
                          draggable={false}
                        />
                      ) : (
                        <div className="text-[9px] font-bold text-gray-400 uppercase select-none">Sem foto</div>
                      )}
                    </div>

                    {/* Informações do Produto */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-gray-900 truncate max-w-[240px] sm:max-w-xs" title={product.name}>
                          {product.name}
                        </span>
                        {product.weight && (
                          <span className="text-[10px] text-gray-500 font-medium font-mono">
                            ({product.weight})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            product.isCompetitor
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {product.brand || (product.isCompetitor ? 'Concorrente' : 'Dr. Oetker')}
                        </span>

                        {product.category && (
                          <span className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded truncate max-w-[120px]">
                            {product.category}
                          </span>
                        )}

                        {recCount > 0 ? (
                          <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            {recCount} registro{recCount > 1 ? 's' : ''} nesta rede
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.2 rounded border border-gray-200">
                            Sem histórico
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controles de Reordenação e Remoção */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onDragStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {/* Botões Mover para Topo / Mover para Fim (visíveis no hover) */}
                      <button
                        type="button"
                        onClick={() => handleMoveToTop(realIndex)}
                        disabled={isFirst}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-20 cursor-pointer hidden sm:inline-flex"
                        title="Mover para o topo da fila"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>

                      {/* Botão Subir */}
                      <button
                        type="button"
                        onClick={() => handleMoveUp(realIndex)}
                        disabled={isFirst}
                        className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg disabled:opacity-20 transition cursor-pointer"
                        title="Subir uma posição"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      {/* Botão Descer */}
                      <button
                        type="button"
                        onClick={() => handleMoveDown(realIndex)}
                        disabled={isLast}
                        className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg disabled:opacity-20 transition cursor-pointer"
                        title="Descer uma posição"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMoveToBottom(realIndex)}
                        disabled={isLast}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-20 cursor-pointer hidden sm:inline-flex"
                        title="Mover para o fim da fila"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Botão Remover da Fila */}
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(product.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition ml-1 cursor-pointer"
                        title="Remover produto da fila"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: Adicionar Produtos do Portfólio (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Header Adicionar */}
          <div className="p-4 sm:p-5 border-b border-gray-150 bg-gray-50/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-black text-gray-900">
                  Adicionar Produtos à Fila
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  {availableToAddProducts.length} produtos disponíveis fora da fila.
                </p>
              </div>

              {availableToAddProducts.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddAllFiltered}
                  className="text-[10px] font-bold text-[#D40511] hover:underline cursor-pointer"
                  title="Adicionar todos os itens filtrados à fila"
                >
                  + Adicionar Todos
                </button>
              )}
            </div>

            {/* Input de Busca */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome, marca ou EAN..."
                value={addSearchText}
                onChange={(e) => setAddSearchText(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-250 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            {/* Filtros de Marca e Categoria */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
              <button
                type="button"
                onClick={() => setAddBrandFilter('all')}
                className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  addBrandFilter === 'all'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-200/80 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Todas Marcas
              </button>
              <button
                type="button"
                onClick={() => setAddBrandFilter('oetker')}
                className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  addBrandFilter === 'oetker'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200/80 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Dr. Oetker
              </button>
              <button
                type="button"
                onClick={() => setAddBrandFilter('mavalerio')}
                className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  addBrandFilter === 'mavalerio'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200/80 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Mavalério
              </button>
              <button
                type="button"
                onClick={() => setAddBrandFilter('competitor')}
                className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                  addBrandFilter === 'competitor'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-200/80 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Concorrentes
              </button>
            </div>
          </div>

          {/* Lista de Produtos para Adicionar */}
          <div className="flex-1 p-3 overflow-y-auto max-h-[620px] space-y-2">
            {availableToAddProducts.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-250 space-y-1">
                <Check className="w-6 h-6 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-gray-700">Todos os produtos já estão na fila</p>
                <p className="text-[11px] text-gray-500">
                  Não há outros produtos ativos correspondentes aos filtros.
                </p>
              </div>
            ) : (
              availableToAddProducts.map((product) => {
                const recCount = productRecordStats[product.id] || 0;

                return (
                  <div
                    key={product.id}
                    className="p-2.5 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-2xs transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-150 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-[8px] font-bold text-gray-400">Sem foto</div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate" title={product.name}>
                          {product.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                              product.isCompetitor
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {product.brand || (product.isCompetitor ? 'Concorrente' : 'Dr. Oetker')}
                          </span>
                          {recCount > 0 && (
                            <span className="text-[8px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                              {recCount} reg.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddProduct(product.id)}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-[#D40511] hover:text-white text-gray-800 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                      title="Adicionar produto ao final da fila"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal Script SQL Supabase */}
      {showSqlModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowSqlModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-4 border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-150 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">Script SQL Supabase</h3>
                  <p className="text-[11px] text-gray-500 font-mono">Tabela custom_traditional_queues</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Execute este comando no <strong>SQL Editor</strong> do painel do seu Supabase para sincronizar as filas tradicionais customizadas na nuvem em tempo real:
            </p>

            <div className="relative">
              <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                {CUSTOM_TRADITIONAL_QUEUES_SQL}
              </pre>
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="absolute top-2 right-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 backdrop-blur-xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{sqlCopied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={copySqlToClipboard}
                className="px-4 py-2 bg-[#D40511] hover:bg-[#b0040e] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{sqlCopied ? 'Copiado!' : 'Copiar Script'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
