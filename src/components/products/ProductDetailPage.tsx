import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Camera,
  Calendar,
  Clock,
  TrendingDown,
  TrendingUp,
  MapPin,
  Globe,
  Filter,
  Package,
  Search,
  ChevronDown,
  ChevronUp,
  Pencil,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Store,
  Layers,
  Sparkles,
  BarChart3,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  DollarSign,
  ArrowRight,
  Maximize2,
  Info,
} from 'lucide-react';
import { Product, Chain, PriceRecord, User, RESEARCH_STATES, getChainStates } from '../../types';
import { normalizeString } from '../../lib/textUtils';

interface ProductDetailPageProps {
  product: Product;
  allProducts: Product[];
  chains: Chain[];
  records: PriceRecord[];
  currentUser?: User | null;
  onBack: () => void;
  onRegisterPrice: () => void;
  onEditProduct?: (product: Product) => void;
  onOpenEditPriceModal: (chain: Chain, record?: PriceRecord, stateName?: string) => void;
  onSelectRecord?: (record: PriceRecord) => void;
  onSelectPeerProduct?: (productId: string) => void;
}

export function ProductDetailPage({
  product,
  allProducts,
  chains,
  records,
  currentUser,
  onBack,
  onRegisterPrice,
  onEditProduct,
  onOpenEditPriceModal,
  onSelectRecord,
  onSelectPeerProduct,
}: ProductDetailPageProps) {
  // State variables
  const [detailStateFilter, setDetailStateFilter] = useState<string>('Todas');
  const [selectedChartChains, setSelectedChartChains] = useState<string[]>(() => {
    // Default top 5 chains with most records for this product
    const productRecords = records.filter((r) => r.productId === product.id);
    const chainCounts: Record<string, number> = {};
    productRecords.forEach((r) => {
      chainCounts[r.chainId] = (chainCounts[r.chainId] || 0) + 1;
    });
    const sortedChainIds = Object.keys(chainCounts).sort((a, b) => chainCounts[b] - chainCounts[a]);
    return sortedChainIds.length > 0 ? sortedChainIds.slice(0, 5) : chains.slice(0, 5).map((c) => c.id);
  });
  const [showChartChainSelector, setShowChartChainSelector] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    chainId: string;
    chainName: string;
    date: string;
    price: number;
    x: number;
    y: number;
  } | null>(null);

  // Competitor comparison filters
  const [compareByCategory, setCompareByCategory] = useState(true);
  const [compareBySubcategory, setCompareBySubcategory] = useState(true);
  const [compareByWeight, setCompareByWeight] = useState(false);
  const [competitorCompareChainId, setCompetitorCompareChainId] = useState<string>('Todas');

  // Copy feedback
  const [hasCopied, setHasCopied] = useState(false);
  // Fullscreen photo modal
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);

  // Active section tab for quick jump
  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'chains' | 'competitors' | 'gallery'>('overview');

  // Helper date formatter
  const formatDateBR = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Helper date freshness class
  const getAuditDateColorClass = (dateStr: string | undefined | null) => {
    if (!dateStr) return 'text-slate-400';
    try {
      const today = new Date();
      const auditDate = new Date(dateStr + 'T00:00:00');
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = todayZero.getTime() - auditDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 30) return 'text-rose-600 font-semibold';
      if (diffDays >= 15) return 'text-amber-600 font-medium';
      return 'text-slate-500 font-medium';
    } catch {
      return 'text-slate-400';
    }
  };

  const getChainColor = (chainId: string) => {
    const chain = chains.find((c) => c.id === chainId);
    if (chain && chain.logoColor) {
      if (chain.logoColor.startsWith('#')) return chain.logoColor;
      if (chain.logoColor === 'bg-blue-600') return '#2563eb';
      if (chain.logoColor === 'bg-emerald-700') return '#047857';
      if (chain.logoColor === 'bg-red-500') return '#ef4444';
      if (chain.logoColor === 'bg-amber-600') return '#d97706';
      if (chain.logoColor === 'bg-purple-600') return '#7c3aed';
    }
    const idx = chains.findIndex((c) => c.id === chainId);
    return idx === 0 ? '#D40511' : idx === 1 ? '#0284c7' : idx === 2 ? '#16a34a' : idx === 3 ? '#ea580c' : '#4b5563';
  };

  // All price records for this product sorted by date asc
  const productHistory = useMemo(() => {
    return records
      .filter((r) => r.productId === product.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  }, [records, product.id]);

  // Latest record for this product overall
  const latestRecordOverall = useMemo(() => {
    if (productHistory.length === 0) return null;
    return productHistory[productHistory.length - 1];
  }, [productHistory]);

  const latestChainOverall = useMemo(() => {
    if (!latestRecordOverall) return null;
    return chains.find((c) => c.id === latestRecordOverall.chainId) || null;
  }, [latestRecordOverall, chains]);

  // Brand classification helper
  const brandInfo = useMemo(() => {
    const b = (product.brand || '').toLowerCase().trim();
    const isOetker = b.includes('oetker') || (!product.isCompetitor && !b.includes('mavalerio'));
    const isMavalerio = b.includes('mavalerio') || b.includes('mavalério');
    const isCompetitor = !!product.isCompetitor || (!isOetker && !isMavalerio);

    if (isCompetitor) {
      return {
        label: product.brand || 'Concorrente',
        type: 'competitor',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500',
      };
    }
    if (isMavalerio) {
      return {
        label: product.brand || 'Mavalério',
        type: 'mavalerio',
        badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
        dotClass: 'bg-violet-500',
      };
    }
    return {
      label: product.brand || 'Dr. Oetker',
      type: 'oetker',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }, [product]);

  // Copy product details
  const handleCopySummary = () => {
    const textToCopy = `Produto: ${product.name}\nMarca: ${product.brand || 'Dr. Oetker'}\nCategoria: ${product.category}${product.subcategory ? ` · ${product.subcategory}` : ''}\nGramatura: ${product.weight || 'N/A'}\nCódigo: ${product.internalCode || 'N/A'}\nPreço Base: R$ ${product.basePrice.toFixed(2)}\nÚltimo Preço Auditado: ${latestRecordOverall ? `R$ ${latestRecordOverall.price.toFixed(2)} (${latestChainOverall?.name || 'Rede'})` : 'Sem registros'}`;
    navigator.clipboard?.writeText(textToCopy);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  // State breakdowns & PDV calculation
  const {
    stateBreakdowns,
    allPricedLatestAcrossStates,
    statesWithRecords,
    nationalAvg,
    nationalMinItem,
    nationalMaxItem,
    selectedStateData,
  } = useMemo(() => {
    const recordedStatesSet = new Set<string>();
    productHistory.forEach((r) => {
      const st = r.state || 'Minas Gerais';
      if (st && st.trim()) recordedStatesSet.add(st.trim());
    });

    chains.forEach((ch) => {
      getChainStates(ch).forEach((st) => {
        if (st && st.trim()) recordedStatesSet.add(st.trim());
      });
    });

    const allInvolvedStates = Array.from(recordedStatesSet).sort((a, b) => {
      const aCount = productHistory.filter((r) => (r.state || 'Minas Gerais') === a).length;
      const bCount = productHistory.filter((r) => (r.state || 'Minas Gerais') === b).length;
      if (aCount !== bCount) return bCount - aCount;
      return a.localeCompare(b);
    });

    const breakdowns = allInvolvedStates.map((stateName) => {
      const stateInfo = RESEARCH_STATES.find((s) => s.name === stateName);
      const uf = stateInfo?.uf || (stateName.length >= 2 ? stateName.substring(0, 2).toUpperCase() : 'UF');
      const stateRecords = productHistory.filter((r) => (r.state || 'Minas Gerais') === stateName);
      const stateChains = chains.filter(
        (ch) => getChainStates(ch).includes(stateName) || stateRecords.some((r) => r.chainId === ch.id)
      );

      const chainPricedList = stateChains
        .map((chain) => {
          const recordsForChainInState = stateRecords.filter((r) => r.chainId === chain.id);
          const latestRecord = recordsForChainInState[recordsForChainInState.length - 1];
          return { chain, latestRecord };
        })
        .sort((a, b) => {
          if (a.latestRecord && b.latestRecord) return a.latestRecord.price - b.latestRecord.price;
          if (a.latestRecord && !b.latestRecord) return -1;
          if (!a.latestRecord && b.latestRecord) return 1;
          return a.chain.name.localeCompare(b.chain.name);
        });

      const pricedRecordsInState = chainPricedList
        .filter((item) => item.latestRecord !== undefined)
        .sort((a, b) => a.latestRecord!.price - b.latestRecord!.price);

      let avgPrice = 0;
      let minItem: (typeof pricedRecordsInState)[number] | null = null;
      let maxItem: (typeof pricedRecordsInState)[number] | null = null;

      if (pricedRecordsInState.length > 0) {
        const sum = pricedRecordsInState.reduce((acc, r) => acc + r.latestRecord!.price, 0);
        avgPrice = sum / pricedRecordsInState.length;
        minItem = pricedRecordsInState[0];
        maxItem = pricedRecordsInState[pricedRecordsInState.length - 1];
      }

      return {
        stateName,
        uf,
        totalChains: stateChains.length,
        pricedCount: pricedRecordsInState.length,
        avgPrice,
        minItem,
        maxItem,
        chainPricedList,
        pricedRecordsInState,
        hasRecords: pricedRecordsInState.length > 0,
      };
    });

    const allPricedLatest = breakdowns.flatMap((st) =>
      st.pricedRecordsInState.map((item) => ({ ...item, stateName: st.stateName, uf: st.uf }))
    );

    let natAvg = 0;
    let natMin: (typeof allPricedLatest)[0] | null = null;
    let natMax: (typeof allPricedLatest)[0] | null = null;

    if (allPricedLatest.length > 0) {
      const sum = allPricedLatest.reduce((acc, r) => acc + r.latestRecord!.price, 0);
      natAvg = sum / allPricedLatest.length;
      const sorted = [...allPricedLatest].sort((a, b) => a.latestRecord!.price - b.latestRecord!.price);
      natMin = sorted[0];
      natMax = sorted[sorted.length - 1];
    }

    const stWithRec = breakdowns.filter((st) => st.hasRecords);
    const selState = detailStateFilter !== 'Todas' ? breakdowns.find((s) => s.stateName === detailStateFilter) || null : null;

    return {
      stateBreakdowns: breakdowns,
      allPricedLatestAcrossStates: allPricedLatest,
      statesWithRecords: stWithRec,
      nationalAvg: natAvg,
      nationalMinItem: natMin,
      nationalMaxItem: natMax,
      selectedStateData: selState,
    };
  }, [productHistory, chains, detailStateFilter]);

  // Chart data calculation
  const chartData = useMemo(() => {
    if (productHistory.length === 0) return null;

    const chainSeries: Record<string, { date: string; price: number }[]> = {};
    chains.forEach((c) => {
      chainSeries[c.id] = [];
    });

    productHistory.forEach((r) => {
      if (chainSeries[r.chainId]) {
        chainSeries[r.chainId].push({
          date: r.date,
          price: r.price,
        });
      }
    });

    const uniqueDates = Array.from(new Set(productHistory.map((r) => r.date))).sort();
    const allPrices = productHistory.map((r) => r.price);
    const maxPrice = Math.max(...allPrices, 5) * 1.1;
    const minPrice = Math.max(0, Math.min(...allPrices, 1) * 0.9);

    return {
      chainSeries,
      uniqueDates,
      maxPrice,
      minPrice,
    };
  }, [productHistory, chains]);

  // Competitor benchmarking
  const competitorPeers = useMemo(() => {
    const peers = allProducts.filter((p) => {
      if (!p.active) return false;
      if (p.id !== product.id && !product.isCompetitor && !p.isCompetitor) return false;
      if (compareByCategory && p.category !== product.category) return false;
      if (compareBySubcategory && p.subcategory !== product.subcategory) return false;
      if (compareByWeight && p.weight !== product.weight) return false;
      return true;
    });

    const calculated = peers
      .map((p) => {
        const productRecords = records.filter((r) => {
          if (r.productId !== p.id) return false;
          if (competitorCompareChainId !== 'Todas' && r.chainId !== competitorCompareChainId) return false;
          return true;
        });

        const latestByChain: Record<string, PriceRecord> = {};
        productRecords.forEach((r) => {
          const current = latestByChain[r.chainId];
          if (!current || r.date > current.date) {
            latestByChain[r.chainId] = r;
          }
        });

        const latestRecordsList = Object.values(latestByChain).filter((r) => r.price > 0);
        if (latestRecordsList.length === 0) return null;

        const sum = latestRecordsList.reduce((acc, r) => acc + r.price, 0);
        const averagePrice = sum / latestRecordsList.length;

        let minRec = latestRecordsList[0];
        latestRecordsList.forEach((r) => {
          if (r.price < minRec.price) minRec = r;
        });

        const minChain = chains.find((c) => c.id === minRec.chainId);
        const minChainName = minChain
          ? minChain.name
          : competitorCompareChainId !== 'Todas'
          ? chains.find((c) => c.id === competitorCompareChainId)?.name || 'Rede'
          : 'Preço de tabela';

        return {
          product: p,
          averagePrice,
          minPrice: minRec.price,
          minChainName,
          isSelf: p.id === product.id,
        };
      })
      .filter(Boolean) as {
      product: Product;
      averagePrice: number;
      minPrice: number;
      minChainName: string;
      isSelf: boolean;
    }[];

    return calculated.sort((a, b) => a.averagePrice - b.averagePrice);
  }, [
    allProducts,
    product,
    records,
    chains,
    compareByCategory,
    compareBySubcategory,
    compareByWeight,
    competitorCompareChainId,
  ]);

  const maxPeerPrice = useMemo(() => {
    return competitorPeers.length > 0 ? Math.max(...competitorPeers.map((p) => p.averagePrice), 10) : 10;
  }, [competitorPeers]);

  // Photos history
  const auditPhotos = useMemo(() => {
    return productHistory.filter((r) => r.imageUrl);
  }, [productHistory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" id="modern-product-detail-view">
      {/* 1. TOP BREADCRUMB & CONTEXT HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Back button & Breadcrumb path */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
              title="Voltar ao catálogo de produtos"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao Catálogo</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans truncate">
              <span className="hover:text-slate-800 transition cursor-pointer" onClick={onBack}>
                Produtos
              </span>
              <span>/</span>
              <span className="text-slate-600 font-medium truncate">{product.category}</span>
              {product.subcategory && (
                <>
                  <span>/</span>
                  <span className="text-slate-600 font-medium truncate">{product.subcategory}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
              title="Copiar resumo do produto"
            >
              {hasCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Resumo</span>
                </>
              )}
            </button>

            {onEditProduct && (
              <button
                type="button"
                onClick={() => onEditProduct(product)}
                className="px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-2xs"
                title="Editar informações do produto"
              >
                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                <span>Editar Dados</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRegisterPrice}
              className="px-4 py-2 rounded-xl text-white bg-[#D40511] hover:bg-[#b0040e] transition flex items-center gap-2 text-xs font-bold cursor-pointer shadow-sm shadow-red-500/20 active:scale-95"
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>Registrar Preço no PDV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE PRODUCT HERO PROFILE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Product Visual Card & Specifications (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between">
          <div>
            {/* Image Preview with Zoom */}
            <div
              onClick={() => setFullscreenPhoto({ url: product.imageUrl, title: product.name })}
              className="w-full aspect-square max-h-72 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-center p-4 relative group cursor-pointer hover:border-slate-300 transition overflow-hidden"
              title="Clique para ampliar a foto do produto"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-300">
                  <Package className="w-12 h-12 stroke-[1.5]" />
                  <span className="text-xs font-sans mt-1">Sem imagem</span>
                </div>
              )}

              {/* Hover Zoom pill */}
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-2xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <span className="bg-white/95 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" /> Ampliar Imagem
                </span>
              </div>

              {/* Top Badges */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${brandInfo.badgeClass}`}>
                  {brandInfo.label}
                </span>
              </div>

              {product.internalCode && (
                <div className="absolute top-2.5 right-2.5">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/95 text-slate-700 border border-slate-200 shadow-2xs">
                    #{product.internalCode}
                  </span>
                </div>
              )}
            </div>

            {/* Product Title & Brand Identity */}
            <div className="mt-4">
              <h1 className="text-lg font-black text-slate-900 leading-snug font-sans">{product.name}</h1>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans mt-1">
                <span>{product.category}</span>
                {product.subcategory && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span>{product.subcategory}</span>
                  </>
                )}
                {product.weight && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-700 font-medium">{product.weight}</span>
                  </>
                )}
              </div>
            </div>

            {/* Specifications Matrix */}
            <div className="mt-5 space-y-2.5 pt-4 border-t border-slate-100 text-xs font-sans">
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Preço Base Tabela</span>
                <span className="font-mono font-black text-slate-900">
                  R$ {product.basePrice.toFixed(2).replace('.', ',')}
                </span>
              </div>

              {product.internalCode && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Código Interno</span>
                  <span className="font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80">
                    {product.internalCode}
                  </span>
                </div>
              )}

              {product.weight && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Gramatura / Volume</span>
                  <span className="font-mono font-bold text-slate-700">{product.weight}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Amostras Registradas</span>
                <span className="font-mono font-bold text-slate-800">{productHistory.length} coletas</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400">Evidências com Foto</span>
                <span className="font-mono font-bold text-slate-800">{auditPhotos.length} fotos</span>
              </div>
            </div>
          </div>

          {/* Quick CTA Bottom */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onRegisterPrice}
              className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs font-sans"
            >
              <Camera className="w-3.5 h-3.5 text-red-400" />
              <span>Nova Coleta de Preço</span>
            </button>
          </div>
        </div>

        {/* Right: Key Intelligence Metrics & Executive Cards (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
          {/* Top 4 KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* KPI 1: Último Preço Auditado (Hero) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Último Preço Auditado
                </span>
                {latestRecordOverall && (
                  <span className={`text-[10px] ${getAuditDateColorClass(latestRecordOverall.date)} flex items-center gap-1 font-mono`}>
                    <Clock className="w-3 h-3" /> {formatDateBR(latestRecordOverall.date)}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                  {latestRecordOverall
                    ? `R$ ${latestRecordOverall.price.toFixed(2).replace('.', ',')}`
                    : `R$ ${product.basePrice.toFixed(2).replace('.', ',')}`}
                </span>

                {latestRecordOverall && product.basePrice > 0 && (
                  (() => {
                    const diffPct = ((latestRecordOverall.price - product.basePrice) / product.basePrice) * 100;
                    const isHigher = diffPct > 0.5;
                    const isLower = diffPct < -0.5;
                    return (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          isHigher
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isLower
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {diffPct > 0 ? '+' : ''}
                        {diffPct.toFixed(1)}% vs Base
                      </span>
                    );
                  })()
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span className="font-medium truncate">
                  {latestChainOverall ? `Rede: ${latestChainOverall.name}` : 'Sem histórico de rede'}
                </span>
                {latestRecordOverall?.state && (
                  <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                    {latestRecordOverall.state}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 2: Preço Médio Nacional / Geral */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Média de Mercado
                </span>
                <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {allPricedLatestAcrossStates.length} PDVs ativos
                </span>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                  {nationalAvg > 0 ? `R$ ${nationalAvg.toFixed(2).replace('.', ',')}` : 'Sem dados'}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500 font-sans">
                <span>Spread de Gôndola</span>
                <span className="font-mono font-bold text-slate-700">
                  {nationalMinItem && nationalMaxItem
                    ? `R$ ${(nationalMaxItem.latestRecord!.price - nationalMinItem.latestRecord!.price).toFixed(2).replace('.', ',')} dif.`
                    : '---'}
                </span>
              </div>
            </div>

            {/* KPI 3: Menor Preço Encontrado */}
            <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200/70 shadow-2xs p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
                    Menor Preço
                  </span>
                </div>
                <div className="p-1 bg-emerald-100/60 rounded-lg text-emerald-700">
                  <TrendingDown className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-emerald-950 tabular-nums">
                  {nationalMinItem
                    ? `R$ ${nationalMinItem.latestRecord!.price.toFixed(2).replace('.', ',')}`
                    : 'Sem dados'}
                </span>

                {nationalMinItem && nationalAvg > 0 && (
                  <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                    -{(((nationalAvg - nationalMinItem.latestRecord!.price) / nationalAvg) * 100).toFixed(1)}% vs Média
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-emerald-200/50 text-xs text-emerald-900 font-sans">
                <span className="font-bold truncate">
                  {nationalMinItem ? nationalMinItem.chain.name : 'Nenhum canal ativo'}
                </span>
                {nationalMinItem && (
                  <span className="font-mono text-[10px] font-bold bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                    {nationalMinItem.uf}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: Maior Preço Encontrado */}
            <div className="bg-rose-50/40 rounded-2xl border border-rose-200/70 shadow-2xs p-5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider font-mono">
                    Maior Preço
                  </span>
                </div>
                <div className="p-1 bg-rose-100/60 rounded-lg text-rose-700">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-rose-950 tabular-nums">
                  {nationalMaxItem
                    ? `R$ ${nationalMaxItem.latestRecord!.price.toFixed(2).replace('.', ',')}`
                    : 'Sem dados'}
                </span>

                {nationalMaxItem && nationalAvg > 0 && (
                  <span className="text-[10px] font-bold font-mono text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded">
                    +{(((nationalMaxItem.latestRecord!.price - nationalAvg) / nationalAvg) * 100).toFixed(1)}% vs Média
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-rose-200/50 text-xs text-rose-900 font-sans">
                <span className="font-bold truncate">
                  {nationalMaxItem ? nationalMaxItem.chain.name : 'Nenhum canal ativo'}
                </span>
                {nationalMaxItem && (
                  <span className="font-mono text-[10px] font-bold bg-white/80 px-1.5 py-0.5 rounded border border-rose-200">
                    {nationalMaxItem.uf}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Regional Coverage Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <MapPin className="w-4 h-4 text-[#D40511]" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">Cobertura Geográfica de Pesquisa</span>
                <span className="text-[11px] text-slate-500">
                  {statesWithRecords.length} estados com coletas ativas · {chains.length} redes cadastradas
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {statesWithRecords.slice(0, 5).map((st) => (
                <span
                  key={st.stateName}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200/80 text-[10px] font-mono font-bold text-slate-700"
                >
                  {st.uf}: R$ {st.avgPrice.toFixed(2)}
                </span>
              ))}
              {statesWithRecords.length > 5 && (
                <span className="text-[10px] font-bold text-slate-400">+{statesWithRecords.length - 5}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SECTION TABS / ANCHORS */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 shadow-2xs overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Store className="w-3.5 h-3.5 text-slate-500" />
          <span>Pontos de Venda & Redes</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
            {allPricedLatestAcrossStates.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chart')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'chart'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
          <span>Evolução Histórica</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('competitors')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'competitors'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <span>Benchmarking & Concorrentes</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
            {competitorPeers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gallery')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'gallery'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
          <span>Evidências Fotográficas</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
            {auditPhotos.length}
          </span>
        </button>
      </div>

      {/* 4. TAB 1: PONTOS DE VENDA & VISÃO REGIONAL POR ESTADO */}
      {(activeTab === 'overview' || activeTab === 'chains') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-6">
          {/* Header & State Selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                Visão de Gôndola nos Pontos de Venda
              </span>
              <h2 className="text-base font-black text-slate-900 font-sans mt-0.5 flex items-center gap-2">
                <span>Preços por Rede & Estado</span>
                {statesWithRecords.length > 1 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {statesWithRecords.length} estados pesquisados
                  </span>
                )}
              </h2>
            </div>

            {/* State filter segmented bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setDetailStateFilter('Todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  detailStateFilter === 'Todas'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>Todos ({allPricedLatestAcrossStates.length})</span>
              </button>

              {stateBreakdowns.map((st) => (
                <button
                  key={st.stateName}
                  type="button"
                  onClick={() => setDetailStateFilter(st.stateName)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    detailStateFilter === st.stateName
                      ? 'bg-[#D40511] text-white shadow-xs'
                      : st.hasRecords
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-red-400" />
                  <span>
                    {st.uf} {st.hasRecords ? `(${st.pricedCount})` : '(0)'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Regional Summary Strip when viewing a specific state */}
          {detailStateFilter !== 'Todas' && selectedStateData && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-sans">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-[#D40511] text-white font-black text-[10px] flex items-center justify-center">
                  {selectedStateData.uf}
                </span>
                <div>
                  <span className="font-bold text-slate-900">{selectedStateData.stateName}</span>
                  <span className="text-slate-400 ml-1.5">
                    ({selectedStateData.pricedCount} de {selectedStateData.totalChains} redes pesquisadas)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 font-mono text-[11px]">
                <span>
                  Média: <strong className="text-slate-900 font-bold">R$ {selectedStateData.avgPrice.toFixed(2)}</strong>
                </span>
                {selectedStateData.minItem && (
                  <span className="text-emerald-700 font-medium">
                    Menor: R$ {selectedStateData.minItem.latestRecord!.price.toFixed(2)}
                  </span>
                )}
                {selectedStateData.maxItem && (
                  <span className="text-rose-700 font-medium">
                    Maior: R$ {selectedStateData.maxItem.latestRecord!.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Retailer Cards Grid */}
          <div className="space-y-6">
            {detailStateFilter === 'Todas' ? (
              statesWithRecords.length > 0 ? (
                stateBreakdowns
                  .filter((st) => st.hasRecords)
                  .map((st) => (
                    <div key={st.stateName} className="space-y-3">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-900 text-white font-bold text-[9px] flex items-center justify-center font-mono">
                            {st.uf}
                          </span>
                          <span className="text-xs font-black text-slate-900">{st.stateName}</span>
                          <span className="text-[10px] text-slate-400">· {st.pricedCount} redes auditadas</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Média: <strong className="text-slate-800">R$ {st.avgPrice.toFixed(2)}</strong>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {st.chainPricedList.map(({ chain, latestRecord }) =>
                          renderModernChainCard(chain, latestRecord, st.avgPrice, st.uf, st.stateName)
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  Nenhum preço auditado atualmente para este produto.
                </div>
              )
            ) : selectedStateData && selectedStateData.chainPricedList.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {selectedStateData.chainPricedList.map(({ chain, latestRecord }) =>
                  renderModernChainCard(chain, latestRecord, selectedStateData.avgPrice, selectedStateData.uf, selectedStateData.stateName)
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Nenhuma rede registrada para o estado selecionado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. TAB 2: HISTÓRICO & EVOLUÇÃO TEMPORAL (GRÁFICO) */}
      {(activeTab === 'overview' || activeTab === 'chart') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                Tendência Temporal de Gôndola
              </span>
              <h2 className="text-base font-black text-slate-900 font-sans mt-0.5">
                Histórico & Curva de Preços (R$)
              </h2>
            </div>

            {/* Filter networks button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowChartChainSelector(!showChartChainSelector)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition flex items-center gap-2 text-xs font-bold cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Filtrar Redes ({selectedChartChains.length})</span>
                {showChartChainSelector ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showChartChainSelector && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowChartChainSelector(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-40 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-black text-slate-800 uppercase font-sans">Redes no Gráfico</span>
                      <button
                        type="button"
                        onClick={() => setShowChartChainSelector(false)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800"
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedChartChains(chains.map((c) => c.id))}
                        className="flex-1 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedChartChains([])}
                        className="flex-1 py-1 text-[11px] font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-700 rounded-lg text-slate-700 transition"
                      >
                        Limpar
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {chains.map((chain) => {
                        const isActive = selectedChartChains.includes(chain.id);
                        const count = productHistory.filter((r) => r.chainId === chain.id).length;
                        const strokeColor = getChainColor(chain.id);
                        return (
                          <button
                            key={chain.id}
                            type="button"
                            onClick={() => {
                              if (isActive) {
                                setSelectedChartChains(selectedChartChains.filter((id) => id !== chain.id));
                              } else {
                                setSelectedChartChains([...selectedChartChains, chain.id]);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                              isActive
                                ? 'bg-slate-50 border-slate-300 text-slate-900'
                                : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: isActive ? strokeColor : '#cbd5e1' }}
                              />
                              <span className="truncate">{chain.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{count} pts</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* SVG Line Chart */}
          {chartData && chartData.uniqueDates.length > 0 ? (
            <div className="space-y-3">
              <div className="relative border border-slate-100 rounded-2xl p-4 bg-slate-50/40">
                <svg viewBox="0 0 500 240" className="w-full h-64" fill="none">
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = 30 + ratio * 160;
                    const priceVal = chartData.maxPrice - ratio * (chartData.maxPrice - chartData.minPrice);
                    return (
                      <g key={i}>
                        <line x1="40" y1={y} x2="480" y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                        <text x="35" y={y + 3} fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="end">
                          {priceVal.toFixed(2)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Dates X axis */}
                  {chartData.uniqueDates.map((date, idx, arr) => {
                    const spacing = arr.length > 1 ? 440 / (arr.length - 1) : 440;
                    const x = 40 + idx * spacing;
                    return (
                      <g key={idx}>
                        <line x1={x} y1="30" x2={x} y2="195" stroke="#f1f5f9" strokeWidth="1" />
                        <text x={x} y="215" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                          {formatDateBR(date).substring(0, 5)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Lines per chain */}
                  {chains.map((chain) => {
                    if (!selectedChartChains.includes(chain.id)) return null;
                    const series = chartData.chainSeries[chain.id] || [];
                    if (series.length === 0) return null;

                    const points = series.map((pt) => {
                      const dateIdx = chartData.uniqueDates.indexOf(pt.date);
                      const spacing = chartData.uniqueDates.length > 1 ? 440 / (chartData.uniqueDates.length - 1) : 440;
                      const x = 40 + dateIdx * spacing;
                      const priceRatio = (pt.price - chartData.minPrice) / (chartData.maxPrice - chartData.minPrice || 1);
                      const y = 190 - priceRatio * 160;
                      return { x, y, price: pt.price, date: pt.date };
                    });

                    const pathD = points.reduce((acc, pt, idx) => {
                      return acc + `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y} `;
                    }, '');

                    const strokeColor = getChainColor(chain.id);

                    return (
                      <g key={chain.id}>
                        <path d={pathD} stroke={strokeColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                        {points.map((pt, pIdx) => (
                          <g key={pIdx}>
                            <circle cx={pt.x} cy={pt.y} r="3" fill="#ffffff" stroke={strokeColor} strokeWidth="2.5" />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="12"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => {
                                setHoveredPoint({
                                  chainId: chain.id,
                                  chainName: chain.name,
                                  date: pt.date,
                                  price: pt.price,
                                  x: pt.x,
                                  y: pt.y,
                                });
                              }}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          </g>
                        ))}
                      </g>
                    );
                  })}
                </svg>

                {/* Floating Tooltip */}
                {hoveredPoint && (
                  <div
                    className="absolute z-20 bg-slate-900 text-white rounded-xl p-2.5 shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-[110%] transition-all text-left min-w-[130px]"
                    style={{
                      left: `${(hoveredPoint.x / 500) * 100}%`,
                      top: `${(hoveredPoint.y / 240) * 100}%`,
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getChainColor(hoveredPoint.chainId) }} />
                      <span className="text-[11px] font-bold truncate text-slate-200">{hoveredPoint.chainName}</span>
                    </div>
                    <div className="text-base font-black font-mono mt-1 text-white">
                      R$ {hoveredPoint.price.toFixed(2).replace('.', ',')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatDateBR(hoveredPoint.date)}</div>
                  </div>
                )}
              </div>

              {/* Active Legend Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {chains
                  .filter((c) => selectedChartChains.includes(c.id))
                  .map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      onClick={() => setSelectedChartChains(selectedChartChains.filter((id) => id !== chain.id))}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition cursor-pointer"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getChainColor(chain.id) }} />
                      <span className="truncate max-w-[110px]">{chain.name}</span>
                      <span className="text-[10px] text-slate-400 ml-0.5">&times;</span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="py-12 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <BarChart3 className="w-8 h-8 mb-2 stroke-[1.5]" />
              <p className="text-xs font-medium">Histórico de preços insuficiente para plotagem de curva.</p>
              <p className="text-[11px] text-slate-400 mt-1">Registre novos preços na gôndola para alimentar o gráfico.</p>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 3: BENCHMARKING & CONCORRENTES */}
      {(activeTab === 'overview' || activeTab === 'competitors') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                Posicionamento Competitivo
              </span>
              <h2 className="text-base font-black text-slate-900 font-sans mt-0.5">
                Comparativo de Preço com Concorrentes
              </h2>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCompareByCategory(!compareByCategory)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    compareByCategory ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Categoria: {product.category}
                </button>
                <button
                  type="button"
                  onClick={() => setCompareBySubcategory(!compareBySubcategory)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    compareBySubcategory ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Subcat: {product.subcategory || 'Todas'}
                </button>
                <button
                  type="button"
                  onClick={() => setCompareByWeight(!compareByWeight)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    compareByWeight ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Peso: {product.weight || 'Todos'}
                </button>
              </div>

              <select
                value={competitorCompareChainId}
                onChange={(e) => setCompetitorCompareChainId(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-red-500 cursor-pointer shadow-2xs"
              >
                <option value="Todas">Todas as Redes</option>
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Competitor Items List */}
          {competitorPeers.length > 0 ? (
            <div className="space-y-3">
              {competitorPeers.map((item) => {
                const barWidth = Math.max(12, (item.averagePrice / maxPeerPrice) * 100);
                const isSelf = item.isSelf;

                return (
                  <div
                    key={item.product.id}
                    onClick={() => {
                      if (!isSelf && onSelectPeerProduct) {
                        onSelectPeerProduct(item.product.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      isSelf
                        ? 'bg-amber-50/30 border-amber-300 ring-2 ring-amber-400/30 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="max-h-full max-w-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-bold ${isSelf ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
                              {item.product.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                isSelf
                                  ? 'bg-[#D40511] text-white'
                                  : item.product.isCompetitor
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {isSelf ? 'Este Produto' : item.product.brand || 'Dr. Oetker'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 font-sans mt-1">
                            <span>Menor preço em: <strong className="text-slate-700">{item.minChainName}</strong></span>
                            <span className="text-slate-300">·</span>
                            <span className="font-mono text-emerald-700 font-bold">R$ {item.minPrice.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="block text-[10px] uppercase font-bold text-slate-400 font-mono">
                            {competitorCompareChainId !== 'Todas' ? 'Preço na Rede' : 'Preço Médio'}
                          </span>
                          <span className={`text-base font-black font-mono ${isSelf ? 'text-amber-950' : 'text-slate-900'}`}>
                            R$ {item.averagePrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Horizontal Bar Indicator */}
                    <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isSelf
                            ? 'bg-amber-500'
                            : item.product.isCompetitor
                            ? 'bg-blue-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Nenhum produto correspondente aos filtros para comparação.
            </div>
          )}
        </div>
      )}

      {/* 7. TAB 4: GALERIA DE FOTOS DE AUDITORIA */}
      {(activeTab === 'overview' || activeTab === 'gallery') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                Auditoria Visual & Gôndola
              </span>
              <h2 className="text-base font-black text-slate-900 font-sans mt-0.5">
                Fotos de Auditoria Coletadas ({auditPhotos.length})
              </h2>
            </div>

            <button
              type="button"
              onClick={onRegisterPrice}
              className="text-xs font-bold text-[#D40511] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" /> Adicionar foto
            </button>
          </div>

          {auditPhotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {auditPhotos.map((rec) => {
                const recChain = chains.find((c) => c.id === rec.chainId);
                return (
                  <div
                    key={rec.id}
                    onClick={() => {
                      if (onSelectRecord) {
                        onSelectRecord(rec);
                      } else {
                        setFullscreenPhoto({
                          url: rec.imageUrl,
                          title: `${product.name} - ${recChain?.name || 'Rede'} (R$ ${rec.price.toFixed(2)})`,
                        });
                      }
                    }}
                    className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-[#D40511] hover:shadow-md transition cursor-pointer flex flex-col justify-between"
                  >
                    <div className="aspect-square bg-slate-100 overflow-hidden relative">
                      <img
                        src={rec.imageUrl}
                        alt="Auditoria"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute top-1.5 right-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                        R$ {rec.price.toFixed(2).replace('.', ',')}
                      </div>
                      <div className="absolute inset-0 bg-[#D40511]/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <span className="p-1.5 bg-white/95 rounded-lg text-slate-900 shadow-sm">
                          <ZoomIn className="w-4 h-4 text-[#D40511]" />
                        </span>
                      </div>
                    </div>

                    <div className="p-2 text-left bg-white">
                      <p className="text-[11px] font-bold text-slate-900 truncate">
                        {recChain?.name || 'Rede'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{formatDateBR(rec.date).substring(0, 5)}</span>
                        {rec.state && <span>{rec.state.substring(0, 2).toUpperCase()}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Nenhuma evidência fotográfica registrada para este produto até o momento.
            </div>
          )}
        </div>
      )}

      {/* FULLSCREEN PHOTO LIGHTBOX MODAL */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setFullscreenPhoto(null)}
        >
          <div
            className="max-w-4xl max-h-[85vh] bg-white rounded-2xl p-3 shadow-2xl relative w-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-900 truncate">{fullscreenPhoto.title}</span>
              <button
                type="button"
                onClick={() => setFullscreenPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 text-xs font-bold cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-[300px]">
              <img
                src={fullscreenPhoto.url}
                alt={fullscreenPhoto.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper renderer for modern chain card
  function renderModernChainCard(
    chain: Chain,
    latestRecord: PriceRecord | undefined,
    stateAvgPrice: number,
    stateUF: string,
    stateName: string
  ) {
    let indicatorText = 'Na Média';
    let indicatorClass = 'text-slate-600 bg-slate-100 border-slate-200';
    let borderAccent = 'border-l-4 border-l-slate-300';

    if (latestRecord && stateAvgPrice > 0) {
      const diff = latestRecord.price - stateAvgPrice;
      if (diff < -0.01) {
        borderAccent = 'border-l-4 border-l-emerald-500';
        indicatorText = '- Média';
        indicatorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (diff > 0.01) {
        borderAccent = 'border-l-4 border-l-rose-500';
        indicatorText = '+ Média';
        indicatorClass = 'text-rose-700 bg-rose-50 border-rose-200';
      }
    }

    return (
      <div
        key={`${chain.id}_${stateName}`}
        onClick={() => {
          if (latestRecord?.imageUrl && onSelectRecord) {
            onSelectRecord(latestRecord);
          } else {
            onOpenEditPriceModal(chain, latestRecord, stateName);
          }
        }}
        className={`bg-white rounded-xl border border-slate-200/90 p-3 flex flex-col justify-between shadow-2xs hover:shadow-md transition cursor-pointer ${borderAccent} group`}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[10px] shrink-0 overflow-hidden border border-slate-100"
            style={{ backgroundColor: getChainColor(chain.id) }}
          >
            {chain.logoUrl ? (
              <img src={chain.logoUrl} alt={chain.name} className="w-full h-full object-contain bg-white p-0.5" referrerPolicy="no-referrer" />
            ) : (
              <span>{chain.name.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-black text-slate-900 truncate block leading-tight">{chain.name}</span>
            <span className="text-[9px] font-mono text-slate-400 block leading-none mt-0.5">{stateUF}</span>
          </div>
        </div>

        {/* Price Center */}
        <div className="my-2.5">
          {latestRecord ? (
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-black font-mono text-slate-900 group-hover:text-[#D40511] transition-colors">
                R$ {latestRecord.price.toFixed(2).replace('.', ',')}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono ${indicatorClass}`}>
                {indicatorText}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditPriceModal(chain, undefined, stateName);
              }}
              className="text-xs text-slate-400 hover:text-[#D40511] font-semibold italic flex items-center gap-1 cursor-pointer"
            >
              + Inserir Preço
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1.5 border-t border-slate-100">
          <span>{latestRecord ? formatDateBR(latestRecord.date).substring(0, 5) : 'Sem data'}</span>
          {latestRecord?.imageUrl && (
            <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded text-[8px] font-bold">
              📷 Foto
            </span>
          )}
        </div>
      </div>
    );
  }
}
