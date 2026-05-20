import { useMemo } from 'react';
import { Package, Calendar, TrendingUp, Award, Clock, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';
import { Product, Chain, PriceRecord } from '../types';

interface DashboardProps {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  onNavigate: (page: string, params?: any) => void;
}

export function Dashboard({ products, chains, records, onNavigate }: DashboardProps) {
  // 1. Total products monitored
  const totalProducts = useMemo(() => {
    return products.filter((p) => p.active).length;
  }, [products]);

  // 2. Last price update
  const lastUpdate = useMemo(() => {
    if (records.length === 0) return null;
    // Sort records descending
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = sorted[0];
    const product = products.find((p) => p.id === latest.productId);
    const chain = chains.find((c) => c.id === latest.chainId);
    return {
      date: latest.date,
      productName: product ? product.name : 'Produto Desconhecido',
      chainName: chain ? chain.name : 'Rede Desconhecida',
      price: latest.price,
    };
  }, [records, products, chains]);

  // 3. Product with highest price variance (Max Price - Min Price) / Min Price
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
      // Must have at least 2 registrations to show variance
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

  // 4. Most competitive chain (lowest relative price index or overall average price of shared products)
  const mostCompetitiveChain = useMemo(() => {
    if (records.length === 0 || chains.length === 0) return null;

    // Calculate average price of products in each chain
    const chainMetrics: Record<string, { total: number; count: number }> = {};
    
    // Initialize
    chains.forEach((c) => {
      chainMetrics[c.id] = { total: 0, count: 0 };
    });

    // We only take the most recent record of each product in each chain to avoid historical drift
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

  // Formatted date helper (PT-BR format)
  const formatDateBR = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Recent activity feed
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

  // Chart calculation - Price collection counts over the last 6 days
  const chartDays = useMemo(() => {
    const days = [];
    const countByDay: Record<string, number> = {};

    // Get last 6 calendar days
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '');
      days.push({ iso, label: dayLabel });
      countByDay[iso] = 0;
    }

    records.forEach((r) => {
      if (countByDay[r.date] !== undefined) {
        countByDay[r.date]++;
      }
    });

    return days.map((day) => ({
      name: day.label,
      count: countByDay[day.iso] || 0,
    }));
  }, [records]);

  // Custom mini bar chart with pure elegant SVG
  const maxChartVal = useMemo(() => {
    const vals = chartDays.map(d => d.count);
    return Math.max(...vals, 4); // default min scale height of 4
  }, [chartDays]);

  return (
    <div className="space-y-6" id="dashboard-view">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E0E0E0] pb-6" id="dashboard-header">
        <div>
          <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase font-mono">
            Visão Geral do Sistema
          </span>
          <h1 className="text-3xl font-black text-[#1A1A1A] font-sans">
            RADAR<span className="text-[#D40511]">.</span> Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Status operacional e comparativos de auditoria em tempo real.
          </p>
        </div>
        <button
          id="quick-register-price-shortcut"
          onClick={() => onNavigate('registrar')}
          className="self-start md:self-auto bg-[#D40511] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#b0040e] transition-colors flex items-center gap-2 cursor-pointer shadow-sm hover:shadow"
        >
          <span>+ Registrar Preço</span>
        </button>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-grid">
        {/* KPI 1: Monitored Products */}
        <div className="bg-white p-5 rounded-2xl border border-[#E0E0E0] shadow-sm flex items-start gap-4 hover:border-gray-300 transition-colors" id="kpi-products">
          <div className="p-3 bg-[#F5F5F5] rounded-xl text-[#D40511]">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold font-sans text-gray-400 uppercase tracking-widest">
              Produtos Ativos
            </p>
            <p className="text-2xl font-black text-[#1A1A1A] font-mono mt-1">
              {totalProducts}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[10px] text-gray-500 font-bold">
              <span className="flex items-center gap-1 select-none" title="Dr. Oetker (Nossa Marca)">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {products.filter(p => p.active && !p.isCompetitor && p.brand === 'Dr. Oetker').length} Oetker
              </span>
              <span className="text-gray-350 select-none">•</span>
              <span className="flex items-center gap-1 select-none" title="Mavalério (Nossa Marca)">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500"></span>
                {products.filter(p => p.active && !p.isCompetitor && p.brand === 'Mavalério').length} Mavalério
              </span>
              <span className="text-gray-350 select-none">•</span>
              <span className="flex items-center gap-1 select-none" title="Marcas Concorrentes">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                {products.filter(p => p.active && p.isCompetitor).length} Concorrentes
              </span>
            </div>
            <button
              onClick={() => onNavigate('produtos')}
              className="text-xs text-[#D40511] font-semibold hover:underline mt-2.5 inline-flex items-center gap-1"
            >
              Ver catálogo completo &rarr;
            </button>
          </div>
        </div>

        {/* KPI 2: Last Update */}
        <div className="bg-white p-5 rounded-2xl border border-[#E0E0E0] shadow-sm flex items-start gap-4 hover:border-gray-300 transition-colors" id="kpi-last-update">
          <div className="p-3 bg-[#F5F5F5] rounded-xl text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold font-sans text-gray-400 uppercase tracking-widest">
              Último Registro
            </p>
            {lastUpdate ? (
              <>
                <p className="text-md font-bold text-[#1A1A1A] truncate mt-1">
                  R$ {lastUpdate.price.toFixed(2)}
                </p>
                <p className="text-[11px] text-gray-500 truncate font-sans">
                  {lastUpdate.productName}
                </p>
                <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                  Hoje às {formatDateBR(lastUpdate.date)} em {lastUpdate.chainName}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Nenhum registro ainda</p>
            )}
          </div>
        </div>

        {/* KPI 3: Highest Variance */}
        <div className="bg-white p-5 rounded-2xl border border-[#E0E0E0] shadow-sm flex items-start gap-4 hover:border-gray-300 transition-colors" id="kpi-highest-variance">
          <div className="p-3 bg-[#F5F5F5] rounded-xl text-red-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold font-sans text-gray-400 uppercase tracking-widest">
              Maior Flutuação
            </p>
            {highestVarianceInfo ? (
              <>
                <div className="flex items-center gap-1.5 mt-1">
                  <p className="text-md font-bold text-[#1A1A1A] font-mono">
                    {highestVarianceInfo.variancePercentage}%
                  </p>
                  <span className="text-[10px] bg-red-100 text-[#D40511] font-bold px-1 py-0.2 rounded inline-flex items-center">
                    <ArrowUpRight className="w-3 h-3" /> Máx.
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 truncate font-sans">
                  {highestVarianceInfo.product?.name}
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  R$ {highestVarianceInfo.min.toFixed(2)} &rarr; R$ {highestVarianceInfo.max.toFixed(2)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Sem histórico suficiente</p>
            )}
          </div>
        </div>

        {/* KPI 4: Most Competitive Chain */}
        <div className="bg-white p-5 rounded-2xl border border-[#E0E0E0] shadow-sm flex items-start gap-4 hover:border-gray-300 transition-colors" id="kpi-competitive-chain">
          <div className="p-3 bg-[#F5F5F5] rounded-xl text-emerald-600">
            <Award className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold font-sans text-gray-400 uppercase tracking-widest">
              Rede Competitiva
            </p>
            {mostCompetitiveChain ? (
              <>
                <p className="text-md font-bold text-emerald-700 truncate mt-1">
                  {mostCompetitiveChain.chain?.name}
                </p>
                <p className="text-[11px] text-gray-500 font-sans mt-0.5">
                  Menor índice de ofertas
                </p>
                <p className="text-[10px] text-gray-400 font-mono">
                  Média: R$ {mostCompetitiveChain.averagePrice} ({mostCompetitiveChain.count} itens)
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Nenhum dado das redes</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Dashboard Area - Dynamic Activity Feed and Custom Inline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-details">
        {/* Statistics & Activity Tracking Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm lg:col-span-4 flex flex-col justify-between" id="dashboard-stats-col">
          <div>
            <h3 className="text-md font-bold text-[#1A1A1A] mb-1 font-sans">
              Envios por Período
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Registros consolidados de preços em gôndola nos últimos dias.
            </p>

            {/* Custom SVG Bar Chart */}
            <div className="w-full h-40 flex items-end justify-between gap-1 border-b border-[#E0E0E0] pb-2 mt-4" id="dashboard-svg-chart">
              {chartDays.map((val, idx) => {
                const heightPercentage = Math.round((val.count / maxChartVal) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1A1A1A] text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none z-10">
                      {val.count} reg.
                    </div>
                    {/* Bar graphic */}
                    <div
                      style={{ height: `${Math.max(heightPercentage, 6)}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
                        idx === chartDays.length - 1 ? 'bg-[#D40511]' : 'bg-[#1A1A1A]'
                      } group-hover:opacity-80`}
                    ></div>
                    {/* Tick Label */}
                    <span className="text-[9px] text-gray-400 mt-1.5 font-mono truncate max-w-full text-center">
                      {val.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E0E0E0] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-sans">Total de amostras cadastradas</span>
              <span className="font-mono font-bold text-[#1A1A1A]">{records.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500 font-sans">Fidelidade das auditorias</span>
              <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">100% C/ FOTO</span>
            </div>
          </div>
        </div>

        {/* Recent Audits Table & Feed */}
        <div className="bg-white p-6 rounded-2xl border border-[#E0E0E0] shadow-sm lg:col-span-8" id="dashboard-feed-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-md font-bold text-[#1A1A1A] font-sans">
                Registros de Auditoria Recentes
              </h3>
              <p className="text-xs text-gray-500">
                Últimos preços inseridos pelos colaboradores em campo.
              </p>
            </div>
            <button
              onClick={() => onNavigate('auditoria')}
              className="text-xs text-[#D40511] font-bold hover:underline cursor-pointer"
            >
              Ver auditoria geral &rarr;
            </button>
          </div>

          <div className="overflow-x-auto" id="recent-audits-table-wrapper">
            <table className="w-full text-left border-collapse" id="recent-audits-table">
              <thead>
                <tr className="border-b border-[#E0E0E0] text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                  <th className="py-3 font-semibold">Produto</th>
                  <th className="py-3 font-semibold">Rede</th>
                  <th className="py-3 font-semibold">Preço</th>
                  <th className="py-3 font-semibold">Data</th>
                  <th className="py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F5] text-xs">
                {recentActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 font-medium text-[#1A1A1A] max-w-[200px] truncate">
                      <div className="flex items-center gap-2">
                        <img
                          src={act.product?.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded border border-[#E0E0E0] fill-current"
                        />
                        <span className="truncate">{act.product?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-gray-600 font-sans">
                      {act.chain?.name}
                    </td>
                    <td className="py-3 font-mono font-bold text-[#1A1A1A]">
                      R$ {act.price.toFixed(2)}
                    </td>
                    <td className="py-3 text-gray-500 font-sans">
                      {formatDateBR(act.date)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onNavigate('auditoria', { recordId: act.id })}
                        className="text-[10px] text-[#D40511] border border-[#D40511]/30 hover:border-[#D40511] hover:bg-red-50 font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        Ver Foto
                      </button>
                    </td>
                  </tr>
                ))}
                {recentActivities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400 italic">
                      Nenhum preço registrado no sistema.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
