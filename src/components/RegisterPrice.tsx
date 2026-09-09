import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Camera, Image, CheckCircle2, AlertTriangle, Sparkles, Sliders, RefreshCw, XCircle, Loader2, Eye, ChevronRight, Trash2, Plus, Info, Layers, Check, FastForward, RotateCcw, Package, PackageX, ChevronsRight, Tag, AlertCircle, Store, MapPin, Clock, Calendar, ArrowRight, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Chain, PriceRecord, User, RESEARCH_STATES, isChainInState, getChainStates } from '../types';
import { supabase, uploadToSupabaseStorage, recordAiCorrection } from '../lib/supabase';
import { normalizeString, searchAndRankProducts, safeParseJSON, serializePendingMeta, parsePriceRecordMeta } from '../lib/textUtils';

// Summary data for the research completion screen
interface CompletionSummary {
  state: string;
  chainId: string;
  chainName: string;
  itemsCount: number;
  completedAt: string;
  date: string;
  researcherName: string;
  isPromotor: boolean;
  isGuest: boolean;
}

// Batch analysis list item structure
interface BatchItem {
  id: string;
  imagePreview: string; // compressed base64
  imageUrl?: string;    // uploaded supabase storage url
  recordId?: string;    // corresponding price_record id
  originalSizeKB: number;
  compressedSizeKB: number;
  status: 'pending' | 'compressing' | 'uploading' | 'analyzing' | 'success' | 'failed';
  
  // Analyzed fields
  selectedProductId: string;
  productSearch: string;
  price: string;
  notes: string;
  selectedChainId: string; // prefill with step 1 chain, but editable individually
  confidence: 'high' | 'low';
  aiAnalysisMessage?: string;
  error?: string;

  // Progressive learning tracking fields
  aiSuggestedProductId?: string;
  aiDetectedText?: string;

  // Kept price flag (registered directly without pending audit)
  isKeptPrice?: boolean;
  keptPriceValue?: number;
  state?: string; // Regional state where item was audited
}

// Asynchronous promise-based image compression utility (guarantees max 800x800 resolution)
const compressSingleImagePromise = (base64Str: string, originalBytes: number): Promise<{
  compressedBase64: string;
  originalSizeKB: number;
  compressedSizeKB: number;
}> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({
          compressedBase64: base64Str,
          originalSizeKB: Math.round(originalBytes / 1024),
          compressedSizeKB: Math.round(originalBytes / 1024)
        });
        return;
      }

      // Limita resolução a no máximo 800x800 pixels
      const maxDim = 800;
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // Exporta em JPEG com qualidade otimizada (78%)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.78);
      
      // Calcula o tamanho comprimido em base64
      const stringLength = compressedBase64.length - 'data:image/jpeg;base64,'.length;
      const actualCompressedBytes = stringLength * 0.75; // decodificação base64 exata
      
      resolve({
        compressedBase64,
        originalSizeKB: Math.round(originalBytes / 1024),
        compressedSizeKB: Math.round(actualCompressedBytes / 1024)
      });
    };
    img.onerror = () => {
      resolve({
        compressedBase64: base64Str,
        originalSizeKB: Math.round(originalBytes / 1024),
        compressedSizeKB: Math.round(originalBytes / 1024)
      });
    };
  });
};

// Visual premium logo generator corresponding to Dashboard.tsx RetailerLogo
function RetailerLogo({ chain, size = "md" }: { chain: Chain; size?: "sm" | "md" | "lg" }) {
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
  const sizeClasses = size === "sm" ? "w-6 h-6 text-[9px] font-bold rounded" : size === "md" ? "w-10 h-10 text-sm font-black rounded-lg" : "w-16 h-16 text-xl font-black rounded-xl";

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


interface RegisterPriceProps {
  products: Product[];
  chains: Chain[];
  records?: PriceRecord[];
  onSaveRecord: (newRecord: PriceRecord) => void;
  onUpdateRecord?: (updatedRecord: PriceRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
  currentUser: User | null;
  onNavigate?: (page: string, params?: any) => void;
  onLogout?: () => void;
  pageParams?: {
    productId?: string;
    chainId?: string;
    state?: string;
    skipToStep?: number;
  } | null;
}

export function RegisterPrice({ products, chains, records = [], onSaveRecord, onUpdateRecord, onDeleteRecord, currentUser, onNavigate, onLogout, pageParams }: RegisterPriceProps) {
  // Navigation Steps: 1 (Estado) | 2 (Rede) | 3 (Foto) | 4 (Confirmação) | 5 (Página de Conclusão)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [completionData, setCompletionData] = useState<CompletionSummary | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');

  // Duplication warning confirm
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);

  // Inputs
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedChainId, setSelectedChainId] = useState('');
  const [price, setPrice] = useState('0,00');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Prefill hook from pageParams
  useEffect(() => {
    if (pageParams) {
      if (pageParams.state) {
        setSelectedState(pageParams.state);
      }
      if (pageParams.productId) {
        setSelectedProductId(pageParams.productId);
        const prod = products.find(p => p.id === pageParams.productId);
        if (prod) {
          setProductSearch(prod.name);
          setPrice(prod.basePrice.toFixed(2).replace('.', ','));
        }
      }
      if (pageParams.chainId) {
        setSelectedChainId(pageParams.chainId);
        const matchedChain = chains.find(c => c.id === pageParams.chainId);
        if (matchedChain) {
          const cStates = getChainStates(matchedChain);
          if (cStates.length > 0 && !cStates.includes(selectedState)) {
            setSelectedState(cStates[0]);
          }
        }
      }
      if (pageParams.skipToStep) {
        setStep(pageParams.skipToStep as any);
      }
    }
  }, [pageParams, products, chains]);

  // Estados ordenados pelo número de redes cadastradas (decrescente)
  const sortedResearchStates = useMemo(() => {
    return [...RESEARCH_STATES]
      .map((st) => ({
        ...st,
        chainCount: chains.filter((c) => isChainInState(c, st.name)).length,
      }))
      .sort((a, b) => {
        if (b.chainCount !== a.chainCount) {
          return b.chainCount - a.chainCount;
        }
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [chains]);

  // Redirect after success prompt state
  const [showRedirectPrompt, setShowRedirectPrompt] = useState(false);
  const [lastRegisteredProductId, setLastRegisteredProductId] = useState('');

  // Image & upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [originalSizeKB, setOriginalSizeKB] = useState<number>(0);
  const [compressedSizeKB, setCompressedSizeKB] = useState<number>(0);
  const [compressionRatio, setCompressionRatio] = useState<number>(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingLater, setIsSavingLater] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [batchSaveProgress, setBatchSaveProgress] = useState<{ current: number; total: number } | null>(null);

  // Progressive learning state & worker helper
  const [aiSuggestion, setAiSuggestion] = useState<{
    detectedText: string | null;
    productId: string | null;
  } | null>(null);

  const saveCorrectionSilently = async (
    chainId: string,
    detectedText: string,
    correctProductId: string,
    correctProductName: string,
    createdBy: string
  ) => {
    await recordAiCorrection({
      chainId,
      detectedText,
      correctProductId,
      correctProductName,
      createdBy,
    });
  };

  // IA pricing analyzer state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisMessage, setAiAnalysisMessage] = useState('');
  const [shutterEffect, setShutterEffect] = useState(false);

  // Batch Mode Constant
  const registrationMode = 'batch';
  const [fullscreenProductPhoto, setFullscreenProductPhoto] = useState<{ url: string; name: string } | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchProductSearches, setBatchProductSearches] = useState<Record<string, string>>({});
  const [batchShowSearchDropdowns, setBatchShowSearchDropdowns] = useState<Record<string, boolean>>({});
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState(false);
  const [batchAnalysisProgress, setBatchAnalysisProgress] = useState('');

  // Immediate manual price input state when taking photo without "manter preço"
  const [pendingPriceModal, setPendingPriceModal] = useState<{
    targetProduct: Product | null;
    dataUrl: string;
    originalBytes: number;
    tempId: string;
  } | null>(null);
  const [immediatePrice, setImmediatePrice] = useState('0,00');

  // Calculator-style price formatter (digit input from right to left)
  const formatToCalculatorPrice = (inputValue: string): string => {
    const digits = inputValue.replace(/\D/g, '');
    if (!digits) return '0,00';
    const cents = parseInt(digits, 10);
    return (cents / 100).toFixed(2).replace('.', ',');
  };

  // Total count occurrences per product across all records (for global fallback)
  const productRecordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (records && records.length > 0) {
      records.forEach(r => {
        if (r.productId) {
          counts[r.productId] = (counts[r.productId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [records]);

  // Count occurrences per product for the currently selected chain and state
  const chainRecordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (records && records.length > 0) {
      records.forEach(r => {
        const rState = r.state || 'Minas Gerais';
        if (r.productId && (!selectedChainId || r.chainId === selectedChainId) && (!selectedState || rState === selectedState)) {
          counts[r.productId] = (counts[r.productId] || 0) + 1;
        }
      });
    }
    return counts;
  }, [records, selectedChainId, selectedState]);

  // Category ordering priority rank
  const getCategoryRank = (categoryName?: string) => {
    if (!categoryName) return 50;
    const cat = categoryName.trim().toLowerCase();
    
    if (cat.includes('gelatina')) return 1;
    if (cat.includes('sobremesa')) return 2;
    if (cat.includes('fermento')) return 3;
    if (cat.includes('cobertura')) return 999;
    
    return 50;
  };

  // Subcategory ordering priority rank within each category
  const getSubcategoryRank = (subcategoryName?: string) => {
    if (!subcategoryName) return 50;
    const sub = subcategoryName.trim().toLowerCase();
    
    // Regular / Tradicional / Químico / Em Pó -> Prioridade 1
    if (sub.includes('regular') || sub.includes('tradicional') || sub.includes('químico') || sub.includes('quimico') || sub.includes('pó') || sub.includes('po')) return 1;
    // Zero / Diet / Light / Sem Açúcar -> Prioridade 2
    if (sub.includes('zero') || sub.includes('diet') || sub.includes('light') || sub.includes('sem açúcar') || sub.includes('sem acucar')) return 2;
    // Premium / Gourmet / Especial -> Prioridade 3
    if (sub.includes('premium') || sub.includes('gourmet') || sub.includes('especial')) return 3;
    // Confeiteiro / Profissional -> Prioridade 4
    if (sub.includes('confeiteiro') || sub.includes('profissional') || sub.includes('food service')) return 4;
    
    return 10;
  };

  // Brand ordering priority rank (marca própria primeiro)
  const getBrandRank = (p: Product) => {
    if (!p.isCompetitor) {
      const brandLower = (p.brand || '').toLowerCase();
      if (brandLower.includes('oetker')) return 1;
      if (brandLower.includes('mavalério') || brandLower.includes('mavalerio')) return 2;
      return 3;
    }
    return 10;
  };

  const getBrandDisplayName = (p: Product) => {
    if (!p.brand) {
      return p.isCompetitor ? 'Concorrente' : 'Dr. Oetker';
    }
    return p.brand.trim();
  };

  // Helper to get last registered price for a product in selected chain and state
  const getLastPriceForProductInChain = (productId: string, chainId: string, stateName?: string) => {
    if (!records || records.length === 0 || !productId) return null;

    const targetState = stateName || selectedState;

    let matching = records.filter(r => {
      if (r.productId !== productId || r.price <= 0) return false;
      const { isPending } = parsePriceRecordMeta(r.notes);
      return !isPending;
    });

    if (chainId) {
      const chainMatching = matching.filter(r => r.chainId === chainId);
      if (chainMatching.length > 0) {
        matching = chainMatching;
        // Regional price differentiation: prioritize records for the specific state
        if (targetState) {
          const stateMatching = chainMatching.filter(r => (r.state || 'Minas Gerais') === targetState);
          if (stateMatching.length > 0) {
            matching = stateMatching;
          }
        }
      }
    }

    if (matching.length === 0) return null;

    const sorted = [...matching].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });

    return sorted[0];
  };

  // Queue List for Guided Camera Auditing based on selected chain and at least 1 record
  const frequentProductsList = useMemo(() => {
    if (!products || products.length === 0) return [];

    const activeProds = products.filter(p => p.active);

    // 1. Filtrar produtos ativos que possuem pelo menos 1 registro de preço na rede selecionada
    let eligibleProducts = activeProds.filter(p => (chainRecordCounts[p.id] || 0) > 0);

    // Fallback: se a rede ainda não possuir nenhum registro de preço (ex: rede nova), exibe os produtos ativos com registros gerais ou todo o catálogo ativo
    if (eligibleProducts.length === 0) {
      const prodsWithAnyRecord = activeProds.filter(p => (productRecordCounts[p.id] || 0) > 0);
      eligibleProducts = prodsWithAnyRecord.length > 0 ? prodsWithAnyRecord : activeProds;
    }

    // 2. Ordenar por:
    // - Hierarquia de Categoria (Gelatinas -> Sobremesas -> Fermentos -> Outras alfabeticamente -> Coberturas)
    // - Hierarquia de Subcategoria (Regular/Tradicional -> Zero/Diet -> Premium -> Confeiteiro -> Demais)
    // - Marca por Categoria/Subcategoria (Marca Própria Dr. Oetker/Mavalério PRIMEIRO, depois agrupado por marca concorrente)
    // - Frequência de registros na rede (DESC)
    // - Nome do produto (ASC)
    return [...eligibleProducts].sort((a, b) => {
      const catA = a.category || 'Outros';
      const catB = b.category || 'Outros';

      const rankCatA = getCategoryRank(catA);
      const rankCatB = getCategoryRank(catB);

      if (rankCatA !== rankCatB) {
        return rankCatA - rankCatB;
      }

      if (catA !== catB) {
        const catCompare = catA.localeCompare(catB);
        if (catCompare !== 0) return catCompare;
      }

      // Hierarquia de Subcategoria
      const subA = a.subcategory || '';
      const subB = b.subcategory || '';
      const rankSubA = getSubcategoryRank(subA);
      const rankSubB = getSubcategoryRank(subB);

      if (rankSubA !== rankSubB) {
        return rankSubA - rankSubB;
      }

      if (subA !== subB) {
        const subCompare = subA.localeCompare(subB);
        if (subCompare !== 0) return subCompare;
      }

      // Hierarquia de Marca (Marca própria primeiro, depois agrupado por marca)
      const rankBrandA = getBrandRank(a);
      const rankBrandB = getBrandRank(b);

      if (rankBrandA !== rankBrandB) {
        return rankBrandA - rankBrandB;
      }

      const brandA = getBrandDisplayName(a);
      const brandB = getBrandDisplayName(b);
      if (brandA !== brandB) {
        const brandCompare = brandA.localeCompare(brandB);
        if (brandCompare !== 0) return brandCompare;
      }

      // Frequência de auditoria na rede
      const countA = chainRecordCounts[a.id] || 0;
      const countB = chainRecordCounts[b.id] || 0;
      if (countB !== countA) return countB - countA;

      return a.name.localeCompare(b.name);
    });
  }, [products, chainRecordCounts, productRecordCounts]);

  const [guidedQueue, setGuidedQueue] = useState<Product[]>([]);
  const [outOfStockProductIds, setOutOfStockProductIds] = useState<string[]>([]);
  const [showOutOfStockModal, setShowOutOfStockModal] = useState<boolean>(false);
  const [outOfStockFilterText, setOutOfStockFilterText] = useState<string>('');
  const [capturedProductIds, setCapturedProductIds] = useState<string[]>([]);
  const [useGuidedMode, setUseGuidedMode] = useState<boolean>(true);
  const [keepCurrentPrice, setKeepCurrentPrice] = useState<boolean>(false);
  const [showFreeModeNoticeModal, setShowFreeModeNoticeModal] = useState<boolean>(false);
  const [hasShownFreeModeNotice, setHasShownFreeModeNotice] = useState<boolean>(false);

  // Inicializa ou reinicia a fila guiada quando a rede muda
  useEffect(() => {
    setCapturedProductIds([]);
    setOutOfStockProductIds([]);
    setGuidedQueue(frequentProductsList);
    setKeepCurrentPrice(false);
    setHasShownFreeModeNotice(false);
    setShowFreeModeNoticeModal(false);
  }, [selectedChainId]);

  // Inicializa a fila na primeira carga se estiver vazia
  useEffect(() => {
    if (guidedQueue.length === 0 && capturedProductIds.length === 0 && outOfStockProductIds.length === 0 && frequentProductsList.length > 0) {
      setGuidedQueue(frequentProductsList);
    }
  }, [frequentProductsList]);

  // Active item in guided camera queue
  const currentGuidedProduct = useMemo(() => {
    if (!useGuidedMode || guidedQueue.length === 0) return null;
    return guidedQueue[0];
  }, [useGuidedMode, guidedQueue]);

  // Reseta opção de manter preço quando o produto ativo mudar
  useEffect(() => {
    setKeepCurrentPrice(false);
  }, [currentGuidedProduct?.id]);

  // Guided Queue Action Handlers
  const handleCaptureGuidedProduct = async () => {
    const targetProduct = currentGuidedProduct;
    const shouldKeepPrice = keepCurrentPrice;
    
    // Por padrão, a opção sempre vem desmarcada para o próximo produto
    setKeepCurrentPrice(false);

    if (shouldKeepPrice) {
      if (targetProduct) {
        // Remove imediatamente o produto capturado da fila para exibir o próximo na tela
        setCapturedProductIds(prev => [...prev, targetProduct.id]);
        setGuidedQueue(prev => prev.filter(p => p.id !== targetProduct.id));
      }
      await captureBatchFrame(targetProduct || undefined, true);
    } else {
      // Se NÃO apertar "manter preço", captura a foto na hora e exibe o modal para digitar o preço antes de ir para o próximo produto
      if (!videoRef.current || !canvasRef.current) return;

      // Trigger visual flash shutter effect
      setShutterEffect(true);
      setTimeout(() => setShutterEffect(false), 120);

      // Trigger haptic vibration feedback on mobile devices if supported
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate(40); } catch (_) {}
      }

      const cw = videoRef.current.videoWidth || 640;
      const ch = videoRef.current.videoHeight || 480;

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      canvasRef.current.width = cw;
      canvasRef.current.height = ch;
      ctx.drawImage(videoRef.current, 0, 0, cw, ch);

      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
      const originalBytes = dataUrl.length * 0.75;
      const tempId = `batch-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setPendingPriceModal({
        targetProduct: targetProduct || null,
        dataUrl,
        originalBytes,
        tempId,
      });
      setImmediatePrice('0,00');
    }
  };

  // Confirmação do preço digitado na hora pelo usuário
  const handleConfirmImmediatePrice = async () => {
    if (!pendingPriceModal) return;
    const { targetProduct, dataUrl, originalBytes, tempId } = pendingPriceModal;
    const numericPrice = parseFloat(immediatePrice.replace(',', '.')) || 0;

    if (numericPrice <= 0) {
      setErrorMsg('Por favor, informe um valor maior que zero para o produto.');
      return;
    }

    const capturedTargetProduct = targetProduct;
    const capturedImmediatePrice = immediatePrice;
    
    // Fecha o modal e limpa o valor para liberar imediatamente a tela
    setPendingPriceModal(null);
    setImmediatePrice('0,00');

    // Se estiver em modo guiado com produto alvo, avança imediatamente para o próximo da fila
    if (capturedTargetProduct) {
      setCapturedProductIds(prev => [...prev, capturedTargetProduct.id]);
      setGuidedQueue(prev => prev.filter(p => p.id !== capturedTargetProduct.id));
    }

    // Cria o item no lote com o valor digitado
    const selectedProdId = capturedTargetProduct ? capturedTargetProduct.id : '';
    const prodSearch = capturedTargetProduct ? capturedTargetProduct.name : '';

    const newItem: BatchItem = {
      id: tempId,
      imagePreview: dataUrl,
      originalSizeKB: Math.round(originalBytes / 1024),
      compressedSizeKB: Math.round(originalBytes / 1024),
      status: 'compressing',
      selectedProductId: selectedProdId,
      productSearch: prodSearch,
      price: capturedImmediatePrice,
      notes: capturedTargetProduct ? `[Preço Digitado] ${capturedTargetProduct.name}` : '',
      selectedChainId: selectedChainId,
      confidence: 'high',
      isKeptPrice: false,
      state: selectedState,
    };

    setBatchItems(prev => [...prev, newItem]);

    try {
      const comp = await compressSingleImagePromise(dataUrl, originalBytes);

      setBatchItems(prev => prev.map(item => item.id === tempId ? {
        ...item,
        imagePreview: comp.compressedBase64,
        originalSizeKB: comp.originalSizeKB,
        compressedSizeKB: comp.compressedSizeKB,
        status: 'uploading' as const
      } : item));

      const finalImageUrl = await uploadToSupabaseStorage(comp.compressedBase64, 'images');
      const todayStr = new Date().toISOString().split('T')[0];
      const recordId = `rec-field-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

      // Se for convidado, marca como pendente para auditoria de gestor!
      const isGuest = !!currentUser?.isGuest;
      const finalNotes = isGuest
        ? serializePendingMeta(prodSearch, numericPrice, `[Registro Convidado: ${currentUser?.name || 'Convidado'}]`)
        : (capturedTargetProduct ? `[Preço Digitado] ${capturedTargetProduct.name}` : '');

      const newRecord: PriceRecord = {
        id: recordId,
        productId: selectedProdId,
        chainId: selectedChainId,
        price: numericPrice,
        date: todayStr,
        imageUrl: finalImageUrl || '',
        notes: finalNotes,
        userName: currentUser?.name || 'Vendedor Autônomo',
        userEmail: currentUser?.email || 'vendas@radar.com',
        state: selectedState,
      };

      onSaveRecord(newRecord);

      setBatchItems(prev => prev.map(item => item.id === tempId ? {
        ...item,
        imageUrl: finalImageUrl,
        recordId: recordId,
        status: isGuest ? ('pending' as const) : ('success' as const),
        price: capturedImmediatePrice,
        aiAnalysisMessage: 'Preço registrado pelo usuário'
      } : item));
    } catch (err) {
      console.error('Camera frame compression/upload/save failed:', err);
      setBatchItems(prev => prev.map(item => item.id === tempId ? {
        ...item,
        status: 'failed' as const
      } : item));
    }
  };

  // Cancela a foto atual sem avançar a fila, permitindo ao usuário tirar outra foto
  const handleCancelImmediatePrice = () => {
    setPendingPriceModal(null);
    setImmediatePrice('0,00');
  };

  const handleSkipGuidedProduct = () => {
    setKeepCurrentPrice(false);
    if (!currentGuidedProduct) return;
    const current = currentGuidedProduct;
    // Move o produto atual para o final da fila
    setGuidedQueue(prev => {
      const remaining = prev.filter(p => p.id !== current.id);
      return [...remaining, current];
    });
  };

  const handleSkipSubcategory = () => {
    setKeepCurrentPrice(false);
    if (!currentGuidedProduct) return;
    const currentCat = currentGuidedProduct.category || '';
    const currentSub = currentGuidedProduct.subcategory || '';

    // Move todos os produtos da mesma categoria e subcategoria atual para o final da fila
    setGuidedQueue(prev => {
      const currentGroup = prev.filter(
        p => (p.category || '') === currentCat && (p.subcategory || '') === currentSub
      );
      const remaining = prev.filter(
        p => !((p.category || '') === currentCat && (p.subcategory || '') === currentSub)
      );
      return [...remaining, ...currentGroup];
    });
  };

  const handleMarkOutOfStock = () => {
    setKeepCurrentPrice(false);
    if (!currentGuidedProduct) return;
    const currentId = currentGuidedProduct.id;
    setOutOfStockProductIds(prev => [...prev, currentId]);
    // Remove permanentemente da fila atual
    setGuidedQueue(prev => prev.filter(p => p.id !== currentId));
  };

  const handleResetGuidedQueue = () => {
    setKeepCurrentPrice(false);
    setCapturedProductIds([]);
    setOutOfStockProductIds([]);
    setGuidedQueue(frequentProductsList);
    setUseGuidedMode(true);
    setHasShownFreeModeNotice(false);
    setShowFreeModeNoticeModal(false);
  };

  // Lista de produtos marcados como 'não tem na loja' com os dados completos de cadastro
  const outOfStockProducts = useMemo(() => {
    return outOfStockProductIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => !!p);
  }, [outOfStockProductIds, products]);

  // Filtro por texto na lista de itens sem estoque
  const filteredOutOfStockProducts = useMemo(() => {
    if (!outOfStockFilterText.trim()) return outOfStockProducts;
    const term = normalizeString(outOfStockFilterText);
    return outOfStockProducts.filter(p => {
      const name = normalizeString(p.name);
      const brand = normalizeString(p.brand || '');
      const cat = normalizeString(p.category || '');
      return name.includes(term) || brand.includes(term) || cat.includes(term);
    });
  }, [outOfStockProducts, outOfStockFilterText]);

  // Ao clicar em um produto da lista de "não tem na loja" para registrar
  const handleSelectOutOfStockToRegister = (prod: Product) => {
    // 1. Remove da lista de sem estoque
    setOutOfStockProductIds(prev => prev.filter(id => id !== prod.id));
    // 2. Garante que não está na lista de capturados
    setCapturedProductIds(prev => prev.filter(id => id !== prod.id));
    // 3. Coloca no início da fila para auditar imediatamente na tela
    setGuidedQueue(prev => {
      const filtered = prev.filter(p => p.id !== prod.id);
      return [prod, ...filtered];
    });
    // 4. Ativa o modo guiado
    setUseGuidedMode(true);
    // 5. Se estiver na etapa de confirmação (4), volta para a etapa de fotos (3) com a câmera
    if (step === 4) {
      setStep(3);
    }
    // 6. Inicia a câmera se estiver fechada
    if (!useCamera) {
      startCamera();
    }
    // 7. Fecha o modal
    setShowOutOfStockModal(false);
    setOutOfStockFilterText('');
  };

  const analyzeImage = async (base64Image: string) => {
    setIsAnalyzing(true);
    setAiAnalysisMessage('Iniciando análise inteligente da imagem...');
    try {
      // Parsea imagem para obter dados puros em base64 e mimetype correto
      const matchesImg = base64Image.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      const mimeType = matchesImg ? matchesImg[1] : 'image/jpeg';
      const base64Data = matchesImg ? matchesImg[2] : base64Image;

      // [GITHUB COMENTÁRIO]: Chamada relativa direcionada ao endpoint '/api/analyze-price'.
      // Esta abordagem dinâmica resolve a conformidade de política de CORS ao delegar a chamada
      // para processamento no lado do servidor (seja a Serverless Function na Vercel ou o backend
      // tradicional). Isso elimina chamadas Cross-Origin a partir do frontend no navegador.
      const response = await fetch('/api/analyze-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mediaType: mimeType === 'image/png' ? 'image/png' : mimeType === 'image/webp' ? 'image/webp' : mimeType === 'image/gif' ? 'image/gif' : 'image/jpeg',
          chainId: selectedChainId,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Falha na resposta do servidor de análise inteligente de preço.');
      }

      const responseData = await response.json();
      let data: any = null;

      // [GITHUB COMENTÁRIO]: Suporta dinamicamente as duas formas de retorno JSON:
      // 1. Resposta em formato de array de conteúdo direto da Inteligência Artificial
      // 2. Resposta formatada direta retornada pelo backend tradicional
      if (responseData.content && Array.isArray(responseData.content)) {
        const textContent = responseData.content[0]?.text || '';
        data = safeParseJSON(textContent);
        if (!data) {
          console.error('Falha ao desfragmentar JSON retornado pela API da IA com safeParseJSON. Conteúdo original:', textContent);
        }
      } else {
        data = responseData;
      }
      
      if (data) {
        let priceSet = false;
        const rawPreco = data.preco !== undefined ? data.preco : data.price;
        if (rawPreco !== undefined && rawPreco !== null) {
          const formattedPrice = String(rawPreco).replace('.', ',');
          setPrice(formattedPrice);
          priceSet = true;
        }

        const obsValue = data.observacao || '';
        setNotes(obsValue);

        let finalMatchedName = '';
        let productMatched = false;
        const matchedIdFromAi = data.matchedProductId;
        let suggestedId: string | null = null;
        if (matchedIdFromAi) {
          const matchedProd = products.find(p => p.id === matchedIdFromAi);
          if (matchedProd) {
            setSelectedProductId(matchedProd.id);
            setProductSearch(matchedProd.name);
            finalMatchedName = matchedProd.name;
            productMatched = true;
            suggestedId = matchedProd.id;
          }
        }

        // Busca de fallback por texto similar se matchedProductId não foi retornado mas string produto existe
        if (!productMatched && data.produto) {
          const normalizedDetected = normalizeString(data.produto);
          const matchedProd = products.find(p => {
            const normalizedName = normalizeString(p.name);
            return normalizedName.includes(normalizedDetected) || normalizedDetected.includes(normalizedName);
          });
          if (matchedProd) {
            setSelectedProductId(matchedProd.id);
            setProductSearch(matchedProd.name);
            finalMatchedName = matchedProd.name;
            productMatched = true;
            suggestedId = matchedProd.id;
          }
        }

        if (priceSet && productMatched) {
          setAiAnalysisMessage(`✨ A IA detectou: R$ ${String(rawPreco).replace('.', ',')} para "${finalMatchedName}". ${data.observacao ? `Obs: ${data.observacao}` : ''}`);
        } else if (priceSet) {
          setAiAnalysisMessage(`✨ A IA detectou o Preço (R$ ${String(rawPreco).replace('.', ',')}), mas não identificou com precisão o produto no catálogo. Produto lido: "${data.produto || ''}"`);
        } else if (productMatched) {
          setAiAnalysisMessage(`✨ A IA identificou o Produto "${finalMatchedName}", mas não conseguiu ler o preço.`);
        } else {
          setAiAnalysisMessage(`⚠️ A IA leu: "${data.produto || 'Sem correspondência'}". Não pôde preencher automaticamente.`);
        }

        // Store original suggestion information for identifying corrections later
        setAiSuggestion({
          detectedText: data.produto || data.detectedText || null,
          productId: suggestedId
        });
      }
    } catch (err: any) {
      console.error('Erro na análise automática via Inteligência Artificial:', err);
      // Se chave faltar, exibe ajuda mais amigável
      if (err.message && err.message.includes('VITE_ANTHROPIC_API_KEY')) {
        setAiAnalysisMessage('⚠️ A chave VITE_ANTHROPIC_API_KEY não foi configurada no seu ambiente. Insira os dados manualmente.');
      } else {
        setAiAnalysisMessage('⚠️ Não foi possível analisar a imagem automaticamente. Insira os dados manualmente.');
      }
    } finally {
      setIsAnalyzing(false);
      // Avança para a etapa 4 de formulário para revisão do usuário
      setStep(4);
    }
  };

  // Synchronizes changes from a batch item to the Supabase database in real-time
  const updateBatchItem = (itemId: string, updates: Partial<BatchItem>) => {
    setBatchItems(prev => {
      const updatedList = prev.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, ...updates };
          
          // Trigger DB update in background if it has a recordId
          if (updatedItem.recordId && onUpdateRecord) {
            const todayStr = new Date().toISOString().split('T')[0];
            const cleanPrice = updatedItem.price ? updatedItem.price.replace(',', '.') : '0';
            let priceNum = parseFloat(cleanPrice);
            if (isNaN(priceNum) || priceNum <= 0) {
              priceNum = 0;
            }

            const aiProductSuggested = updatedItem.productSearch || '';
            const aiPriceSuggested = priceNum;
            const finalNotes = serializePendingMeta(aiProductSuggested, aiPriceSuggested, updatedItem.notes);

            const updatedRecord: PriceRecord = {
              id: updatedItem.recordId,
              productId: updatedItem.selectedProductId || '',
              chainId: updatedItem.selectedChainId || selectedChainId,
              price: priceNum,
              date: todayStr,
              imageUrl: updatedItem.imageUrl || '',
              notes: finalNotes,
              userName: currentUser?.name || 'Vendedor Autônomo',
              userEmail: currentUser?.email || 'vendas@radar.com',
              state: updatedItem.state || selectedState,
            };

            onUpdateRecord(updatedRecord);
          }
          return updatedItem;
        }
        return item;
      });
      return updatedList;
    });
  };

  // Restaura produto de volta para a fila guiada de auditoria quando um registro é excluído antes de concluir a pesquisa
  const restoreProductToGuidedQueue = (productId?: string, productNameFallback?: string) => {
    if (!productId && !productNameFallback) return;
    const prod = products.find(p => p.id === productId) ||
      (productNameFallback ? products.find(p => p.name.toLowerCase().trim() === productNameFallback.toLowerCase().trim()) : null);

    if (!prod) return;

    // 1. Remove dos conjuntos de capturados e indisponíveis
    setCapturedProductIds(prev => prev.filter(id => id !== prod.id));
    setOutOfStockProductIds(prev => prev.filter(id => id !== prod.id));

    // 2. Adiciona de volta ao início da fila para que o usuário possa registrar novamente
    setGuidedQueue(prev => {
      const filtered = prev.filter(p => p.id !== prod.id);
      return [prod, ...filtered];
    });

    // 3. Garante que o modo guiado continue ativo
    setUseGuidedMode(true);
  };

  // Removes a batch item from the UI and deletes its pending record from Supabase, returning product to queue
  const removeBatchItem = (item: BatchItem) => {
    setBatchItems(prev => prev.filter(i => i.id !== item.id));
    if (item.recordId && onDeleteRecord) {
      onDeleteRecord(item.recordId);
    }
    restoreProductToGuidedQueue(item.selectedProductId, item.productSearch);
  };

  // Batch Mode Utility: compress target file using promise and limits
  const handleBatchFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    files.forEach((file: File) => {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        const tempId = `batch-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Adiciona à fila em estado de compressão
        const newItem: BatchItem = {
          id: tempId,
          imagePreview: result,
          originalSizeKB: Math.round(file.size / 1024),
          compressedSizeKB: Math.round(file.size / 1024),
          status: 'compressing',
          selectedProductId: '',
          productSearch: '',
          price: '0,00',
          notes: '',
          selectedChainId: selectedChainId,
          confidence: 'low',
          state: selectedState,
        };

        setBatchItems(prev => [...prev, newItem]);

        try {
          // Comprime a imagem para 800x800 antes da API como exigido
          const comp = await compressSingleImagePromise(result, file.size);
          
          setBatchItems(prev => prev.map(item => item.id === tempId ? {
            ...item,
            imagePreview: comp.compressedBase64,
            originalSizeKB: comp.originalSizeKB,
            compressedSizeKB: comp.compressedSizeKB,
            status: 'uploading' as const
          } : item));

          // Realiza o upload automático imediato para armazenamento
          const finalImageUrl = await uploadToSupabaseStorage(comp.compressedBase64, 'images');

          // Registra na auditoria imediatamente (como pendente de preenchimento)
          const todayStr = new Date().toISOString().split('T')[0];
          const recordId = `rec-pending-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
          const finalNotes = serializePendingMeta('', 0, '');

          const newRecord: PriceRecord = {
            id: recordId,
            productId: '',
            chainId: selectedChainId,
            price: 0,
            date: todayStr,
            imageUrl: finalImageUrl || '',
            notes: finalNotes,
            userName: currentUser?.name || 'Vendedor Autônomo',
            userEmail: currentUser?.email || 'vendas@radar.com',
            state: selectedState,
          };

          onSaveRecord(newRecord);

          setBatchItems(prev => prev.map(item => item.id === tempId ? {
            ...item,
            imageUrl: finalImageUrl,
            recordId: recordId,
            status: 'pending' as const
          } : item));

        } catch (err) {
          console.error('File compression/upload/save failed for batch item:', err);
          setBatchItems(prev => prev.map(item => item.id === tempId ? {
            ...item,
            status: 'failed' as const
          } : item));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Captura foto sequencial da câmera em lote e comprime em background
  const captureBatchFrame = async (targetProduct?: Product, keepPrice = false) => {
    if (!videoRef.current || !canvasRef.current) return;

    // Trigger visual flash shutter effect
    setShutterEffect(true);
    setTimeout(() => setShutterEffect(false), 120);

    // Trigger haptic vibration feedback on mobile devices if supported
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try { window.navigator.vibrate(40); } catch (_) {}
    }

    const cw = videoRef.current.videoWidth || 640;
    const ch = videoRef.current.videoHeight || 480;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = cw;
    canvasRef.current.height = ch;
    ctx.drawImage(videoRef.current, 0, 0, cw, ch);

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.95);
    const originalBytes = dataUrl.length * 0.75;

    const tempId = `batch-img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // If target product is passed, pre-fill item fields directly
    const selectedProdId = targetProduct ? targetProduct.id : '';
    const prodSearch = targetProduct ? targetProduct.name : '';

    // Calculate price: if keeping price, look up last registered price for this chain and state
    const lastRec = targetProduct ? getLastPriceForProductInChain(targetProduct.id, selectedChainId, selectedState) : null;
    const priceToKeep = lastRec && lastRec.price > 0
      ? lastRec.price
      : (targetProduct && targetProduct.basePrice > 0 ? targetProduct.basePrice : 0);

    const initialPrice = keepPrice
      ? (priceToKeep > 0 ? priceToKeep.toFixed(2).replace('.', ',') : '0,00')
      : (targetProduct && targetProduct.basePrice > 0
        ? targetProduct.basePrice.toFixed(2).replace('.', ',')
        : '0,00');
    const initialConfidence = (targetProduct || keepPrice) ? 'high' : 'low';

    const newItem: BatchItem = {
      id: tempId,
      imagePreview: dataUrl,
      originalSizeKB: Math.round(originalBytes / 1024),
      compressedSizeKB: Math.round(originalBytes / 1024),
      status: 'compressing',
      selectedProductId: selectedProdId,
      productSearch: prodSearch,
      price: initialPrice,
      notes: keepPrice
        ? `[Preço Mantido] ${targetProduct?.name || ''}`
        : (targetProduct ? `[Auditado em Lote] ${targetProduct.name}` : ''),
      selectedChainId: selectedChainId,
      confidence: initialConfidence,
      isKeptPrice: keepPrice,
      keptPriceValue: keepPrice ? priceToKeep : undefined,
      state: selectedState,
    };

    setBatchItems(prev => [...prev, newItem]);

    try {
      const comp = await compressSingleImagePromise(dataUrl, originalBytes);
      
      setBatchItems(prev => prev.map(item => item.id === tempId ? {
        ...item,
        imagePreview: comp.compressedBase64,
        originalSizeKB: comp.originalSizeKB,
        compressedSizeKB: comp.compressedSizeKB,
        status: 'uploading' as const
      } : item));

      // Realiza o upload automático imediato para armazenamento
      const finalImageUrl = await uploadToSupabaseStorage(comp.compressedBase64, 'images');

      const todayStr = new Date().toISOString().split('T')[0];
      const recordId = keepPrice
        ? `rec-kept-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        : `rec-pending-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const numPrice = keepPrice ? priceToKeep : (parseFloat(initialPrice.replace(',', '.')) || 0);

      const isGuest = !!currentUser?.isGuest;
      // Se for convidado, marca como pendente para auditoria de gestor
      const finalNotes = isGuest
        ? serializePendingMeta(prodSearch, numPrice, `[Registro Convidado - Preço Mantido: ${currentUser?.name || 'Convidado'}]`)
        : (keepPrice
            ? `[Preço Mantido] ${targetProduct?.name || ''}`
            : serializePendingMeta(prodSearch, numPrice, targetProduct ? `[Auditado em Lote] ${targetProduct.name}` : ''));

      const newRecord: PriceRecord = {
        id: recordId,
        productId: selectedProdId,
        chainId: selectedChainId,
        price: numPrice,
        date: todayStr,
        imageUrl: finalImageUrl || '',
        notes: finalNotes,
        userName: currentUser?.name || 'Vendedor Autônomo',
        userEmail: currentUser?.email || 'vendas@radar.com',
        state: selectedState,
      };

      onSaveRecord(newRecord);

      setBatchItems(prev => prev.map(item => item.id === tempId ? {
        ...item,
        imageUrl: finalImageUrl,
        recordId: recordId,
        status: (!isGuest && keepPrice) ? ('success' as const) : ('pending' as const),
        aiAnalysisMessage: keepPrice ? 'Preço anterior mantido pelo usuário' : undefined
      } : item));

    } catch (err) {
      console.error('Camera frame compression/upload/save failed:', err);
      setBatchItems(prev => prev.map(item => item.id === tempId ? {
        ...item,
        status: 'failed' as const
      } : item));
    }
  };

  // Executa análise em paralelo de todas as imagens pendentes do lote
  const analyzeBatchAll = async () => {
    if (batchItems.length === 0) {
      setErrorMsg('Adicione pelo menos uma foto ao lote antes de analisar.');
      return;
    }

    setIsAnalyzingBatch(true);
    setErrorMsg('');

    const itemsToAnalyze = batchItems.filter(item => item.status === 'pending' && !item.isKeptPrice);
    if (itemsToAnalyze.length === 0) {
      setIsAnalyzingBatch(false);
      setStep(4);
      return;
    }

    let completedCount = 0;
    const totalCount = itemsToAnalyze.length;
    setBatchAnalysisProgress(`Iniciando análise de ${totalCount} fotos...`);

    const promises = itemsToAnalyze.map(async (item) => {
      setBatchItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'analyzing' as const } : i));

      try {
        const matchesImg = item.imagePreview.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        const mimeType = matchesImg ? matchesImg[1] : 'image/jpeg';
        const base64Data = matchesImg ? matchesImg[2] : item.imagePreview;

        const response = await fetch('/api/analyze-price', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageBase64: base64Data,
            mediaType: mimeType === 'image/png' ? 'image/png' : mimeType === 'image/webp' ? 'image/webp' : mimeType === 'image/gif' ? 'image/gif' : 'image/jpeg',
            chainId: item.selectedChainId || selectedChainId,
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              brand: p.brand
            }))
          })
        });

        if (!response.ok) {
          throw new Error('Falha de resposta da API');
        }

        const responseData = await response.json();
        let data: any = null;

        if (responseData.content && Array.isArray(responseData.content)) {
          const textContent = responseData.content[0]?.text || '';
          data = safeParseJSON(textContent);
          if (!data) {
            console.error('Falha de parse no item com safeParseJSON. Conteúdo original:', textContent);
          }
        } else {
          data = responseData;
        }

        if (data) {
          let priceSet = false;
          let detectedPrice = '';
          const rawPreco = data.preco !== undefined ? data.preco : data.price;
          if (rawPreco !== undefined && rawPreco !== null) {
            detectedPrice = String(rawPreco).replace('.', ',');
            priceSet = true;
          }

          let matchedProdId = '';
          let matchedProdName = '';
          let productMatched = false;

          const matchedIdFromAi = data.matchedProductId;
          if (matchedIdFromAi) {
            const matchedProd = products.find(p => p.id === matchedIdFromAi);
            if (matchedProd) {
              matchedProdId = matchedProd.id;
              matchedProdName = matchedProd.name;
              productMatched = true;
            }
          }

          if (!productMatched && data.produto) {
            const normalizedDetected = normalizeString(data.produto);
            const matchedProd = products.find(p => {
              const normalizedName = normalizeString(p.name);
              return normalizedName.includes(normalizedDetected) || normalizedDetected.includes(normalizedName);
            });
            if (matchedProd) {
              matchedProdId = matchedProd.id;
              matchedProdName = matchedProd.name;
              productMatched = true;
            }
          }

          let msg = '';
          const confidence: 'high' | 'low' = (priceSet && productMatched) ? 'high' : 'low';

          if (priceSet && productMatched) {
            msg = `A IA detectou: R$ ${detectedPrice} para "${matchedProdName}".`;
          } else if (priceSet) {
            msg = `A IA detectou R$ ${detectedPrice}, mas sem localizar produto no catálogo local.`;
          } else if (productMatched) {
            msg = `A IA detectou "${matchedProdName}", mas sem preço legível.`;
          } else {
            msg = `A IA leu produto: "${data.produto || 'Não identificado'}" sem correspondência.`;
          }

          updateBatchItem(item.id, {
            status: 'success' as const,
            selectedProductId: matchedProdId,
            productSearch: matchedProdName || data.produto || '',
            price: detectedPrice,
            notes: data.observacao || '',
            confidence,
            aiAnalysisMessage: msg,
            aiSuggestedProductId: productMatched ? matchedProdId : undefined,
            aiDetectedText: data.produto || data.detectedText || undefined
          });

          // Atualiza também os campos de busca textuais
          if (matchedProdName || data.produto) {
            setBatchProductSearches(prev => ({
              ...prev,
              [item.id]: matchedProdName || data.produto || ''
            }));
          }

        } else {
          throw new Error('Falha no JSON da IA');
        }
      } catch (err) {
        updateBatchItem(item.id, {
          status: 'failed' as const,
          aiAnalysisMessage: 'Não foi possível identificar — preencha manualmente',
          confidence: 'low' as const
        });
      } finally {
        completedCount++;
        setBatchAnalysisProgress(`Analisando ${completedCount} de ${totalCount} fotos...`);
      }
    });

    await Promise.all(promises);
    setIsAnalyzingBatch(false);
    setStep(4); // Avança direto para a lista de confirmação de lote
  };

  // Envia todos os novos registros do lote em paralelo para o Supabase
  const handleBatchSaveAll = async () => {
    setErrorMsg('');

    // Valida se todos possuem produtos id e preços numéricos corretos
    const invalidItems = batchItems.filter(item => {
      const priceNum = parseFloat(item.price.replace(',', '.'));
      return !item.selectedProductId || isNaN(priceNum) || priceNum <= 0 || item.price === '0,00';
    });

    if (invalidItems.length > 0) {
      setErrorMsg('Existem cards com produtos não selecionados ou com preço zerado (R$ 0,00) no lote. Certifique-se de preencher todos com preços válidos.');
      return;
    }

    setIsSavingAll(true);
    setBatchSaveProgress({ current: 0, total: batchItems.length });
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      let idx = 0;
      for (const item of batchItems) {
        setBatchSaveProgress({ current: idx + 1, total: batchItems.length });

        let finalNotes = item.notes.trim();
        if (!item.isKeptPrice && item.aiAnalysisMessage) {
          finalNotes = finalNotes ? `[Lote / IA] ${finalNotes}` : '[Lote / IA] Monitorado via Scanner Inteligente';
        }

        const priceNum = parseFloat(item.price.replace(',', '.'));

        if (item.recordId && onUpdateRecord) {
          // Update existing pending record in database to make it final (stripping __PENDING_METADATA__)
          const updatedRecord: PriceRecord = {
            id: item.recordId,
            productId: item.selectedProductId,
            chainId: item.selectedChainId || selectedChainId,
            price: priceNum,
            date: todayStr,
            imageUrl: item.imageUrl || '',
            notes: finalNotes || undefined,
            userName: currentUser?.name || 'Vendedor Autônomo',
            userEmail: currentUser?.email || 'vendas@radar.com',
            state: item.state || selectedState,
          };

          onUpdateRecord(updatedRecord);
        } else {
          // Fallback if not saved in background
          let finalImageUrl = item.imageUrl || '';
          if (!finalImageUrl && item.imagePreview) {
            finalImageUrl = await uploadToSupabaseStorage(item.imagePreview, 'images');
          }
          const newRecord: PriceRecord = {
            id: `rec-usr-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            productId: item.selectedProductId,
            chainId: item.selectedChainId || selectedChainId,
            price: priceNum,
            date: todayStr,
            imageUrl: finalImageUrl || undefined,
            notes: finalNotes || undefined,
            userName: currentUser?.name || 'Vendedor Autônomo',
            userEmail: currentUser?.email || 'vendas@radar.com',
            state: item.state || selectedState,
          };
          onSaveRecord(newRecord);
        }

        // Save correction silently in background if user altered the AI's suggested product in the batch item
        if (item.aiDetectedText) {
          if (item.selectedProductId !== item.aiSuggestedProductId) {
            const correctProd = products.find(p => p.id === item.selectedProductId);
            if (correctProd) {
              const chainIdToSave = item.selectedChainId || selectedChainId;
              saveCorrectionSilently(
                chainIdToSave,
                item.aiDetectedText,
                item.selectedProductId,
                correctProd.name,
                currentUser?.email || 'vendas@radar.com'
              );
            }
          }
        }

        idx++;
      }

      const count = batchItems.length;
      const chainObj = chains.find(c => c.id === selectedChainId);
      const isGuest = !!currentUser?.isGuest;
      const chainName = chainObj ? chainObj.name : (isGuest ? 'Rede Pesquisada' : 'Rede Auditada');
      const now = new Date();

      setCompletionData({
        state: selectedState,
        chainId: selectedChainId,
        chainName,
        itemsCount: count,
        completedAt: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('pt-BR'),
        researcherName: currentUser?.name || 'Pesquisador',
        isPromotor: currentUser?.role === 'promotor',
        isGuest,
      });

      setSuccessMsg(false);
      
      // Limpa os dados do lote corporativo e vai para a página de conclusão
      setBatchItems([]);
      setBatchProductSearches({});
      setBatchShowSearchDropdowns({});
      stopCamera();
      setStep(5);

    } catch (err) {
      console.error('Falha de envio batch records:', err);
      setErrorMsg('Ocorreu um erro ao salvar o lote. Por favor, tente novamente.');
    } finally {
      setIsSavingAll(false);
      setBatchSaveProgress(null);
    }
  };

  // Salva os itens do lote para re-analisar depois (status pendente)
  const handleBatchSaveLater = async () => {
    setErrorMsg('');
    setIsSavingLater(true);
    try {
      const count = batchItems.length;
      const chainObj = chains.find(c => c.id === selectedChainId);
      const isGuest = !!currentUser?.isGuest;
      const chainName = chainObj ? chainObj.name : (isGuest ? 'Rede Pesquisada' : 'Rede Auditada');
      const now = new Date();

      setCompletionData({
        state: selectedState,
        chainId: selectedChainId,
        chainName,
        itemsCount: count,
        completedAt: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('pt-BR'),
        researcherName: currentUser?.name || 'Pesquisador',
        isPromotor: currentUser?.role === 'promotor',
        isGuest,
      });

      // Limpa a tela de lote e avança para a página de conclusão
      setSavedLaterCount(null);
      setBatchItems([]);
      setBatchProductSearches({});
      setBatchShowSearchDropdowns({});
      stopCamera();
      setStep(5);

    } catch (err) {
      console.error('Falha ao salvar lote pendente:', err);
      setErrorMsg('Ocorreu um erro ao salvar o lote pendente. Por favor, tente novamente.');
    } finally {
      setIsSavingLater(false);
    }
  };

  // Iniciar uma nova pesquisa a partir da página de conclusão
  const handleStartNewResearch = () => {
    stopCamera();
    setBatchItems([]);
    setBatchProductSearches({});
    setBatchShowSearchDropdowns({});
    setSelectedProductId('');
    setSelectedChainId('');
    setSelectedState('');
    setPrice('0,00');
    setNotes('');
    setProductSearch('');
    setImagePreview(null);
    setAiAnalysisMessage('');
    setErrorMsg('');
    setSuccessMsg(false);
    setCompletionData(null);
    setCapturedProductIds([]);
    setOutOfStockProductIds([]);
    setHasShownFreeModeNotice(false);
    setShowFreeModeNoticeModal(false);
    setStep(1);
  };

  // Finalizar e navegar para a tela de produtos ou logout
  const handleFinishAndNavigateAway = () => {
    setCompletionData(null);
    if (currentUser?.isGuest || completionData?.isGuest) {
      if (onLogout) {
        onLogout();
      } else {
        localStorage.removeItem('pricehub_auth_user');
        localStorage.removeItem('pricehub_session_guest_name');
        window.location.reload();
      }
    } else if (onNavigate) {
      onNavigate('produtos');
    } else if (onLogout) {
      onLogout();
    } else {
      setStep(1);
    }
  };

  const getBatchFilteredProducts = (search: string) => {
    const activeProducts = products.filter(p => p.active);
    if (!search) return activeProducts.slice(0, 5);
    return searchAndRankProducts(activeProducts, search);
  };

  const handleBatchItemProductSelect = (itemId: string, selectedProduct: Product) => {
    updateBatchItem(itemId, { selectedProductId: selectedProduct.id, productSearch: selectedProduct.name });
    setBatchProductSearches(prev => ({
      ...prev,
      [itemId]: selectedProduct.name
    }));
    setBatchShowSearchDropdowns(prev => ({
      ...prev,
      [itemId]: false
    }));
  };

  // Camera integration state
  const [useCamera, setUseCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dispara modal de aviso ao concluir todos os produtos da fila de auditoria
  useEffect(() => {
    if (
      useCamera &&
      useGuidedMode &&
      frequentProductsList.length > 0 &&
      guidedQueue.length === 0 &&
      (capturedProductIds.length > 0 || outOfStockProductIds.length > 0) &&
      !pendingPriceModal &&
      !hasShownFreeModeNotice
    ) {
      setShowFreeModeNoticeModal(true);
      setHasShownFreeModeNotice(true);
    }
  }, [
    useCamera,
    useGuidedMode,
    frequentProductsList.length,
    guidedQueue.length,
    capturedProductIds.length,
    outOfStockProductIds.length,
    pendingPriceModal,
    hasShownFreeModeNotice,
  ]);

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState(false);
  const [savedLaterCount, setSavedLaterCount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Dropdown search filtering
  const filteredProductsBySearch = useMemo(() => {
    const activeProducts = products.filter(p => p.active);
    return searchAndRankProducts(activeProducts, productSearch);
  }, [products, productSearch]);

  // Helper to find latest price in a chain, taking state into account
  const getLatestPrice = (productId: string, chainId: string, stateName?: string) => {
    const targetState = stateName || selectedState;
    let chainRecords = [...records].filter(r => r.productId === productId && r.chainId === chainId);
    if (chainRecords.length === 0) return null;
    if (targetState) {
      const stateRecords = chainRecords.filter(r => (r.state || 'Minas Gerais') === targetState);
      if (stateRecords.length > 0) {
        chainRecords = stateRecords;
      }
    }
    chainRecords.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
    return chainRecords[0].price;
  };

  // Helper to find latest price record in a chain, taking state into account
  const getLatestPriceRecord = (productId: string, chainId: string, stateName?: string) => {
    const targetState = stateName || selectedState;
    let chainRecords = [...records].filter(r => r.productId === productId && r.chainId === chainId);
    if (chainRecords.length === 0) return null;
    if (targetState) {
      const stateRecords = chainRecords.filter(r => (r.state || 'Minas Gerais') === targetState);
      if (stateRecords.length > 0) {
        chainRecords = stateRecords;
      }
    }
    chainRecords.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
    return chainRecords[0];
  };

  // Helper date format BR YYYY-MM-DD -> DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProductId(product.id);
    setProductSearch(product.name);
    setShowSearchDropdown(false);
  };

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Image compressor using Canvas to satisfy "Comprimir imagens antes do upload"
  const compressImage = (base64Str: string, originalBytes: number) => {
    setIsCompressing(true);
    
    // Simulate real visual feedback of compression calculation
    setOriginalSizeKB(Math.round(originalBytes / 1024));

    const img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setImagePreview(base64Str);
        setCompressedSizeKB(Math.round(originalBytes / 1024));
        setCompressionRatio(0);
        setIsCompressing(false);
        if (currentUser?.role === 'promotor') {
          setStep(4);
        } else {
          analyzeImage(base64Str);
        }
        return;
      }

      // Max dimension of 800px for shelf audits
      const maxDim = 800;
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      // Export as JPEG with 0.6 quality (60% comp ratio)
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.78);
      
      // Calculate compressed size
      const stringLength = compressedBase64.length - 'data:image/jpeg;base64,'.length;
      const actualCompressedBytes = stringLength * 0.75; // exact base64 decoding ratio
      
      setImagePreview(compressedBase64);
      setCompressedSizeKB(Math.round(actualCompressedBytes / 1024));
      
      const savedPct = Math.round((1 - (actualCompressedBytes / originalBytes)) * 100);
      setCompressionRatio(savedPct > 0 ? savedPct : 0);
      setIsCompressing(false);
      
      if (currentUser?.role === 'promotor') {
        setStep(4);
      } else {
        analyzeImage(compressedBase64);
      }
    };
  };

  // File Selector input handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, envie um arquivo de imagem válido (PNG/JPG/WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      compressImage(result, file.size);
    };
    reader.readAsDataURL(file);
  };

  // Setup camera stream when camera is active
  useEffect(() => {
    if (useCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => console.error('Video play error:', err));
    }
  }, [useCamera, cameraStream]);

  // Turn on camera for real-time video capture
  const startCamera = async () => {
    setErrorMsg('');
    setUseCamera(true);

    // Initialize guided queue with frequent products list if starting fresh
    if (guidedQueue.length === 0 && capturedProductIds.length === 0) {
      setGuidedQueue(frequentProductsList.filter(p => !outOfStockProductIds.includes(p.id)));
    }
    setUseGuidedMode(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // favor secondary mobile camera
        audio: false,
      });
      setCameraStream(stream);
    } catch (err) {
      console.error('Camera access error:', err);
      // Give fallback mock image if webcam is physically restricted
      setCameraStream(null);
      setErrorMsg('Câmera física indisponível no navegador. Gerando foto de prateleira simulada para gôndola.');
      
      // Seed a lovely preset retail photo to satisfy preview
      setTimeout(() => {
        const fallbackUrl = `data:image/svg+xml;utf8,<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="%23dfdfdf"/><text x="200" y="140" font-family="sans-serif" font-weight="bold" font-size="14" fill="%23D40511" text-anchor="middle">FOTO DE GÔNDOLA AUDITADA</text><text x="200" y="165" font-family="sans-serif" font-size="10" fill="%23555555" text-anchor="middle">Camera simulator fallback - PriceHub Mobile v1.4</text></svg>`;
        compressImage(fallbackUrl, 250000); // simulate 250KB photo
        setUseCamera(false);
      }, 1000);
    }
  };

  // Capture frame from active video feed stream
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const cw = videoRef.current.videoWidth || 640;
    const ch = videoRef.current.videoHeight || 480;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = cw;
    canvasRef.current.height = ch;
    ctx.drawImage(videoRef.current, 0, 0, cw, ch);

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.78);
    
    // Stop camera streams
    stopCamera();

    // Compress raw frame
    const approximateOriginalSize = dataUrl.length * 0.75;
    compressImage(dataUrl, approximateOriginalSize);
  };

  const stopCamera = () => {
    setKeepCurrentPrice(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setUseCamera(false);
  };

  useEffect(() => {
    // Cleanup stream on destruction
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSubmit(false);
  };

  const handleRefuseDuplicate = () => {
    setShowDuplicateConfirm(false);
    setSelectedProductId('');
    setSelectedChainId('');
    setPrice('0,00');
    setNotes('');
    setProductSearch('');
    setImagePreview(null);
    setOriginalSizeKB(0);
    setCompressedSizeKB(0);
    setCompressionRatio(0);
    setAiAnalysisMessage('');
    setIsAnalyzing(false);
    setStep(1);
  };

  const executeSubmit = async (bypassDuplicate = false) => {
    setErrorMsg('');

    if (!selectedProductId) {
      setErrorMsg('Por favor, selecione um produto do catálogo.');
      return;
    }

    if (!selectedChainId) {
      setErrorMsg('Por favor, informe a bandeira da rede onde fez a auditoria.');
      return;
    }

    const priceNum = parseFloat(price.replace(',', '.'));
    
    // Promotores salvam sem preço, com status pendente para auditoria
    if (currentUser?.role === 'promotor') {
      // Ignorar validação de preço
    } else {
      if (isNaN(priceNum) || priceNum <= 0 || price === '0,00') {
        setErrorMsg('O preço de gôndola não pode ser R$ 0,00. Por favor, insira um preço válido.');
        return;
      }
    }

    // Check duplicate: same product, same chain, same day (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    const isDuplicate = records.some(
      (r) =>
        r.productId === selectedProductId &&
        r.chainId === selectedChainId &&
        r.date === todayStr
    );

    if (isDuplicate && !bypassDuplicate) {
      setShowDuplicateConfirm(true);
      return;
    }

    setShowDuplicateConfirm(false);
    setIsUploading(true);
    try {
      let finalImageUrl = '';
      if (imagePreview) {
        finalImageUrl = await uploadToSupabaseStorage(imagePreview, 'images');
      }

      let finalNotes = notes.trim();
      if (aiAnalysisMessage) {
        finalNotes = finalNotes ? `[IA] ${finalNotes}` : '[IA] Monitorado via Scanner Inteligente';
      }
      
      // Se for promotor, sempre injeta o metadata "Pendente" para auditoria,
      // mesmo se o modo single for usado, para que não passe do fluxo de auditoria
      if (currentUser?.role === 'promotor') {
        finalNotes = serializePendingMeta(selectedProductId, priceNum || 0, finalNotes);
      }

      const newRecord: PriceRecord = {
        id: `rec-usr-${Date.now()}`,
        productId: selectedProductId,
        chainId: selectedChainId,
        price: priceNum,
        date: todayStr,
        imageUrl: finalImageUrl,
        notes: finalNotes || undefined,
        userName: currentUser?.name || 'Vendedor Autônomo',
        userEmail: currentUser?.email || 'vendas@radar.com'
      };

      const productIdRegistered = selectedProductId;
      setLastRegisteredProductId(productIdRegistered);

      // Save correction silently in background if user altered the AI's suggested product
      if (aiSuggestion && aiSuggestion.detectedText) {
        if (selectedProductId !== aiSuggestion.productId) {
          const correctProd = products.find(p => p.id === selectedProductId);
          if (correctProd) {
            saveCorrectionSilently(
              selectedChainId,
              aiSuggestion.detectedText,
              selectedProductId,
              correctProd.name,
              currentUser?.email || 'vendas@radar.com'
            );
          }
        }
      }

      onSaveRecord(newRecord);

      const chainObj = chains.find(c => c.id === selectedChainId);
      const isGuest = !!currentUser?.isGuest;
      const chainName = chainObj ? chainObj.name : (isGuest ? 'Rede Pesquisada' : 'Rede Auditada');
      const now = new Date();

      setCompletionData({
        state: selectedState,
        chainId: selectedChainId,
        chainName,
        itemsCount: 1,
        completedAt: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('pt-BR'),
        researcherName: currentUser?.name || 'Pesquisador',
        isPromotor: currentUser?.role === 'promotor',
        isGuest,
      });

      // Show success feedback and clear form
      setSuccessMsg(false);
      setSelectedProductId('');
      setPrice('0,00');
      setNotes('');
      setProductSearch('');
      setImagePreview(null);
      setOriginalSizeKB(0);
      setCompressedSizeKB(0);
      setCompressionRatio(0);
      setAiAnalysisMessage('');
      setIsAnalyzing(false);
      setShowRedirectPrompt(false);
      stopCamera();
      setStep(5); // Go to completion page
    } catch (err: any) {
      console.error("Erro no processamento:", err);
      setErrorMsg("Falha ao salvar auditoria ou hospedar a imagem.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-10" id="register-price-view">

      {/* Visual Stepper Progress Indicator */}
      <div className="flex items-center justify-between max-w-xl mx-auto px-4 select-none" id="stepper-progress-indicator">
        {[
          { num: 1, label: 'Estado', desc: 'UF Pesquisa' },
          { num: 2, label: 'Rede', desc: 'Identificar Canal' },
          { num: 3, label: 'Foto', desc: 'Scanner Inteligente' },
          { num: 5, label: 'Conclusão', desc: 'Finalização' },
        ].map((s, idx) => (
          <React.Fragment key={s.num}>
            {idx > 0 && (
              <div 
                className={`flex-1 h-0.5 mx-1.5 sm:mx-3 transition-colors duration-300 ${
                  (step > s.num || step === 5)
                    ? 'bg-emerald-500'
                    : step >= s.num 
                      ? 'bg-[#D40511]' 
                      : 'bg-slate-100'
                }`}
              />
            )}
            <button
              type="button"
              disabled={s.num > step || step === 5} // Can only navigate backward manually to edit
              onClick={() => {
                if (s.num < step && step !== 5) {
                  stopCamera();
                  setStep(s.num as 1 | 2 | 3 | 4 | 5);
                }
              }}
              className="flex flex-col items-center focus:outline-none group disabled:cursor-not-allowed"
            >
              <div 
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === s.num 
                    ? (s.num === 5 ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-100' : 'bg-[#D40511] text-white shadow-sm ring-4 ring-red-100') 
                    : (step > s.num || (step === 5 && s.num < 5))
                      ? 'bg-emerald-500 text-white shadow-2xs' 
                      : 'bg-slate-50 text-slate-400 border border-slate-100'
                }`}
              >
                {(step > s.num || (step === 5 && s.num <= 5)) ? <CheckCircle2 className="w-4 h-4 text-white" /> : (s.num === 5 ? 4 : s.num)}
              </div>
              <span className={`text-[9px] sm:text-[10px] font-bold mt-1.5 sm:mt-2 tracking-wide uppercase transition-colors duration-300 ${
                step === s.num 
                  ? (s.num === 5 ? 'text-emerald-700' : 'text-slate-800') 
                  : (step === 5 ? 'text-slate-600' : 'text-slate-400')
              }`}>
                {s.label}
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {successMsg && step !== 5 && (
        <div className="p-5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-start gap-4 shadow-sm" id="register-success-box">
          <div className="p-2 bg-emerald-500 text-white rounded-xl">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-bold font-sans">Preço Auditado com Sucesso!</p>
            <p className="text-xs text-emerald-700/90 mt-1 font-medium leading-relaxed">
              O registro foi consolidado, verificado por scanner IA e transmitido em tempo real para o dashboard executivo do PriceHub.
            </p>
          </div>
        </div>
      )}

      {savedLaterCount !== null && step !== 5 && (
        <div className="p-5 bg-emerald-50 border border-emerald-150 text-emerald-900 rounded-2xl flex items-start gap-4 shadow-sm" id="register-saved-later-box">
          <div className="p-2 bg-emerald-600 text-white rounded-xl col-span-1 shrink-0">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-bold font-sans">Pesquisa Concluída com Sucesso!</p>
            <p className="text-xs text-emerald-800/90 mt-1 font-medium leading-relaxed">
              Consolidamos <strong>{savedLaterCount} produto(s)</strong> pesquisados com sucesso. Os preços e fotos foram registrados no sistema.
              {currentUser?.isGuest && (
                <span className="block mt-1 text-emerald-950 font-bold">
                  Seus registros foram enviados e estão disponíveis para auditoria na conta de um gestor.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-5 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-start gap-4 shadow-sm" id="register-error-box">
          <div className="p-2 bg-rose-500 text-white rounded-xl col-span-1 shrink-0">
            <AlertTriangle className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <p className="text-sm font-bold font-sans">Falha na Auditoria</p>
            <p className="text-xs text-rose-700/90 mt-1 font-medium leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* STEP 1 — Selecionar Estado */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-1-container">
          <div className="border-b border-slate-50 pb-4">
            <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
              Etapa 1 — Selecionar Estado da Pesquisa
            </h2>
            <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed">
              Selecione a unidade federativa onde a auditoria de preços em gôndola está sendo realizada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="states-selection-grid">
            {sortedResearchStates.map((st) => {
              const stateChainsCount = st.chainCount;
              const isSelected = selectedState === st.name;

              return (
                <button
                  key={st.uf}
                  type="button"
                  id={`select-state-${st.uf.toLowerCase()}`}
                  onClick={() => {
                    setSelectedState(st.name);
                    setSelectedChainId('');
                    setStep(2);
                  }}
                  className={`p-5 rounded-2xl border text-left flex items-center justify-between gap-4 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-xs cursor-pointer ${
                    isSelected
                      ? 'border-[#D40511] ring-2 ring-red-500/20 bg-red-50/20'
                      : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl font-mono font-black text-xs flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#D40511] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                    }`}>
                      {st.uf}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 truncate leading-snug">
                        {st.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {st.region}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {stateChainsCount} {stateChainsCount === 1 ? 'rede' : 'redes'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-colors shrink-0 ${
                    isSelected ? 'text-[#D40511]' : 'text-slate-300 group-hover:text-slate-500'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2 — Selecionar Rede */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-2-container">
          <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                Etapa 2 — Selecionar Rede ({selectedState})
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                Selecione a rede de {selectedState} para iniciar a pesquisa.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                {selectedState}
              </span>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-[#D40511] hover:underline font-bold cursor-pointer"
              >
                Trocar estado
              </button>
            </div>
          </div>

          {chains.filter((c) => isChainInState(c, selectedState)).length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
              <div className="w-10 h-10 mx-auto rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Nenhuma rede cadastrada em {selectedState}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Ainda não há redes cadastradas para este estado. Você pode cadastrar novas redes na aba de Configurações ou selecionar outro estado.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Voltar e Escolher Outro Estado
                </button>
                {!currentUser?.isGuest && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('configuracoes')}
                    className="px-4 py-2 bg-[#D40511] hover:bg-[#b0040e] text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Ir para Configurações
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="chains-selection-grid">
              {chains
                .filter((chain) => isChainInState(chain, selectedState))
                .map((chain) => {
                  const borderCol = chain.logoColor ? chain.logoColor.replace('bg-', 'border-') : 'border-slate-200';
                  const ringColor = chain.logoColor ? chain.logoColor.replace('bg-', 'ring-') : 'ring-red-500';
                  const allStates = getChainStates(chain);

                  return (
                    <button
                      key={chain.id}
                      type="button"
                      id={`select-chain-${chain.id}`}
                      onClick={() => {
                        setSelectedChainId(chain.id);
                        setStep(3);
                      }}
                      className={`p-5 rounded-2xl border text-left flex items-center gap-4 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-xs cursor-pointer ${
                        selectedChainId === chain.id
                          ? `${borderCol} ring-2 ${ringColor}/30 bg-slate-50/25`
                          : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50/10'
                      }`}
                    >
                      <RetailerLogo chain={chain} size="md" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-800 truncate leading-snug">
                          {chain.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {allStates.map((stName) => {
                            const uf = RESEARCH_STATES.find(s => s.name === stName)?.uf || stName.substring(0, 2).toUpperCase();
                            const isCurrent = stName === selectedState;
                            return (
                              <span
                                key={stName}
                                className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors ${
                                  isCurrent
                                    ? 'bg-red-100 text-[#D40511] font-black'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                                title={stName}
                              >
                                {uf}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0 ml-auto" />
                    </button>
                  );
                })}
            </div>
          )}

          <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-extrabold text-slate-400 hover:text-slate-800 transition duration-150 cursor-pointer inline-flex items-center gap-1"
            >
              &larr; Voltar para Estados
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Foto da Gôndola */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-3-container">
          <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                Etapa 3 — Foto da Gôndola
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                Envie fotos nítidas da etiqueta de preço juntamente com o produto para auditoria.
              </p>
            </div>
            {selectedChainId && (
              <div className="sm:flex items-center gap-2 bg-slate-50 border border-slate-100/50 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 self-start sm:self-auto shrink-0 max-w-full truncate">
                <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                <span className="truncate max-w-[120px]">{chains.find(c => c.id === selectedChainId)?.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({selectedState})</span>
              </div>
            )}
          </div>

          {/* FLUXO REGISTRO EM LOTE (Novos Elementos) */}
          <div className="space-y-6" id="batch-workspace">
              {!useCamera && !isAnalyzingBatch ? (
                <div className="space-y-6">
                  {/* Triggers de entrada do Lote */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      id="btn-open-continuous-camera"
                      onClick={startCamera}
                      className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 hover:from-red-50/50 hover:to-red-50/20 text-slate-700 border border-slate-200 hover:border-[#D40511]/30 flex flex-col items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md text-center group"
                    >
                      <div className="p-3 bg-red-100/80 text-[#D40511] rounded-2xl group-hover:scale-110 group-hover:bg-[#D40511] group-hover:text-white transition-all duration-200 shadow-xs">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-800 block">Tirar Fotos (Câmera do App)</span>
                        <span className="text-[10px] text-slate-400 font-medium font-sans mt-0.5 block">Abra a câmera direto do app e tire as fotos para pesquisa</span>
                      </div>
                    </button>

                    <label
                      className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 hover:from-emerald-50/50 hover:to-emerald-50/20 text-slate-700 border border-slate-200 hover:border-emerald-500/30 flex flex-col items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md text-center group"
                    >
                      <div className="p-3 bg-emerald-100/80 text-emerald-600 rounded-2xl group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200 shadow-xs">
                        <Image className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-800 block">Importar da Galeria / Arquivos</span>
                        <span className="text-[10px] text-slate-400 font-medium font-sans mt-0.5 block">Selecione fotos já salvas do seu dispositivo</span>
                      </div>
                      <input
                        id="register-batch-file-selector"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleBatchFilesChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Grid de miniaturas do Lote */}
                  {outOfStockProductIds.length > 0 && (
                    <div className="flex items-center justify-between bg-rose-50/80 border border-rose-200/80 p-3 rounded-2xl">
                      <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                        <PackageX className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{outOfStockProductIds.length} {outOfStockProductIds.length === 1 ? 'item marcado' : 'itens marcados'} como "Não tem na loja"</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOutOfStockModal(true)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                      >
                        Ver e Registrar
                      </button>
                    </div>
                  )}

                  {batchItems.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Imagens no Lote ({batchItems.length})</span>
                        <button
                          type="button"
                          onClick={() => {
                            batchItems.forEach(item => {
                              if (item.recordId && onDeleteRecord) {
                                onDeleteRecord(item.recordId);
                              }
                              restoreProductToGuidedQueue(item.selectedProductId, item.productSearch);
                            });
                            setBatchItems([]);
                            setBatchProductSearches({});
                            setBatchShowSearchDropdowns({});
                          }}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remover Tudo
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4" id="batch-thumbnails-container">
                        {batchItems.map((item, idx) => {
                          const product = products.find(p => p.id === item.selectedProductId);
                          const productName = product ? product.name : (item.productSearch || `Item ${idx + 1}`);

                          return (
                            <div
                              key={item.id}
                              className="relative border border-slate-200 rounded-2xl overflow-hidden bg-white flex flex-col shadow-2xs hover:shadow-sm transition-all group"
                            >
                              {/* Visual Thumbnail */}
                              <div className="relative w-full h-28 sm:h-32 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
                                <img
                                  src={item.imagePreview}
                                  alt={productName}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-black font-mono px-2 py-0.5 rounded-md">
                                  Foto {idx + 1}
                                </div>
                                {/* Delete single button over corner */}
                                <button
                                  type="button"
                                  onClick={() => removeBatchItem(item)}
                                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full text-white hover:bg-rose-600 hover:scale-110 cursor-pointer transition shadow-md shrink-0"
                                  title="Remover item"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              
                              {/* Card Details/Conferência */}
                              <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                                <div>
                                  {/* Nome do Item */}
                                  <h4 className="text-xs font-black text-slate-800 line-clamp-2 leading-snug" title={productName}>
                                    {productName}
                                  </h4>
                                  {product?.weight && (
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {product.weight}
                                    </span>
                                  )}
                                </div>

                                {/* Valor para Conferência & Status */}
                                <div className="pt-2 border-t border-slate-100 flex flex-col gap-1">
                                  <div className="flex items-baseline justify-between gap-1">
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                                      Valor:
                                    </span>
                                    <span className="text-sm font-black font-mono text-[#D40511]">
                                      R$ {item.price || '0,00'}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 mt-0.5">
                                    {item.isKeptPrice ? (
                                      <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 leading-none uppercase">
                                        <Check className="w-2.5 h-2.5" />
                                        Preço Mantido
                                      </span>
                                    ) : item.status === 'compressing' ? (
                                      <span className="text-[9px] text-violet-600 font-extrabold flex items-center gap-1 leading-none uppercase animate-pulse">
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        Comprimindo
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-emerald-600 font-extrabold flex items-center gap-1 leading-none uppercase">
                                        <Check className="w-3 h-3" />
                                        Pronto {item.compressedSizeKB ? `(${item.compressedSizeKB} KB)` : ''}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Processamento de Salvamento em Lote com Barra de Progresso se salvo de antemão */}
                      {batchSaveProgress && (
                        <div className="w-full bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col gap-2.5" id="batch-save-progress-box-step2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700 font-sans">
                            <span className="flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-indigo-700">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              Salvando e Catalogando Lote de Imagens ({batchSaveProgress.current}/{batchSaveProgress.total})
                            </span>
                            <span className="font-mono text-[11px] font-extrabold text-slate-800">
                              {Math.round((batchSaveProgress.current / batchSaveProgress.total) * 100)}% concluído
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 transition-all duration-300 rounded-full"
                              style={{ width: `${(batchSaveProgress.current / batchSaveProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Botões de Ação do Lote */}
                      <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
                        <button
                          type="button"
                          onClick={handleBatchSaveLater}
                          disabled={isSavingLater || isSavingAll || batchItems.some(i => i.status === 'compressing')}
                          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-xs font-black disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2 uppercase tracking-wide h-12"
                        >
                          {isSavingLater ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                              <span>Concluindo pesquisa...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                              <span>Concluir Pesquisa</span>
                            </>
                          )}
                        </button>

                        {/* Botão de analisar lote com IA oculto por solicitação do usuário. Código mantido intacto para uso futuro. */}
                        {false && currentUser?.role !== 'promotor' && (
                          <button
                            type="button"
                            onClick={analyzeBatchAll}
                            disabled={isSavingLater || isSavingAll || batchItems.some(i => i.status === 'compressing')}
                            className="w-full sm:w-auto bg-[#D40511] hover:bg-[#b0040e] text-white px-8 py-4 rounded-xl text-xs font-extrabold disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2 uppercase tracking-wide h-12"
                          >
                            <Sparkles className="w-4 h-4 text-white shrink-0 animate-pulse" />
                            <span>Analisar Lote com IA ({batchItems.length} Fotos)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : useCamera ? (
                /* Fullscreen camera experience for price registration & shelf auditing */
                <div className="fixed inset-0 z-50 bg-black overflow-hidden flex flex-col justify-between select-none" id="batch-camera-feed">
                  {/* Real-time Video Stream (covers full screen) */}
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    autoPlay
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Visual Shutter Flash Effect */}
                  {shutterEffect && (
                    <div className="absolute inset-0 bg-white z-40 pointer-events-none transition-opacity duration-150" />
                  )}

                  {/* TOP OVERLAY: Navigation Header + Product Information (sobre a câmera, visual limpo) */}
                  <div className="relative z-30 w-full px-3 sm:px-6 pt-3 sm:pt-4 pb-2 bg-gradient-to-b from-black/85 via-black/60 to-transparent space-y-2">
                    {/* Top Navigation Row */}
                    <div className="flex items-center justify-between gap-2 max-w-2xl mx-auto">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="p-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md transition cursor-pointer shrink-0"
                          title="Fechar Câmera"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        {selectedChainId && (
                          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-full text-xs font-bold text-white min-w-0 truncate">
                            <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                            <span className="truncate max-w-[110px] sm:max-w-[170px]">
                              {chains.find(c => c.id === selectedChainId)?.name}
                            </span>
                            <span className="text-[10px] text-white/70 font-mono">
                              ({RESEARCH_STATES.find(s => s.name === selectedState)?.uf || selectedState})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {outOfStockProductIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowOutOfStockModal(true)}
                            className="text-[11px] text-rose-300 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 px-2.5 py-1 rounded-full font-bold transition cursor-pointer flex items-center gap-1 backdrop-blur-sm shadow-xs"
                            title="Ver produtos marcados como 'Não tem na loja'"
                          >
                            <PackageX className="w-3.5 h-3.5 text-rose-400" />
                            <span className="hidden xs:inline">Sem estoque</span>
                            <span>({outOfStockProductIds.length})</span>
                          </button>
                        )}

                        {useGuidedMode ? (
                          <button
                            type="button"
                            onClick={() => setUseGuidedMode(false)}
                            className="text-[11px] text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 rounded-full font-bold transition cursor-pointer backdrop-blur-sm"
                          >
                            Modo Livre
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setUseGuidedMode(true)}
                            className="text-[11px] text-white/95 hover:text-white bg-red-600/80 hover:bg-red-600 border border-red-400/50 px-2.5 py-1 rounded-full font-bold transition cursor-pointer backdrop-blur-sm shadow-xs"
                          >
                            Modo Guiado
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Informação do produto na parte superior sobre a câmera (sem poluir o visual) */}
                    {currentGuidedProduct ? (
                      <motion.div
                        key={currentGuidedProduct.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="bg-black/65 backdrop-blur-md border border-white/20 rounded-2xl p-2.5 sm:p-3 text-white shadow-2xl max-w-2xl mx-auto"
                      >
                        {/* Subheader da auditoria */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-wider text-red-400 font-mono">
                              AUDITORIA ({frequentProductsList.length > 0 ? Math.min(capturedProductIds.length + 1, frequentProductsList.length) : 1}/{frequentProductsList.length})
                            </span>
                          </div>

                          {currentGuidedProduct.category && (
                            <span className="text-[10px] font-bold text-slate-200 bg-white/10 px-2 py-0.5 rounded-md border border-white/10 font-mono truncate max-w-[150px]">
                              {currentGuidedProduct.category}
                            </span>
                          )}
                        </div>

                        {/* Linha com imagem e detalhes do produto */}
                        <div className="flex items-center gap-3">
                          {currentGuidedProduct.imageUrl ? (
                            <button
                              type="button"
                              onClick={() => setFullscreenProductPhoto({
                                url: currentGuidedProduct.imageUrl!,
                                name: currentGuidedProduct.name
                              })}
                              className="relative group w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border border-white/20 hover:border-red-400 bg-white shrink-0 p-0.5 cursor-pointer transition focus:outline-none"
                              title="Clique para ver a foto do produto ampliada"
                            >
                              <img
                                src={currentGuidedProduct.imageUrl}
                                alt={currentGuidedProduct.name}
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Eye className="w-4 h-4 text-white drop-shadow" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-dashed border-white/20 bg-white/10 flex items-center justify-center shrink-0">
                              <Package className="w-6 h-6 text-red-400" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest font-mono">
                                {currentGuidedProduct.brand || 'Marca'}
                              </span>
                              {currentGuidedProduct.weight && (
                                <span className="text-[10px] text-white/70 font-medium">
                                  • {currentGuidedProduct.weight}
                                </span>
                              )}
                            </div>
                            <h3
                              className="text-xs sm:text-sm font-black text-white truncate leading-tight mt-0.5"
                              title={currentGuidedProduct.name}
                            >
                              {currentGuidedProduct.name}
                            </h3>

                            {/* Preço de Referência, Último Preço na Rede e Manter Preço */}
                            {(() => {
                              const lastRec = getLastPriceForProductInChain(currentGuidedProduct.id, selectedChainId, selectedState);
                              const hasLastPrice = !!lastRec && lastRec.price > 0;
                              const stateUf = RESEARCH_STATES.find(s => s.name === selectedState)?.uf || selectedState;

                              return (
                                <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                                  <div className="flex items-center gap-1.5">
                                    {hasLastPrice ? (
                                      <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/75 border border-amber-500/40 px-2 py-0.5 rounded-md">
                                        Último ({stateUf}): R$ {lastRec.price.toFixed(2).replace('.', ',')}
                                      </span>
                                    ) : currentGuidedProduct.basePrice > 0 ? (
                                      <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/75 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                                        Ref: R$ {currentGuidedProduct.basePrice.toFixed(2).replace('.', ',')}
                                      </span>
                                    ) : null}
                                  </div>

                                  {hasLastPrice && (
                                    <label
                                      htmlFor="camera-keep-price-toggle"
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer select-none shrink-0 ${
                                        keepCurrentPrice
                                          ? 'bg-emerald-500/35 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400/60 shadow-xs'
                                          : 'bg-white/10 hover:bg-white/15 border-white/20 text-white/90'
                                      }`}
                                    >
                                      <input
                                        id="camera-keep-price-toggle"
                                        type="checkbox"
                                        checked={keepCurrentPrice}
                                        onChange={(e) => setKeepCurrentPrice(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-emerald-500 focus:ring-0 border-white/30 bg-black/40 cursor-pointer accent-emerald-500"
                                      />
                                      <span className="font-extrabold whitespace-nowrap">
                                        Manter preço
                                      </span>
                                    </label>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      /* Modo Livre Banner */
                      <div className="bg-black/65 backdrop-blur-md border border-white/20 rounded-2xl p-3 text-white shadow-2xl max-w-2xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-red-600/30 border border-red-500/50 flex items-center justify-center text-red-400">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-white block">Modo Livre</span>
                            <span className="text-[11px] text-white/70 block">Aponte para o produto e etiqueta de preço</span>
                          </div>
                        </div>
                        {batchItems.length > 0 && (
                          <span className="text-xs font-mono font-bold text-white bg-white/15 px-2.5 py-1 rounded-lg border border-white/20">
                            {batchItems.length} {batchItems.length === 1 ? 'foto' : 'fotos'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CENTER RETICLE / SCANNER VIEWPORT */}
                  <div className="relative flex-1 pointer-events-none flex items-center justify-center p-4">
                    <div className="w-full max-w-xs sm:max-w-sm aspect-4/3 rounded-3xl border-2 border-dashed border-white/25 relative flex items-center justify-center">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-2xl"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-2xl"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-2xl"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-2xl"></div>
                      <div className="w-full h-0.5 bg-red-500/35 animate-pulse absolute"></div>
                    </div>
                  </div>

                  {/* BOTTOM OVERLAY: Controls Bar */}
                  <div className="relative z-30 w-full px-3 sm:px-6 pt-3 pb-5 sm:pb-8 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex flex-col items-center gap-3">
                    {/* Carrossel horizontal com fotos capturadas na sessão */}
                    {batchItems.length > 0 && (
                      <div className="flex items-center gap-2 max-w-md w-full overflow-x-auto scrollbar-none py-1 px-1">
                        <div className="flex items-center gap-1.5 shrink-0 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
                          <span className="text-[10px] text-white/70 font-mono font-bold uppercase">Capturadas:</span>
                          <span className="text-xs font-mono font-black text-white">{batchItems.length}</span>
                        </div>
                        <div className="h-6 w-px bg-white/20 shrink-0" />
                        <div className="flex items-center gap-2 min-w-0">
                          {batchItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className={`relative w-10 h-10 rounded-xl border-2 ${
                                item.isKeptPrice ? 'border-emerald-400 ring-1 ring-emerald-500/50' : 'border-white/30'
                              } overflow-hidden shrink-0 bg-black/60 shadow-sm`}
                            >
                              <img
                                src={item.imagePreview}
                                alt={`Foto ${idx + 1}`}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              {item.isKeptPrice && (
                                <div className="absolute bottom-0 inset-x-0 bg-emerald-600 text-white text-[7px] font-black text-center py-0.5 leading-none uppercase tracking-tight">
                                  Mantido
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeBatchItem(item)}
                                className="absolute top-0 right-0 p-0.5 bg-black/80 hover:bg-rose-600 text-white rounded-bl-md transition cursor-pointer"
                                title="Remover foto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Linha de Controles: [Pular item] [Categoria] - [🔴 Botão Vermelho Redondo] - [Não tem na loja] [Concluir] */}
                    <div className="flex items-center justify-between w-full max-w-md gap-2 sm:gap-3 px-1">
                      {/* Left 1: Pular item */}
                      <button
                        type="button"
                        onClick={handleSkipGuidedProduct}
                        disabled={!currentGuidedProduct}
                        className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md border border-white/20 transition cursor-pointer shadow-lg disabled:opacity-30 disabled:pointer-events-none group"
                        title="Pular este item individual e tirar foto depois"
                      >
                        <FastForward className="w-5 h-5 text-amber-400 group-hover:scale-110 transition shrink-0" />
                        <span className="text-[9px] sm:text-[10px] font-black text-white/90 mt-1 leading-none tracking-tight">
                          Pular item
                        </span>
                      </button>

                      {/* Left 2: Categoria (Pular categoria) */}
                      <button
                        type="button"
                        onClick={handleSkipSubcategory}
                        disabled={!currentGuidedProduct}
                        className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-500/25 hover:bg-indigo-500/35 active:scale-95 text-indigo-200 backdrop-blur-md border border-indigo-400/30 transition cursor-pointer shadow-lg disabled:opacity-30 disabled:pointer-events-none group"
                        title="Pular todos os itens desta categoria/subcategoria"
                      >
                        <ChevronsRight className="w-5 h-5 text-indigo-300 group-hover:scale-110 transition shrink-0" />
                        <span className="text-[9px] sm:text-[10px] font-black text-indigo-100 mt-1 leading-none tracking-tight">
                          Categoria
                        </span>
                      </button>

                      {/* Center: Botão Vermelho Redondo de Tirar a Foto */}
                      <div className="relative flex items-center justify-center shrink-0 mx-1">
                        <button
                          type="button"
                          id="btn-capture-batch-frame"
                          onClick={handleCaptureGuidedProduct}
                          className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-white/90 active:scale-90 shadow-2xl flex items-center justify-center transition-all duration-150 cursor-pointer ring-4 ring-black/40 ${
                            keepCurrentPrice
                              ? 'bg-emerald-600 hover:bg-emerald-700 ring-emerald-400/40'
                              : 'bg-[#D40511] hover:bg-[#b0040e]'
                          }`}
                          title={keepCurrentPrice ? 'Tirar Foto e Manter Preço' : 'Tirar Foto'}
                        >
                          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full border-2 border-white/40 flex items-center justify-center">
                            <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow" />
                          </div>
                        </button>
                        {keepCurrentPrice && (
                          <span className="absolute -bottom-2 bg-emerald-500 text-white font-black text-[9px] font-mono px-2 py-0.5 rounded-full border border-emerald-300 shadow uppercase tracking-wider">
                            Manter
                          </span>
                        )}
                      </div>

                      {/* Right 1: Não tem na loja */}
                      <button
                        type="button"
                        onClick={handleMarkOutOfStock}
                        disabled={!currentGuidedProduct}
                        className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/25 hover:bg-rose-500/35 active:scale-95 text-rose-200 backdrop-blur-md border border-rose-400/30 transition cursor-pointer shadow-lg disabled:opacity-30 disabled:pointer-events-none group"
                        title="Marca que o produto não está disponível nesta loja"
                      >
                        <PackageX className="w-5 h-5 text-rose-300 group-hover:scale-110 transition shrink-0" />
                        <span className="text-[9px] sm:text-[10px] font-black text-rose-100 mt-1 leading-none tracking-tight">
                          Não tem
                        </span>
                      </button>

                      {/* Right 2: Concluir */}
                      <button
                        type="button"
                        id="btn-stop-camera"
                        onClick={stopCamera}
                        className="flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/25 hover:bg-emerald-500/35 active:scale-95 text-emerald-200 backdrop-blur-md border border-emerald-400/30 transition cursor-pointer shadow-lg relative group"
                        title="Concluir sessão de fotos e revisar lote"
                      >
                        {batchItems.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white font-mono text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-black shadow">
                            {batchItems.length}
                          </span>
                        )}
                        <CheckCircle2 className="w-5 h-5 text-emerald-300 group-hover:scale-110 transition shrink-0" />
                        <span className="text-[9px] sm:text-[10px] font-black text-emerald-100 mt-1 leading-none tracking-tight">
                          Concluir
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : isAnalyzingBatch ? (
                /* Sequential batch AI scanning screen */
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center" id="ai-scanning-progress">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-violet-600 animate-spin"></div>
                    <Sparkles className="w-6 h-6 text-violet-600 animate-pulse absolute top-5 left-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Leitura do Lote em Paralelo</h4>
                    <p className="text-xs text-slate-400 mt-1 animate-pulse font-medium">{batchAnalysisProgress}</p>
                  </div>

                  {/* Tiny progress bars queue */}
                  <div className="w-full max-w-sm bg-slate-50 border border-slate-100 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 mt-4">
                    {batchItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between text-[11px] border-b border-slate-100/50 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-bold text-slate-600">Foto #{idx + 1}</span>
                        {item.status === 'analyzing' && <span className="text-violet-600 font-extrabold uppercase animate-pulse">Iniciando análise...</span>}
                        {item.status === 'success' && <span className="text-emerald-600 font-extrabold uppercase">Completo!</span>}
                        {item.status === 'failed' && <span className="text-rose-600 font-extrabold uppercase">Falhou</span>}
                        {item.status === 'pending' && <span className="text-slate-400 font-medium">Aguardando...</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

          <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setStep(2);
              }}
              className="text-xs font-extrabold text-slate-400 hover:text-slate-850 transition duration-150 cursor-pointer inline-flex items-center gap-1"
            >
              &larr; Voltar para Redes
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — Confirmação dos dados (Ocultado na página conforme solicitado, códigos mantidos intactos) */}
      {false && step === 4 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-8 space-y-6" id="step-4-container">
          <div className="border-b border-slate-50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest leading-none">
                Etapa 4 — Confirmação dos dados
              </h2>
              <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">
                {registrationMode === 'batch' 
                  ? 'Revise os valores detectados no lote e associe cada foto a um produto cadastrado.' 
                  : 'Revise os valores detectados automaticamente ou faça as correções necessárias.'}
              </p>
            </div>
            {selectedChainId && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 self-start sm:self-auto shrink-0 max-w-full truncate">
                <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                <span className="truncate max-w-[120px] font-bold">{chains.find(c => c.id === selectedChainId)?.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({selectedState})</span>
              </div>
            )}
          </div>

          <>
            /* CONFIGURAÇÃO EM FILA DE CARDS PARA O MODO EM LOTE */
            <div className="space-y-6 animate-fade-in" id="batch-confirmation-queue">
              <div className="p-4 bg-violet-50/50 border border-violet-100 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-xs font-extrabold text-violet-950 uppercase tracking-wider font-sans">Scanner do Lote Ativo</h4>
                  <p className="text-[11px] text-violet-700/90 mt-1 leading-relaxed font-sans">
                    A Inteligência Artificial analisou as {batchItems.length} fotos em paralelo. Identifique ou vincule o produto correto do catálogo abaixo e verifique os preços detectados.
                  </p>
                </div>
              </div>

              {outOfStockProductIds.length > 0 && (
                <div className="flex items-center justify-between bg-rose-50/80 border border-rose-200/80 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-2 text-rose-800 text-xs font-bold">
                    <PackageX className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{outOfStockProductIds.length} {outOfStockProductIds.length === 1 ? 'item marcado' : 'itens marcados'} como "Não tem na loja"</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOutOfStockModal(true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Ver e Registrar
                  </button>
                </div>
              )}

              <div className="space-y-6" id="batch-cards-queue-list">
                {batchItems.map((item, idx) => {
                  const resolvedProduct = products.find((p) => p.id === item.selectedProductId);
                  const isLowConfidence = item.confidence === 'low' || item.status === 'failed';

                  return (
                    <div 
                      key={item.id} 
                      className={`p-5 rounded-2xl border bg-white shadow-3xs transition-all relative ${
                        isLowConfidence 
                          ? 'border-amber-200 bg-amber-50/15' 
                          : 'border-slate-100 hover:border-slate-200'
                      }`}
                      id={`batch-item-card-${item.id}`}
                    >
                      {/* Card Header Row */}
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-extrabold">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-750 font-sans">Gôndola Auditada</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.isKeptPrice ? (
                            <span className="bg-emerald-50 text-emerald-800 border-emerald-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider font-sans">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              Preço Mantido
                            </span>
                          ) : isLowConfidence ? (
                            <span className="bg-amber-50 text-amber-800 border-amber-100 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider font-sans">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              Preenchimento Manual
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-800 border-emerald-100 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider font-sans">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse shrink-0" />
                              Leitura Concluída ({item.confidence === 'high' ? 'Alta' : 'Detectada'})
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              removeBatchItem(item);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition shrink-0 cursor-pointer hover:bg-slate-50"
                            title="Remover esta foto do lote"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Content Row visual */}
                      <div className="flex flex-col md:flex-row gap-5">
                        {/* Left Side: Photo preview details and sizes */}
                        <div className="w-full md:w-32 shrink-0 flex flex-col items-center gap-2">
                          <div 
                            className="w-32 h-32 rounded-xl bg-slate-50 border border-slate-150 overflow-hidden flex items-center justify-center shadow-inner pt-1 cursor-pointer group hover:ring-2 hover:ring-[#D40511] transition-all relative select-none"
                            onClick={() => setFullscreenProductPhoto({ url: item.imagePreview, name: `Foto do Rótulo de Gôndola - Lote ${idx + 1}` })}
                            title="Clique para ver a foto em tela cheia"
                          >
                            <img 
                              src={item.imagePreview} 
                              alt={`Lote - ${idx + 1}`} 
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Search className="w-5 h-5 text-white shrink-0" />
                            </div>
                          </div>
                          {item.compressedSizeKB && (
                            <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                              Compresso: {item.compressedSizeKB} KB
                            </span>
                          )}
                        </div>

                        {/* Right Side: Field Editor controls */}
                        <div className="flex-1 min-w-0 space-y-4">
                          
                          {/* Rich Product Autocomplete Selector */}
                          <div className="relative">
                            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                              1. Vincular Produto Catalogo *
                            </label>
                            
                            <div className="relative">
                              <input 
                                type="text" 
                                placeholder="Insira o nome, marca ou categoria para buscar no catálogo..." 
                                value={batchProductSearches[item.id] !== undefined ? batchProductSearches[item.id] : (resolvedProduct?.name || '')}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBatchProductSearches(prev => ({ ...prev, [item.id]: val }));
                                  setBatchShowSearchDropdowns(prev => ({ ...prev, [item.id]: true }));
                                  if (!val) {
                                    updateBatchItem(item.id, { selectedProductId: '' });
                                  }
                                }}
                                onFocus={() => {
                                  setBatchShowSearchDropdowns(prev => ({ ...prev, [item.id]: true }));
                                }}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#D40511] focus:ring-1 focus:ring-[#D40511]"
                              />
                              {(batchProductSearches[item.id] || resolvedProduct?.name) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBatchProductSearches(prev => ({ ...prev, [item.id]: '' }));
                                    updateBatchItem(item.id, { selectedProductId: '' });
                                    setBatchShowSearchDropdowns(prev => ({ ...prev, [item.id]: true }));
                                  }}
                                  className="absolute right-3.5 top-3 text-[10px] text-slate-400 hover:text-slate-600 font-bold cursor-pointer bg-white px-1.5"
                                >
                                  Limpar
                                </button>
                              )}
                            </div>

                            {/* Dropdown elements filter list */}
                            {batchShowSearchDropdowns[item.id] && (
                              <div className="absolute z-30 w-full left-0 mt-1.5 bg-white border border-slate-250 rounded-xl shadow-xl max-h-40 overflow-y-auto" id={`dropdown-batch-item-${item.id}`}>
                                {getBatchFilteredProducts(batchProductSearches[item.id] || '').map((p) => {
                                  const bChainId = item.selectedChainId || selectedChainId;
                                  const latestPrice = bChainId ? getLatestPrice(p.id, bChainId) : null;

                                  return (
                                    <div 
                                      key={p.id}
                                      onClick={() => handleBatchItemProductSelect(item.id, p)}
                                      className="px-3.5 py-2.5 hover:bg-slate-50 text-xs text-slate-800 cursor-pointer flex justify-between items-center border-b border-slate-100 pointer-events-auto"
                                    >
                                      <div className="flex items-center gap-3 min-w-0 pr-2 flex-1">
                                        {/* Auto-suggest product image preview */}
                                        <div className="w-9 h-9 rounded-md bg-white overflow-hidden flex items-center justify-center shrink-0">
                                          {p.imageUrl ? (
                                            <img
                                              src={p.imageUrl}
                                              alt={p.name}
                                              className="w-full h-full object-contain"
                                              referrerPolicy="no-referrer"
                                            />
                                          ) : (
                                            <span className="text-[9px] text-slate-300 font-bold uppercase font-sans">SF</span>
                                          )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-extrabold text-slate-850 truncate">{p.name}</span>
                                          <span className="text-[10px] text-slate-400 mt-0.5 font-sans block">
                                            {p.category} {p.subcategory ? `• ${p.subcategory}` : ''} {p.weight ? `• ${p.weight}` : ''}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex flex-col items-end gap-1 shrink-0 text-right min-w-[85px]">
                                        {latestPrice ? (
                                          <span className="font-mono text-[10px] text-emerald-700 font-extrabold">
                                            Último: R$ {latestPrice.toFixed(2).replace('.', ',')}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-slate-400 italic">Sem registro</span>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                          {p.isCompetitor ? (
                                            <span className="text-[8px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 rounded px-1.5 py-0.5 whitespace-nowrap uppercase font-mono tracking-wide">
                                              {p.brand}
                                            </span>
                                          ) : (
                                            <span className={`text-[8px] font-extrabold border rounded px-1.5 py-0.5 whitespace-nowrap uppercase font-mono tracking-wide ${
                                              (p.brand?.toLowerCase().includes('mavalerio') || p.brand?.toLowerCase().includes('mavalério'))
                                                ? 'bg-violet-50 text-violet-800 border-violet-100'
                                                : 'bg-emerald-50 text-emerald-800 border-emerald-150'
                                            }`}>
                                              {p.brand || 'Dr. Oetker'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {getBatchFilteredProducts(batchProductSearches[item.id] || '').length === 0 && (
                                  <div className="p-4 text-center text-xs text-slate-400 italic">Nenhum produto correspondente cadastrado no PriceHub.</div>
                                )}
                              </div>
                            )}

                            {/* Selected product details preview */}
                            {resolvedProduct && (
                              <div className="mt-2.5 p-3 bg-emerald-50/20 border border-emerald-100 rounded-xl flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div 
                                    className={`w-9 h-9 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 select-none ${
                                      resolvedProduct.imageUrl ? 'cursor-pointer group hover:ring-2 hover:ring-[#D40511] transition-all relative' : ''
                                    }`}
                                    onClick={() => {
                                      if (resolvedProduct.imageUrl) {
                                        setFullscreenProductPhoto({ url: resolvedProduct.imageUrl, name: resolvedProduct.name });
                                      }
                                    }}
                                    title={resolvedProduct.imageUrl ? "Clique para ver foto do produto em tela cheia" : undefined}
                                  >
                                    {resolvedProduct.imageUrl ? (
                                      <>
                                        <img src={resolvedProduct.imageUrl} alt={resolvedProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Search className="w-3.5 h-3.5 text-white" />
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-[9px] text-slate-300 font-bold uppercase font-sans">SF</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="text-xs font-extrabold text-[#D40511] truncate font-sans">{resolvedProduct.name}</h5>
                                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{resolvedProduct.brand} • {resolvedProduct.weight}</p>
                                  </div>
                                </div>
                                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md shrink-0">
                                  Vinculado
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Price input field & PDV selection box */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                                2. Preço de Gôndola (R$) *
                              </label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 font-mono font-extrabold">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0,00"
                                  value={item.price || '0,00'}
                                  onChange={(e) => {
                                    const val = formatToCalculatorPrice(e.target.value);
                                    updateBatchItem(item.id, { price: val });
                                  }}
                                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-[#D40511]"
                                  required
                                />
                              </div>
                              {(() => {
                                if (!item.selectedProductId) return null;
                                const chainId = item.selectedChainId || selectedChainId;
                                const itemState = item.state || selectedState;
                                const lastRecord = getLatestPriceRecord(item.selectedProductId, chainId, itemState);
                                const stateUf = RESEARCH_STATES.find(s => s.name === itemState)?.uf || itemState;
                                const isExact = lastRecord && (lastRecord.state || 'Minas Gerais') === itemState;
                                const recUf = lastRecord ? (RESEARCH_STATES.find(s => s.name === (lastRecord.state || 'Minas Gerais'))?.uf || lastRecord.state) : '';

                                return (
                                  <p className="text-[10px] text-slate-500 mt-1 font-sans leading-relaxed">
                                    {lastRecord ? (
                                      <span>
                                        Último em {isExact ? stateUf : `${recUf} (ref)`}: <strong className="font-mono text-slate-700">R$ {lastRecord.price.toFixed(2).replace('.', ',')}</strong> ({formatDateBR(lastRecord.date)})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">Sem registro anterior em {stateUf}</span>
                                    )}
                                  </p>
                                );
                              })()}
                            </div>

                            <div>
                              <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                                3. Rede / PDV de Auditoria *
                              </label>
                              <select
                                value={item.selectedChainId || selectedChainId}
                                onChange={(e) => {
                                  const cId = e.target.value;
                                  updateBatchItem(item.id, { selectedChainId: cId });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans font-extrabold text-slate-700 focus:outline-none focus:bg-white focus:border-[#D40511] h-9"
                                required
                              >
                                {chains.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Notes input container */}
                          <div>
                            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1.5">
                              4. Observações de Auditoria <span className="text-slate-450 font-medium lowercase">(opcional)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Ruptura de gôndola, etiqueta errada, promoção ativa, etc..."
                              value={item.notes}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateBatchItem(item.id, { notes: val });
                              }}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#D40511]"
                            />
                          </div>

                          {/* IA prompt detected details */}
                          {item.aiAnalysisMessage && item.status === 'success' && (
                            <div className="p-3 bg-violet-50/25 rounded-xl border border-violet-100 text-[10px] text-violet-700 flex items-start gap-1.5 leading-relaxed font-sans">
                              <Sparkles className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5 animate-pulse" />
                              <span><strong>Resposta da IA:</strong> {item.aiAnalysisMessage}</span>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Processamento de Salvamento em Lote com Barra de Progresso */}
              {batchSaveProgress && (
                <div className="mt-4 w-full bg-slate-50 border border-slate-150 p-4 rounded-2xl flex flex-col gap-2.5" id="batch-save-progress-box">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 font-sans">
                    <span className="flex items-center gap-1.5 uppercase tracking-wide text-[10px] text-indigo-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      Processando e Enviando Lote de Registros ({batchSaveProgress.current}/{batchSaveProgress.total})
                    </span>
                    <span className="font-mono text-[11px] font-extrabold text-slate-800">
                      {Math.round((batchSaveProgress.current / batchSaveProgress.total) * 100)}% concluído
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 transition-all duration-300 rounded-full"
                      style={{ width: `${(batchSaveProgress.current / batchSaveProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Botão de submissão em Lote final */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={isSavingLater || isSavingAll}
                  onClick={() => setStep(3)}
                  className="w-full sm:w-auto text-xs font-extrabold text-slate-400 hover:text-slate-850 disabled:text-slate-300 transition duration-155 cursor-pointer inline-flex items-center justify-center gap-1 py-3"
                >
                  &larr; Voltar para Fotos
                </button>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleBatchSaveLater}
                    disabled={isSavingLater || isSavingAll || batchItems.length === 0}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl text-xs font-black disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2 uppercase tracking-wide"
                  >
                    {isSavingLater ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Concluindo pesquisa...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                        <span>Concluir Pesquisa</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleBatchSaveAll}
                    disabled={isSavingLater || isSavingAll || batchItems.length === 0}
                    className="w-full sm:w-auto bg-[#D40511] hover:bg-[#b0040e] text-white px-10 py-4 rounded-xl text-xs font-extrabold disabled:bg-slate-300 disabled:cursor-not-allowed transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2 uppercase tracking-wide"
                  >
                    {isSavingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        <span>Salvando todos...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Salvar Todos os {batchItems.length} Registros</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        </div>
      )}

      {/* STEP 5 — Página de Conclusão de Pesquisa */}
      {step === 5 && (
        <div className="bg-white rounded-3xl border border-slate-150 shadow-xs p-6 sm:p-10 space-y-8 animate-fade-in" id="step-5-completion-page">
          {/* Header de Conclusão */}
          <div className="text-center space-y-3.5 max-w-md mx-auto">
            <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center shadow-xs border border-emerald-200">
              <CheckCircle2 className="w-8 h-8 shrink-0" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {completionData?.isGuest ? 'Tudo ok' : 'Auditoria Concluída'}
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {completionData?.isGuest ? 'Pesquisa Concluída com Sucesso!' : 'Pesquisa Concluída com Sucesso!'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                {completionData?.isGuest
                  ? 'Todos os registros e fotos coletados foram gravados e sincronizados com sucesso.'
                  : 'Todos os registros e fotos coletados foram consolidados e sincronizados em tempo real com a base do PriceHub.'}
              </p>
            </div>
          </div>

          {/* Cartão de Resumo da Pesquisa */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Resumo da Pesquisa
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Sincronizado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {/* Rede / Loja */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  {completionData?.chainId && chains.find(c => c.id === completionData.chainId) ? (
                    <RetailerLogo chain={chains.find(c => c.id === completionData.chainId)!} size="sm" />
                  ) : (
                    <Store className="w-5 h-5 text-slate-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rede / Loja</span>
                  <p className="text-xs font-extrabold text-slate-800 truncate">
                    {completionData?.chainName || (completionData?.isGuest ? 'Rede Pesquisada' : 'Rede Auditada')}
                  </p>
                </div>
              </div>

              {/* Estado / UF */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-[#D40511]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Estado (UF)</span>
                  <p className="text-xs font-extrabold text-slate-800 truncate">
                    {completionData?.state || selectedState}
                  </p>
                </div>
              </div>

              {/* Quantidade de Itens */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                  <Package className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Itens Coletados</span>
                  <p className="text-xs font-extrabold text-slate-800 truncate">
                    {completionData?.itemsCount || 0} {(completionData?.itemsCount || 0) === 1 
                      ? (completionData?.isGuest ? 'produto pesquisado' : 'produto auditado') 
                      : (completionData?.isGuest ? 'produtos pesquisados' : 'produtos auditados')}
                  </p>
                </div>
              </div>

              {/* Data e Hora */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Horário de Conclusão</span>
                  <p className="text-xs font-extrabold text-slate-800 truncate">
                    {completionData?.date} às {completionData?.completedAt}
                  </p>
                </div>
              </div>
            </div>

            {/* Mensagem de confirmação */}
            <div className="pt-2">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-200/60 flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {completionData?.isGuest ? (
                    <>
                      Pesquisa finalizada por <strong className="text-slate-800">{completionData?.researcherName || 'Pesquisador'}</strong>. 
                      Os dados foram gravados e serão auditados por um gestor posteriormente.
                    </>
                  ) : (
                    <>
                      Auditoria finalizada por <strong className="text-slate-800">{completionData?.researcherName || 'Pesquisador'}</strong>. 
                      {completionData?.isPromotor 
                        ? ' Os dados foram gravados com sucesso e estão disponíveis para conferência de relatórios.' 
                        : ' Os valores atualizados já estão visíveis no catálogo e nos gráficos comparativos.'}
                    </>
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* Seção de Pergunta no Final */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-6 sm:p-8 text-center space-y-4" id="another-research-prompt-card">
            <div className="space-y-1.5 max-w-sm mx-auto">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                Deseja realizar outra pesquisa?
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {completionData?.isGuest
                  ? 'Você pode iniciar uma nova pesquisa em outra rede ou concluir sua sessão.'
                  : 'Você pode iniciar uma nova auditoria em outra rede ou navegar para consultar a lista de produtos.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto">
              <button
                type="button"
                id="btn-start-another-research"
                onClick={handleStartNewResearch}
                className="w-full sm:flex-1 py-3.5 px-5 bg-[#D40511] hover:bg-[#b0040e] active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Sim, iniciar outra pesquisa</span>
              </button>

              <button
                type="button"
                id="btn-finish-go-to-products"
                onClick={handleFinishAndNavigateAway}
                className="w-full sm:flex-1 py-3.5 px-5 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{completionData?.isGuest ? 'Não, finalizar' : 'Não, ver produtos'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Redirect prompt Modal overlay */}
      {showRedirectPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans" id="register-redirect-modal-overlay">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6" id="register-redirect-modal-content">
            <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-900">Preço Registrado com Sucesso!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Os dados foram computados e publicados no painel do PriceHub. Deseja realizar outra auditoria de preço agora?
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                id="btn-register-more-yes"
                onClick={() => {
                  setShowRedirectPrompt(false);
                  setStep(3);
                }}
                className="flex-1 px-4 py-2.5 bg-[#D40511] hover:bg-[#b0040e] text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer shadow-xs text-center"
              >
                Sim, registrar outro
              </button>
              <button
                type="button"
                id="btn-register-more-no"
                onClick={() => {
                  setShowRedirectPrompt(false);
                  if (!currentUser?.isGuest && onNavigate && lastRegisteredProductId) {
                    onNavigate("produtos", { action: "detail", productId: lastRegisteredProductId });
                  } else {
                    // For guests or default: reset to start new search cleanly
                    setStep(1);
                    setBatchItems([]);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition duration-150 cursor-pointer border border-slate-200 text-center"
              >
                {currentUser?.isGuest ? "Concluir" : "Não, ver detalhes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplication confirmation modal overlay */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs font-sans animate-fade-in" id="register-duplicate-modal-overlay">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl space-y-6" id="register-duplicate-modal-content">
            <div className="mx-auto w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-slate-900">Atualização de Preço Já Realizada!</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Já foi registrada uma atualização de preço para o produto <strong className="text-slate-800">{selectedProduct?.name}</strong> na rede <strong className="text-slate-800">{chains.find(c => c.id === selectedChainId)?.name}</strong> no dia de hoje.
              </p>
              <p className="text-xs text-slate-400 font-medium">
                Deseja registrar uma nova modificação de preço para este mesmo produto hoje?
              </p>
            </div>

            {/* Selected product and chain visual confirmation */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 text-left">
              <div 
                className={`w-10 h-10 rounded bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center select-none ${
                  selectedProduct?.imageUrl ? 'cursor-pointer group hover:ring-2 hover:ring-[#D40511] transition-all relative' : ''
                }`}
                onClick={() => {
                  if (selectedProduct?.imageUrl) {
                    setFullscreenProductPhoto({ url: selectedProduct.imageUrl, name: selectedProduct.name });
                  }
                }}
                title={selectedProduct?.imageUrl ? "Clique para ver foto do produto em tela cheia" : undefined}
              >
                {selectedProduct?.imageUrl ? (
                  <>
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Search className="w-3.5 h-3.5 text-white" />
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-300 font-bold uppercase font-sans">SF</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-800 truncate leading-tight">{selectedProduct?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-medium text-slate-400 leading-none">{selectedProduct?.weight || ''}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 rounded bg-slate-100 px-1 py-0.5 leading-none">
                    {chains.find(c => c.id === selectedChainId) && (
                      <RetailerLogo chain={chains.find(c => c.id === selectedChainId)!} size="sm" />
                    )}
                    <span className="truncate max-w-[80px] font-bold font-sans">{chains.find(c => c.id === selectedChainId)?.name}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                id="btn-duplicate-confirm-accept"
                onClick={() => {
                  executeSubmit(true);
                }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition duration-150 cursor-pointer shadow-xs text-center border border-emerald-700/20"
              >
                Sim, salvar mesmo assim
              </button>
              <button
                type="button"
                id="btn-duplicate-confirm-refuse"
                onClick={handleRefuseDuplicate}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition duration-150 cursor-pointer border border-slate-200 text-center select-none"
              >
                Não, recusar e voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Image Fullscreen Viewer Modal */}
      {fullscreenProductPhoto && (
        <div
          id="product-photo-fullscreen-modal"
          onClick={() => setFullscreenProductPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div
            className="relative flex flex-col items-center max-w-full max-h-full cursor-default select-none animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button with min touch target 44x44px */}
            <button
              onClick={() => setFullscreenProductPhoto(null)}
              className="absolute -top-12 sm:top-2 -right-2 sm:-right-12 text-white hover:text-gray-300 bg-[#E0E0E0]/20 hover:bg-[#E0E0E0]/30 rounded-full w-11 h-11 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
              aria-label="Fechar visualização"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
            
            <img
              src={fullscreenProductPhoto.url}
              alt={fullscreenProductPhoto.name}
              referrerPolicy="no-referrer"
              className="max-w-[90vw] max-h-[75vh] md:max-h-[80vh] rounded-xl object-contain shadow-2xl"
            />
            
            <p className="text-center text-sm md:text-base text-white/95 font-bold font-mono mt-4 px-4 py-2 bg-black/60 rounded-lg max-w-[85vw] break-words">
              {fullscreenProductPhoto.name}
            </p>
          </div>
        </div>
      )}

      {/* Modal para digitar o preço na hora caso não tenha marcado "Manter Preço" */}
      {pendingPriceModal && (
        <div
          id="immediate-price-input-modal"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-150 animate-scale-up flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header com preview da foto capturada */}
            <div className="relative bg-slate-900 h-44 sm:h-48 w-full overflow-hidden flex items-center justify-center">
              <img
                src={pendingPriceModal.dataUrl}
                alt="Foto capturada"
                className="w-full h-full object-contain bg-black/40"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold font-mono px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <Camera className="w-3 h-3 text-amber-400" />
                Foto Capturada
              </div>
            </div>

            {/* Conteúdo & Campo Numérico Estilo Calculadora */}
            <div className="p-5 sm:p-6 flex flex-col gap-4 sm:gap-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                    Informe o Preço de Varejo na Gôndola
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  {pendingPriceModal.targetProduct?.name || 'Produto da Pesquisa'}
                </h3>
                {pendingPriceModal.targetProduct?.category && (
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {pendingPriceModal.targetProduct.category}
                  </p>
                )}
              </div>

              {/* Input Numérico com shift de decimais da direita pra esquerda */}
              <div className="bg-slate-50 border-2 border-slate-200 focus-within:border-[#D40511] focus-within:bg-white rounded-2xl p-4 transition flex flex-col items-center justify-center shadow-2xs">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Preço de Varejo (R$)
                </label>
                <div className="flex items-baseline justify-center gap-1.5 w-full">
                  <span className="text-2xl font-black text-slate-400 font-mono">R$</span>
                  <input
                    id="input-immediate-price"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoFocus
                    value={immediatePrice}
                    onChange={(e) => setImmediatePrice(formatToCalculatorPrice(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmImmediatePrice();
                      }
                    }}
                    className="w-48 text-center text-3xl sm:text-4xl font-black font-mono text-[#D40511] bg-transparent outline-hidden border-b-2 border-slate-300 focus:border-[#D40511] tracking-tight"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  id="btn-cancel-immediate-price"
                  onClick={handleCancelImmediatePrice}
                  className="order-2 sm:order-1 flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition duration-150 cursor-pointer text-center"
                >
                  Tirar outra foto
                </button>
                <button
                  type="button"
                  id="btn-confirm-immediate-price"
                  onClick={handleConfirmImmediatePrice}
                  disabled={immediatePrice === '0,00'}
                  className="order-1 sm:order-2 flex-1 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition duration-150 cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 text-white shrink-0" />
                  <span>Confirmar & Próximo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Itens marcados como "Não tem na loja" para resgatar e registrar */}
      <AnimatePresence>
        {showOutOfStockModal && (
          <div
            id="out-of-stock-products-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
            onClick={() => {
              setShowOutOfStockModal(false);
              setOutOfStockFilterText('');
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-slate-150 flex items-start justify-between gap-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                    <PackageX className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-800">
                        Itens "Não tem na loja"
                      </h3>
                      <span className="text-[11px] font-black font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        {outOfStockProducts.length} {outOfStockProducts.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Marcou sem querer ou encontrou agora? Clique no item para registrá-lo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowOutOfStockModal(false);
                    setOutOfStockFilterText('');
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Input de busca quando há mais de 2 itens */}
              {outOfStockProducts.length > 2 && (
                <div className="p-3 sm:px-5 sm:pt-3 sm:pb-2 border-b border-slate-100 bg-white">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por produto, marca ou categoria..."
                      value={outOfStockFilterText}
                      onChange={(e) => setOutOfStockFilterText(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                    />
                    {outOfStockFilterText && (
                      <button
                        type="button"
                        onClick={() => setOutOfStockFilterText('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Produtos */}
              <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2 divide-y divide-slate-100">
                {filteredOutOfStockProducts.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs">
                    {outOfStockProducts.length === 0 ? (
                      <p className="font-semibold text-slate-500">Nenhum item marcado como indisponível no momento.</p>
                    ) : (
                      <p className="font-semibold text-slate-500">Nenhum produto corresponde à busca "{outOfStockFilterText}".</p>
                    )}
                  </div>
                ) : (
                  filteredOutOfStockProducts.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleSelectOutOfStockToRegister(prod)}
                      className="pt-2 first:pt-0 group flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {prod.imageUrl ? (
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 p-0.5">
                            <img
                              src={prod.imageUrl}
                              alt={prod.name}
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl border border-dashed border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                            <Package className="w-5 h-5" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-black uppercase text-red-600 font-mono">
                              {prod.brand || 'Marca'}
                            </span>
                            {prod.category && (
                              <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md font-mono">
                                {prod.category}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 truncate group-hover:text-red-700 transition" title={prod.name}>
                            {prod.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium mt-0.5">
                            {prod.weight && <span>{prod.weight}</span>}
                            {prod.basePrice > 0 && (
                              <span className="text-emerald-700 font-bold font-mono">
                                Ref: R$ {prod.basePrice.toFixed(2).replace('.', ',')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectOutOfStockToRegister(prod);
                        }}
                        className="shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Colocar na câmera e registrar agora"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">Registrar</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  {filteredOutOfStockProducts.length} {filteredOutOfStockProducts.length === 1 ? 'produto listado' : 'produtos listados'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowOutOfStockModal(false);
                    setOutOfStockFilterText('');
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Aviso: Conclusão da lista com convite para registrar produtos adicionais no modo livre */}
        {showFreeModeNoticeModal && (
          <div
            id="modal-free-mode-notice"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
            onClick={() => setShowFreeModeNoticeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200 p-6 sm:p-7 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon Container */}
              <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 text-[#D40511] flex items-center justify-center border border-red-100 shadow-2xs mb-4">
                <Camera className="w-8 h-8 shrink-0" />
              </div>

              {/* Tag / Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold uppercase tracking-wider mx-auto mb-3">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Lista da Loja Concluída</span>
              </div>

              {/* Title & Description */}
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug tracking-tight">
                Encontrou algum outro produto que não estava na listagem?
              </h3>

              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-2.5 mb-6">
                Registre as fotos dos produtos no modo livre antes de concluir a pesquisa.
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  id="btn-notice-free-mode"
                  onClick={() => {
                    setShowFreeModeNoticeModal(false);
                    setUseGuidedMode(false);
                    if (!useCamera) {
                      startCamera();
                    }
                  }}
                  className="w-full py-3.5 px-5 bg-[#D40511] hover:bg-[#b0040e] active:scale-98 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tirar fotos no modo livre</span>
                </button>

                <button
                  type="button"
                  id="btn-notice-finish-research"
                  onClick={() => {
                    setShowFreeModeNoticeModal(false);
                    stopCamera();
                    setStep(3);
                  }}
                  className="w-full py-3 px-5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer border border-slate-250"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Concluir</span>
                </button>

                {outOfStockProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFreeModeNoticeModal(false);
                      setShowOutOfStockModal(true);
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center justify-center gap-1.5 pt-2 cursor-pointer transition"
                  >
                    <PackageX className="w-3.5 h-3.5" />
                    <span>Ver {outOfStockProductIds.length} {outOfStockProductIds.length === 1 ? 'item sem estoque' : 'itens sem estoque'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
