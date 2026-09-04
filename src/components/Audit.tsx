import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Filter, Calendar, MapPin, User, Tag, Sparkles, Trash2, ExternalLink, RefreshCw, AlertTriangle, Check, CheckCircle2, Image as ImageIcon, Loader2, ZoomIn, ZoomOut, RotateCcw, X, Maximize2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, History, ArrowRight } from 'lucide-react';
import { PriceRecord, Product, Chain } from '../types';
import { parsePriceRecordMeta, searchAndRankProducts } from '../lib/textUtils';
import { supabase, recordAiCorrection } from '../lib/supabase';

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

  // Lazy loading state for pending records
  const PENDING_BATCH_SIZE = 10;
  const [visiblePendingCount, setVisiblePendingCount] = useState(PENDING_BATCH_SIZE);
  const [isLoadingMorePending, setIsLoadingMorePending] = useState(false);
  const pendingSentinelRef = useRef<HTMLDivElement | null>(null);

  // Pagination states for audited records
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const [auditItemsPerPage, setAuditItemsPerPage] = useState(12);

  // Quick inline audit states for pending records
  const [quickPendingState, setQuickPendingState] = useState<Record<string, {
    productId: string | null;
    searchQuery: string;
    price: string;
    chainId: string;
    notes: string;
    isDropdownOpen: boolean;
    showDeleteConfirm: boolean;
  }>>({});

  // Image only preview modal for pending list thumbnails
  const [previewImageRecord, setPreviewImageRecord] = useState<PriceRecord | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  // Product image preview modal
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

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
  const [isPendingDropdownOpen, setIsPendingDropdownOpen] = useState(false);

  // Image zoom state for pending record confirmation modal
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [inlineZoomScale, setInlineZoomScale] = useState(1);

  // Image pan/drag state
  const [inlinePan, setInlinePan] = useState({ x: 0, y: 0 });
  const [isDraggingInline, setIsDraggingInline] = useState(false);
  const inlineDragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0, moved: false });

  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isDraggingFullscreen, setIsDraggingFullscreen] = useState(false);
  const fullscreenDragRef = useRef({ startX: 0, startY: 0, panX: 0, panY: 0, moved: false });

  // Inline Drag Handlers
  const handleInlineMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    inlineDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: inlinePan.x,
      panY: inlinePan.y,
      moved: false,
    };
    setIsDraggingInline(true);
  };

  const handleInlineMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingInline) return;
    const dx = e.clientX - inlineDragRef.current.startX;
    const dy = e.clientY - inlineDragRef.current.startY;
    if (Math.hypot(dx, dy) > 3) {
      inlineDragRef.current.moved = true;
    }
    setInlinePan({
      x: inlineDragRef.current.panX + dx,
      y: inlineDragRef.current.panY + dy,
    });
  };

  const handleInlineMouseUp = () => {
    setIsDraggingInline(false);
  };

  const handleInlineTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    inlineDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      panX: inlinePan.x,
      panY: inlinePan.y,
      moved: false,
    };
    setIsDraggingInline(true);
  };

  const handleInlineTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingInline || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - inlineDragRef.current.startX;
    const dy = touch.clientY - inlineDragRef.current.startY;
    if (Math.hypot(dx, dy) > 3) {
      inlineDragRef.current.moved = true;
    }
    setInlinePan({
      x: inlineDragRef.current.panX + dx,
      y: inlineDragRef.current.panY + dy,
    });
  };

  const handleInlineTouchEnd = () => {
    setIsDraggingInline(false);
  };

  const handleInlineClick = () => {
    if (inlineDragRef.current.moved) return;
    setInlineZoomScale(prev => {
      const next = prev === 1 ? 2.2 : prev === 2.2 ? 3.2 : 1;
      if (next === 1) setInlinePan({ x: 0, y: 0 });
      return next;
    });
  };

  // Fullscreen Drag Handlers
  const handleFullscreenMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    fullscreenDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: fullscreenPan.x,
      panY: fullscreenPan.y,
      moved: false,
    };
    setIsDraggingFullscreen(true);
  };

  const handleFullscreenMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingFullscreen) return;
    const dx = e.clientX - fullscreenDragRef.current.startX;
    const dy = e.clientY - fullscreenDragRef.current.startY;
    if (Math.hypot(dx, dy) > 3) {
      fullscreenDragRef.current.moved = true;
    }
    setFullscreenPan({
      x: fullscreenDragRef.current.panX + dx,
      y: fullscreenDragRef.current.panY + dy,
    });
  };

  const handleFullscreenMouseUp = () => {
    setIsDraggingFullscreen(false);
  };

  const handleFullscreenTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    fullscreenDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      panX: fullscreenPan.x,
      panY: fullscreenPan.y,
      moved: false,
    };
    setIsDraggingFullscreen(true);
  };

  const handleFullscreenTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingFullscreen || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - fullscreenDragRef.current.startX;
    const dy = touch.clientY - fullscreenDragRef.current.startY;
    if (Math.hypot(dx, dy) > 3) {
      fullscreenDragRef.current.moved = true;
    }
    setFullscreenPan({
      x: fullscreenDragRef.current.panX + dx,
      y: fullscreenDragRef.current.panY + dy,
    });
  };

  const handleFullscreenTouchEnd = () => {
    setIsDraggingFullscreen(false);
  };

  const handleFullscreenClick = () => {
    if (fullscreenDragRef.current.moved) return;
    setZoomScale(prev => {
      const next = prev >= 2.5 ? 1 : prev === 1 ? 1.8 : 2.5;
      if (next === 1) setFullscreenPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Handle ESC key to close image zoom or pending modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isImageZoomed) {
          setIsImageZoomed(false);
        } else if (showPendingDeleteConfirm) {
          setShowPendingDeleteConfirm(false);
        } else if (pendingRecordToConfirm) {
          setPendingRecordToConfirm(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImageZoomed, showPendingDeleteConfirm, pendingRecordToConfirm]);

  const [isAnalyzingPending, setIsAnalyzingPending] = useState(false);
  const [aiFeedbackMessage, setAiFeedbackMessage] = useState<string | null>(null);
  const [aiDetectedTextFromRecheck, setAiDetectedTextFromRecheck] = useState<string | null>(null);
  const [aiSuggestedProductIdFromRecheck, setAiSuggestedProductIdFromRecheck] = useState<string | null>(null);

  const handleReanalyzePending = async () => {
    if (!pendingRecordToConfirm) return;
    setIsAnalyzingPending(true);
    setAiFeedbackMessage(null);
    setAiDetectedTextFromRecheck(null);
    setAiSuggestedProductIdFromRecheck(null);
    try {
      const response = await fetch('/api/analyze-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: pendingRecordToConfirm.imageUrl,
          chainId: pendingChainId,
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Falha na resposta da API.');
      }

      const data = await response.json();
      console.log("DEBUG/AUDIT_REANALYZE: Response from AI:", data);

      if (data && data.price !== undefined) {
        // Track the AI's suggestions for future smart corrections
        setAiDetectedTextFromRecheck(data.produto || null);
        setAiSuggestedProductIdFromRecheck(data.matchedProductId || null);

        // Matched product from AI
        let productMatched: Product | null = null;
        if (data.matchedProductId) {
          const matched = products.find(p => p.id === data.matchedProductId);
          if (matched) productMatched = matched;
        }

        if (!productMatched && data.produto) {
          const activeProducts = products.filter(p => p.active);
          const fuzzyMatches = searchAndRankProducts(activeProducts, data.produto);
          const exact = activeProducts.find(p => p.name.toLowerCase().trim() === data.produto.toLowerCase().trim());
          if (exact) {
            productMatched = exact;
          } else if (fuzzyMatches.length > 0) {
            productMatched = fuzzyMatches[0];
          }
        }

        if (productMatched) {
          setSelectedProductForPending(productMatched);
          setPendingSearchQuery(productMatched.name);
        } else if (data.produto) {
          setSelectedProductForPending(null);
          setPendingSearchQuery(data.produto);
        }

        setPendingPrice(data.price.toFixed(2).replace('.', ','));
        setAiFeedbackMessage(`Leitura bem-sucedida! Produto: "${data.produto || 'Não decifrado'}". Preço: R$ ${data.price.toFixed(2)}.`);
      } else {
        setAiFeedbackMessage('⚠️ A IA não identificou um preço legível nesta imagem.');
      }
    } catch (err) {
      console.error('Erro na re-análise assistida por IA:', err);
      setAiFeedbackMessage('❌ Falha na conexão ou processamento da imagem pela IA.');
    } finally {
      setIsAnalyzingPending(false);
    }
  };

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
    return records
      .filter((rec) => {
        const { isPending } = parsePriceRecordMeta(rec.notes);
        return !rec.productId || isPending;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.id.localeCompare(a.id);
      });
  }, [records]);

  // Sync visible count when pendingRecords list changes
  useEffect(() => {
    if (pendingRecords.length > 0 && visiblePendingCount < Math.min(PENDING_BATCH_SIZE, pendingRecords.length)) {
      setVisiblePendingCount(Math.min(PENDING_BATCH_SIZE, pendingRecords.length));
    }
  }, [pendingRecords.length]);

  // Lazy loaded slice of pending records
  const visiblePendingRecords = useMemo(() => {
    return pendingRecords.slice(0, visiblePendingCount);
  }, [pendingRecords, visiblePendingCount]);

  // IntersectionObserver for infinite scrolling / lazy load on scroll
  useEffect(() => {
    if (visiblePendingCount >= pendingRecords.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          setIsLoadingMorePending(true);
          setTimeout(() => {
            setVisiblePendingCount((prev) => Math.min(prev + PENDING_BATCH_SIZE, pendingRecords.length));
            setIsLoadingMorePending(false);
          }, 150);
        }
      },
      { rootMargin: '250px', threshold: 0.05 }
    );

    const currentSentinel = pendingSentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [visiblePendingCount, pendingRecords.length]);

  const handleLoadMorePending = () => {
    setIsLoadingMorePending(true);
    setTimeout(() => {
      setVisiblePendingCount((prev) => Math.min(prev + PENDING_BATCH_SIZE, pendingRecords.length));
      setIsLoadingMorePending(false);
    }, 100);
  };

  const handleLoadAllPending = () => {
    setIsLoadingMorePending(true);
    setTimeout(() => {
      setVisiblePendingCount(pendingRecords.length);
      setIsLoadingMorePending(false);
    }, 100);
  };

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

  // Reset page when filters change
  useEffect(() => {
    setAuditCurrentPage(1);
  }, [selectedProductId, selectedChainId, searchNotes, filterPeriodDays, auditItemsPerPage]);

  // Total pages and paginated slice for audited records
  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditRecords.length / auditItemsPerPage));
  const paginatedAuditRecords = useMemo(() => {
    const start = (auditCurrentPage - 1) * auditItemsPerPage;
    return filteredAuditRecords.slice(start, start + auditItemsPerPage);
  }, [filteredAuditRecords, auditCurrentPage, auditItemsPerPage]);

  // Calculator-style price formatter (digit input from right to left)
  const formatToCalculatorPrice = (inputValue: string): string => {
    const digits = inputValue.replace(/\D/g, '');
    if (!digits) return '0,00';
    const cents = parseInt(digits, 10);
    return (cents / 100).toFixed(2).replace('.', ',');
  };

  // Helper to find latest price for a product in a specific chain
  const getLatestPriceForProductInChain = (productId: string, chainId: string) => {
    const chainRecords = records.filter(r => {
      if (r.productId !== productId || r.chainId !== chainId) return false;
      const { isPending } = parsePriceRecordMeta(r.notes);
      return !isPending;
    });
    if (chainRecords.length === 0) return null;
    chainRecords.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
    return chainRecords[0].price;
  };

  // Helper to find latest price record for a product in a specific chain
  const getLatestPriceRecordForProductInChain = (productId: string, chainId: string) => {
    const chainRecords = records.filter(r => {
      if (r.productId !== productId || r.chainId !== chainId) return false;
      const { isPending } = parsePriceRecordMeta(r.notes);
      return !isPending;
    });
    if (chainRecords.length === 0) return null;
    chainRecords.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
    return chainRecords[0];
  };

  // Quick Inline State Helpers for Pending Records
  const getOrInitItemState = (rec: PriceRecord) => {
    if (quickPendingState[rec.id]) {
      return quickPendingState[rec.id];
    }
    const meta = parsePriceRecordMeta(rec.notes);
    const activeProducts = products.filter(p => p.active);
    let matchedProduct: Product | null = null;

    if (meta.aiProductSuggested) {
      const exact = activeProducts.find(p => p.name.toLowerCase().trim() === meta.aiProductSuggested.toLowerCase().trim());
      if (exact) {
        matchedProduct = exact;
      } else {
        const fuzzy = searchAndRankProducts(activeProducts, meta.aiProductSuggested);
        if (fuzzy.length === 1 && meta.aiProductSuggested.trim().length > 3) {
          matchedProduct = fuzzy[0];
        }
      }
    }

    const initialPrice = meta.aiPriceSuggested > 0 
      ? meta.aiPriceSuggested.toFixed(2).replace('.', ',') 
      : '0,00';

    return {
      productId: matchedProduct?.id || null,
      searchQuery: matchedProduct?.name || meta.aiProductSuggested || '',
      price: initialPrice,
      chainId: rec.chainId || (chains[0]?.id || ''),
      notes: meta.originalNotes || '',
      isDropdownOpen: false,
      showDeleteConfirm: false,
    };
  };

  const updateQuickItemState = (recordId: string, partial: Partial<{
    productId: string | null;
    searchQuery: string;
    price: string;
    chainId: string;
    notes: string;
    isDropdownOpen: boolean;
    showDeleteConfirm: boolean;
  }>) => {
    setQuickPendingState(prev => {
      const rec = pendingRecords.find(r => r.id === recordId);
      const current = prev[recordId] || (rec ? getOrInitItemState(rec) : {
        productId: null,
        searchQuery: '',
        price: '0,00',
        chainId: chains[0]?.id || '',
        notes: '',
        isDropdownOpen: false,
        showDeleteConfirm: false,
      });
      return {
        ...prev,
        [recordId]: {
          ...current,
          ...partial,
        }
      };
    });
  };

  // Consolidated audit handler
  const handleExecuteAuditConfirm = (params: {
    record: PriceRecord;
    productId: string;
    chainId: string;
    priceNum: number;
    notes?: string;
    suggestedName?: string | null;
    suggestedProdId?: string | null;
  }) => {
    const { record, productId, chainId, priceNum, notes, suggestedName, suggestedProdId } = params;
    const chosenProduct = products.find(p => p.id === productId);

    if (suggestedName && chosenProduct) {
      const correctProdId = chosenProduct.id;
      if (correctProdId !== suggestedProdId) {
        recordAiCorrection({
          chainId,
          detectedText: suggestedName,
          correctProductId: correctProdId,
          correctProductName: chosenProduct.name,
          createdBy: record.userEmail || 'vendas@radar.com'
        });
      }
    }

    const updatedRecord: PriceRecord = {
      ...record,
      productId,
      chainId,
      price: priceNum,
      notes: notes || '',
    };
    onUpdateRecord?.(updatedRecord);
  };

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
    
    setPendingPrice(meta.aiPriceSuggested > 0 ? meta.aiPriceSuggested.toFixed(2).replace('.', ',') : '0,00');
    setPendingNotes(meta.originalNotes);
    setPendingChainId(rec.chainId);
    setShowPendingDeleteConfirm(false);
    setIsPendingDropdownOpen(false);
    setIsImageZoomed(false);
    setZoomScale(1);
    setInlineZoomScale(1);
    setInlinePan({ x: 0, y: 0 });
    setFullscreenPan({ x: 0, y: 0 });
    
    // Reset AI analysis feedback
    setAiFeedbackMessage(null);
    setIsAnalyzingPending(false);
    setAiDetectedTextFromRecheck(null);
    setAiSuggestedProductIdFromRecheck(null);
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

      {/* 1. SEÇÃO PENDENTE DE ANÁLISE - LISTA COM AUDITORIA RÁPIDA E LAZY LOADING */}
      {pendingRecords.length > 0 && (
        <div className="bg-amber-50/30 border border-amber-200/90 p-5 sm:p-6 rounded-3xl space-y-4 shadow-2xs" id="pending-audits-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
              <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-widest font-sans">
                Pendentes de Análise ({pendingRecords.length})
              </h2>
              {pendingRecords.length > PENDING_BATCH_SIZE && (
                <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full font-mono">
                  Exibindo {visiblePendingRecords.length} de {pendingRecords.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-800 font-sans font-medium">
              Auditoria rápida em lista com carregamento incremental. Altere ou mantenha o último preço e confirme diretamente.
            </p>
          </div>
          
          <div className="space-y-4">
            {visiblePendingRecords.map((rec) => {
              const itemState = getOrInitItemState(rec);
              const meta = parsePriceRecordMeta(rec.notes);
              const activeProducts = products.filter(p => p.active);
              const matchedProduct = itemState.productId ? products.find(p => p.id === itemState.productId) : null;
              const latestPrice = matchedProduct ? getLatestPriceForProductInChain(matchedProduct.id, itemState.chainId) : null;
              const latestRecord = matchedProduct ? getLatestPriceRecordForProductInChain(matchedProduct.id, itemState.chainId) : null;
              
              const filteredProdsForThis = itemState.searchQuery
                ? searchAndRankProducts(activeProducts, itemState.searchQuery)
                : activeProducts.slice(0, 6);

              const priceNum = parseFloat(itemState.price.replace(',', '.')) || 0;
              const isReadyToConfirm = Boolean(itemState.productId && priceNum > 0);

              return (
                <div
                  id={`pending-row-${rec.id}`}
                  key={rec.id}
                  className="bg-white border border-amber-200/90 hover:border-amber-400 rounded-2xl p-4 transition-all shadow-2xs relative group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Column 1: Thumbnail & Metadata (Date & User under image) */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0 w-24 sm:w-28">
                      <div 
                        onClick={() => {
                          setPreviewImageRecord(rec);
                          setPreviewZoom(1);
                        }}
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden relative border border-slate-200 bg-slate-100 cursor-pointer shrink-0 group/img shadow-2xs"
                        title="Clique para visualizar a foto da evidência em alta resolução"
                      >
                        <img
                          src={rec.imageUrl}
                          alt="Evidência pendente"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-5 h-5 drop-shadow-md" />
                        </div>
                        <div className="absolute top-1 left-1 bg-amber-500 text-white font-black text-[7.5px] px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs">
                          Pendente
                        </div>
                      </div>

                      {/* Date and User strictly below image */}
                      <div className="w-full flex flex-col items-center text-center space-y-0.5 px-0.5">
                        <span className="text-[9.5px] text-slate-500 font-mono inline-flex items-center justify-center gap-1 w-full truncate">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{formatDateBR(rec.date)}</span>
                        </span>
                        <span className="text-[9.5px] text-slate-700 font-medium inline-flex items-center justify-center gap-1 w-full truncate" title={rec.userName}>
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{rec.userName}</span>
                        </span>
                      </div>
                    </div>

                    {/* Column 2: Audit Form Fields (Balanced Grid on Desktop) */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                      {/* Field 1: Store / Chain (4 cols on Web) */}
                      <div className="sm:col-span-1 lg:col-span-4">
                        <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 font-sans">
                          1. Rede / Loja
                        </label>
                        <select
                          value={itemState.chainId}
                          onChange={(e) => updateQuickItemState(rec.id, { chainId: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:bg-white focus:border-[#D40511] h-9 shadow-2xs"
                        >
                          {chains.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Field 2: Product selection (5 cols on Web - generous space for readable names) */}
                      <div className="sm:col-span-1 lg:col-span-5 relative">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-slate-500 font-sans">
                            2. <span className="sm:hidden">Produto Vinculado</span><span className="hidden sm:inline">Produto</span>
                          </label>
                          {matchedProduct && (
                            <button
                              type="button"
                              onClick={() => updateQuickItemState(rec.id, { productId: null, searchQuery: '', isDropdownOpen: true })}
                              className="text-[9.5px] text-[#D40511] hover:underline font-bold cursor-pointer transition-colors"
                            >
                              Alterar
                            </button>
                          )}
                        </div>

                        {matchedProduct ? (
                          <div 
                            onClick={() => {
                              if (matchedProduct.imageUrl) {
                                setPreviewProduct(matchedProduct);
                              }
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1 bg-emerald-50/80 border border-emerald-200 rounded-lg h-9 shadow-2xs transition-all ${matchedProduct.imageUrl ? 'hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer group/prod' : ''}`}
                            title={matchedProduct.imageUrl ? 'Clique para visualizar a imagem do produto' : `${matchedProduct.name} ${matchedProduct.weight ? `(${matchedProduct.weight})` : ''}`}
                          >
                            {matchedProduct.imageUrl ? (
                              <img 
                                src={matchedProduct.imageUrl} 
                                alt={matchedProduct.name} 
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 object-contain bg-white rounded border border-slate-100 shrink-0 group-hover/prod:scale-110 transition-transform" 
                              />
                            ) : (
                              <div className="w-6 h-6 rounded bg-white flex items-center justify-center border border-slate-200 shrink-0">
                                <ImageIcon className="w-3 h-3 text-slate-400" />
                              </div>
                            )}
                            <span className="text-xs font-bold text-slate-800 truncate flex-1" title={`${matchedProduct.name} ${matchedProduct.weight ? `(${matchedProduct.weight})` : ''}`}>
                              {matchedProduct.name}
                            </span>
                            {matchedProduct.imageUrl && (
                              <span className="text-[9px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 flex items-center gap-1 group-hover/prod:bg-emerald-200">
                                <Eye className="w-3 h-3 text-emerald-700" />
                                <span className="hidden sm:inline">Ver</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Buscar produto..."
                              value={itemState.searchQuery}
                              onFocus={() => updateQuickItemState(rec.id, { isDropdownOpen: true })}
                              onBlur={() => setTimeout(() => updateQuickItemState(rec.id, { isDropdownOpen: false }), 250)}
                              onChange={(e) => updateQuickItemState(rec.id, { searchQuery: e.target.value, isDropdownOpen: true })}
                              className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-amber-300 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#D40511] h-9 shadow-2xs"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" />

                            {itemState.isDropdownOpen && (
                              <div className="absolute left-0 right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                                {filteredProdsForThis.length > 0 ? (
                                  filteredProdsForThis.map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        updateQuickItemState(rec.id, {
                                          productId: p.id,
                                          searchQuery: p.name,
                                          isDropdownOpen: false,
                                        });
                                      }}
                                      className="w-full text-left px-2.5 py-2 text-[10px] font-bold text-slate-700 hover:bg-amber-50/60 flex items-center justify-between border-b border-slate-100 last:border-none cursor-pointer gap-2 transition-colors"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {p.imageUrl ? (
                                          <img
                                            src={p.imageUrl}
                                            alt={p.name}
                                            referrerPolicy="no-referrer"
                                            className="w-6 h-6 rounded object-contain bg-white border border-slate-100 shrink-0"
                                          />
                                        ) : (
                                          <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                            <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                          </div>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                          <span className="truncate text-slate-800">{p.name} {p.weight ? `(${p.weight})` : ''}</span>
                                          {(() => {
                                            const prodPrice = getLatestPriceForProductInChain(p.id, itemState.chainId);
                                            return prodPrice !== null ? (
                                              <span className="text-[8.5px] text-[#D40511] font-mono font-bold">
                                                Último: R$ {prodPrice.toFixed(2).replace('.', ',')}
                                              </span>
                                            ) : null;
                                          })()}
                                        </div>
                                      </div>
                                      <span className="text-[8px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded uppercase shrink-0">
                                        {p.category}
                                      </span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="p-3 text-[10px] text-slate-400 italic text-center">
                                    Nenhum produto correspondente.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Field 3: Price + "Manter preço" Button (3 cols on Web) */}
                      <div className="sm:col-span-1 lg:col-span-3">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-[#D40511] font-sans">
                            3. Preço (R$) *
                          </label>
                          {/* Mobile version of Maintain Price button */}
                          {latestPrice !== null && (
                            <button
                              type="button"
                              onClick={() => updateQuickItemState(rec.id, { price: latestPrice.toFixed(2).replace('.', ',') })}
                              className="sm:hidden text-[9px] font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all"
                              title="Preencher com o último preço registrado para este produto nesta rede"
                            >
                              <RotateCcw className="w-2.5 h-2.5 text-emerald-600" />
                              Manter R$ {latestPrice.toFixed(2).replace('.', ',')}
                            </button>
                          )}
                        </div>

                        <div className="relative rounded-lg h-9">
                          <span className="absolute left-2.5 top-2 text-[10px] font-extrabold text-[#D40511]">R$</span>
                          <input
                            type="text"
                            placeholder="0,00"
                            value={itemState.price}
                            onChange={(e) => updateQuickItemState(rec.id, { price: formatToCalculatorPrice(e.target.value) })}
                            className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-[#D40511] focus:outline-none focus:bg-white focus:border-[#D40511] h-9 shadow-2xs"
                          />
                        </div>

                        {/* Web/Desktop exclusive version of Maintain Price button (clean, un-truncated button below input) */}
                        {latestPrice !== null && (
                          <div className="hidden sm:block mt-1">
                            <button
                              type="button"
                              onClick={() => updateQuickItemState(rec.id, { price: latestPrice.toFixed(2).replace('.', ',') })}
                              className="w-full text-[9.5px] font-extrabold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 hover:border-emerald-400 px-2 py-1 rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95 transition-all whitespace-nowrap"
                              title={`Preencher com o último preço registrado nesta rede: R$ ${latestPrice.toFixed(2).replace('.', ',')}`}
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Manter R$ {latestPrice.toFixed(2).replace('.', ',')}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Field 4: Observações (Exclusively on Tablet & Mobile) */}
                      <div className="sm:col-span-2 lg:hidden">
                        <label className="block text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-sans">
                          4. Observações
                        </label>
                        <input
                          type="text"
                          placeholder="Opcional..."
                          value={itemState.notes}
                          onChange={(e) => updateQuickItemState(rec.id, { notes: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:bg-white focus:border-slate-400 h-9 placeholder-slate-400 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Column 3: Quick Action Buttons */}
                    <div className="flex flex-row lg:flex-col items-stretch lg:items-center justify-center gap-1.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 lg:w-32">
                      <button
                        type="button"
                        disabled={!isReadyToConfirm}
                        onClick={() => {
                          if (!itemState.productId || priceNum <= 0) return;
                          handleExecuteAuditConfirm({
                            record: rec,
                            productId: itemState.productId,
                            chainId: itemState.chainId,
                            priceNum,
                            notes: itemState.notes,
                            suggestedName: meta.aiProductSuggested,
                            suggestedProdId: null,
                          });
                        }}
                        className="flex-1 xl:flex-initial w-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-[10px] font-extrabold disabled:bg-slate-300 disabled:cursor-not-allowed transition uppercase shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer font-sans h-9 tracking-wider shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                        Confirmar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenPendingConfirm(rec)}
                        className="flex-1 xl:flex-initial w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-[9.5px] font-bold border border-slate-200 transition flex items-center justify-center gap-1 cursor-pointer font-sans h-8"
                        title="Abrir imagem em alta definição, zoom e re-leitura com IA"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">Análise Detalhada</span>
                      </button>

                      {itemState.showDeleteConfirm ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteRecord?.(rec.id);
                            }}
                            className="bg-red-600 text-white text-[9px] font-bold px-2 py-1.5 rounded-lg cursor-pointer"
                          >
                            Descartar
                          </button>
                          <button
                            type="button"
                            onClick={() => updateQuickItemState(rec.id, { showDeleteConfirm: false })}
                            className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-1.5 rounded-lg cursor-pointer"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateQuickItemState(rec.id, { showDeleteConfirm: true })}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                          title="Descartar foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Sentinel and Lazy Loading Controls for Pending Records */}
            {visiblePendingRecords.length < pendingRecords.length && (
              <div 
                ref={pendingSentinelRef} 
                className="pt-2 pb-1 flex flex-col items-center justify-center gap-2.5 bg-amber-100/40 border border-dashed border-amber-300/80 rounded-2xl p-4 transition-all"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950 font-sans">
                  {isLoadingMorePending ? (
                    <>
                      <Loader2 className="w-4 h-4 text-amber-700 animate-spin" />
                      <span>Carregando mais itens pendentes...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>
                        Exibindo {visiblePendingRecords.length} de {pendingRecords.length} fotos pendentes (rolagem automática)
                      </span>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-xs bg-amber-200/80 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-amber-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(visiblePendingRecords.length / pendingRecords.length) * 100}%` }}
                  />
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleLoadMorePending}
                    disabled={isLoadingMorePending}
                    className="px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {isLoadingMorePending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                    )}
                    <span>Carregar mais (+{Math.min(PENDING_BATCH_SIZE, pendingRecords.length - visiblePendingCount)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadAllPending}
                    disabled={isLoadingMorePending}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow-2xs transition-all cursor-pointer"
                  >
                    Mostrar todos ({pendingRecords.length})
                  </button>
                </div>
              </div>
            )}

            {pendingRecords.length > PENDING_BATCH_SIZE && visiblePendingRecords.length >= pendingRecords.length && (
              <div className="text-center py-2 text-[11px] font-bold text-amber-800/80 font-sans">
                ✓ Todos os {pendingRecords.length} itens pendentes foram carregados.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SEÇÃO DE REGISTROS AUDITADOS / CONFIRMADOS COM PAGINAÇÃO */}
      <div className="space-y-6" id="audited-logs-section">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest leading-none font-sans flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            Registros Consolidados & Auditados
          </h2>
          <span className="text-xs text-slate-400 font-mono font-semibold">Total: {auditedRecords.length} ({filteredAuditRecords.length} filtrados)</span>
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

        {/* Gallery Photo Results (Paginated) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="audit-gallery-results">
          {paginatedAuditRecords.map((rec) => {
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

        {/* Pagination Toolbar */}
        {filteredAuditRecords.length > 0 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
              <span>
                Mostrando <strong>{(auditCurrentPage - 1) * auditItemsPerPage + 1}</strong> a <strong>{Math.min(auditCurrentPage * auditItemsPerPage, filteredAuditRecords.length)}</strong> de <strong>{filteredAuditRecords.length}</strong> registros
              </span>
              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                <span className="text-[11px] text-slate-500">Por página:</span>
                <select
                  value={auditItemsPerPage}
                  onChange={(e) => setAuditItemsPerPage(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                  <option value={96}>96</option>
                </select>
              </div>
            </div>

            {totalAuditPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={auditCurrentPage === 1}
                  onClick={() => setAuditCurrentPage(1)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  title="Primeira página"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  disabled={auditCurrentPage === 1}
                  onClick={() => setAuditCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page number buttons */}
                {Array.from({ length: Math.min(5, totalAuditPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalAuditPages > 5) {
                    if (auditCurrentPage > 3) {
                      pageNum = auditCurrentPage - 2 + i;
                    }
                    if (pageNum > totalAuditPages) {
                      pageNum = totalAuditPages - (4 - i);
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setAuditCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition cursor-pointer ${
                        auditCurrentPage === pageNum
                          ? 'bg-[#D40511] text-white shadow-2xs'
                          : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={auditCurrentPage === totalAuditPages}
                  onClick={() => setAuditCurrentPage(prev => Math.min(totalAuditPages, prev + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1"
                  title="Próxima página"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={auditCurrentPage === totalAuditPages}
                  onClick={() => setAuditCurrentPage(totalAuditPages)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer"
                  title="Última página"
                >
                  &raquo;
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. CONFIRMAR REGISTRO PENDENTE MODEL DIALOG BOX */}
      {pendingRecordToConfirm && (
        <div
          id="pending-confirm-backdrop"
          onClick={() => setPendingRecordToConfirm(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 cursor-pointer overflow-y-auto animate-fade-in"
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-[96vw] md:w-full border border-gray-100 overflow-hidden shadow-2xl relative cursor-default my-auto max-h-[94vh] md:max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            id="pending-confirm-card"
          >
            {/* Header banner */}
            <div className="bg-amber-50 border-b border-amber-100 px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="bg-amber-500 text-white p-2 rounded-xl">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-amber-950 font-sans uppercase tracking-wider">
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

            <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-y-auto md:overflow-hidden" id="pending-split-view">
              {/* Image side content */}
              <div className="bg-slate-50 p-5 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-between md:h-full md:overflow-y-auto col-span-12 md:col-span-5" id="pending-image-side">
                <div
                  className="relative rounded-2xl overflow-hidden shadow-sm max-w-full bg-black flex-1 flex flex-col items-center justify-center min-h-[220px] max-h-[300px] md:min-h-[260px] md:max-h-[360px] group border border-slate-800 transition-all select-none"
                >
                  {/* Scrollable image viewport with drag/pan support */}
                  <div 
                    className={`w-full h-full flex items-center justify-center p-2 overflow-hidden relative touch-none select-none ${
                      inlineZoomScale > 1
                        ? isDraggingInline ? 'cursor-grabbing' : 'cursor-grab'
                        : 'cursor-zoom-in'
                    }`}
                    onMouseDown={handleInlineMouseDown}
                    onMouseMove={handleInlineMouseMove}
                    onMouseUp={handleInlineMouseUp}
                    onMouseLeave={handleInlineMouseUp}
                    onTouchStart={handleInlineTouchStart}
                    onTouchMove={handleInlineTouchMove}
                    onTouchEnd={handleInlineTouchEnd}
                    onClick={handleInlineClick}
                    title={inlineZoomScale > 1 ? "Clique e arraste para mover a imagem ou clique para alterar o zoom" : "Clique na foto para dar zoom"}
                  >
                    <img
                      src={pendingRecordToConfirm.imageUrl}
                      alt="Evidência provisória"
                      draggable={false}
                      referrerPolicy="no-referrer"
                      style={{ 
                        transform: `translate(${inlinePan.x}px, ${inlinePan.y}px) scale(${inlineZoomScale})`,
                        transformOrigin: 'center center' 
                      }}
                      className={`max-h-full max-w-full object-contain mx-auto select-none pointer-events-none ${
                        isDraggingInline ? 'transition-none' : 'transition-transform duration-200 ease-out'
                      }`}
                    />
                  </div>

                  {/* Top-Left: Inline Zoom Controls */}
                  <div 
                    className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-black/80 backdrop-blur-md text-white px-2 py-1 rounded-xl text-[10px] font-extrabold border border-white/10 shadow-lg z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setInlineZoomScale(prev => {
                        const next = Math.max(1, parseFloat((prev - 0.5).toFixed(1)));
                        if (next === 1) setInlinePan({ x: 0, y: 0 });
                        return next;
                      })}
                      disabled={inlineZoomScale <= 1}
                      className="p-1 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-white transition cursor-pointer"
                      title="Reduzir zoom interno"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    {inlineZoomScale > 1 && (
                      <span className="font-mono text-amber-400 min-w-[36px] text-center px-0.5">
                        {Math.round(inlineZoomScale * 100)}%
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setInlineZoomScale(prev => Math.min(3.5, parseFloat((prev + 0.5).toFixed(1))))}
                      disabled={inlineZoomScale >= 3.5}
                      className="p-1 hover:text-amber-400 disabled:opacity-30 disabled:hover:text-white transition cursor-pointer"
                      title="Aumentar zoom interno"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {inlineZoomScale > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setInlineZoomScale(1);
                          setInlinePan({ x: 0, y: 0 });
                        }}
                        className="p-1 ml-0.5 hover:text-rose-400 text-slate-300 transition cursor-pointer"
                        title="Resetar zoom"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Top-Right: Fullscreen Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsImageZoomed(true);
                      setZoomScale(inlineZoomScale > 1 ? inlineZoomScale : 1.8);
                      setFullscreenPan({ x: 0, y: 0 });
                    }}
                    className="absolute top-2.5 right-2.5 bg-black/80 hover:bg-amber-600 backdrop-blur-md text-white text-[10px] font-extrabold px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-white/10 shadow-lg transition-colors cursor-pointer z-10"
                    title="Abrir foto em tela inteira"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-amber-400 group-hover:text-white" />
                    <span className="hidden sm:inline">Tela Inteira</span>
                  </button>
                </div>
                <div className="mt-4 text-center w-full">
                  <span className="text-[9px] text-gray-400 font-mono font-semibold block">
                    Por: {pendingRecordToConfirm.userName} ({pendingRecordToConfirm.userEmail})
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans font-bold flex items-center justify-center gap-1 mt-1">
                    <Calendar className="w-3.5 h-3.5" /> Coletado em: {formatDateBR(pendingRecordToConfirm.date)}
                  </span>

                  {/* IA Action Button */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      disabled={isAnalyzingPending}
                      onClick={handleReanalyzePending}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-amber-300 disabled:to-amber-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer h-9 animate-pulse"
                    >
                      {isAnalyzingPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Consultando IA...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 shrink-0 text-white animate-pulse" />
                          Consultar IA p/ Nova Checagem
                        </>
                      )}
                    </button>
                    {aiFeedbackMessage && (
                      <p className="mt-2 text-[10px] font-semibold text-center leading-relaxed text-slate-800 bg-slate-100 border border-slate-200 p-2.5 rounded-xl">
                        {aiFeedbackMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Form details input side */}
              <div className="p-5 md:p-6 flex flex-col justify-between md:h-full min-h-0 col-span-12 md:col-span-7" id="pending-form-side">
                <div className="space-y-4 md:overflow-y-auto pr-1 md:pr-2 flex-1 min-h-0 mb-4">
                  
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
                      <div 
                        onClick={() => {
                          if (selectedProductForPending.imageUrl) {
                            setPreviewProduct(selectedProductForPending);
                          }
                        }}
                        className={`p-3 bg-emerald-50/45 border border-emerald-100 rounded-2xl flex items-center justify-between shadow-2xs transition ${selectedProductForPending.imageUrl ? 'hover:bg-emerald-50/80 cursor-pointer' : ''}`}
                        title={selectedProductForPending.imageUrl ? 'Clique para visualizar a foto do produto' : undefined}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectedProductForPending.imageUrl && (
                            <img
                              src={selectedProductForPending.imageUrl}
                              alt={selectedProductForPending.name}
                              referrerPolicy="no-referrer"
                              className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-100 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-[11px] font-extrabold text-slate-800 font-sans leading-snug truncate flex items-center gap-1.5">
                              <span>{selectedProductForPending.name}</span>
                              {selectedProductForPending.imageUrl && (
                                <Eye className="w-3 h-3 text-emerald-600 inline shrink-0" />
                              )}
                            </p>
                            <p className="text-[9px] text-slate-450 font-medium">
                              {selectedProductForPending.category} / {selectedProductForPending.brand || 'Sem marca'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
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
                            onFocus={() => setIsPendingDropdownOpen(true)}
                            onBlur={() => setTimeout(() => setIsPendingDropdownOpen(false), 200)}
                            onChange={(e) => {
                              setPendingSearchQuery(e.target.value);
                              setIsPendingDropdownOpen(true);
                            }}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans font-bold text-slate-700 placeholder-slate-450 focus:outline-none focus:bg-white h-9"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.8 font-extrabold" />
                        </div>

                        {/* Autocomplete selection dropdown */}
                        {isPendingDropdownOpen && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-150 rounded-xl shadow-lg z-55 max-h-44 overflow-y-auto">
                            {pendingFilteredProducts.length > 0 ? (
                              pendingFilteredProducts.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProductForPending(p);
                                    setPendingSearchQuery(p.name);
                                    setIsPendingDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between border-b border-slate-100 last:border-none cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {p.imageUrl ? (
                                      <img
                                        src={p.imageUrl}
                                        alt={p.name}
                                        className="w-6 h-6 rounded object-contain bg-white border border-slate-100 shrink-0"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                                      </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate">{p.name} {p.weight ? `(${p.weight})` : ''}</span>
                                      {(() => {
                                        const latestPrice = getLatestPriceForProductInChain(p.id, pendingChainId);
                                        return latestPrice !== null ? (
                                          <span className="text-[9px] text-[#D40511] font-mono mt-0.5 font-bold">
                                            Preço Atual: R$ {latestPrice.toFixed(2).replace('.', ',')}
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-slate-400 mt-0.5 italic font-medium">
                                            Sem histórico nesta rede
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  <span className="text-[8px] bg-slate-150 text-slate-600 font-mono px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ml-1.5">{p.category}</span>
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-[10px] text-gray-400 italic text-center font-sans">
                                Nenhum produto correspondente cadastrado.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Confirmed Price */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#D40511] font-sans">
                          3. Confirmar Preço do Produto *
                        </label>
                        {selectedProductForPending && (() => {
                          const latestPrice = getLatestPriceForProductInChain(selectedProductForPending.id, pendingChainId);
                          return latestPrice !== null ? (
                            <button
                              type="button"
                              onClick={() => setPendingPrice(latestPrice.toFixed(2).replace('.', ','))}
                              className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md cursor-pointer transition-all active:scale-95 shadow-2xs"
                              title="Preencher com o último preço registrado nesta rede"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600" />
                              Manter mesmo preço (R$ {latestPrice.toFixed(2).replace('.', ',')})
                            </button>
                          ) : null;
                        })()}
                      </div>
                      <div className="relative rounded-lg h-9">
                        <span className="absolute left-3 top-2 px-1 text-[10px] font-extrabold text-[#D40511] font-sans">R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={pendingPrice}
                          onChange={(e) => setPendingPrice(formatToCalculatorPrice(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-[#D40511] focus:outline-none focus:bg-white focus:border-[#D40511] h-9 placeholder-slate-400"
                        />
                      </div>
                    </div>

                    {/* Latest price historical details visible below price field after product is selected */}
                    {selectedProductForPending && (
                      <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl text-[11px] font-sans">
                        <span className="block text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">
                          Histórico de Preço nesta Rede
                        </span>
                        {(() => {
                          const latestRecord = getLatestPriceRecordForProductInChain(selectedProductForPending.id, pendingChainId);
                          return latestRecord ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-medium text-slate-700">
                              <div>
                                <span>Último preço: </span>
                                <strong className="text-slate-800 font-extrabold font-mono text-xs">
                                  R$ {latestRecord.price.toFixed(2).replace('.', ',')}
                                </strong>
                                <span className="text-slate-400 text-[10px]">
                                  {" "}(coletado em {formatDateBR(latestRecord.date)})
                                </span>
                                {latestRecord.userName && (
                                  <span className="block sm:inline sm:ml-2 text-[9px] text-slate-400 italic truncate max-w-[140px]" title={latestRecord.userName}>
                                    por {latestRecord.userName}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setPendingPrice(latestRecord.price.toFixed(2).replace('.', ','))}
                                className="self-start sm:self-auto inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                <RotateCcw className="w-3 h-3 text-emerald-600" />
                                Usar este preço
                              </button>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-[10px]">
                              Nenhum registro anterior encontrado para este produto na rede selecionada.
                            </p>
                          );
                        })()}
                      </div>
                    )}
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
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between bg-white text-[10px] shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPendingDeleteConfirm(true)}
                    className="flex items-center gap-1 text-[10px] text-red-650 hover:text-red-700 font-extrabold uppercase tracking-wider cursor-pointer py-2 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Descartar Foto
                  </button>

                  <button
                    type="button"
                    disabled={!selectedProductForPending || !pendingPrice}
                    onClick={() => {
                      const cleanPrice = pendingPrice.replace(',', '.');
                      const priceNum = parseFloat(cleanPrice) || 0;
                      
                      // Save correction silently if user matched/corrected the AI suggestion
                      const meta = parsePriceRecordMeta(pendingRecordToConfirm.notes);
                      const suggestedName = aiDetectedTextFromRecheck || meta.aiProductSuggested;
                      const suggestedProdId = aiDetectedTextFromRecheck
                        ? aiSuggestedProductIdFromRecheck
                        : (products.find(p => p.name.toLowerCase().trim() === meta.aiProductSuggested.toLowerCase().trim())?.id || null);

                      if (suggestedName) {
                        const correctProdId = selectedProductForPending!.id;

                        if (correctProdId !== suggestedProdId) {
                          recordAiCorrection({
                            chainId: pendingChainId,
                            detectedText: suggestedName,
                            correctProductId: correctProdId,
                            correctProductName: selectedProductForPending!.name,
                            createdBy: pendingRecordToConfirm.userEmail || 'vendas@radar.com'
                          });
                        }
                      }

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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-[10px] font-extrabold disabled:bg-slate-350 disabled:cursor-not-allowed transition uppercase shadow-sm flex items-center gap-1.5 cursor-pointer font-sans h-10 tracking-wider shrink"
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

      {/* FULLSCREEN IMAGE ZOOM OVERLAY FOR PENDING RECORD */}
      {isImageZoomed && pendingRecordToConfirm && (
        <div 
          className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 animate-fade-in select-none"
          onClick={() => setIsImageZoomed(false)}
        >
          {/* Top Controls Header */}
          <div 
            className="w-full max-w-3xl flex items-center justify-between py-2.5 px-4 bg-slate-900/90 border border-slate-800 rounded-2xl backdrop-blur-md text-white shadow-xl z-10 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-extrabold font-sans text-amber-50">Zoom da Foto em Alta Resolução</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Out Button */}
              <button
                type="button"
                onClick={() => setZoomScale(prev => {
                  const next = Math.max(1, parseFloat((prev - 0.5).toFixed(1)));
                  if (next === 1) setFullscreenPan({ x: 0, y: 0 });
                  return next;
                })}
                disabled={zoomScale <= 1}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition cursor-pointer"
                title="Reduzir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {zoomScale > 1 && (
                <span className="text-xs font-mono font-bold min-w-10 text-center text-amber-400 px-0.5">
                  {Math.round(zoomScale * 100)}%
                </span>
              )}

              {/* Zoom In Button */}
              <button
                type="button"
                onClick={() => setZoomScale(prev => Math.min(3.5, parseFloat((prev + 0.5).toFixed(1))))}
                disabled={zoomScale >= 3.5}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              {/* Reset Zoom */}
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setFullscreenPan({ x: 0, y: 0 });
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer text-xs font-extrabold px-2.5 flex items-center gap-1"
                title="Resetar Zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>

              <div className="w-px h-5 bg-slate-700 mx-1" />

              {/* Close Overlay */}
              <button
                type="button"
                onClick={() => setIsImageZoomed(false)}
                className="p-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer font-bold flex items-center gap-1 text-xs px-2.5"
                title="Fechar Zoom"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Fechar</span>
              </button>
            </div>
          </div>

          {/* Center Image Display Area with Drag Support */}
          <div 
            className={`flex-1 w-full flex items-center justify-center overflow-hidden p-2 sm:p-4 my-2 relative touch-none select-none ${
              zoomScale > 1 
                ? isDraggingFullscreen ? 'cursor-grabbing' : 'cursor-grab'
                : 'cursor-zoom-in'
            }`}
            onClick={(e) => {
              if (e.target === e.currentTarget && !fullscreenDragRef.current.moved) {
                setIsImageZoomed(false);
              }
            }}
            onMouseDown={handleFullscreenMouseDown}
            onMouseMove={handleFullscreenMouseMove}
            onMouseUp={handleFullscreenMouseUp}
            onMouseLeave={handleFullscreenMouseUp}
            onTouchStart={handleFullscreenTouchStart}
            onTouchMove={handleFullscreenTouchMove}
            onTouchEnd={handleFullscreenTouchEnd}
          >
            <div 
              className={`max-w-full max-h-full flex items-center justify-center ${
                isDraggingFullscreen ? 'transition-none' : 'transition-transform duration-200 ease-out'
              }`}
              style={{ 
                transform: `translate(${fullscreenPan.x}px, ${fullscreenPan.y}px) scale(${zoomScale})`,
                transformOrigin: 'center center'
              }}
              onClick={handleFullscreenClick}
              title={zoomScale > 1 ? "Clique e arraste para mover a foto ou clique para alternar o zoom" : "Clique na foto para dar zoom"}
            >
              <img
                src={pendingRecordToConfirm.imageUrl}
                alt="Evidência ampliada"
                draggable={false}
                referrerPolicy="no-referrer"
                className="max-h-[75vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl border border-slate-800 pointer-events-none select-none"
              />
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

      {/* DEDICATED IMAGE-ONLY PREVIEW MODAL FOR PENDING THUMBNAIL CLICKS */}
      {previewImageRecord && (
        <div
          id="image-only-preview-backdrop"
          onClick={() => setPreviewImageRecord(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-between p-3 sm:p-5 cursor-pointer animate-in fade-in duration-150"
        >
          {/* Top Header Controls */}
          <div 
            className="w-full max-w-4xl flex items-center justify-between gap-3 text-white z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 cursor-default shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-[9.5px] px-2 py-1 rounded-lg uppercase tracking-wider shrink-0 font-sans">
                Foto de Evidência
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-100 truncate font-sans">
                  {chains.find(c => c.id === previewImageRecord.chainId)?.name || 'Rede não especificada'} &bull; {formatDateBR(previewImageRecord.date)}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  Auditor: {previewImageRecord.userName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewZoom(prev => (prev >= 2.5 ? 1 : prev + 0.5))}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition border border-slate-700 shadow-2xs"
                title="Alternar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>{Math.round(previewZoom * 100)}%</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const r = previewImageRecord;
                  setPreviewImageRecord(null);
                  handleOpenPendingConfirm(r);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition border border-amber-500/40 shadow-2xs"
                title="Abrir formulário de auditoria detalhada com OCR"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Análise Detalhada</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewImageRecord(null)}
                className="p-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer shadow-2xs"
                title="Fechar imagem"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Image Container */}
          <div 
            className="flex-1 w-full max-w-5xl flex items-center justify-center overflow-auto p-2 cursor-zoom-out"
            onClick={() => setPreviewImageRecord(null)}
          >
            <div
              className="transition-transform duration-200 ease-out cursor-default max-h-[82vh] max-w-[92vw] flex items-center justify-center"
              style={{ transform: `scale(${previewZoom})` }}
              onClick={(e) => {
                e.stopPropagation();
                setPreviewZoom(prev => (prev >= 2.5 ? 1 : prev + 0.75));
              }}
              title="Clique na foto para alternar o zoom"
            >
              <img
                src={previewImageRecord.imageUrl}
                alt="Foto de Evidência da Gôndola"
                referrerPolicy="no-referrer"
                className="max-h-[78vh] max-w-[88vw] object-contain rounded-2xl shadow-2xl border border-slate-800 select-none cursor-pointer"
              />
            </div>
          </div>

          {/* Bottom Footer Hint */}
          <div 
            className="text-[11px] text-slate-400 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-800 text-center cursor-default z-10 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            Clique na foto para dar zoom &bull; Pressione fora ou no X para fechar
          </div>
        </div>
      )}

      {/* PRODUCT IMAGE PREVIEW MODAL */}
      {previewProduct && (
        <div
          id="product-image-preview-backdrop"
          onClick={() => setPreviewProduct(null)}
          className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 cursor-default animate-in zoom-in-95 duration-150 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60 font-sans">
                  {previewProduct.category || 'Produto'}
                </span>
                <h3 className="text-sm font-bold text-slate-100 truncate mt-1 font-sans" title={previewProduct.name}>
                  {previewProduct.name} {previewProduct.weight ? `(${previewProduct.weight})` : ''}
                </h3>
                {previewProduct.brand && (
                  <p className="text-[11px] text-slate-400 truncate">
                    Marca: <span className="text-slate-300 font-semibold">{previewProduct.brand}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body - High Definition Image */}
            <div className="p-6 bg-slate-50 flex items-center justify-center min-h-[260px] max-h-[60vh] overflow-hidden">
              {previewProduct.imageUrl ? (
                <img
                  src={previewProduct.imageUrl}
                  alt={previewProduct.name}
                  referrerPolicy="no-referrer"
                  className="max-h-[50vh] max-w-full object-contain rounded-xl drop-shadow-md select-none transition-transform hover:scale-105"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-8">
                  <ImageIcon className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
                  <p className="text-xs font-semibold">Sem imagem cadastrada para este produto</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 font-mono">
                {previewProduct.ean ? `EAN: ${previewProduct.ean}` : 'Catálogo de Produtos'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs font-sans"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
