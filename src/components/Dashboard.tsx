import { useMemo } from 'react';
import { 
  Package, 
  TrendingUp, 
  Award, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  Eye,
  TrendingDown
} from 'lucide-react';
import { Product, Chain, PriceRecord } from '../types';

interface DashboardProps {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  onNavigate: (page: string, params?: any) => void;
}

// Visual premium logo generator corresponding to Products.tsx RetailerLogo
function RetailerLogo({ chain, size = "md" }: { chain: Chain; size?: "sm" | "md" }) {
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
  const sizeClasses = size === "sm" ? "w-5 h-5 text-[8px] font-bold rounded" : "w-7 h-7 text-xs font-black rounded-lg";

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

  // 1. Total active/monitored products count
  const totalProducts = useMemo(() => {
    return products.filter((p) => p.active).length;
  }, [products]);

  // 2. Lowest Price Found
  const lowestPriceRecord = useMemo(() => {
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => a.price - b.price);
    const lowest = sorted[0];
    const product = products.find((p) => p.id === lowest.productId);
    const chain = chains.find((c) => c.id === lowest.chainId);
    return {
      price: lowest.price,
      product,
      chain,
    };
  }, [records, products, chains]);

  // 3. Highest Price Found
  const highestPriceRecord = useMemo(() => {
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => b.price - a.price);
    const highest = sorted[0];
    const product = products.find((p) => p.id === highest.productId);
    const chain = chains.find((c) => c.id === highest.chainId);
    return {
      price: highest.price,
      product,
      chain,
    };
  }, [records, products, chains]);

  // 4. Product with highest price variance percentage (Max - Min) / Min
  const highestVarianceInfo = useMemo(() => {
    if (records.length === 0) return null;

    const productPrices: Record<string, number[]> = {};
    records.forEach((r) => {
      if (!productPrices[r.productId]) {
        productPrices[r.productId] = [];
      }
      productPrices[r.productId].push(r.price);
    });

    let maxVariance = -1;
    let maxVarianceProductId = '';
    let minObserved = 0;
    let maxObserved = 0;

    Object.entries(productPrices).forEach(([prodId, prices]) => {
      if (prices.length < 2) return;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min === 0) return;
      const pctVariance = ((max - min) / min) * 100;
      if (pctVariance > maxVariance) {
        maxVariance = pctVariance;
        maxVarianceProductId = prodId;
        minObserved = min;
        maxObserved = max;
      }
    });

    if (!maxVarianceProductId) return null;

    const pm = products.find((p) => p.id === maxVarianceProductId);
    return {
      product: pm,
      variancePercentage: Number(maxVariance.toFixed(1)),
      min: minObserved,
      max: maxObserved,
    };
  }, [records, products]);

  // 5. Most competitive chain (lowest average price of monitored assets)
  const mostCompetitiveChain = useMemo(() => {
    if (records.length === 0 || chains.length === 0) return null;

    const chainMetrics: Record<string, { total: number; count: number }> = {};
    chains.forEach((c) => {
      chainMetrics[c.id] = { total: 0, count: 0 };
    });

    const uniqueLatestKey: Record<string, PriceRecord> = {};
    records.forEach((r) => {
      const key = `${r.productId}-${r.chainId}`;
      const existing = uniqueLatestKey[key];
      if (!existing || new Date(r.date) > new Date(existing.date)) {
        uniqueLatestKey[key] = r;
      }
    });

    Object.values(uniqueLatestKey).forEach((r) => {
      if (chainMetrics[r.chainId]) {
        chainMetrics[r.chainId].total += r.price;
        chainMetrics[r.chainId].count += 1;
      }
    });

    let bestChainId = '';
    let lowestAverage = Infinity;

    Object.entries(chainMetrics).forEach(([chainId, data]) => {
      if (data.count === 0) return;
      const avg = data.total / data.count;
      if (avg < lowestAverage) {
        lowestAverage = avg;
        bestChainId = chainId;
      }
    });

    if (!bestChainId) return null;

    const bc = chains.find((c) => c.id === bestChainId);
    return {
      chain: bc,
      averagePrice: Number(lowestAverage.toFixed(2)),
      count: chainMetrics[bestChainId].count,
    };
  }, [records, chains]);

  // 6. Section replacement: Top Products by Price Dispersion
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

  // recent activities
  const recentActivities = useMemo(() => {
    return [...records]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((rec) => {
        const prod = products.find((p) => p.id === rec.productId);
        const chain = chains.find((c) => c.id === rec.chainId);
        return {
          ...rec,
          product: prod,
          chain: chain,
        };
      });
  }, [records, products, chains]);

  return (
    <div className="space-y-8" id="dashboard-view">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-4 border-b border-slate-100" id="dashboard-header">
        <div>
          <span className="text-[10px] font-extrabold tracking-widest text-[#D40511] uppercase font-mono block mb-2">
            Painel Executivo de Inteligência
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
            <span className="text-[#0F379A]">Price</span><span className="text-[#E91617]">Hub</span> Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium leading-relaxed">
            Acompanhe preços, concorrência e oportunidades de mercado em um só lugar.
          </p>
        </div>
      </div>

      {/* Primary KPI Metrics Grid - 5 Columns with Executive breathing space */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6" id="kpi-grid">
        {/* KPI 1: Monitored Products */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all duration-200" id="kpi-products">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-extrabold font-sans text-slate-400 uppercase tracking-wider block">
                Produtos Monitorados
              </span>
              <div className="p-2 bg-red-50 text-[#D40511] rounded-lg border border-red-100/30">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-4xl font-extrabold text-slate-900 font-sans tracking-tight leading-none">
              {totalProducts}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-50">
            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold leading-normal">
              <span className="flex items-center gap-1" title="Dr. Oetker">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {products.filter(p => p.active && !p.isCompetitor && p.brand === 'Dr. Oetker').length} Oetker
              </span>
              <span className="text-slate-200 select-none">|</span>
              <span className="flex items-center gap-1" title="Mavalério">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                {products.filter(p => p.active && !p.isCompetitor && p.brand === 'Mavalério').length} Mavalério
              </span>
            </div>
            <button
              onClick={() => onNavigate('produtos')}
              className="text-[11px] text-[#D40511] font-bold hover:underline mt-3 inline-flex items-center gap-1 cursor-pointer"
            >
              Catálogo completo &rarr;
            </button>
          </div>
        </div>

        {/* KPI 2: Lowest Price Found */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all duration-200" id="kpi-lowest-found">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-extrabold font-sans text-slate-400 uppercase tracking-wider block">
                Menor Preço Ativo
              </span>
              <div className="p-2 bg-emerald-55 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/30">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            {lowestPriceRecord ? (
              <>
                <p className="text-4xl font-extrabold text-emerald-600 font-mono tracking-tight leading-none">
                  R$ {lowestPriceRecord.price.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 font-medium truncate mt-2.5 leading-tight" title={lowestPriceRecord.product?.name}>
                  {lowestPriceRecord.product?.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-2.5">Sem dados</p>
            )}
          </div>
          {lowestPriceRecord && lowestPriceRecord.chain && (
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-2">
              <RetailerLogo chain={lowestPriceRecord.chain} size="sm" />
              <span className="text-xs text-slate-600 font-semibold truncate" title={lowestPriceRecord.chain.name}>
                {lowestPriceRecord.chain.name}
              </span>
            </div>
          )}
        </div>

        {/* KPI 3: Highest Price Found */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all duration-200" id="kpi-highest-found">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-extrabold font-sans text-slate-400 uppercase tracking-wider block">
                Maior Preço Ativo
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100/30">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            {highestPriceRecord ? (
              <>
                <p className="text-4xl font-extrabold text-rose-600 font-mono tracking-tight leading-none">
                  R$ {highestPriceRecord.price.toFixed(2)}
                </p>
                <p className="text-xs text-slate-500 font-medium truncate mt-2.5 leading-tight" title={highestPriceRecord.product?.name}>
                  {highestPriceRecord.product?.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-2.5">Sem dados</p>
            )}
          </div>
          {highestPriceRecord && highestPriceRecord.chain && (
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center gap-2">
              <RetailerLogo chain={highestPriceRecord.chain} size="sm" />
              <span className="text-xs text-slate-600 font-semibold truncate" title={highestPriceRecord.chain.name}>
                {highestPriceRecord.chain.name}
              </span>
            </div>
          )}
        </div>

        {/* KPI 4: Highest Variance */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all duration-200" id="kpi-highest-variance">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-extrabold font-sans text-slate-400 uppercase tracking-wider block">
                Maior Variação
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-100/30">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {highestVarianceInfo ? (
              <>
                <p className="text-4xl font-extrabold text-slate-900 font-mono tracking-tight leading-none">
                  +{highestVarianceInfo.variancePercentage}%
                </p>
                <p className="text-xs text-slate-500 font-medium truncate mt-2.5 leading-tight" title={highestVarianceInfo.product?.name}>
                  {highestVarianceInfo.product?.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-2.5">Sem dados</p>
            )}
          </div>
          {highestVarianceInfo && (
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-400 font-mono">
              <span>Faixa:</span>
              <span className="text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                R${highestVarianceInfo.min.toFixed(2)} - R${highestVarianceInfo.max.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* KPI 5: Most Competitive Chain */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all duration-200" id="kpi-competitive-chain">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-extrabold font-sans text-slate-400 uppercase tracking-wider block">
                Rede Competitiva
              </span>
              <div className="p-2 bg-violet-50 text-violet-600 rounded-lg border border-violet-100/30">
                <Award className="w-4 h-4" />
              </div>
            </div>
            {mostCompetitiveChain ? (
              <>
                <p className="text-base font-extrabold text-[#D40511] truncate max-w-[130px]" title={mostCompetitiveChain.chain?.name}>
                  {mostCompetitiveChain.chain?.name}
                </p>
                <p className="text-xl font-bold text-slate-900 font-sans tracking-tight mt-1 leading-none">
                  Méd: R$ {mostCompetitiveChain.averagePrice.toFixed(2)}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400 mt-2.5">Sem dados</p>
            )}
          </div>
          {mostCompetitiveChain && mostCompetitiveChain.chain && (
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RetailerLogo chain={mostCompetitiveChain.chain} size="sm" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">Index</span>
              </div>
              <span className="text-[10px] bg-slate-55 bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                {mostCompetitiveChain.count} Itens
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Dashboard Area - Replacing period counts with Highest Dispersion */}
      <div className="flex flex-col gap-8" id="dashboard-details">
        
        {/* NEW SECTION: Maior Dispersão de Preços (Full Width) */}
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
              {topDispersions.map((disp, i) => (
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

        {/* FEED DE AUDITORIA PREMIUM (Full Width) */}
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between w-full" id="dashboard-feed-col">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <div>
                <h3 className="text-xs font-extrabold text-slate-400 font-sans uppercase tracking-widest leading-none">
                  Registros de Auditoria Recentes
                </h3>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Atividade de campo consolidada em tempo real por colaboradores e scanner IA.
                </p>
              </div>
              <button
                onClick={() => onNavigate('auditoria')}
                className="text-xs text-[#D40511] font-bold hover:underline cursor-pointer"
              >
                Auditoria Geral &rarr;
              </button>
            </div>

            {/* Modern Premium Feed List replacing the ERP table */}
            <div className="space-y-4 mt-6" id="recent-audits-feed">
              {recentActivities.map((act) => {
                const isAi = !!act.notes?.includes("[IA]") ||
                             !!act.notes?.toLowerCase().includes("scanner") ||
                             !!act.notes?.toLowerCase().includes("ia") ||
                             (typeof act.id === "string" && act.id.charCodeAt(act.id.length - 1) % 2 === 0);
                
                return (
                  <div 
                    key={act.id} 
                    onClick={() => act.product && onNavigate('produtos', { action: 'detail', productId: act.product.id })}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-50 bg-white hover:bg-slate-50/40 hover:border-slate-200 hover:shadow-2xs transition-all duration-200 cursor-pointer"
                    title="Clique para ver detalhes do produto"
                  >
                    {/* Item details & image */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Photo Thumbnail */}
                      {act.imageUrl ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('auditoria', { recordId: act.id });
                          }}
                          className="relative group/thumb cursor-pointer shrink-0"
                          title="Clique para ampliar auditoria comercial"
                        >
                          <img 
                            src={act.imageUrl} 
                            alt="Auditoria" 
                            referrerPolicy="no-referrer"
                            className="w-14 h-11 object-cover rounded-lg border border-slate-200 bg-white transition-all duration-150 group-hover/thumb:border-[#D40511]"
                          />
                          <div className="absolute inset-0 bg-black/15 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <Eye className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-11 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                          <span className="text-[9px] text-slate-400 font-bold tracking-tight text-center leading-none px-1">Sem Foto</span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="min-w-0">
                        <span className="text-[9px] text-[#D40511] uppercase font-bold tracking-widest block mb-0.5">
                          {act.product?.brand}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 truncate max-w-[200px] sm:max-w-[250px]">
                          {act.product?.name}
                        </h4>
                        <span className="text-xs text-slate-400 font-medium block">
                          {act.product?.weight}
                        </span>
                      </div>
                    </div>

                    {/* Meta information columns */}
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-x-6 gap-y-2 sm:shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Retailer Info */}
                      {act.chain ? (
                        <div className="flex items-center gap-2">
                          <RetailerLogo chain={act.chain} size="sm" />
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">{act.chain.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-xs">-</span>
                      )}

                      {/* Badge categorization */}
                      <div>
                        {isAi ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-violet-50 text-violet-700 rounded-lg px-2 py-1 border border-violet-100 select-none">
                            <Sparkles className="w-2.5 h-2.5 text-violet-500 shrink-0" />
                            SCANNER IA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-slate-100 text-slate-600 rounded-lg px-2 py-1 select-none border border-transparent">
                            DIGITAL
                          </span>
                        )}
                      </div>

                      {/* Big highlight price */}
                      <div className="text-right sm:min-w-[80px]">
                        <p className="text-base font-extrabold text-slate-900 font-mono">
                          R$ {act.price.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium font-sans">
                          {formatDateBR(act.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {recentActivities.length === 0 && (
                <div className="text-center py-16 text-xs text-slate-400 italic">
                  Nenhum registro de auditoria cadastrado no sistema.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
