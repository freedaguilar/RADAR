import { useState, useMemo } from 'react';
import { Search, Filter, Calendar, MapPin, User, Tag, Sparkles, Trash2, ExternalLink } from 'lucide-react';
import { PriceRecord, Product, Chain } from '../types';

interface AuditProps {
  records: PriceRecord[];
  products: Product[];
  chains: Chain[];
  initialSelectedRecordId?: string | null;
  onDeleteRecord?: (recordId: string) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export function Audit({ records, products, chains, initialSelectedRecordId, onDeleteRecord, onNavigate }: AuditProps) {
  // Filter states
  const [selectedProductId, setSelectedProductId] = useState('Todos');
  const [selectedChainId, setSelectedChainId] = useState('Todas');
  const [searchNotes, setSearchNotes] = useState('');
  const [filterPeriodDays, setFilterPeriodDays] = useState('30'); // '7' | '15' | '30' | 'Todas'

  // Lightbox view state
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initialSelectedRecordId || null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  // Filter audit records based on options
  const filteredAuditRecords = useMemo(() => {
    return records
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
  }, [records, selectedProductId, selectedChainId, searchNotes, filterPeriodDays]);

  return (
    <div className="space-y-6" id="audit-gallery-view">
      {/* Gallery Header */}
      <div className="border-b border-[#E0E0E0] pb-6" id="audit-gallery-header">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase font-mono">
          Controle de Qualidade em Campo
        </span>
        <h1 className="text-3xl font-black text-[#1A1A1A] font-sans">
          Painel de Auditoria Geral
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Galeria probatória de comprovantes de gôndole e preços. Clique nas miniaturas para detalhes completos.
        </p>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white p-4 rounded-xl border border-[#E0E0E0] shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" id="audit-filters-grid">
        {/* Filter Product */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Filtrar por Produto</label>
          <select
            id="audit-product-filter"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
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
            className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
          >
            <option value="Todas font-sans">Todas as Redes/Bandeiras</option>
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
            className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
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
            className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#D40511]"
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
              className="bg-white rounded-2xl border border-[#E0E0E0] hover:border-[#D40511] overflow-hidden shadow-sm hover:shadow transition-all group cursor-pointer flex flex-col justify-between"
            >
              {/* Image box */}
              <div className="aspect-video bg-gray-100 overflow-hidden relative">
                <img
                  src={rec.imageUrl}
                  alt={product?.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform"
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
                    <img src={product.imageUrl} alt={product.name} className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100" />
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
                  <p className="text-[10px] text-gray-500 font-sans truncate">
                    Rede: {chain ? chain.name : 'Indefinida'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between text-[9px] text-gray-400 font-sans">
                  <span className="truncate max-w-[100px] inline-flex items-center gap-0.5">
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

      {/* AUDIT FULLSCREEN DETAIL LIGHTBOX MODAL */}
      {activeRecordForLightbox && (
        <div
          id="audit-lightbox-backdrop"
          onClick={() => setSelectedRecordId(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 overflow-hidden shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
            id="audit-lightbox-card"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E0E0E0] flex justify-between items-center bg-[#F5F5F5]">
              <div>
                <span className="text-[10px] font-bold text-[#D40511] bg-red-100 rounded px-2 py-0.5 uppercase tracking-wider">
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
                    <img src={activeRecordForLightbox.product.imageUrl} alt={activeRecordForLightbox.product.name} className="w-6 h-6 rounded object-contain bg-white border border-gray-100" />
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

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-[9px] uppercase text-gray-400 font-bold font-sans">Ponto de Venda</span>
                      <span className="font-semibold text-gray-800 flex items-center gap-1 mt-0.5 font-sans">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {activeRecordForLightbox.chain?.name}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase text-gray-400 font-bold font-sans">Data & Hora</span>
                      <span className="font-medium text-gray-500 block mt-0.5 font-mono">
                        {formatDateBR(activeRecordForLightbox.date)} (Hoje)
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[9px] uppercase text-gray-400 font-bold font-sans">Auditor do Campo</span>
                      <span className="font-medium text-gray-600 block mt-0.5 font-sans">
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

                <div className="pt-4 border-t border-[#E0E0E0] flex items-center justify-between text-[10px] text-gray-400 bg-white">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir Registro
                  </button>
                  {showDeleteConfirm && (
                    <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4">
                      <p className="text-sm font-bold text-gray-800">Deseja realmente excluir este registro?</p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => {
                              onDeleteRecord?.(activeRecordForLightbox.id);
                              handleCloseLightbox();
                          }}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs"
                        >
                          Sim, excluir
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(false)}
                          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold text-xs"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
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
