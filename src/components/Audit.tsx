import { useState, useMemo } from 'react';
import { Search, Filter, Calendar, MapPin, User, Tag, Sparkles, Trash2, ExternalLink, RefreshCw, AlertTriangle, Check, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { PriceRecord, Product, Chain } from '../types';
import { parsePriceRecordMeta, searchAndRankProducts } from '../lib/textUtils';

interface AuditProps {
  records: PriceRecord[];
  products: Product[];
  chains: Chain[];
  initialSelectedRecordId?: string | null;
  onDeleteRecord?: (recordId: string) => void;
  onUpdateRecord?: (record: PriceRecord) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export function Audit({ 
  records, 
  products, 
  chains, 
  initialSelectedRecordId, 
  onDeleteRecord, 
  onUpdateRecord,
  onNavigate 
}: AuditProps) {
  // Filter states for audited records
  const [selectedProductId, setSelectedProductId] = useState('Todos');
  const [selectedChainId, setSelectedChainId] = useState('Todas');
  const [searchNotes, setSearchNotes] = useState('');
  const [filterPeriodDays, setFilterPeriodDays] = useState('30'); // '7' | '15' | '30' | 'Todas'

  // Lightbox view state for audited records
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initialSelectedRecordId || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pending confirmation dialog state
  const [pendingRecordToConfirm, setPendingRecordToConfirm] = useState<PriceRecord | null>(null);
  const [pendingSearchQuery, setPendingSearchQuery] = useState('');
  const [selectedProductForPending, setSelectedProductForPending] = useState<Product | null>(null);
  const [pendingPrice, setPendingPrice] = useState('');
  const [pendingNotes, setPendingNotes] = useState('');
  const [pendingChainId, setPendingChainId] = useState('');
  const [showPendingDeleteConfirm, setShowPendingDeleteConfirm] = useState(false);

  const handleCloseLightbox = () => {
    setSelectedRecordId(null);
    setShowDeleteConfirm(false);
  };

  const activeRecordForLightbox = useMemo(() => {
    if (!selectedRecordId) return null;
    const rec = records.find((r) => r.id === selectedRecordId);
    if (!rec) return null;
    return {
      ...rec,
      product: products.find((p) => p.id === rec.productId),
      chain: chains.find((c) => c.id === rec.chainId),
    };
  }, [records, selectedRecordId, products, chains]);

  // Formatted date helper (PT-BR)
  const formatDateBR = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Split into pending vs. audited
  const pendingRecords = useMemo(() => {
    return records.filter((rec) => {
      const { isPending } = parsePriceRecordMeta(rec.notes);
      return !rec.productId || isPending;
    });
  }, [records]);

  const auditedRecords = useMemo(() => {
    return records.filter((rec) => {
      const { isPending } = parsePriceRecordMeta(rec.notes);
      return rec.productId && !isPending;
    });
  }, [records]);

  // Filter audited records based on options
  const filteredAuditRecords = useMemo(() => {
    return auditedRecords
      .filter((rec) => {
        const matchesProduct = selectedProductId === 'Todos' || rec.productId === selectedProductId;
        const matchesChain = selectedChainId === 'Todas' || rec.chainId === selectedChainId;
        
        // Notes or submitter email/name filter search
        const matchesSearch = !searchNotes || 
          rec.userName.toLowerCase().includes(searchNotes.toLowerCase()) || 
          (rec.notes && rec.notes.toLowerCase().includes(searchNotes.toLowerCase()));
 
        // Period filter based on days
        let matchesPeriod = true;
        if (filterPeriodDays !== 'Todas') {
          const limitDays = parseInt(filterPeriodDays);
          const limitDate = new Date();
          limitDate.setDate(limitDate.getDate() - limitDays);
          
          const recordDate = new Date(rec.date);
          matchesPeriod = recordDate >= limitDate;
        }
 
        return matchesProduct && matchesChain && matchesSearch && matchesPeriod;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      }); // descending by date & insertion/ID order
  }, [auditedRecords, selectedProductId, selectedChainId, searchNotes, filterPeriodDays]);

  // Handler to open pending confirmation modal
  const handleOpenPendingConfirm = (rec: PriceRecord) => {
    const meta = parsePriceRecordMeta(rec.notes);
    setPendingRecordToConfirm(rec);
    setPendingSearchQuery(meta.aiProductSuggested);
    
    // Attempt to automatically pre-select matched product
    const activeProducts = products.filter(p => p.active);
    const fuzzyMatches = searchAndRankProducts(activeProducts, meta.aiProductSuggested);
    
    // If exact name matches or very unique fuzzy matches, preselect
    const exact = activeProducts.find(p => p.name.toLowerCase().trim() === meta.aiProductSuggested.toLowerCase().trim());
    if (exact) {
      setSelectedProductForPending(exact);
    } else if (fuzzyMatches.length === 1 && meta.aiProductSuggested.trim().length > 3) {
      setSelectedProductForPending(fuzzyMatches[0]);
    } else {
      setSelectedProductForPending(null);
    }
    
    setPendingPrice(meta.aiPriceSuggested > 0 ? meta.aiPriceSuggested.toString().replace('.', ',') : '');
    setPendingNotes(meta.originalNotes);
    setPendingChainId(rec.chainId);
    setShowPendingDeleteConfirm(false);
  };

  // Compute fuzzy match list inside modal
  const pendingFilteredProducts = useMemo(() => {
    const activeProducts = products.filter(p => p.active);
    if (!pendingSearchQuery) return activeProducts.slice(0, 5);
    return searchAndRankProducts(activeProducts, pendingSearchQuery);
  }, [products, pendingSearchQuery]);

  return (
    <div className="space-y-8" id="audit-gallery-view">
      {/* Gallery Header */}
      <div className="border-b border-[#E0E0E0] pb-6" id="audit-gallery-header">
        <span className="text-xs font-semibold tracking-wider text-[#D40511] uppercase font-mono">
          Controle de Qualidade em Campo
        </span>
        <h1 className="text-3xl font-black text-[#1A1A1A] font-sans">
          Painel de Auditoria Geral
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie status de auditoria em lote, valide leituras provisórias de IA e catalogue evidências fotográficas de campo.
        </p>
      </div>

      {/* 1. SEÇÃO PENDENTE DE ANÁLISE */}
      {pendingRecords.length > 0 && (
        <div className="bg-amber-50/20 border border-amber-200/85 p-6 rounded-3xl space-y-4" id="pending-audits-section">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <h2 className="text-sm font-extrabold text-amber-900 uppercase tracking-widest font-sans">
              Pendentes de Análise ({pendingRecords.length})
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {pendingRecords.map((rec) => {
              const chain = chains.find((c) => c.id === rec.chainId);
              const { aiProductSuggested, aiPriceSuggested } = parsePriceRecordMeta(rec.notes);

              return (
                <div
                  id={`pending-card-${rec.id}`}
                  key={rec.id}
                  onClick={() => handleOpenPendingConfirm(rec)}
                  className="bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md rounded-2xl overflow-hidden p-3.5 flex flex-col justify-between transition-all cursor-pointer relative group"
                >
                  <div className="aspect-video bg-slate-100 overflow-hidden relative rounded-xl border border-slate-50">
                    <img
                      src={rec.imageUrl}
                      alt="Provisional evidence card"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                    />
                    <div className="absolute top-2.5 left-2.5 bg-amber-500 text-white font-extrabold text-[8px] px-2 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase tracking-wider">
                      <Sparkles className="w-2.5 h-2.5 shrink-0 animate-pulse" />
                      Aguardando Confirmação
                    </div>
                  </div>

                  <div className="mt-3 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] bg-amber-100/65 text-amber-800 font-extrabold px-1.5 py-0.5 rounded truncate max-w-[130px]" title={chain?.name}>
                          {chain ? chain.name : 'Rede Indefinida'}
                        </span>
                        <span className="text-[9px] text-gray-400 font-mono shrink-0">
                          {formatDateBR(rec.date)}
                        </span>
                      </div>

                      {aiProductSuggested ? (
                        <div className="mt-2.5 p-2 bg-amber-50/40 border border-amber-100/80 rounded-xl text-[10px] text-amber-850 font-sans leading-relaxed">
                          <p className="font-extrabold uppercase text-[8px] flex items-center gap-1 text-amber-600 mb-1">
                            <Sparkles className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                            Previsão Provisória da IA:
                          </p>
                          <p className="font-bold line-clamp-1 truncate text-slate-800 leading-snug">{aiProductSuggested}</p>
                          <p className="font-extrabold font-mono text-[#D40511] mt-1 text-[11px]">R$ {aiPriceSuggested ? Number(aiPriceSuggested).toFixed(2) : '0,00'}</p>
                        </div>
                      ) : (
                        <div className="mt-2.5 p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 font-sans leading-relaxed">
                          <p className="font-extrabold text-[8px] text-slate-400 uppercase tracking-wide mb-1">Análise Manual Exigida</p>
                          <p className="text-[9px] text-slate-400 font-medium">A IA não pôde sugerir um produto nesta foto. Clique para vincular manualmente.</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-amber-100/50 flex items-center justify-between text-[9px] text-slate-400 font-sans">
                      <span className="truncate max-w-[110px]" title={rec.userName}>
                        Por: {rec.userName}
                      </span>
                      <span className="text-[#D40511] font-extrabold hover:underline inline-flex items-center gap-0.5 uppercase tracking-wider text-[8px]">
                        Resolver &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. SEÇÃO DE REGISTROS AUDITADOS / CONFIRMADOS */}
      <div className="space-y-6" id="audited-logs-section">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest leading-none font-sans flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            Registros Consolidados & Auditados
          </h2>
          <span className="text-xs text-slate-400 font-mono font-semibold">Total: {auditedRecords.length}</span>
        </div>

        {/* Advanced Filters */}
        <div className="bg-white p-4 rounded-xl border border-[#E0E0E0] shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" id="audit-filters-grid">
          {/* Filter Product */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Filtrar por Produto</label>
            <select
              id="audit-product-filter"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511] font-sans"
            >
              <option value="Todos">Todos os Produtos</option>
              {products.map((prod) => (
                <option key={prod.id} value={prod.id}>{prod.name}</option>
              ))}
            </select>
          </div>

          {/* Filter Chain */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Filtrar por Rede</label>
            <select
              id="audit-chain-filter"
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511] font-sans"
            >
              <option value="Todas">Todas as Redes/Bandeiras</option>
              {chains.map((chain) => (
                <option key={chain.id} value={chain.id}>{chain.name}</option>
              ))}
            </select>
          </div>

          {/* Period selection */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Período de Envio</label>
            <select
              id="audit-period-filter"
              value={filterPeriodDays}
              onChange={(e) => setFilterPeriodDays(e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511] font-sans"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="15">Últimos 15 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="Todas">Todo o histórico</option>
            </select>
          </div>

          {/* Search Observations text input */}
          <div className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Buscar por Observador/Notas</label>
            <input
              id="audit-text-search"
              type="text"
              placeholder="Ex: Carla Souza, Promo..."
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
              className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511] font-sans"
            />
          </div>
        </div>

        {/* Gallery Photo Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="audit-gallery-results">
          {filteredAuditRecords.map((rec) => {
            const product = products.find((p) => p.id === rec.productId);
            const chain = chains.find((c) => c.id === rec.chainId);

            return (
              <div
                id={`audit-photo-card-${rec.id}`}
                key={rec.id}
                onClick={() => setSelectedRecordId(rec.id)}
                className="bg-white rounded-2xl border border-[#E0E0E0] hover:border-[#D40511] overflow-hidden shadow-2xs hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
              >
                {/* Image box */}
                <div className="aspect-video bg-gray-100 overflow-hidden relative">
                  <img
                    src={rec.imageUrl}
                    alt={product?.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-102 transition-transform"
                  />
                  
                  {/* Embedded quick price label and chain badge */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="bg-[#1A1A1A] text-white font-mono text-[10px] font-black px-2 py-0.5 rounded shadow">
                      R$ {rec.price.toFixed(2)}
                    </span>
                    <span className="text-[8px] bg-red-100/90 text-[#D40511] font-bold px-1.5 py-0.5 rounded shadow">
                      {chain?.name.split(' ')[0]}
                    </span>
                  </div>
                </div>

                {/* Text Meta Container */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {product?.imageUrl && (
                        <img src={product.imageUrl} alt={product.name} className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 shrink-0" />
                      )}
                      <h4 
                        className="text-xs font-bold text-[#1A1A1A] line-clamp-1 leading-normal font-sans hover:text-[#D40511] cursor-pointer" 
                        title={product?.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('produtos', { action: 'detail', productId: rec.productId });
                        }}
                      >
                        {product ? product.name : 'Produto Indisponível'} {product?.weight ? `(${product.weight})` : ''}
                      </h4>
                    </div>
                    <p className="text-[10px] text-gray-500 font-sans truncate mt-1">
                      Rede: {chain ? chain.name : 'Indefinida'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between text-[9px] text-gray-400 font-sans">
                    <span className="truncate max-w-[100px] inline-flex items-center gap-0.5" title={rec.userName}>
                      <User className="w-2.5 h-2.5 shrink-0" /> {rec.userName}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5 shrink-0" /> {formatDateBR(rec.date)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAuditRecords.length === 0 && (
            <div className="col-span-full py-16 bg-white border border-[#E0E0E0] rounded-2xl text-center" id="empty-audits-view">
              <p className="text-gray-400 italic font-sans text-sm">Nenhuma foto de auditoria atende aos critérios informados.</p>
              <button
                onClick={() => { setSelectedProductId('Todos'); setSelectedChainId('Todas'); setSearchNotes(''); setFilterPeriodDays('Todas'); }}
                className="mt-3 text-xs text-[#D40511] font-bold hover:underline"
              >
                Resetar filtros de pesquisa
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. CONFIRMAR REGISTRO PENDENTE MODEL DIALOG BOX */}
      {pendingRecordToConfirm && (
        <div
          id="pending-confirm-backdrop"
          onClick={() => setPendingRecordToConfirm(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer overflow-y-auto"
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full border border-gray-100 overflow-hidden shadow-2xl relative cursor-default my-8"
            onClick={(e) => e.stopPropagation()}
            id="pending-confirm-card"
          >
            {/* Header banner */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-500 text-white p-2 rounded-xl">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-md font-extrabold text-amber-950 font-sans uppercase tracking-wider">
                    Confirmar Análise Provisória
                  </h2>
                  <p className="text-[10px] text-amber-800 mt-0.5 font-sans font-medium">
                    Vincule a foto ao produto correspondente e consolide o preço coletado.
                  </p>
                </div>
              </div>
              <button
                id="close-pending-confirm-btn"
                onClick={() => setPendingRecordToConfirm(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2" id="pending-split-view">
              {/* Image side content */}
              <div className="bg-slate-50 p-6 border-r border-slate-100 flex flex-col justify-center items-center min-h-[300px]">
                <div className="relative rounded-2xl overflow-hidden shadow-sm max-w-full bg-black max-h-[380px]">
                  <img
                    src={pendingRecordToConfirm.imageUrl}
                    alt="Evidência provisória"
                    referrerPolicy="no-referrer"
                    className="max-h-[360px] object-contain mx-auto"
                  />
                </div>
                <div className="mt-4 text-center">
                  <span className="text-[9px] text-gray-400 font-mono font-semibold block">
                    Por: {pendingRecordToConfirm.userName} ({pendingRecordToConfirm.userEmail})
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans font-bold flex items-center justify-center gap-1 mt-1 justify-center">
                    <Calendar className="w-3.5 h-3.5" /> Coletado em: {formatDateBR(pendingRecordToConfirm.date)}
                  </span>
                </div>
              </div>

              {/* Form details input side */}
              <div className="p-6 space-y-4 flex flex-col justify-between" id="pending-form-side">
                <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                  
                  {/* Select Chain (Network) */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#D40511] mb-1.5 font-sans">
                      1. Rede / PDV de Auditoria *
                    </label>
                    <select
                      value={pendingChainId}
                      onChange={(e) => setPendingChainId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans font-extrabold text-slate-700 h-9"
                    >
                      {chains.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* ADVANCED PRODUCT AUTOCOMPLETE SEARCH */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between font-sans">
                      <span>2. Vincular Produto do Catálogo *</span>
                      {selectedProductForPending && (
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-sans">
                          <Check className="w-3 h-3" /> Vinculado
                        </span>
                      )}
                    </label>

                    {selectedProductForPending ? (
                      <div className="p-3 bg-emerald-50/45 border border-emerald-100 rounded-2xl flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectedProductForPending.imageUrl && (
                            <img
                              src={selectedProductForPending.imageUrl}
                              alt={selectedProductForPending.name}
                              className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-100 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-[11px] font-extrabold text-slate-800 font-sans leading-snug truncate">
                              {selectedProductForPending.name}
                            </p>
                            <p className="text-[9px] text-slate-450 font-medium">
                              {selectedProductForPending.category} / {selectedProductForPending.brand || 'Sem marca'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForPending(null);
                            setPendingSearchQuery('');
                          }}
                          className="px-2.5 py-1 text-slate-400 hover:text-red-600 rounded-lg bg-white border border-slate-200 hover:border-red-100 text-[9px] font-extrabold cursor-pointer h-7"
                        >
                          Alterar
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Busque pelo nome, marca ou categoria..."
                            value={pendingSearchQuery}
                            onChange={(e) => setPendingSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans font-bold text-slate-700 placeholder-slate-450 focus:outline-none focus:bg-white h-9"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.8" />
                        </div>

                        {/* Autocomplete selection dropdown */}
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-lg z-50 max-h-44 overflow-y-auto">
                          {pendingFilteredProducts.length > 0 ? (
                            pendingFilteredProducts.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setSelectedProductForPending(p);
                                  setPendingSearchQuery(p.name);
                                }}
                                className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-none cursor-pointer"
                              >
                                <span>{p.name} {p.weight ? `(${p.weight})` : ''}</span>
                                <span className="text-[8px] bg-slate-100 text-slate-500 font-mono px-1 rounded uppercase tracking-wider">{p.category}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-[10px] text-gray-400 italic text-center font-sans">
                              Nenhum produto correspondente cadastrado.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirmed Price */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#D40511] mb-1.5 font-sans">
                      3. Confirmar Preço do Produto *
                    </label>
                    <div className="relative rounded-lg h-9">
                      <span className="absolute left-3 top-2 px-1 text-[10px] font-extrabold text-[#D40511] font-sans">R$</span>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={pendingPrice}
                        onChange={(e) => setPendingPrice(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-[#D40511] focus:outline-none focus:bg-white focus:border-[#D40511] h-9 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Technical observations notes edit */}
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5 font-sans">
                      4. Observações de Auditoria <span className="text-slate-400 font-medium lowercase">(opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Identificou promoção ou avaria?"
                      value={pendingNotes}
                      onChange={(e) => setPendingNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans font-medium text-slate-700 focus:outline-none h-9 placeholder-slate-400"
                    />
                  </div>

                </div>

                {/* Confirmations and action footer buttons inside modal */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-white text-[10px]">
                  <button
                    type="button"
                    onClick={() => setShowPendingDeleteConfirm(true)}
                    className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Descartar Foto
                  </button>

                  <button
                    type="button"
                    disabled={!selectedProductForPending || !pendingPrice}
                    onClick={() => {
                      const cleanPrice = pendingPrice.replace(',', '.');
                      const priceNum = parseFloat(cleanPrice) || 0;
                      
                      const updatedRecord: PriceRecord = {
                        ...pendingRecordToConfirm,
                        productId: selectedProductForPending!.id,
                        chainId: pendingChainId,
                        price: priceNum,
                        notes: pendingNotes || '', // Clears the metadata so it gets marked as audited
                      };
                      onUpdateRecord?.(updatedRecord);
                      setPendingRecordToConfirm(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-extrabold disabled:bg-slate-350 disabled:cursor-not-allowed transition uppercase shadow-sm flex items-center gap-1.5 cursor-pointer font-sans"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                    Confirmar & Auditoria OK
                  </button>

                  {showPendingDeleteConfirm && (
                    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
                      <AlertTriangle className="w-8 h-8 text-[#D40511] mb-2 animate-bounce" />
                      <p className="text-xs font-extrabold text-slate-800 max-w-xs leading-normal font-sans">
                        Deseja realmente descartar e apagar permanentemente esta imagem de auditoria ? Essa decolagem será removida do histórico do sistema.
                      </p>
                      <div className="flex gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteRecord?.(pendingRecordToConfirm.id);
                            setPendingRecordToConfirm(null);
                          }}
                          className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-sm cursor-pointer"
                        >
                          Sim, descartar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPendingDeleteConfirm(false)}
                          className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-xs border border-slate-200 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT FULLSCREEN DETAIL LIGHTBOX MODAL */}
      {activeRecordForLightbox && (
        <div
          id="audit-lightbox-backdrop"
          onClick={() => setSelectedRecordId(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 overflow-hidden shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
            id="audit-lightbox-card"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E0E0E0] flex justify-between items-center bg-[#F5F5F5]">
              <div>
                <span className="text-[10px] font-bold text-[#D40511] bg-red-100 rounded px-2 py-0.5 uppercase tracking-wider font-sans">
                  Comprovante Válido - Auditoria
                </span>
                <h3 
                  onClick={() => {
                    handleCloseLightbox();
                    onNavigate?.('produtos', { action: 'detail', productId: activeRecordForLightbox.productId });
                  }}
                  className="text-xs font-bold text-[#1A1A1A] mt-1 pr-6 font-sans hover:text-[#D40511] cursor-pointer flex items-center gap-1"
                >
                  {activeRecordForLightbox.product?.imageUrl && (
                    <img src={activeRecordForLightbox.product.imageUrl} alt={activeRecordForLightbox.product.name} className="w-6 h-6 rounded object-contain bg-white border border-gray-100 shrink-0" />
                  )}
                  {activeRecordForLightbox.product?.name}
                  <ExternalLink className="w-3 h-3" />
                </h3>
              </div>
              <button
                id="close-lightbox-btn"
                onClick={() => setSelectedRecordId(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-1 absolute top-3 right-4 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Split Image and Details layout */}
            <div className="grid grid-cols-1 md:grid-cols-2" id="lightbox-split">
              {/* Photo View column */}
              <div className="bg-gray-100 flex items-center justify-center p-2 min-h-[250px] max-h-[400px] overflow-hidden">
                <img
                  src={activeRecordForLightbox.imageUrl}
                  alt={activeRecordForLightbox.product?.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[350px] object-contain w-full rounded shadow-sm"
                />
              </div>

              {/* Detailed information lists and observations column */}
              <div className="p-6 space-y-4 flex flex-col justify-between" id="lightbox-details-col">
                <div className="space-y-4">
                  <div>
                    <span className="block text-[10px] uppercase text-gray-400 font-bold tracking-wider">Valor Coletado</span>
                    <p className="text-3xl font-black text-[#D40511] font-mono leading-tight">
                      R$ {activeRecordForLightbox.price.toFixed(2)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                    <div>
                      <span className="block text-[9px] uppercase text-gray-400 font-bold font-sans">Ponto de Venda</span>
                      <span className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5 font-sans truncate" title={activeRecordForLightbox.chain?.name}>
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {activeRecordForLightbox.chain?.name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase text-gray-400 font-bold font-sans">Data & Hora</span>
                      <span className="font-medium text-gray-500 block mt-0.5 font-mono">
                        {formatDateBR(activeRecordForLightbox.date)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] uppercase text-gray-400 font-bold font-sans">Auditor do Campo</span>
                      <span className="font-medium text-gray-600 block mt-0.5 font-sans truncate">
                        {activeRecordForLightbox.userName} ({activeRecordForLightbox.userEmail})
                      </span>
                    </div>
                  </div>

                  {activeRecordForLightbox.notes && (
                    <div className="bg-[#F5F5F5] p-3 rounded-lg border border-[#E0E0E0]" id="lightbox-notes-box">
                      <span className="block text-[9px] uppercase text-gray-400 font-bold mb-1">Notas do Observador</span>
                      <p className="text-xs text-gray-700 italic font-sans leading-relaxed">
                        "{activeRecordForLightbox.notes}"
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#E0E0E0] flex items-center justify-between text-[10px] text-gray-400 bg-white font-sans">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 text-[10px] text-[#D40511] font-extrabold uppercase tracking-wide cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir Registro
                  </button>
                  {showDeleteConfirm && (
                    <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
                      <p className="text-sm font-bold text-gray-850 font-sans">Deseja realmente excluir este registro?</p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => {
                              onDeleteRecord?.(activeRecordForLightbox.id);
                              handleCloseLightbox();
                          }}
                          className="bg-[#D40511] text-white px-4 py-2 rounded-lg font-extrabold text-xs cursor-pointer shadow-xs"
                        >
                          Sim, excluir
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-bold text-xs cursor-pointer border border-slate-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase font-sans">
                    Comprimida OK
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
