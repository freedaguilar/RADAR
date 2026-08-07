import { useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  RefreshCw,
  Building2,
  Calendar,
  Package
} from 'lucide-react';
import { Product, Chain, PriceRecord } from '../types';

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

  // 2. Últimas redes atualizadas
  const recentUpdatedChains = useMemo(() => {
    if (chains.length === 0 || records.length === 0) return [];

    const chainRecordsMap: Record<string, PriceRecord[]> = {};
    records.forEach((r) => {
      if (!chainRecordsMap[r.chainId]) {
        chainRecordsMap[r.chainId] = [];
      }
      chainRecordsMap[r.chainId].push(r);
    });

    const chainList = chains.map((chain) => {
      const chainRecs = chainRecordsMap[chain.id] || [];

      if (chainRecs.length === 0) {
        return {
          chain,
          lastUpdateDate: '',
          updatedProductsCount: 0,
        };
      }

      const sorted = [...chainRecs].sort((a, b) => b.date.localeCompare(a.date));
      const lastUpdateDate = sorted[0].date;

      const productsOnLastDate = new Set(
        sorted.filter((r) => r.date === lastUpdateDate).map((r) => r.productId)
      );

      return {
        chain,
        lastUpdateDate,
        updatedProductsCount: productsOnLastDate.size,
      };
    });

    return chainList
      .filter((item) => item.lastUpdateDate !== '')
      .sort((a, b) => b.lastUpdateDate.localeCompare(a.lastUpdateDate))
      .slice(0, 10);
  }, [chains, records]);

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
        {/* Card 1: Últimas redes atualizadas */}
        <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between" id="card-updated-chains">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100/50">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-400 font-sans uppercase tracking-widest leading-none">
                    Últimas Redes Atualizadas
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Redes varejistas com pesquisas e auditorias recentes
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('auditoria')}
                className="text-xs text-[#D40511] font-bold hover:underline cursor-pointer shrink-0"
              >
                Ver auditorias &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 mt-5">
              {recentUpdatedChains.map((item) => (
                <div
                  key={item.chain.id}
                  onClick={() => onNavigate('produtos', { chainId: item.chain.id })}
                  className="p-4 rounded-xl border border-slate-100 bg-white hover:border-blue-500/40 hover:bg-slate-50/60 hover:shadow-xs transition-all duration-200 cursor-pointer flex flex-col items-center text-center group"
                >
                  {/* Highlighted Retailer Logo */}
                  <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 mb-3 group-hover:scale-105 group-hover:border-blue-200 transition-all duration-200 flex items-center justify-center">
                    <RetailerLogo chain={item.chain} size="lg" />
                  </div>

                  {/* Chain Name */}
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                    {item.chain.name}
                  </h4>

                  {/* Date below logo */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium mt-1.5">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>{formatDateBR(item.lastUpdateDate)}</span>
                  </div>

                  {/* Product count badge below */}
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-100/80 px-2.5 py-1 rounded-full font-mono">
                      <Package className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{item.updatedProductsCount} {item.updatedProductsCount === 1 ? 'produto' : 'produtos'}</span>
                    </span>
                  </div>
                </div>
              ))}

              {recentUpdatedChains.length === 0 && (
                <div className="col-span-full text-center py-10 text-xs text-slate-400 italic">
                  Nenhuma rede de supermercado com atualização recente.
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

