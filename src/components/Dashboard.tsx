import { useState, useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  RefreshCw,
  Building2,
  Calendar,
  Package,
  ChevronDown,
  ChevronUp,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe
} from 'lucide-react';
import { Product, Chain, PriceRecord, RESEARCH_STATES, isChainInState, getPriceRecordState, getChainStates } from '../types';

interface DashboardProps {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  onNavigate: (page: string, params?: any) => void;
}

// Visual premium logo generator corresponding to Products.tsx RetailerLogo
function RetailerLogo({ chain, size = "md" }: { chain: Chain; size?: "sm" | "md" | "lg" | "xl" }) {
  const getInitialsAndColors = (name: string) => {
    const uppercase = name.toUpperCase();
    if (uppercase.includes("CARREFOUR")) return { text: "C", bg: "bg-blue-600", border: "border-blue-700/50", textCol: "text-white" };
    if (uppercase.includes("PÃO DE AÇÚCAR") || uppercase.includes("PAO DE ACUCAR") || uppercase.includes("GPA")) {
      return { text: "PA", bg: "bg-emerald-700", border: "border-emerald-800/50", textCol: "text-white" };
    }
    if (uppercase.includes("SONDA")) return { text: "SD", bg: "bg-red-500", border: "border-red-600/50", textCol: "text-white" };
    if (uppercase.includes("MAMBO")) return { text: "MB", bg: "bg-amber-500", border: "border-amber-600/50", textCol: "text-amber-950" };
    if (uppercase.includes("HIROTA")) return { text: "HR", bg: "bg-orange-600", border: "border-orange-700/50", textCol: "text-white" };
    if (uppercase.includes("BH") || uppercase.includes("BELO HORIZONTE")) return { text: "BH", bg: "bg-amber-400", border: "border-amber-500/50", textCol: "text-blue-900" };
    if (uppercase.includes("ASSAÍ") || uppercase.includes("ASSAI")) return { text: "AS", bg: "bg-orange-500", border: "border-orange-600/50", textCol: "text-white" };
    if (uppercase.includes("ATACADÃO") || uppercase.includes("ATACADAO")) return { text: "AT", bg: "bg-red-600", border: "border-red-750", textCol: "text-white" };
    if (uppercase.includes("VILLEFORT")) return { text: "VF", bg: "bg-sky-600", border: "border-sky-700", textCol: "text-white" };

    const parts = name.split(" ").filter(Boolean);
    const initials = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
    return {
      text: initials || "?",
      bg: chain.logoColor || "bg-gray-600",
      border: "border-gray-500/20",
      textCol: "text-white",
    };
  };

  const { text, bg, border, textCol } = getInitialsAndColors(chain.name);
  const sizeClasses = 
    size === "sm" ? "w-5 h-5 text-[8px] font-bold rounded" :
    size === "lg" ? "w-11 h-11 text-base font-black rounded-xl" :
    size === "xl" ? "w-14 h-14 text-lg font-black rounded-2xl" :
    "w-7 h-7 text-xs font-black rounded-lg";

  if (chain.logoUrl) {
    return (
      <div className={`overflow-hidden border border-gray-200 shrink-0 bg-white flex items-center justify-center ${sizeClasses}`}>
        <img src={chain.logoUrl} alt={chain.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center shrink-0 border select-none font-bold uppercase ${bg} ${border} ${textCol} ${sizeClasses} font-mono`} title={chain.name}>
      {text}
    </div>
  );
}

interface ChainStateAuditInfo {
  chain: Chain;
  state: string;
  lastUpdateDate: string | null;
  updatedProductsCount: number;
  totalProductsCount: number;
  daysSince: number | null;
  status: 'recent' | 'updated' | 'warning' | 'outdated' | 'never';
  isOutdated: boolean;
}

interface StateAuditGroup {
  name: string;
  uf: string;
  chains: ChainStateAuditInfo[];
  recentChains: ChainStateAuditInfo[];
  outdatedChains: ChainStateAuditInfo[];
  outdatedCount: number;
  latestUpdateDate: string | null;
}

const STATE_UF_MAP: Record<string, string> = {
  'Minas Gerais': 'MG',
  'Goiás': 'GO',
  'Distrito Federal': 'DF',
  'Amazonas': 'AM',
  'Acre': 'AC',
  'Rondônia': 'RO',
  'Mato Grosso': 'MT',
  'Tocantins': 'TO',
  'São Paulo': 'SP',
  'Rio de Janeiro': 'RJ',
};

const getStateUF = (stateName: string): string => {
  if (STATE_UF_MAP[stateName]) return STATE_UF_MAP[stateName];
  const found = RESEARCH_STATES.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
  if (found) return found.uf;
  return stateName.substring(0, 2).toUpperCase();
};

export function Dashboard({ products, chains, records, onNavigate }: DashboardProps) {
  // Helper for PT-BR date representation
  const formatDateBR = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // 1. Produtos com alterações de preços
  const recentPriceChanges = useMemo(() => {
    if (records.length === 0 || products.length === 0) return [];

    const chainProductRecords: Record<string, PriceRecord[]> = {};

    records.forEach((r) => {
      const key = `${r.productId}_${r.chainId}`;
      if (!chainProductRecords[key]) {
        chainProductRecords[key] = [];
      }
      chainProductRecords[key].push(r);
    });

    const changes: {
      product: Product;
      chain: Chain;
      oldPrice: number;
      newPrice: number;
      diff: number;
      diffPercentage: number;
      date: string;
    }[] = [];

    Object.entries(chainProductRecords).forEach(([, recs]) => {
      const sorted = [...recs].sort((a, b) => {
        const cmp = b.date.localeCompare(a.date);
        if (cmp !== 0) return cmp;
        return b.id.localeCompare(a.id);
      });

      if (sorted.length >= 2) {
        const latest = sorted[0];
        const previous = sorted[1];

        if (latest.price !== previous.price) {
          const prod = products.find((p) => p.id === latest.productId);
          const ch = chains.find((c) => c.id === latest.chainId);
          if (prod && ch) {
            const diff = latest.price - previous.price;
            const diffPercentage = previous.price > 0 ? (diff / previous.price) * 100 : 0;
            changes.push({
              product: prod,
              chain: ch,
              oldPrice: previous.price,
              newPrice: latest.price,
              diff,
              diffPercentage: Number(diffPercentage.toFixed(1)),
              date: latest.date,
            });
          }
        }
      }
    });

    if (changes.length < 3) {
      const productRecordsMap: Record<string, PriceRecord[]> = {};
      records.forEach((r) => {
        if (!productRecordsMap[r.productId]) {
          productRecordsMap[r.productId] = [];
        }
        productRecordsMap[r.productId].push(r);
      });

      Object.entries(productRecordsMap).forEach(([prodId, recs]) => {
        const sorted = [...recs].sort((a, b) => b.date.localeCompare(a.date));
        if (sorted.length >= 2) {
          const latest = sorted[0];
          const prevDiff = sorted.find((r, idx) => idx > 0 && r.price !== latest.price);
          if (prevDiff) {
            const prod = products.find((p) => p.id === prodId);
            const ch = chains.find((c) => c.id === latest.chainId);
            const exists = changes.some((c) => c.product.id === prodId && c.chain.id === ch?.id);
            if (prod && ch && !exists) {
              const diff = latest.price - prevDiff.price;
              const diffPercentage = prevDiff.price > 0 ? (diff / prevDiff.price) * 100 : 0;
              changes.push({
                product: prod,
                chain: ch,
                oldPrice: prevDiff.price,
                newPrice: latest.price,
                diff,
                diffPercentage: Number(diffPercentage.toFixed(1)),
                date: latest.date,
              });
            }
          }
        }
      });
    }

    return changes
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
  }, [records, products, chains]);

  // Estados e controle de expansão do card de redes atualizadas
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('Todas');
  const [expandedStates, setExpandedStates] = useState<Record<string, boolean>>({});

  const toggleStateExpansion = (stateName: string) => {
    setExpandedStates((prev) => ({
      ...prev,
      [stateName]: !prev[stateName],
    }));
  };

  // 2. Últimas redes atualizadas organizadas por estado com status de atualização e pendências
  const stateAuditGroups = useMemo(() => {
    if (chains.length === 0) return [];

    // Coleta todos os estados válidos que possuem redes ou registros
    const allStateNames = new Set<string>();

    // Prioriza os estados oficiais de pesquisa na ordem predefinida
    RESEARCH_STATES.forEach((st) => allStateNames.add(st.name));

    chains.forEach((chain) => {
      getChainStates(chain).forEach((st) => allStateNames.add(st));
    });

    records.forEach((r) => {
      const st = getPriceRecordState(r, chains);
      if (st) allStateNames.add(st);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groups: StateAuditGroup[] = [];

    allStateNames.forEach((stateName) => {
      // Redes ativas configuradas para este estado ou que possuem registros gravados nele
      const stateChains = chains.filter(
        (c) =>
          c.active &&
          (isChainInState(c, stateName) ||
            records.some((r) => r.chainId === c.id && getPriceRecordState(r, chains) === stateName))
      );

      if (stateChains.length === 0) return;

      const chainAuditInfos: ChainStateAuditInfo[] = stateChains.map((chain) => {
        const chainStateRecs = records.filter(
          (r) => r.chainId === chain.id && getPriceRecordState(r, chains) === stateName
        );

        if (chainStateRecs.length === 0) {
          return {
            chain,
            state: stateName,
            lastUpdateDate: null,
            updatedProductsCount: 0,
            totalProductsCount: 0,
            daysSince: null,
            status: 'never',
            isOutdated: true,
          };
        }

        const sorted = [...chainStateRecs].sort((a, b) => {
          const cmp = b.date.localeCompare(a.date);
          if (cmp !== 0) return cmp;
          return b.id.localeCompare(a.id);
        });

        const lastDate = sorted[0].date;
        const productsOnLastDate = new Set(
          sorted.filter((r) => r.date === lastDate).map((r) => r.productId)
        );
        const allUniqueProducts = new Set(sorted.map((r) => r.productId));

        let daysSince: number | null = null;
        try {
          const [y, m, d] = lastDate.split('-').map(Number);
          const recDate = new Date(y, m - 1, d);
          daysSince = Math.max(0, Math.floor((today.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24)));
        } catch {
          daysSince = 0;
        }

        let status: 'recent' | 'updated' | 'warning' | 'outdated' | 'never' = 'updated';
        if (daysSince === null) {
          status = 'never';
        } else if (daysSince <= 7) {
          status = 'recent';
        } else if (daysSince <= 20) {
          status = 'updated';
        } else if (daysSince <= 30) {
          status = 'warning';
        } else {
          status = 'outdated';
        }

        const isOutdated = daysSince === null || daysSince > 20;

        return {
          chain,
          state: stateName,
          lastUpdateDate: lastDate,
          updatedProductsCount: productsOnLastDate.size,
          totalProductsCount: allUniqueProducts.size,
          daysSince,
          status,
          isOutdated,
        };
      });

      // Ordena as redes do estado:
      // Redes com atualização recente primeiro (data desc), depois redes mais desatualizadas / nunca auditadas
      chainAuditInfos.sort((a, b) => {
        if (a.lastUpdateDate && b.lastUpdateDate) {
          return b.lastUpdateDate.localeCompare(a.lastUpdateDate);
        }
        if (a.lastUpdateDate && !b.lastUpdateDate) return -1;
        if (!a.lastUpdateDate && b.lastUpdateDate) return 1;
        return a.chain.name.localeCompare(b.chain.name);
      });

      const recentChains = chainAuditInfos.filter((c) => !c.isOutdated);
      const outdatedChains = chainAuditInfos.filter((c) => c.isOutdated);
      const latestDate = chainAuditInfos.find((c) => c.lastUpdateDate !== null)?.lastUpdateDate || null;

      groups.push({
        name: stateName,
        uf: getStateUF(stateName),
        chains: chainAuditInfos,
        recentChains,
        outdatedChains,
        outdatedCount: outdatedChains.length,
        latestUpdateDate: latestDate,
      });
    });

    // Ordenação dos estados: estados com auditorias mais recentes e maior número de redes primeiro
    return groups.sort((a, b) => {
      if (a.latestUpdateDate && b.latestUpdateDate) {
        const cmp = b.latestUpdateDate.localeCompare(a.latestUpdateDate);
        if (cmp !== 0) return cmp;
      } else if (a.latestUpdateDate && !b.latestUpdateDate) {
        return -1;
      } else if (!a.latestUpdateDate && b.latestUpdateDate) {
        return 1;
      }
      return b.chains.length - a.chains.length;
    });
  }, [chains, records]);

  // Contagem total de redes desatualizadas somando todos os estados
  const totalOutdatedCount = useMemo(() => {
    return stateAuditGroups.reduce((acc, g) => acc + g.outdatedCount, 0);
  }, [stateAuditGroups]);

  // Grupos visíveis respeitando o filtro de estado selecionado
  const visibleStateGroups = useMemo(() => {
    if (selectedStateFilter === 'Todas') {
      return stateAuditGroups;
    }
    return stateAuditGroups.filter((g) => g.name === selectedStateFilter);
  }, [stateAuditGroups, selectedStateFilter]);

  // 3. Section: Top Products by Price Dispersion
  const topDispersions = useMemo(() => {
    if (records.length === 0 || products.length === 0) return [];

    const productPrices: Record<string, number[]> = {};
    records.forEach((r) => {
      if (!productPrices[r.productId]) {
        productPrices[r.productId] = [];
      }
      productPrices[r.productId].push(r.price);
    });

    const dispersions = Object.entries(productPrices)
      .map(([prodId, prices]) => {
        const prod = products.find((p) => p.id === prodId);
        if (!prod) return null;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === 0) return null;
        const varianceVal = ((max - min) / min) * 100;
        return {
          product: prod,
          min,
          max,
          variance: varianceVal,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null && d.variance > 0)
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 4);

    return dispersions;
  }, [records, products]);

  return (
    <div className="space-y-8" id="dashboard-view">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-4 border-b border-slate-100" id="dashboard-header">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            <span className="text-[#0F379A]">Price</span><span className="text-[#E91617]">Hub</span> Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium leading-relaxed">
            Acompanhe preços, concorrência e oportunidades de mercado em um só lugar.
          </p>
        </div>
      </div>

      {/* Primary Top Cards Container: Full-width stacked layout */}
      <div className="flex flex-col gap-6 w-full" id="dashboard-top-cards">
        {/* Card 1: Últimas redes atualizadas por estado */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between" id="card-updated-chains">
          <div className="space-y-4">
            {/* Card Header with Expansion Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100/50 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-extrabold text-slate-700 font-sans uppercase tracking-widest leading-none">
                      Últimas Redes Atualizadas por Estado
                    </h3>
                    {totalOutdatedCount > 0 && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                        {totalOutdatedCount} {totalOutdatedCount === 1 ? 'desatualizada' : 'desatualizadas'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    {isExpanded
                      ? 'Exibindo todas as redes por estado, incluindo as desatualizadas para auditoria'
                      : 'Exibindo as últimas redes atualizadas de cada estado. Expanda para ver todas e as pendentes'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-toggle-expand-all-chains"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border shadow-2xs ${
                    isExpanded
                      ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      : 'bg-[#D40511] text-white border-[#D40511] hover:bg-[#b0040e]'
                  }`}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                      <span>Recolher redes</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      <span>Ver todas as redes {totalOutdatedCount > 0 ? `(${totalOutdatedCount} desatualizadas)` : ''}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('auditoria')}
                  className="text-xs text-[#D40511] font-bold hover:underline cursor-pointer shrink-0 hidden md:inline-block ml-1"
                >
                  Ver auditorias &rarr;
                </button>
              </div>
            </div>

            {/* Quick State Tabs Filter */}
            {stateAuditGroups.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedStateFilter('Todas')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    selectedStateFilter === 'Todas'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>Todos os Estados ({stateAuditGroups.length})</span>
                </button>
                {stateAuditGroups.map((st) => (
                  <button
                    type="button"
                    key={st.name}
                    onClick={() => setSelectedStateFilter(st.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      selectedStateFilter === st.name
                        ? 'bg-[#0F379A] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span className="font-mono text-[10px] bg-black/10 px-1 py-0.5 rounded font-black">
                      {st.uf}
                    </span>
                    <span>{st.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({st.chains.length})</span>
                    {st.outdatedCount > 0 && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" title={`${st.outdatedCount} pendentes`} />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Info Notice when expanded */}
            {isExpanded && totalOutdatedCount > 0 && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="leading-relaxed">
                  <strong>Visão expandida de auditorias:</strong> Exibindo todas as redes por estado, incluindo <strong>{totalOutdatedCount} redes pendentes ou desatualizadas</strong> (mais de 20 dias sem auditoria). Clique no botão <strong>Atualizar Preços</strong> para iniciar a coleta imediata na loja.
                </p>
              </div>
            )}

            {/* State Groups List */}
            <div className="space-y-6 pt-1">
              {visibleStateGroups.map((st) => {
                const isStateExpanded = isExpanded || !!expandedStates[st.name] || selectedStateFilter === st.name;
                const displayedChains = isStateExpanded
                  ? st.chains
                  : (st.recentChains.length > 0 ? st.recentChains.slice(0, 3) : st.chains.slice(0, 3));

                return (
                  <div key={st.name} className="space-y-3">
                    {/* State Header Bar */}
                    <div className="flex items-center justify-between bg-slate-50/90 px-3.5 py-2 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#0F379A] text-white font-mono text-[10px] font-black flex items-center justify-center shadow-2xs">
                          {st.uf}
                        </span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 font-sans">
                          {st.name}
                        </h4>
                        <span className="text-[11px] text-slate-400 font-medium">
                          • {st.chains.length} {st.chains.length === 1 ? 'rede' : 'redes'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {st.outdatedCount > 0 ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full font-mono">
                            {st.outdatedCount} {st.outdatedCount === 1 ? 'pendente' : 'pendentes'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                            Todas em dia
                          </span>
                        )}

                        {!isExpanded && selectedStateFilter !== st.name && st.chains.length > 3 && (
                          <button
                            type="button"
                            onClick={() => toggleStateExpansion(st.name)}
                            className="text-xs text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-0.5 ml-2"
                          >
                            {expandedStates[st.name] ? 'Recolher' : `Ver todas (${st.chains.length})`}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grid of chains for this state */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {displayedChains.map((item) => {
                        const isOutdated = item.isOutdated;
                        return (
                          <div
                            key={`${st.name}-${item.chain.id}`}
                            onClick={() => onNavigate('produtos', { chainId: item.chain.id, state: st.name })}
                            className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center text-center group justify-between ${
                              isOutdated
                                ? 'border-amber-200/90 bg-amber-50/20 hover:border-[#D40511] hover:bg-red-50/20 shadow-2xs'
                                : 'border-slate-100 bg-white hover:border-blue-500/40 hover:bg-slate-50/60 hover:shadow-xs'
                            }`}
                          >
                            <div className="w-full flex flex-col items-center">
                              {/* UF badge & status tag */}
                              <div className="w-full flex items-center justify-between gap-1 mb-2">
                                <span className="font-mono text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                                  {st.uf}
                                </span>
                                {item.status === 'recent' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-mono">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    {item.daysSince === 0 ? 'Hoje' : item.daysSince === 1 ? '1d' : `${item.daysSince}d`}
                                  </span>
                                )}
                                {item.status === 'updated' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full font-mono">
                                    <Clock className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                    {item.daysSince}d atrás
                                  </span>
                                )}
                                {item.status === 'warning' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full font-mono">
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    {item.daysSince}d atrás
                                  </span>
                                )}
                                {item.status === 'outdated' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full font-mono">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                    {item.daysSince}d atrás
                                  </span>
                                )}
                                {item.status === 'never' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full font-mono">
                                    Sem dados
                                  </span>
                                )}
                              </div>

                              {/* Highlighted Retailer Logo */}
                              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 mb-2 group-hover:scale-105 group-hover:border-blue-200 transition-all duration-200 flex items-center justify-center">
                                <RetailerLogo chain={item.chain} size="lg" />
                              </div>

                              {/* Chain Name */}
                              <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {item.chain.name}
                              </h4>

                              {/* Date below logo */}
                              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-1">
                                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{item.lastUpdateDate ? formatDateBR(item.lastUpdateDate) : 'Nunca auditada'}</span>
                              </div>

                              {/* Product count badge below */}
                              {item.lastUpdateDate && (
                                <div className="mt-1.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100/80 px-2 py-0.5 rounded-full font-mono">
                                    <Package className="w-3 h-3 text-blue-600 shrink-0" />
                                    <span>{item.updatedProductsCount} {item.updatedProductsCount === 1 ? 'produto' : 'produtos'}</span>
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Action Button: Atualizar Preços if outdated, or Ver Catálogo link */}
                            <div className="w-full mt-3 pt-2 border-t border-slate-100">
                              {isOutdated ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate('registrar', { chainId: item.chain.id, state: st.name, skipToStep: 2 });
                                  }}
                                  className="w-full py-1.5 px-2 bg-[#D40511] hover:bg-[#b0040e] active:scale-95 text-white text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer group/btn"
                                  title={`Atualizar preços da rede ${item.chain.name} em ${st.name}`}
                                >
                                  <Camera className="w-3 h-3 group-hover/btn:scale-110 transition-transform shrink-0" />
                                  <span className="truncate">Atualizar Preços</span>
                                </button>
                              ) : (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 group-hover:text-blue-600 font-medium">Ver catálogo &rarr;</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigate('registrar', { chainId: item.chain.id, state: st.name, skipToStep: 2 });
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#D40511] transition rounded hover:bg-red-50 cursor-pointer"
                                    title="Auditar novamente"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Button to expand more chains in this state if collapsed */}
                    {!isStateExpanded && st.chains.length > displayedChains.length && (
                      <div className="flex items-center justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => toggleStateExpansion(st.name)}
                          className="text-xs font-bold text-slate-600 hover:text-[#D40511] bg-slate-50 hover:bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <ChevronDown className="w-3 h-3" />
                          <span>
                            Ver mais {st.chains.length - displayedChains.length} {st.chains.length - displayedChains.length === 1 ? 'rede' : 'redes'} de {st.name}
                            {st.outdatedCount > 0 ? ` (${st.outdatedCount} desatualizadas)` : ''}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleStateGroups.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 italic">
                  Nenhuma rede encontrada para o filtro de estado selecionado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Produtos com alterações de preços */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between" id="card-price-changes">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100/50">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 font-sans uppercase tracking-widest leading-none">
                    Produtos com Alterações de Preços
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Últimas variações detectadas em relação ao preço anterior
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('produtos')}
                className="text-xs text-[#D40511] font-bold hover:underline cursor-pointer shrink-0"
              >
                Ver produtos &rarr;
              </button>
            </div>

            <div className="space-y-3 mt-4">
              {recentPriceChanges.map((item, idx) => {
                const isUp = item.diff > 0;
                return (
                  <div
                    key={`${item.product.id}-${item.chain.id}-${idx}`}
                    onClick={() => onNavigate('produtos', { action: 'detail', productId: item.product.id })}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-[#D40511]/30 hover:bg-slate-50/50 transition-all duration-200 cursor-pointer group"
                  >
                    {/* Product Thumbnail & Brand/Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={item.product.imageUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-lg border border-slate-200 object-contain shrink-0 bg-white"
                      />
                      <div className="min-w-0">
                        <span className="text-[9px] text-[#D40511] uppercase font-extrabold tracking-wider block leading-tight">
                          {item.product.brand}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[180px] sm:max-w-[400px] md:max-w-[600px] leading-tight group-hover:text-[#D40511] transition-colors">
                          {item.product.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <RetailerLogo chain={item.chain} size="sm" />
                          <span className="text-[10px] text-slate-500 font-medium truncate max-w-[110px]">
                            {item.chain.name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price change comparison & badge */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end gap-1 font-mono text-xs">
                        <span className="text-slate-400 line-through text-[11px]">
                          R${item.oldPrice.toFixed(2)}
                        </span>
                        <span className="text-slate-300 text-[10px]">&rarr;</span>
                        <span className="font-extrabold text-slate-900">
                          R${item.newPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono ${
                          isUp 
                            ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {isUp ? <ArrowUpRight className="w-3 h-3 shrink-0" /> : <ArrowDownRight className="w-3 h-3 shrink-0" />}
                          {isUp ? '+' : ''}{item.diffPercentage}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans">
                          {formatDateBR(item.date)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {recentPriceChanges.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 italic">
                  Nenhuma alteração de preço registrada recentemente.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Area */}
      <div className="flex flex-col gap-8" id="dashboard-details">
        
        {/* Maior Dispersão de Preços (Full Width) */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between w-full" id="dashboard-dispersions-col">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <h3 className="text-xs font-extrabold text-slate-400 font-sans uppercase tracking-widest leading-none">
                Maior Dispersão de Preços
              </h3>
              <Sparkles className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
            </div>
            <p className="text-xs text-slate-400 mt-2.5 mb-6 leading-relaxed">
              Diferença percentual observada entre o menor e maior preço de venda no mercado físico local.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="dispersions-rows-container">
              {topDispersions.map((disp) => (
                <div 
                  key={disp.product.id} 
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-slate-100 hover:border-[#D40511]/20 hover:bg-slate-50/40 transition-all duration-200 cursor-pointer"
                  onClick={() => onNavigate('produtos', { action: 'detail', productId: disp.product.id })}
                  title="Clique para ver no catálogo"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <img 
                      src={disp.product.imageUrl} 
                      alt="" 
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg border border-slate-100 object-contain shrink-0 bg-white"
                    />
                    <div className="min-w-0">
                      <span className="text-[9px] text-[#D40511] uppercase font-extrabold tracking-wider block mb-0.5">
                        {disp.product.brand}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 truncate max-w-[140px] leading-tight">
                        {disp.product.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        R${disp.min.toFixed(2)} - R${disp.max.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center justify-center text-xs font-extrabold text-rose-600 bg-rose-50 border border-rose-100/50 rounded-lg px-2.5 py-1 font-mono">
                      +{disp.variance.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}

              {topDispersions.length === 0 && (
                <div className="text-center py-12 text-xs text-slate-400 italic font-medium col-span-1 md:col-span-2">
                  Histórico de auditorias insuficientes para traçar índices de dispersão.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex justify-between sm:justify-start items-center gap-6 text-xs w-full sm:w-auto">
              <span className="text-slate-400 font-medium">Amostras consolidadas</span>
              <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-100/50 text-xs">{records.length}</span>
            </div>
            <div className="flex justify-between sm:justify-start items-center gap-6 text-xs w-full sm:w-auto">
              <span className="text-slate-400 font-medium">Garantia comercial</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded text-[9px] border border-emerald-100/30 uppercase tracking-widest">
                100% Auditável
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

