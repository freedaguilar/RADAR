import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  X,
  Filter,
  Plus,
  ChevronLeft,
  Calendar,
  FileText,
  Check,
  AlertCircle,
  Trash2,
  Edit,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
  Clock,
  Package,
  Camera,
  Download,
  MapPin,
  Globe,
  Pencil,
  CheckCircle2,
  Loader2,
  ArrowUpRight,
  SlidersHorizontal,
  Layers,
  Store,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Tag,
  ChevronRight,
} from "lucide-react";
import { Product, Chain, PriceRecord, User, RESEARCH_STATES, getPriceRecordState, getChainStates } from "../types";
import { normalizeString } from "../lib/textUtils";
import { getOutdatedProducts } from "../lib/productUtils";
import { ProductDetailPage } from "./products/ProductDetailPage";

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

    // fallback using initials of the name
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

interface ProductsProps {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  onDeleteProduct: (productId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onUpdateRecord?: (record: PriceRecord) => Promise<void> | void;
  onSaveRecord?: (record: PriceRecord) => Promise<void> | void;
  currentUser?: User | null;
  pageParams?: any;
  onNavigate?: (page: string, params?: any) => void;
}

export function Products({
  products,
  chains,
  records,
  onDeleteProduct,
  onAddProduct,
  onEditProduct,
  onDeleteRecord,
  onUpdateRecord,
  onSaveRecord,
  currentUser,
  pageParams,
  onNavigate,
}: ProductsProps) {
  // Current active view: 'list' | 'detail' | 'create' | 'edit'
  const [activeView, setActiveView] = useState<
    "list" | "detail" | "create" | "edit"
  >("list");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [productPhotoModal, setProductPhotoModal] = useState<{ url: string; name: string } | null>(null);
  const [showRegisterPriceModal, setShowRegisterPriceModal] = useState(false);

  // Edit Chain Price Modal state inside product detail
  const [editPriceModal, setEditPriceModal] = useState<{
    chain: Chain;
    product: Product;
    record?: PriceRecord;
    stateName: string;
  } | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>("");
  const [editPriceDate, setEditPriceDate] = useState<string>("");
  const [editPriceNotes, setEditPriceNotes] = useState<string>("");
  const [editPriceFeedback, setEditPriceFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingPrice, setIsSavingPrice] = useState<boolean>(false);

  const formatPriceInput = (inputValue: string): string => {
    const digits = inputValue.replace(/\D/g, '');
    if (!digits) return '0,00';
    const cents = parseInt(digits, 10);
    return (cents / 100).toFixed(2).replace('.', ',');
  };

  const handleOpenEditPriceModal = (chain: Chain, record?: PriceRecord, stateName?: string) => {
    const targetProduct = products.find(p => p.id === selectedProductId);
    if (!targetProduct) return;
    const targetState = stateName || record?.state || (chain.states && chain.states[0]) || chain.state || "Minas Gerais";
    setEditPriceModal({
      chain,
      product: targetProduct,
      record,
      stateName: targetState,
    });
    setEditPriceValue(
      record && record.price > 0
        ? record.price.toFixed(2).replace('.', ',')
        : (targetProduct.basePrice > 0 ? targetProduct.basePrice.toFixed(2).replace('.', ',') : "0,00")
    );
    setEditPriceDate(record?.date || new Date().toISOString().split("T")[0]);
    setEditPriceNotes(record?.notes || "");
    setEditPriceFeedback(null);
    setIsSavingPrice(false);
  };

  const handleSaveEditedPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPriceModal) return;

    const rawVal = editPriceValue.replace(/\./g, '').replace(',', '.');
    const numericPrice = parseFloat(rawVal);

    if (isNaN(numericPrice) || numericPrice <= 0) {
      setEditPriceFeedback({
        type: "error",
        message: "Por favor, informe um valor de preço válido maior que zero.",
      });
      return;
    }

    setIsSavingPrice(true);
    try {
      const todayStr = editPriceDate || new Date().toISOString().split("T")[0];
      if (editPriceModal.record && onUpdateRecord) {
        const updatedRecord: PriceRecord = {
          ...editPriceModal.record,
          price: numericPrice,
          date: todayStr,
          notes: editPriceNotes.trim() ? editPriceNotes.trim() : (editPriceModal.record.notes || undefined),
          state: editPriceModal.stateName,
          productId: editPriceModal.product.id,
          chainId: editPriceModal.chain.id,
        };
        await onUpdateRecord(updatedRecord);
        setEditPriceFeedback({
          type: "success",
          message: `Preço atualizado com sucesso para R$ ${numericPrice.toFixed(2).replace('.', ',')} em ${editPriceModal.chain.name}!`,
        });
        setTimeout(() => {
          setEditPriceModal(null);
          setIsSavingPrice(false);
        }, 800);
      } else if (onSaveRecord) {
        const newRecord: PriceRecord = {
          id: `rec-manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          productId: editPriceModal.product.id,
          chainId: editPriceModal.chain.id,
          price: numericPrice,
          date: todayStr,
          imageUrl: "",
          notes: editPriceNotes.trim() ? editPriceNotes.trim() : `Preço ajustado manualmente no perfil de produto`,
          userName: currentUser?.name || "Usuário",
          userEmail: currentUser?.email || "usuario@dr-oetker.com",
          state: editPriceModal.stateName,
        };
        await onSaveRecord(newRecord);
        setEditPriceFeedback({
          type: "success",
          message: `Preço cadastrado com sucesso para R$ ${numericPrice.toFixed(2).replace('.', ',')} em ${editPriceModal.chain.name}!`,
        });
        setTimeout(() => {
          setEditPriceModal(null);
          setIsSavingPrice(false);
        }, 800);
      } else {
        setEditPriceFeedback({
          type: "error",
          message: "Função de salvamento não disponível.",
        });
        setIsSavingPrice(false);
      }
    } catch (err) {
      console.error("Erro ao salvar preço:", err);
      setEditPriceFeedback({
        type: "error",
        message: "Erro ao atualizar o preço. Tente novamente.",
      });
      setIsSavingPrice(false);
    }
  };

  // Excel Export Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStates, setExportStates] = useState<string[]>(["Todos"]);
  const [exportChainIds, setExportChainIds] = useState<string[]>(["Todas"]);
  const [exportCategories, setExportCategories] = useState<string[]>(["Todas"]);
  const [exportBrandTypes, setExportBrandTypes] = useState<string[]>([
    "propria-oetker",
    "propria-mavalerio",
    "concorrentes",
  ]);
  const [exportIncludeHistory, setExportIncludeHistory] = useState<boolean>(false);
  const [exportIsGenerating, setExportIsGenerating] = useState<boolean>(false);

  const handleExecuteExcelExport = async () => {
    setExportIsGenerating(true);
    try {
      // 1. Filter products based on selected categories and brands
      const filteredProds = products.filter((p) => {
        if (!p.active) return false;

        // Category check
        if (!exportCategories.includes("Todas") && !exportCategories.includes(p.category)) {
          return false;
        }

        // Brand checks
        let matchesBrandType = false;
        const isAllExportBrands = exportBrandTypes.length === 3 || exportBrandTypes.includes("Todas");
        if (isAllExportBrands) {
          matchesBrandType = true;
        } else {
          const bLower = (p.brand || "").toLowerCase().trim();
          const isOetker = bLower.includes("oetker");
          const isMav = bLower.includes("mavalerio") || bLower.includes("mavalério");
          const isComp = !!p.isCompetitor || (!isOetker && !isMav);

          if (exportBrandTypes.includes("propria-oetker") && isOetker && !p.isCompetitor) {
            matchesBrandType = true;
          }
          if (
            exportBrandTypes.includes("propria-mavalerio") &&
            isMav &&
            !p.isCompetitor
          ) {
            matchesBrandType = true;
          }
          if (exportBrandTypes.includes("concorrentes") && isComp) {
            matchesBrandType = true;
          }
        }

        return matchesBrandType;
      });

      // 2. Select matching records
      const prodIdsSet = new Set(filteredProds.map((p) => p.id));
      let matchingRecords = records.filter((r) => prodIdsSet.has(r.productId));

      // State check
      if (!exportStates.includes("Todos")) {
        matchingRecords = matchingRecords.filter((r) => {
          const recState = getPriceRecordState(r, chains);
          return exportStates.includes(recState);
        });
      }

      // Network check
      if (!exportChainIds.includes("Todas")) {
        matchingRecords = matchingRecords.filter((r) => exportChainIds.includes(r.chainId));
      }

      // If NOT including full history, we only want the LATEST record per (productId, chainId, state)
      if (!exportIncludeHistory) {
        // Group by productId + chainId + state
        const latestMap = new Map<string, PriceRecord>();
        matchingRecords.forEach((r) => {
          const recState = getPriceRecordState(r, chains);
          const key = `${r.productId}_${r.chainId}_${recState}`;
          const currentLatest = latestMap.get(key);
          if (!currentLatest || r.date.localeCompare(currentLatest.date) > 0) {
            latestMap.set(key, r);
          }
        });
        matchingRecords = Array.from(latestMap.values());
      }

      // 3. Prepare Sheet 1: "Relatório de Auditoria"
      // Sort matchingRecords chronologically descending (newest first)
      const sortedRecordsForSheet = [...matchingRecords].sort((a, b) => b.date.localeCompare(a.date));

      const rowsAudit = sortedRecordsForSheet.map((r, idx) => {
        const prod = products.find((p) => p.id === r.productId);
        const ch = chains.find((c) => c.id === r.chainId);
        const recState = getPriceRecordState(r, chains);

        return {
          "Nº": idx + 1,
          "Data do Registro": formatDateBR(r.date),
          "Estado": recState,
          "Rede (PDV)": ch ? ch.name : "N/A",
          "Código": prod?.internalCode && prod.internalCode.trim() ? prod.internalCode.trim() : "-",
          "Código Interno": prod?.internalCode && prod.internalCode.trim() ? prod.internalCode.trim() : "-",
          "Produto": prod ? prod.name : "N/A",
          "Marca": prod ? prod.brand : "N/A",
          "Categoria": prod ? prod.category : "N/A",
          "Subcategoria": prod ? (prod.subcategory || "") : "N/A",
          "Gramatura": prod ? (prod.weight || "") : "N/A",
          "Preço Unitário (R$)": r.price,
          "Tipo de Registro": prod ? (prod.isCompetitor ? "Competidor" : "Própria") : "N/A",
          "Preço Base (R$)": prod ? prod.basePrice : 0,
          "Auditor": r.userName,
          "Email do Auditor": r.userEmail,
          "Observações": r.notes || "Sem observações",
        };
      });

      // 4. Prepare Sheet 2: "Matriz de Comparação" (Latest prices side-by-side)
      const selectedChains = exportChainIds.includes("Todas")
        ? chains
        : chains.filter((c) => exportChainIds.includes(c.id));

      // Compute latest price per chain filtered by selected states
      const exportLatestPricesMap: Record<string, Record<string, number>> = {};
      const sortedMatchingForPivot = [...matchingRecords].sort(compareRecordsAsc);
      sortedMatchingForPivot.forEach((r) => {
        if (!exportLatestPricesMap[r.productId]) {
          exportLatestPricesMap[r.productId] = {};
        }
        exportLatestPricesMap[r.productId][r.chainId] = r.price;
      });

      const rowsPivot = filteredProds.map((prod) => {
        // Get prices across selected chains
        const pricesMap = (exportLatestPricesMap[prod.id] || {}) as Record<string, number>;

        // Filter price values to selected chains only
        const activePrices: number[] = [];
        const chainColumns: Record<string, any> = {};

        selectedChains.forEach((ch) => {
          const price = pricesMap[ch.id];
          if (price !== undefined) {
            chainColumns[ch.name] = price;
            activePrices.push(price);
          } else {
            chainColumns[ch.name] = "-";
          }
        });

        const avgVal = activePrices.length > 0 ? activePrices.reduce((a, b) => a + b, 0) / activePrices.length : 0;
        const minVal = activePrices.length > 0 ? Math.min(...activePrices) : 0;
        const maxVal = activePrices.length > 0 ? Math.max(...activePrices) : 0;
        const dispersion = minVal > 0 ? ((maxVal - minVal) / minVal) * 100 : 0;

        return {
          "Código": prod.internalCode && prod.internalCode.trim() ? prod.internalCode.trim() : "-",
          "Produto": prod.name,
          "Marca": prod.brand || "Dr. Oetker",
          "Categoria": prod.category,
          "Subcategoria": prod.subcategory || "",
          "Gramatura": prod.weight || "",
          "Tipo": prod.isCompetitor ? "Concorrente" : "Própria",
          ...chainColumns,
          "Preço Médio (R$)": avgVal > 0 ? Number(avgVal.toFixed(2)) : "N/A",
          "Preço Mínimo (R$)": minVal > 0 ? Number(minVal.toFixed(2)) : "N/A",
          "Preço Máximo (R$)": maxVal > 0 ? Number(maxVal.toFixed(2)) : "N/A",
          "Dispersão Máx/Mín (%)": dispersion > 0 ? `${dispersion.toFixed(1)}%` : "0%",
        };
      });

      if (rowsAudit.length === 0 && rowsPivot.length === 0) {
        alert("Nenhum preço ou produto encontrado com os filtros selecionados.");
        setExportIsGenerating(false);
        return;
      }

      // Montar payload para a API
      const payload = {
        rows_audit: rowsAudit,
        rows_pivot: rowsPivot,
        meta: {
          data_geracao: new Date().toLocaleString('pt-BR'),
          estados_selecionados: exportStates.includes("Todos")
            ? "Todos"
            : exportStates.join(", "),
          redes_selecionadas: exportChainIds.includes("Todas")
            ? "Todas"
            : chains.filter(c => exportChainIds.includes(c.id)).map(c => c.name).join(", "),
          categorias_selecionadas: exportCategories.includes("Todas")
            ? "Todas"
            : exportCategories.join(", "),
          marcas_selecionadas: exportBrandTypes
            .map(t => t === "propria-oetker" ? "Dr. Oetker" : t === "propria-mavalerio" ? "Mavalério" : "Concorrentes")
            .join(", "),
        }
      };

      // Chamar API e fazer download
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Falha na geração do arquivo');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pesquisa_precos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setShowExportModal(false);
    } catch (err: any) {
      console.error("Erro ao exportar excel:", err);
      alert("Houve um erro ao processar a planilha. Detalhes: " + err.message);
    } finally {
      setExportIsGenerating(false);
    }
  };

  const handleToggleState = (stateName: string) => {
    if (stateName === "Todos") {
      setExportStates(["Todos"]);
    } else {
      if (exportStates.includes("Todos")) {
        setExportStates([stateName]);
      } else {
        let updated = [...exportStates];
        if (updated.includes(stateName)) {
          updated = updated.filter((s) => s !== stateName);
        } else {
          updated.push(stateName);
        }
        if (updated.length === 0 || updated.length === RESEARCH_STATES.length) {
          setExportStates(["Todos"]);
        } else {
          setExportStates(updated);
        }
      }
    }
  };

  const handleToggleChain = (chainId: string) => {
    if (chainId === "Todas") {
      setExportChainIds(["Todas"]);
    } else {
      if (exportChainIds.includes("Todas")) {
        // "Todas" is checked. Selecting a specific chain deselects all others and keeps only this one.
        setExportChainIds([chainId]);
      } else {
        let updated = [...exportChainIds];
        if (updated.includes(chainId)) {
          updated = updated.filter((id) => id !== chainId);
        } else {
          updated.push(chainId);
        }
        if (updated.length === 0 || updated.length === chains.length) {
          setExportChainIds(["Todas"]);
        } else {
          setExportChainIds(updated);
        }
      }
    }
  };

  const handleToggleCategory = (catName: string) => {
    const availableCategories = categories.filter((c) => c !== "Todas");
    if (catName === "Todas") {
      setExportCategories(["Todas"]);
    } else {
      if (exportCategories.includes("Todas")) {
        // "Todas" is checked. Selecting a specific category deselects all others and keeps only this one.
        setExportCategories([catName]);
      } else {
        let updated = [...exportCategories];
        if (updated.includes(catName)) {
          updated = updated.filter((c) => c !== catName);
        } else {
          updated.push(catName);
        }
        if (updated.length === 0 || updated.length === availableCategories.length) {
          setExportCategories(["Todas"]);
        } else {
          setExportCategories(updated);
        }
      }
    }
  };

  const handleToggleBrandType = (type: string) => {
    if (exportBrandTypes.includes(type)) {
      if (exportBrandTypes.length > 1) {
        setExportBrandTypes(exportBrandTypes.filter((t) => t !== type));
      }
    } else {
      setExportBrandTypes([...exportBrandTypes, type]);
    }
  };

  // O(1) map of record.id to its index in the original records list to determine insertion order
  const recordIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r, idx) => {
      map.set(r.id, idx);
    });
    return map;
  }, [records]);

  // Compare records: youngest/most recent date & ID first (descending chronological order)
  const compareRecordsDesc = useMemo(() => {
    return (a: PriceRecord, b: PriceRecord) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return b.id.localeCompare(a.id);
    };
  }, []);

  // Compare records: oldest date & ID first (ascending chronological order)
  const compareRecordsAsc = useMemo(() => {
    return (a: PriceRecord, b: PriceRecord) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return a.id.localeCompare(b.id);
    };
  }, []);

  // Filters state
  const [isOutdatedFilter, setIsOutdatedFilter] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Todas");
  const [selectedChainId, setSelectedChainId] = useState("Todas");
  const [selectedState, setSelectedState] = useState("Todas");
  const [selectedWeight, setSelectedWeight] = useState("Todas");
  const [selectedBrandFilters, setSelectedBrandFilters] = useState<
    ("propria-oetker" | "propria-mavalerio" | "concorrentes")[]
  >(["propria-oetker", "propria-mavalerio", "concorrentes"]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Sorting State
  const [sortBy, setSortBy] = useState("ultimo-preco");

  // Sorting Options depends on whether we filter by a specific network (selectedChainId)
  const sortingOptions = useMemo(() => {
    if (selectedChainId === "Todas") {
      return [
        { id: "ultimo-preco", label: "Último preço cadastrado" },
        { id: "nome-az", label: "Nome do produto (A → Z)" },
        { id: "nome-za", label: "Nome do produto (Z → A)" },
        { id: "menor-preco-medio", label: "Menor preço médio" },
        { id: "maior-preco-medio", label: "Maior preço médio" },
        { id: "maior-dispersao", label: "Maior dispersão de preços" },
        { id: "mais-auditorias", label: "Mais registros de auditoria" },
        { id: "cadastro-recente", label: "Cadastro mais recente" },
        { id: "mais-antigo", label: "Mais tempo sem atualização" },
      ];
    } else {
      return [
        { id: "ultimo-preco", label: "Último preço cadastrado" },
        { id: "nome-az", label: "Nome do produto (A → Z)" },
        { id: "nome-za", label: "Nome do produto (Z → A)" },
        { id: "menor-preco-rede", label: "Menor preço nessa rede" },
        { id: "maior-preco-rede", label: "Maior preço nessa rede" },
        { id: "mais-auditorias", label: "Mais registros de auditoria" },
        { id: "cadastro-recente", label: "Cadastro mais recente" },
        { id: "mais-antigo", label: "Mais tempo sem atualização" },
      ];
    }
  }, [selectedChainId]);

  // Validate active sorting strategy when the network selection changes
  useEffect(() => {
    const isValid = sortingOptions.some((opt) => opt.id === sortBy);
    if (!isValid) {
      setSortBy("ultimo-preco");
    }
  }, [selectedChainId, sortingOptions, sortBy]);

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedChainId, selectedState, selectedWeight, selectedBrandFilters, sortBy]);

  // Audit Photo Modal / Lightbox inside Product Detail
  const [selectedRecord, setSelectedRecord] = useState<PriceRecord | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [compareChainId, setCompareChainId] = useState<string>("");
  const [compareWeight, setCompareWeight] = useState<string>("Todas");
  const [compareByCategory, setCompareByCategory] = useState(true);
  const [compareBySubcategory, setCompareBySubcategory] = useState(true);
  const [compareByWeight, setCompareByWeight] = useState(false);
  const [competitorCompareChainId, setCompetitorCompareChainId] = useState<string>("Todas");
  const [detailStateFilter, setDetailStateFilter] = useState<string>("Todas");

  // Sync state filter in detail modal with main filter when opening a product
  useEffect(() => {
    if (selectedProductId) {
      setDetailStateFilter(selectedState !== "Todas" ? selectedState : "Todas");
    }
  }, [selectedProductId, selectedState]);

  // Chart-specific states (filtering networks and hover points)
  const [selectedChartChains, setSelectedChartChains] = useState<string[]>([]);
  const [showChartChainSelector, setShowChartChainSelector] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    chainId: string;
    chainName: string;
    date: string;
    price: number;
    x: number;
    y: number;
  } | null>(null);

  const getChainColor = (chainId: string) => {
    const chain = chains.find((c) => c.id === chainId);
    if (chain && chain.logoColor) {
      if (chain.logoColor.startsWith("#")) {
        return chain.logoColor;
      }
      if (chain.logoColor === "bg-blue-600") return "#2563eb";
      if (chain.logoColor === "bg-emerald-700") return "#047857";
      if (chain.logoColor === "bg-red-500") return "#ef4444";
      if (chain.logoColor === "bg-amber-600") return "#d97706";
      if (chain.logoColor === "bg-purple-600") return "#7c3aed";
    }
    const idx = chains.findIndex((c) => c.id === chainId);
    return idx === 0
      ? "#D40511"
      : idx === 1
        ? "#0284c7"
        : idx === 2
          ? "#16a34a"
          : idx === 3
            ? "#ea580c"
            : "#4b5563";
  };

  // Form states for creating a new product
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Geral Retail");
  const [newProdSubcategory, setNewProdSubcategory] = useState("Regular");
  const [newProdWeight, setNewProdWeight] = useState("100g");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdBasePrice, setNewProdBasePrice] = useState("0.00");
  const [newProdIsCompetitor, setNewProdIsCompetitor] = useState(false);
  const [newProdBrand, setNewProdBrand] = useState("Dr. Oetker");
  const [newProdInternalCode, setNewProdInternalCode] = useState("");
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (pageParams?.action === "create") {
      setIsOutdatedFilter(false);
      setActiveView("create");
      setNewProdName("");
      setNewProdCategory("Geral Retail");
      setNewProdSubcategory("Regular");
      setNewProdWeight("100g");
      setNewProdImageUrl("");
      setNewProdBasePrice("0.00");
      setNewProdIsCompetitor(false);
      setNewProdBrand("Dr. Oetker");
      setNewProdInternalCode("");
    } else if (pageParams?.action === "edit" && pageParams.productId) {
      setIsOutdatedFilter(false);
      const prod = products.find((p) => p.id === pageParams.productId);
      if (prod) {
        setSelectedProductId(prod.id);
        setActiveView("edit");
        setNewProdName(prod.name);
        setNewProdCategory(prod.category);
        setNewProdSubcategory(prod.subcategory || "Regular");
        setNewProdWeight(prod.weight || "100g");
        setNewProdImageUrl(prod.imageUrl);
        setNewProdBasePrice(prod.basePrice.toString());
        setNewProdIsCompetitor(prod.isCompetitor || false);
        setNewProdBrand(prod.brand || "Dr. Oetker");
        setNewProdInternalCode(prod.internalCode || "");
      }
    } else if (pageParams?.action === "detail" && pageParams.productId) {
      setIsOutdatedFilter(false);
      setSelectedProductId(pageParams.productId);
      setActiveView("detail");
    } else if (pageParams?.filter === "outdated") {
      setIsOutdatedFilter(true);
      setActiveView("list");
    } else if (pageParams?.chainId) {
      setIsOutdatedFilter(false);
      setSelectedChainId(pageParams.chainId);
      if (pageParams.state) {
        setSelectedState(pageParams.state);
      }
      setActiveView("list");
    } else {
      setIsOutdatedFilter(false);
      setActiveView("list");
    }
  }, [pageParams, products]);

  // Initialize selectedChartChains with the top 5 chains with most recent records for the selected product
  useEffect(() => {
    if (selectedProductId) {
      const productRecords = records.filter((r) => r.productId === selectedProductId);
      
      const latestRecordOfChain: Record<string, PriceRecord> = {};
      productRecords.forEach((r) => {
        const existing = latestRecordOfChain[r.chainId];
        if (!existing || compareRecordsDesc(r, existing) < 0) {
          latestRecordOfChain[r.chainId] = r;
        }
      });

      const chainsWithRecords = chains
        .filter((c) => latestRecordOfChain[c.id] !== undefined)
        .sort((a, b) => {
          const recordA = latestRecordOfChain[a.id];
          const recordB = latestRecordOfChain[b.id];
          return compareRecordsDesc(recordA, recordB);
        });

      let initialChains: string[] = [];
      if (chainsWithRecords.length > 0) {
        initialChains = chainsWithRecords.slice(0, 5).map((c) => c.id);
      } else {
        initialChains = chains.slice(0, 5).map((c) => c.id);
      }
      setSelectedChartChains(initialChains);
      setHoveredPoint(null); // Clear tooltips
    }
  }, [selectedProductId, records, chains, compareRecordsDesc]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const availableWeightsForSelected = useMemo(() => {
    if (!selectedProduct) return [];
    const list = new Set(
      products
        .filter(
          (p) =>
            p.category === selectedProduct.category && p.active && p.weight,
        )
        .map((p) => p.weight!),
    );
    return Array.from(list);
  }, [products, selectedProduct]);

  // Suggested configs map
  const SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
    Coberturas: ["Premium", "Confeiteiro"],
    Gelatinas: ["Regular", "Zero", "Diet", "Fini"],
    Fermentos: ["Fermento Químico", "Fermento em Pó"],
    "Ingredientes de Confeitaria": ["Confeiteiro", "Premium", "Regular"],
    "Sobremesas em Pó": ["Regular", "Zero", "Diet"],
    "Chás e Infusões": ["Regular", "Premium"],
    Congelados: ["Regular", "Premium"],
    "Geral Retail": ["Regular", "Premium"],
  };

  // Categories list
  const categories = useMemo(() => {
    const list = new Set(products.map((p) => p.category));
    // Make sure our major categories exist
    list.add("Coberturas");
    list.add("Gelatinas");
    list.add("Fermentos");
    return ["Todas", ...Array.from(list)];
  }, [products]);

  // Derived subcategories depending on the selected category
  const subcategories = useMemo(() => {
    const list = new Set<string>();
    products.forEach((p) => {
      if (selectedCategory === "Todas" || p.category === selectedCategory) {
        if (p.subcategory) {
          list.add(p.subcategory);
        }
      }
    });
    // Add default suggestions for UI if we are on a specific category
    if (
      selectedCategory !== "Todas" &&
      SUBCATEGORIES_BY_CATEGORY[selectedCategory]
    ) {
      SUBCATEGORIES_BY_CATEGORY[selectedCategory].forEach((sub) =>
        list.add(sub),
      );
    }
    return ["Todas", ...Array.from(list)];
  }, [products, selectedCategory]);

  // Derived weights depending on the selected category and subcategory
  const weights = useMemo(() => {
    const list = new Set<string>();
    products.forEach((p) => {
      if (p.active && p.weight) {
        if (selectedCategory === "Todas" || p.category === selectedCategory) {
          if (
            selectedSubcategory === "Todas" ||
            p.subcategory === selectedSubcategory
          ) {
            list.add(p.weight);
          }
        }
      }
    });
    return ["Todas", ...Array.from(list)];
  }, [products, selectedCategory, selectedSubcategory]);

  // Price record history for selected product sorted by date
  const selectedProductHistory = useMemo(() => {
    if (!selectedProductId) return [];
    return records
      .filter((r) => r.productId === selectedProductId)
      .sort(compareRecordsAsc);
  }, [records, selectedProductId, compareRecordsAsc]);

  // Regional pricing records filtered by selectedState
  const effectiveRecords = useMemo(() => {
    if (selectedState === "Todas") return records;
    return records.filter((r) => (r.state || "Minas Gerais") === selectedState);
  }, [records, selectedState]);

  // Dynamic calculated latest price per retail chain for each product or specific product
  const latestPricePerChainMap = useMemo(() => {
    const productChainPrices: Record<string, Record<string, number>> = {};

    // Sort effective records chronologically
    const sortedRecords = [...effectiveRecords].sort(compareRecordsAsc);

    sortedRecords.forEach((r) => {
      if (!productChainPrices[r.productId]) {
        productChainPrices[r.productId] = {};
      }
      productChainPrices[r.productId][r.chainId] = r.price;
    });

    return productChainPrices;
  }, [effectiveRecords, compareRecordsAsc]);

  // Memoized catalog summary metrics
  const catalogMetrics = useMemo(() => {
    const activeProducts = products.filter((p) => p.active !== false);
    const oetkerCount = activeProducts.filter((p) => {
      const b = (p.brand || "").toLowerCase();
      return !p.isCompetitor && b.includes("oetker");
    }).length;
    const mavalerioCount = activeProducts.filter((p) => {
      const b = (p.brand || "").toLowerCase();
      return (
        !p.isCompetitor &&
        (b.includes("mavalerio") || b.includes("mavalério"))
      );
    }).length;
    const competitorCount = activeProducts.filter((p) => {
      const b = (p.brand || "").toLowerCase();
      const isOetker = b.includes("oetker");
      const isMav = b.includes("mavalerio") || b.includes("mavalério");
      return !!p.isCompetitor || (!isOetker && !isMav);
    }).length;

    const outdatedList = getOutdatedProducts(products, effectiveRecords);

    return {
      total: activeProducts.length,
      oetker: oetkerCount,
      mavalerio: mavalerioCount,
      competitors: competitorCount,
      outdatedCount: outdatedList.length,
      outdatedIds: new Set(outdatedList.map((p) => p.id)),
      totalRecords: effectiveRecords.length,
    };
  }, [products, effectiveRecords]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (prod.active === false) return false;

      const searchTerms = (searchTerm || "").toLowerCase().trim().split(/\s+/).filter(Boolean).map(term => normalizeString(term));
      const matchesSearch = searchTerms.every((term) => {
        const nameMatch = normalizeString(prod.name).includes(term);
        const categoryMatch = normalizeString(prod.category).includes(term);
        const subcategoryMatch = prod.subcategory ? normalizeString(prod.subcategory).includes(term) : false;
        const brandMatch = prod.brand ? normalizeString(prod.brand).includes(term) : false;
        const weightMatch = prod.weight ? normalizeString(prod.weight).includes(term) : false;
        const internalCodeMatch = prod.internalCode ? normalizeString(prod.internalCode).includes(term) : false;
        return nameMatch || categoryMatch || subcategoryMatch || brandMatch || weightMatch || internalCodeMatch;
      });

      const matchesCategory =
        selectedCategory === "Todas" || prod.category === selectedCategory;
      const matchesSubcategory =
        selectedSubcategory === "Todas" ||
        prod.subcategory === selectedSubcategory;

      // Handle brand/competitor division
      let matchesBrand = false;
      const isAllBrands =
        selectedBrandFilters.length === 3 ||
        selectedBrandFilters.length === 0;

      if (isAllBrands) {
        matchesBrand = true;
      } else {
        const brandNormalized = (prod.brand || "").toLowerCase().trim();
        const isOetker = brandNormalized.includes("oetker");
        const isMavalerio =
          brandNormalized.includes("mavalerio") ||
          brandNormalized.includes("mavalério");
        const isCompetitor =
          !!prod.isCompetitor || (!isOetker && !isMavalerio);

        if (
          selectedBrandFilters.includes("propria-oetker") &&
          isOetker &&
          !prod.isCompetitor
        ) {
          matchesBrand = true;
        }
        if (
          selectedBrandFilters.includes("propria-mavalerio") &&
          isMavalerio &&
          !prod.isCompetitor
        ) {
          matchesBrand = true;
        }
        if (
          selectedBrandFilters.includes("concorrentes") &&
          isCompetitor
        ) {
          matchesBrand = true;
        }
      }

      // If a chain is selected, check if this product has at least one recorded price in that chain
      let matchesChain = true;
      if (selectedChainId !== "Todas") {
        matchesChain = effectiveRecords.some(
          (r) => r.productId === prod.id && r.chainId === selectedChainId
        );
      }

      // If a specific state is selected, check if this product has at least one recorded price in that state
      let matchesState = true;
      if (selectedState !== "Todas") {
        matchesState = effectiveRecords.some(
          (r) =>
            r.productId === prod.id &&
            (r.state === selectedState ||
              (!r.state && selectedState === "Minas Gerais"))
        );
      }

      // Weight filter logic
      const matchesWeight =
        selectedWeight === "Todas" || prod.weight === selectedWeight;
      
      const isOutdated = catalogMetrics.outdatedIds.has(prod.id);
      const matchesOutdated = isOutdatedFilter ? isOutdated : true;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSubcategory &&
        matchesChain &&
        matchesState &&
        matchesBrand &&
        matchesWeight &&
        matchesOutdated
      );
    });
  }, [
    products,
    effectiveRecords,
    searchTerm,
    selectedCategory,
    selectedSubcategory,
    selectedChainId,
    selectedState,
    selectedBrandFilters,
    selectedWeight,
    latestPricePerChainMap,
    isOutdatedFilter,
    catalogMetrics,
  ]);

  // Sort mappings
  const productLatestRecordMap = useMemo(() => {
    const map: Record<string, { time: number; index: number }> = {};
    const sortedAsc = [...effectiveRecords].sort(compareRecordsAsc);
    sortedAsc.forEach((r, idx) => {
      if (selectedChainId !== "Todas" && r.chainId !== selectedChainId) return;
      const t = new Date(r.date).getTime();
      const existing = map[r.productId];
      if (!existing || t > existing.time || (t === existing.time && idx > existing.index)) {
        map[r.productId] = { time: t, index: idx };
      }
    });
    return map;
  }, [effectiveRecords, selectedChainId, compareRecordsAsc]);

  const productAveragePriceMap = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    effectiveRecords.forEach((r) => {
      if (!map[r.productId]) {
        map[r.productId] = { sum: 0, count: 0 };
      }
      map[r.productId].sum += r.price;
      map[r.productId].count += 1;
    });
    const averages: Record<string, number> = {};
    Object.entries(map).forEach(([prodId, val]) => {
      averages[prodId] = val.sum / val.count;
    });
    return averages;
  }, [effectiveRecords]);

  const productDispersionMap = useMemo(() => {
    const prodPrices: Record<string, number[]> = {};
    effectiveRecords.forEach((r) => {
      if (!prodPrices[r.productId]) {
        prodPrices[r.productId] = [];
      }
      prodPrices[r.productId].push(r.price);
    });
    const dispersions: Record<string, number> = {};
    Object.entries(prodPrices).forEach(([prodId, prices]) => {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min > 0) {
        dispersions[prodId] = ((max - min) / min) * 100;
      } else {
        dispersions[prodId] = 0;
      }
    });
    return dispersions;
  }, [effectiveRecords]);

  const productRecordCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    effectiveRecords.forEach((r) => {
      if (selectedChainId !== "Todas" && r.chainId !== selectedChainId) return;
      map[r.productId] = (map[r.productId] || 0) + 1;
    });
    return map;
  }, [effectiveRecords, selectedChainId]);

  const sortedAndFilteredProducts = useMemo(() => {
    const list = [...filteredProducts];

    list.sort((a, b) => {
      switch (sortBy) {
        case "ultimo-preco": {
          const valA = productLatestRecordMap[a.id];
          const valB = productLatestRecordMap[b.id];
          const timeA = valA ? valA.time : 0;
          const timeB = valB ? valB.time : 0;
          if (timeA !== timeB) {
            return timeB - timeA; // Descending
          }
          const idxA = valA ? valA.index : -1;
          const idxB = valB ? valB.index : -1;
          if (idxA !== idxB) {
            return idxB - idxA; // Descending
          }
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "nome-az":
          return a.name.localeCompare(b.name, "pt-BR");
        case "nome-za":
          return b.name.localeCompare(a.name, "pt-BR");
        case "menor-preco-medio": {
          const avgA = productAveragePriceMap[a.id];
          const avgB = productAveragePriceMap[b.id];
          if (avgA !== undefined && avgB !== undefined) {
            return avgA - avgB;
          }
          if (avgA !== undefined) return -1;
          if (avgB !== undefined) return 1;
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "maior-preco-medio": {
          const avgA = productAveragePriceMap[a.id];
          const avgB = productAveragePriceMap[b.id];
          if (avgA !== undefined && avgB !== undefined) {
            return avgB - avgA;
          }
          if (avgA !== undefined) return -1;
          if (avgB !== undefined) return 1;
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "maior-dispersao": {
          const dispA = productDispersionMap[a.id] || 0;
          const dispB = productDispersionMap[b.id] || 0;
          if (dispA !== dispB) {
            return dispB - dispA;
          }
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "mais-auditorias": {
          const cntA = productRecordCountMap[a.id] || 0;
          const cntB = productRecordCountMap[b.id] || 0;
          if (cntA !== cntB) {
            return cntB - cntA;
          }
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "cadastro-recente": {
          const idxA = products.findIndex((item) => item.id === a.id);
          const idxB = products.findIndex((item) => item.id === b.id);
          return idxA - idxB;
        }
        case "mais-antigo": {
          const valA = productLatestRecordMap[a.id];
          const valB = productLatestRecordMap[b.id];
          const timeA = valA ? valA.time : 0;
          const timeB = valB ? valB.time : 0;
          if (timeA !== timeB) {
            return timeA - timeB; // Ascending
          }
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "menor-preco-rede": {
          const priceA = latestPricePerChainMap[a.id]?.[selectedChainId];
          const priceB = latestPricePerChainMap[b.id]?.[selectedChainId];
          if (priceA !== undefined && priceB !== undefined) {
            return priceA - priceB;
          }
          if (priceA !== undefined) return -1;
          if (priceB !== undefined) return 1;
          return a.name.localeCompare(b.name, "pt-BR");
        }
        case "maior-preco-rede": {
          const priceA = latestPricePerChainMap[a.id]?.[selectedChainId];
          const priceB = latestPricePerChainMap[b.id]?.[selectedChainId];
          if (priceA !== undefined && priceB !== undefined) {
            return priceB - priceA;
          }
          if (priceA !== undefined) return -1;
          if (priceB !== undefined) return 1;
          return a.name.localeCompare(b.name, "pt-BR");
        }
        default:
          return 0;
      }
    });

    return list;
  }, [
    filteredProducts,
    sortBy,
    productLatestRecordMap,
    productAveragePriceMap,
    productDispersionMap,
    productRecordCountMap,
    latestPricePerChainMap,
    selectedChainId,
    products,
  ]);

  // Paginated Products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedAndFilteredProducts.slice(startIndex, endIndex);
  }, [sortedAndFilteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedAndFilteredProducts.length / itemsPerPage) || 1;

  const pageNumbers = useMemo(() => {
    const list: number[] = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Adjust start page if we are near the end
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      list.push(i);
    }
    return list;
  }, [currentPage, totalPages]);

  // SVG Line Chart Drawer parameters
  const chartData = useMemo(() => {
    if (!selectedProductId || selectedProductHistory.length === 0) return null;

    // We want to graph a timeline
    // Collect all price records for this product
    // Group records by chain
    const chainSeries: Record<string, { date: string; price: number }[]> = {};
    chains.forEach((c) => {
      chainSeries[c.id] = [];
    });

    selectedProductHistory.forEach((r) => {
      if (chainSeries[r.chainId]) {
        chainSeries[r.chainId].push({
          date: r.date,
          price: r.price,
        });
      }
    });

    // Extract unique dates on x-axis (sorted)
    const uniqueDates = Array.from(
      new Set(selectedProductHistory.map((r) => r.date)),
    ).sort();

    // Find global min and max prices to set chart limits
    const allPrices = selectedProductHistory.map((r) => r.price);
    const maxPrice = Math.max(...allPrices, 5) * 1.1; // adding some headroom
    const minPrice = Math.max(0, Math.min(...allPrices, 1) * 0.9);

    return {
      chainSeries,
      uniqueDates,
      maxPrice,
      minPrice,
    };
  }, [selectedProductId, selectedProductHistory, chains]);

  const handleProductClick = (id: string) => {
    setSelectedProductId(id);
    setCompareWeight("Todas");
    setActiveView("detail");
  };

  const formatDateBR = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const getAuditDateColorClass = (dateStr: string | undefined | null) => {
    if (!dateStr) return "text-gray-400";
    try {
      const today = new Date();
      const auditDate = new Date(dateStr + "T00:00:00");
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const diffTime = todayZero.getTime() - auditDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 30) {
        return "text-rose-600"; 
      } else if (diffDays >= 15) {
        return "text-amber-500";
      }
      return "text-gray-400 font-medium";
    } catch {
      return "text-gray-400";
    }
  };

  const formatAuditDateRelative = (dateStr: string | undefined | null) => {
    if (!dateStr) return "Sem auditoria";
    try {
      const today = new Date();
      const auditDate = new Date(dateStr + "T00:00:00");
      const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const diffTime = todayZero.getTime() - auditDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Hoje";
      if (diffDays === 1) return "Ontem";
      if (diffDays < 30) return `há ${diffDays}d`;
      return formatDateBR(dateStr);
    } catch {
      return formatDateBR(dateStr);
    }
  };

  const handleStartCreateProduct = () => {
    setIsOutdatedFilter(false);
    setNewProdName("");
    setNewProdCategory(categories.find(c => c !== "Todas") || "Geral Retail");
    setNewProdSubcategory("Regular");
    setNewProdWeight("100g");
    setNewProdImageUrl("");
    setNewProdBasePrice("0.00");
    setNewProdIsCompetitor(false);
    setNewProdBrand("Dr. Oetker");
    setNewProdInternalCode("");
    setFormFeedback(null);
    setActiveView("create");
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedCategory !== "Todas") count++;
    if (selectedSubcategory !== "Todas") count++;
    if (selectedWeight !== "Todas") count++;
    if (selectedChainId !== "Todas") count++;
    if (selectedState !== "Todas") count++;
    if (isOutdatedFilter) count++;
    if (selectedBrandFilters.length < 3 && selectedBrandFilters.length > 0) count++;
    return count;
  }, [
    searchTerm,
    selectedCategory,
    selectedSubcategory,
    selectedWeight,
    selectedChainId,
    selectedState,
    isOutdatedFilter,
    selectedBrandFilters,
  ]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("Todas");
    setSelectedSubcategory("Todas");
    setSelectedWeight("Todas");
    setSelectedChainId("Todas");
    setSelectedState("Todas");
    setIsOutdatedFilter(false);
    setSelectedBrandFilters(["propria-oetker", "propria-mavalerio", "concorrentes"]);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6" id="products-view">
      {activeView === "list" && (
        <>
          {/* Top Banner and Actions */}
          <div
            className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5"
            id="products-header"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold tracking-widest text-[#D40511] uppercase font-mono">
                  Portfólio & Gôndola
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="text-[11px] font-semibold text-slate-500 font-mono">
                  {catalogMetrics.total} SKUs Monitorados
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-sans">
                Produtos Cadastrados
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Acompanhe o portfólio de produtos próprios e concorrentes, histórico de auditoria de campo e dispersão de preços no varejo.
              </p>
            </div>

            {/* Actions: + Novo Produto and Exportar Excel */}
            <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
              <button
                id="create-product-btn"
                type="button"
                onClick={handleStartCreateProduct}
                className="flex items-center gap-2 bg-[#D40511] hover:bg-[#b0040e] text-white px-4 py-2.5 rounded-xl font-bold shadow-xs hover:shadow-md transition-all text-xs sm:text-sm cursor-pointer select-none font-sans"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>Novo Produto</span>
              </button>

              <button
                id="export-excel-btn"
                type="button"
                onClick={() => {
                  setExportChainIds(["Todas"]);
                  setExportCategories(["Todas"]);
                  setExportBrandTypes(["propria-oetker", "propria-mavalerio", "concorrentes"]);
                  setExportIncludeHistory(false);
                  setShowExportModal(true);
                }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold shadow-xs hover:shadow-md transition-all text-xs sm:text-sm cursor-pointer select-none font-sans"
              >
                <Download className="w-4 h-4 text-white" />
                <span>Exportar Preços (Excel)</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" id="products-kpi-ribbon">
            {/* KPI 1: Total */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                  Portfólio Total
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono tracking-tight tabular-nums">
                  {catalogMetrics.total}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5 font-sans">
                  Itens cadastrados
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2: Own Brands */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block font-mono">
                  Marcas Próprias
                </span>
                <span className="text-2xl font-black text-emerald-800 font-mono tracking-tight tabular-nums">
                  {catalogMetrics.oetker + catalogMetrics.mavalerio}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5 truncate font-sans">
                  {catalogMetrics.oetker} Dr. Oetker · {catalogMetrics.mavalerio} Mavalério
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700 shrink-0">
                <Store className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3: Competitors */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block font-mono">
                  Concorrência
                </span>
                <span className="text-2xl font-black text-slate-800 font-mono tracking-tight tabular-nums">
                  {catalogMetrics.competitors}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5 font-sans">
                  SKUs rivais monitorados
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4: Audit Status */}
            <div className={`rounded-2xl border p-4 shadow-2xs flex items-center justify-between transition-colors ${
              catalogMetrics.outdatedCount > 0 
                ? "bg-amber-50/50 border-amber-200" 
                : "bg-white border-slate-200/90"
            }`}>
              <div className="min-w-0 pr-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider block font-mono ${
                  catalogMetrics.outdatedCount > 0 ? "text-amber-800" : "text-emerald-700"
                }`}>
                  Auditorias ({catalogMetrics.totalRecords})
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
                    catalogMetrics.outdatedCount > 0 ? "text-amber-900" : "text-emerald-800"
                  }`}>
                    {catalogMetrics.outdatedCount > 0 ? `${catalogMetrics.outdatedCount} pendentes` : "100% em dia"}
                  </span>
                </div>
                {catalogMetrics.outdatedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsOutdatedFilter(!isOutdatedFilter)}
                    className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer mt-0.5 block"
                  >
                    {isOutdatedFilter ? "Mostrar todos" : "Filtrar pendentes (>15d)"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 block mt-0.5 font-sans">
                    Preços recentes no radar
                  </span>
                )}
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                catalogMetrics.outdatedCount > 0 
                  ? "bg-amber-100 text-amber-800" 
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
              }`}>
                {catalogMetrics.outdatedCount > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
            </div>
          </div>

          {/* Brand Tabs container + View Mode Toggle container */}
          <div
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 mt-1 mb-2 w-full"
            id="brand-filters-and-modes-container"
          >
            {/* Brand Segmented Controls */}
            <div
              className="flex flex-wrap bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 gap-1 w-full lg:w-auto shadow-2xs"
              id="brand-tabs-container"
            >
              <button
                id="brand-tab-todos"
                type="button"
                onClick={() => {
                  setSelectedBrandFilters([
                    "propria-oetker",
                    "propria-mavalerio",
                    "concorrentes",
                  ]);
                }}
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedBrandFilters.length === 3 || selectedBrandFilters.length === 0
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Todos ({catalogMetrics.total})
              </button>
              <button
                id="brand-tab-propria"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.length === 3 || selectedBrandFilters.length === 0) {
                    setSelectedBrandFilters(["propria-oetker"]);
                  } else if (
                    selectedBrandFilters.length === 1 &&
                    selectedBrandFilters.includes("propria-oetker")
                  ) {
                    setSelectedBrandFilters([
                      "propria-oetker",
                      "propria-mavalerio",
                      "concorrentes",
                    ]);
                  } else if (selectedBrandFilters.includes("propria-oetker")) {
                    setSelectedBrandFilters(
                      selectedBrandFilters.filter(
                        (f) => f !== "propria-oetker",
                      ),
                    );
                  } else {
                    setSelectedBrandFilters([
                      ...selectedBrandFilters,
                      "propria-oetker",
                    ]);
                  }
                }}
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBrandFilters.includes("propria-oetker") && selectedBrandFilters.length < 3
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-emerald-800 hover:bg-emerald-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    selectedBrandFilters.includes("propria-oetker") && selectedBrandFilters.length < 3 
                      ? "bg-emerald-300" 
                      : "bg-emerald-500"
                  }`}
                />
                <span className="truncate">
                  Dr. Oetker ({catalogMetrics.oetker})
                </span>
              </button>
              <button
                id="brand-tab-propria-mavalerio"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.length === 3 || selectedBrandFilters.length === 0) {
                    setSelectedBrandFilters(["propria-mavalerio"]);
                  } else if (
                    selectedBrandFilters.length === 1 &&
                    selectedBrandFilters.includes("propria-mavalerio")
                  ) {
                    setSelectedBrandFilters([
                      "propria-oetker",
                      "propria-mavalerio",
                      "concorrentes",
                    ]);
                  } else if (selectedBrandFilters.includes("propria-mavalerio")) {
                    setSelectedBrandFilters(
                      selectedBrandFilters.filter(
                        (f) => f !== "propria-mavalerio",
                      ),
                    );
                  } else {
                    setSelectedBrandFilters([
                      ...selectedBrandFilters,
                      "propria-mavalerio",
                    ]);
                  }
                }}
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBrandFilters.includes("propria-mavalerio") && selectedBrandFilters.length < 3
                    ? "bg-violet-700 text-white shadow-xs"
                    : "text-violet-800 hover:bg-violet-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    selectedBrandFilters.includes("propria-mavalerio") && selectedBrandFilters.length < 3 
                      ? "bg-violet-300" 
                      : "bg-violet-500"
                  }`}
                />
                <span className="truncate">
                  Mavalério ({catalogMetrics.mavalerio})
                </span>
              </button>
              <button
                id="brand-tab-concorrentes"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.length === 3 || selectedBrandFilters.length === 0) {
                    setSelectedBrandFilters(["concorrentes"]);
                  } else if (
                    selectedBrandFilters.length === 1 &&
                    selectedBrandFilters.includes("concorrentes")
                  ) {
                    setSelectedBrandFilters([
                      "propria-oetker",
                      "propria-mavalerio",
                      "concorrentes",
                    ]);
                  } else if (selectedBrandFilters.includes("concorrentes")) {
                    setSelectedBrandFilters(
                      selectedBrandFilters.filter((f) => f !== "concorrentes"),
                    );
                  } else {
                    setSelectedBrandFilters([
                      ...selectedBrandFilters,
                      "concorrentes",
                    ]);
                  }
                }}
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBrandFilters.includes("concorrentes") && selectedBrandFilters.length < 3
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200/60"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    selectedBrandFilters.includes("concorrentes") && selectedBrandFilters.length < 3 
                      ? "bg-blue-400" 
                      : "bg-slate-500"
                  }`}
                />
                <span className="truncate">
                  Concorrentes ({catalogMetrics.competitors})
                </span>
              </button>
            </div>

            {/* View Mode Switcher + Outdated Quick Toggle + Sorter */}
            <div className="flex flex-wrap items-center gap-2.5" id="sorting-and-view-toggles">
              {/* Outdated Quick Pill */}
              {catalogMetrics.outdatedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsOutdatedFilter(!isOutdatedFilter)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none shadow-2xs ${
                    isOutdatedFilter
                      ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                      : "bg-white text-amber-800 border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Pendentes ({catalogMetrics.outdatedCount})</span>
                </button>
              )}

              {/* View Mode Switcher: Grid vs List */}
              <div
                className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 gap-1 shrink-0 select-none shadow-2xs"
                id="view-mode-toggle"
              >
                <button
                  id="toggle-grid-mode"
                  type="button"
                  onClick={() => setDisplayMode("grid")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
                    displayMode === "grid"
                      ? "bg-white text-[#D40511] shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Visualização em Grade"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grade</span>
                </button>
                <button
                  id="toggle-list-mode"
                  type="button"
                  onClick={() => setDisplayMode("list")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
                    displayMode === "list"
                      ? "bg-white text-[#D40511] shadow-xs border border-slate-200/60"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="Visualização em Tabela / Lista"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Sorting Select Filter */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs select-none" id="sorting-filter-wrapper">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-[10px] text-slate-400 uppercase font-bold whitespace-nowrap tracking-wide">
                  Ordenar:
                </span>
                <select
                  id="product-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent border-0 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer p-0 pr-1"
                >
                  {sortingOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} className="font-medium text-slate-800 bg-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Filtering Widgets Card */}
          <div
            className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3"
            id="filters-container"
          >
            {/* Top row of filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 gap-3">
              {/* Search Input with Clear Button */}
              <div
                className="relative w-full sm:col-span-2 lg:col-span-1 xl:col-span-3"
                id="search-input-wrapper"
              >
                <input
                  id="product-search-input"
                  type="text"
                  placeholder="Pesquisar por nome, marca ou código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#D40511]/20 focus:border-[#D40511] font-sans transition-all"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Limpar pesquisa"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Select Filter */}
              <div className="flex items-center gap-2 xl:col-span-2 min-w-0" id="category-filter-wrapper">
                <span className="text-[11px] text-slate-400 uppercase font-bold whitespace-nowrap shrink-0">
                  Categoria:
                </span>
                <select
                  id="product-category-filter-select"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedSubcategory("Todas");
                    setSelectedWeight("Todas");
                  }}
                  className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#D40511] cursor-pointer"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Select Filter */}
              <div className="flex items-center gap-2 xl:col-span-2 min-w-0" id="subcategory-filter-wrapper">
                <span className="text-[11px] text-slate-400 uppercase font-bold whitespace-nowrap shrink-0">
                  Subcat:
                </span>
                <select
                  id="product-subcategory-filter-select"
                  value={selectedSubcategory}
                  onChange={(e) => {
                    setSelectedSubcategory(e.target.value);
                    setSelectedWeight("Todas");
                  }}
                  className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#D40511] cursor-pointer"
                >
                  {subcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Weight Select Filter */}
              <div className="flex items-center gap-2 xl:col-span-1 min-w-0" id="weight-filter-wrapper">
                <span className="text-[11px] text-slate-400 uppercase font-bold whitespace-nowrap shrink-0">
                  Peso:
                </span>
                <select
                  id="product-weight-filter-select"
                  value={selectedWeight}
                  onChange={(e) => setSelectedWeight(e.target.value)}
                  className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#D40511] cursor-pointer"
                >
                  {weights.map((w) => (
                    <option key={w} value={w}>
                      {w === "Todas" ? "Todas" : w}
                    </option>
                  ))}
                </select>
              </div>

              {/* Retail Chain Filter */}
              <div className="flex items-center gap-2 xl:col-span-2 min-w-0" id="chain-filter-wrapper">
                <span className="text-[11px] text-slate-400 uppercase font-bold whitespace-nowrap shrink-0">
                  Rede:
                </span>
                <select
                  id="product-chain-filter-select"
                  value={selectedChainId}
                  onChange={(e) => setSelectedChainId(e.target.value)}
                  className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#D40511] cursor-pointer"
                >
                  <option value="Todas">Todas as Redes</option>
                  {chains.map((chain) => (
                    <option key={chain.id} value={chain.id}>
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Regional State Filter */}
              <div className="flex items-center gap-2 xl:col-span-2 min-w-0" id="state-filter-wrapper">
                <span className="text-[11px] text-slate-400 uppercase font-bold whitespace-nowrap shrink-0">
                  Estado:
                </span>
                <select
                  id="product-state-filter-select"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-[#D40511] cursor-pointer"
                >
                  <option value="Todas">Todos Estados</option>
                  {RESEARCH_STATES.map((st) => (
                    <option key={st.name} value={st.name}>
                      {st.uf} - {st.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Filters Row */}
            {activeFiltersCount > 0 && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">
                    Filtros ativos ({activeFiltersCount}):
                  </span>

                  {searchTerm.trim() && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      Busca: "{searchTerm}"
                      <button type="button" onClick={() => setSearchTerm("")} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedCategory !== "Todas" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      Cat: {selectedCategory}
                      <button type="button" onClick={() => setSelectedCategory("Todas")} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedSubcategory !== "Todas" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      Subcat: {selectedSubcategory}
                      <button type="button" onClick={() => setSelectedSubcategory("Todas")} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedWeight !== "Todas" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      Peso: {selectedWeight}
                      <button type="button" onClick={() => setSelectedWeight("Todas")} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedChainId !== "Todas" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      Rede: {chains.find(c => c.id === selectedChainId)?.name || selectedChainId}
                      <button type="button" onClick={() => setSelectedChainId("Todas")} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedState !== "Todas" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      UF: {selectedState}
                      <button type="button" onClick={() => setSelectedState("Todas")} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {isOutdatedFilter && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                      Apenas Pendentes (&gt;15d)
                      <button type="button" onClick={() => setIsOutdatedFilter(false)} className="hover:text-red-600 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  {selectedBrandFilters.length < 3 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[11px] font-medium border border-slate-200">
                      Marcas Filtradas ({selectedBrandFilters.length})
                      <button
                        type="button"
                        onClick={() => setSelectedBrandFilters(["propria-oetker", "propria-mavalerio", "concorrentes"])}
                        className="hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D40511] hover:underline cursor-pointer ml-1"
                  >
                    <RotateCcw className="w-3 h-3" /> Limpar todos
                  </button>
                </div>

                <div className="text-slate-400 font-medium text-[11px]">
                  Mostrando <span className="font-bold text-slate-700">{sortedAndFilteredProducts.length}</span> produtos
                </div>
              </div>
            )}
          </div>

          {/* Catalog View: Grid or List */}
          {displayMode === "grid" ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
              id="products-grid"
            >
              {paginatedProducts.map((prod) => {
                const pricesMap = (latestPricePerChainMap[prod.id] || {}) as Record<string, number>;
                const pricesCount = Object.keys(pricesMap).length;
                const priceValues = Object.values(pricesMap) as number[];
                const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
                const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;
                const averagePrice = priceValues.length > 0
                  ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
                  : prod.basePrice;

                const productRecords = records.filter(
                  (r) =>
                    r.productId === prod.id &&
                    (selectedChainId === "Todas" || r.chainId === selectedChainId),
                );
                const latestRecord = productRecords.length > 0
                  ? [...productRecords].sort(compareRecordsDesc)[0]
                  : null;
                const currentPrice = latestRecord ? latestRecord.price : prod.basePrice;
                const isOutdated = catalogMetrics.outdatedIds.has(prod.id);

                return (
                  <div
                    id={`product-card-${prod.id}`}
                    key={prod.id}
                    onClick={() => handleProductClick(prod.id)}
                    className="bg-white rounded-2xl border border-slate-200/85 hover:border-red-400 hover:shadow-lg transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between group h-full relative p-4"
                  >
                    {/* Top Content: Image & Badges */}
                    <div>
                      {/* Product Image Section */}
                      <div className="w-full h-40 bg-slate-50/80 rounded-xl overflow-hidden flex items-center justify-center p-3 relative mb-3 border border-slate-100 group-hover:bg-slate-50 transition-colors">
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xs"
                          onError={(e) => {
                            // Fallback on broken image
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />

                        {/* Brand Badge Top Left */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs backdrop-blur-xs ${
                              prod.isCompetitor
                                ? "text-slate-700 bg-white/95 border-slate-200"
                                : prod.brand?.toLowerCase().includes("mavalerio") || prod.brand?.toLowerCase().includes("mavalério")
                                  ? "text-violet-800 bg-violet-50/95 border-violet-200"
                                  : "text-emerald-800 bg-emerald-50/95 border-emerald-200"
                            }`}
                          >
                            {prod.brand || (prod.isCompetitor ? "Competidor" : "Dr. Oetker")}
                          </span>
                        </div>

                        {/* Top Right Badges: Outdated Pill + Code */}
                        <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                          {isOutdated && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100/95 text-amber-900 border border-amber-200 shadow-2xs">
                              <Clock className="w-2.5 h-2.5" /> Pendente
                            </span>
                          )}
                          {prod.internalCode && (
                            <span className="text-[9px] font-mono font-bold text-slate-600 bg-white/90 border border-slate-200 rounded px-1.5 py-0.2 shadow-2xs">
                              #{prod.internalCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Metadata */}
                      <div className="space-y-1">
                        <h3
                          className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#D40511] transition-colors font-sans min-h-[2.5rem]"
                          title={prod.name}
                        >
                          {prod.name}
                        </h3>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-sans">
                          <span className="font-medium truncate">{prod.category}</span>
                          {prod.subcategory && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="truncate">{prod.subcategory}</span>
                            </>
                          )}
                          {prod.weight && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono text-slate-600 shrink-0">{prod.weight}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Price Hero Section */}
                      <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3 my-3">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          <span>
                            {selectedChainId === "Todas" ? "Último Preço Auditado" : "Preço Nesta Rede"}
                          </span>
                          {(() => {
                            const recordChain = latestRecord
                              ? chains.find((c) => c.id === latestRecord.chainId)
                              : selectedChainId !== "Todas"
                                ? chains.find((c) => c.id === selectedChainId)
                                : null;
                            return recordChain ? (
                              <div className="flex items-center gap-1 text-slate-600 font-sans font-semibold">
                                <RetailerLogo chain={recordChain} size="sm" />
                                <span className="truncate max-w-[90px]">{recordChain.name.split(" ")[0]}</span>
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-2xl font-black text-slate-900 font-mono tracking-tight group-hover:text-[#D40511] transition-colors tabular-nums">
                            R$ {currentPrice.toFixed(2).replace('.', ',')}
                          </span>

                          {/* Deviation Badge */}
                          {priceValues.length > 0 && (() => {
                            const deviationStatus = currentPrice > averagePrice + 0.01 
                              ? "above" 
                              : currentPrice < averagePrice - 0.01 
                                ? "below" 
                                : "average";

                            if (deviationStatus === "below") {
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <TrendingDown className="w-3 h-3 text-emerald-600" />
                                  Abaixo méd.
                                </span>
                              );
                            } else if (deviationStatus === "above") {
                              return (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  <TrendingUp className="w-3 h-3 text-rose-600" />
                                  Acima méd.
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                  Na média
                                </span>
                              );
                            }
                          })()}
                        </div>

                        {/* Audit Date */}
                        <div className="text-[11px] mt-2 flex items-center justify-between font-sans text-slate-500 pt-1.5 border-t border-slate-200/60">
                          {latestRecord ? (
                            <span className={getAuditDateColorClass(latestRecord.date)}>
                              Auditado {formatAuditDateRelative(latestRecord.date)} ({formatDateBR(latestRecord.date)})
                            </span>
                          ) : (
                            <span className="text-slate-400">Preço base inicial</span>
                          )}
                        </div>
                      </div>

                      {/* Network Comparison Spread */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1.5">
                          <span>Monitor Redes ({pricesCount})</span>
                          {priceValues.length > 0 && (
                            <span className="font-mono text-slate-600 font-semibold lowercase">
                              méd: R$ {averagePrice.toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>

                        {pricesCount > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              let minChainId: string | null = null;
                              let maxChainId: string | null = null;

                              Object.entries(pricesMap).forEach(([chainId, price]) => {
                                if (price === minPrice && !minChainId) minChainId = chainId;
                              });
                              Object.entries(pricesMap).forEach(([chainId, price]) => {
                                if (price === maxPrice && !maxChainId && chainId !== minChainId) maxChainId = chainId;
                              });
                              if (!maxChainId && pricesCount > 1) {
                                Object.entries(pricesMap).forEach(([chainId, price]) => {
                                  if (price === maxPrice && !maxChainId) maxChainId = chainId;
                                });
                              }

                              return chains.map((chain) => {
                                if (chain.id !== minChainId && chain.id !== maxChainId) return null;
                                const price = pricesMap[chain.id];
                                if (price === undefined) return null;
                                const isMin = chain.id === minChainId;
                                const isMax = chain.id === maxChainId;
                                const badgeLabel = isMin && isMax ? "único" : isMin ? "mín" : "máx";

                                return (
                                  <div 
                                    key={chain.id}
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 border text-xs select-none transition-all ${
                                      isMin && isMax 
                                        ? "border-slate-200 bg-slate-50 text-slate-700" 
                                        : isMin 
                                          ? "border-emerald-200 bg-emerald-50/70 text-emerald-800" 
                                          : "border-rose-200 bg-rose-50/70 text-rose-800"
                                    }`}
                                    title={`${chain.name}: R$ ${price.toFixed(2)} (${badgeLabel})`}
                                  >
                                    <RetailerLogo chain={chain} size="sm" />
                                    <span className="font-mono font-bold tabular-nums">
                                      R$ {price.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span className="text-[9px] font-sans font-medium text-slate-400 uppercase">
                                      {badgeLabel}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic">
                            Sem outras redes registradas
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Ver detalhes affordance */}
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#D40511] transition-colors">
                      <span>Ver histórico completo</span>
                      <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                );
              })}

              {sortedAndFilteredProducts.length === 0 && (
                <div
                  className="col-span-full bg-white p-12 text-center border border-slate-200 rounded-2xl shadow-xs"
                  id="empty-products-view"
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <Package className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-1">
                    Nenhum produto encontrado
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Nenhum item do catálogo corresponde aos filtros selecionados. Tente ajustar os termos de pesquisa ou remover restrições.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Limpar todos os filtros
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* LIST / TABLE VIEW */
            <div className="flex flex-col gap-2.5" id="products-list-layout">
              {/* Table Column Headers */}
              <div className="hidden md:grid md:grid-cols-12 md:items-center gap-4 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                <div className="md:col-span-4">Produto & Especificações</div>
                <div className="md:col-span-2">Marca & Tipo</div>
                <div className="md:col-span-3">Último Preço Auditado</div>
                <div className="md:col-span-2">Comparativo Redes</div>
                <div className="md:col-span-1 text-right">Ação</div>
              </div>

              {paginatedProducts.map((prod) => {
                const pricesMap = (latestPricePerChainMap[prod.id] || {}) as Record<string, number>;
                const pricesCount = Object.keys(pricesMap).length;
                const priceValues = Object.values(pricesMap) as number[];
                const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : null;
                const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : null;
                const averagePrice = priceValues.length > 0
                  ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
                  : prod.basePrice;

                const productRecords = records.filter(
                  (r) =>
                    r.productId === prod.id &&
                    (selectedChainId === "Todas" || r.chainId === selectedChainId),
                );
                const latestRecord = productRecords.length > 0
                  ? [...productRecords].sort(compareRecordsDesc)[0]
                  : null;
                const currentPrice = latestRecord ? latestRecord.price : prod.basePrice;
                const isOutdated = catalogMetrics.outdatedIds.has(prod.id);

                return (
                  <div
                    id={`product-list-row-${prod.id}`}
                    key={prod.id}
                    onClick={() => handleProductClick(prod.id)}
                    className="bg-white rounded-xl border border-slate-200/85 hover:border-red-400 hover:shadow-sm transition-all duration-200 cursor-pointer p-3.5 flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 group relative"
                  >
                    {/* Col 1: Product Thumbnail & Title (span 4) */}
                    <div className="flex items-center gap-3.5 min-w-0 md:col-span-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 shrink-0 overflow-hidden shadow-2xs">
                        <img
                          src={prod.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          {prod.internalCode && (
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              #{prod.internalCode}
                            </span>
                          )}
                          {isOutdated && (
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                              Pendente
                            </span>
                          )}
                          {prod.weight && (
                            <span className="text-[10px] font-mono text-slate-500">
                              {prod.weight}
                            </span>
                          )}
                        </div>

                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#D40511] transition-colors truncate font-sans" title={prod.name}>
                          {prod.name}
                        </h3>

                        <p className="text-[11px] text-slate-400 truncate">
                          {prod.category} {prod.subcategory ? `· ${prod.subcategory}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Col 2: Brand & Type (span 2) */}
                    <div className="md:col-span-2">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          prod.isCompetitor
                            ? "text-slate-700 bg-slate-100 border-slate-200"
                            : prod.brand?.toLowerCase().includes("mavalerio") || prod.brand?.toLowerCase().includes("mavalério")
                              ? "text-violet-800 bg-violet-50 border-violet-200"
                              : "text-emerald-800 bg-emerald-50 border-emerald-200"
                        }`}
                      >
                        {prod.brand || (prod.isCompetitor ? "Competidor" : "Dr. Oetker")}
                      </span>
                    </div>

                    {/* Col 3: Last Audited Price (span 3) */}
                    <div className="md:col-span-3 flex flex-col justify-center">
                      <div className="flex items-baseline gap-2">
                        {(() => {
                          const recordChain = latestRecord
                            ? chains.find((c) => c.id === latestRecord.chainId)
                            : selectedChainId !== "Todas"
                              ? chains.find((c) => c.id === selectedChainId)
                              : null;
                          return recordChain ? (
                            <div className="shrink-0" title={recordChain.name}>
                              <RetailerLogo chain={recordChain} size="sm" />
                            </div>
                          ) : null;
                        })()}

                        <span className="text-base font-black font-mono tracking-tight text-slate-900 group-hover:text-[#D40511] transition-colors tabular-nums">
                          R$ {currentPrice.toFixed(2).replace('.', ',')}
                        </span>

                        {priceValues.length > 0 && (() => {
                          const status = currentPrice > averagePrice + 0.01 
                            ? "above" 
                            : currentPrice < averagePrice - 0.01 
                              ? "below" 
                              : "average";

                          if (status === "below") {
                            return (
                              <span className="inline-flex items-center text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200" title="Abaixo da média">
                                <TrendingDown className="w-3 h-3 text-emerald-600 mr-0.5" /> Abaixo
                              </span>
                            );
                          } else if (status === "above") {
                            return (
                              <span className="inline-flex items-center text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200" title="Acima da média">
                                <TrendingUp className="w-3 h-3 text-rose-600 mr-0.5" /> Acima
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="text-[10px] mt-0.5 truncate font-sans text-slate-500">
                        {latestRecord ? (
                          <span className={getAuditDateColorClass(latestRecord.date)}>
                            Auditado {formatAuditDateRelative(latestRecord.date)}
                          </span>
                        ) : (
                          <span className="text-slate-400">Base sem auditoria</span>
                        )}
                      </div>
                    </div>

                    {/* Col 4: Market Benchmarks (span 2) */}
                    <div className="md:col-span-2">
                      {pricesCount > 0 ? (
                        <div className="text-xs space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="text-slate-400 w-8">Mín:</span>
                            <span className="font-bold text-emerald-700">R$ {minPrice?.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="text-slate-400 w-8">Méd:</span>
                            <span className="font-bold text-slate-700">R$ {averagePrice.toFixed(2).replace('.', ',')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] font-mono">
                            <span className="text-slate-400 w-8">Máx:</span>
                            <span className="font-bold text-rose-700">R$ {maxPrice?.toFixed(2).replace('.', ',')}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sem benchmark</span>
                      )}
                    </div>

                    {/* Col 5: Detail Action Chevron (span 1) */}
                    <div className="md:col-span-1 flex items-center md:justify-end">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#D40511] group-hover:border-red-200 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedAndFilteredProducts.length === 0 && (
                <div
                  className="bg-white p-12 text-center border border-slate-200 rounded-2xl shadow-xs"
                  id="empty-products-view-list"
                >
                  <p className="text-slate-500 font-medium text-sm">
                    Nenhum produto cadastrado corresponde aos filtros.
                  </p>
                  <button
                    onClick={handleResetFilters}
                    className="mt-3 text-xs font-bold text-[#D40511] hover:underline cursor-pointer"
                  >
                    Limpar filtros de busca
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Modern Pagination Bar */}
          {sortedAndFilteredProducts.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-white border border-slate-200 rounded-2xl shadow-2xs mt-4 font-sans" id="products-pagination-bar">
              {/* Items Per Page Selector & Textual Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] font-sans">
                    Itens por página:
                  </span>
                  <select
                    id="pagination-items-per-page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#D40511] cursor-pointer"
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                    <option value={96}>96</option>
                    <option value={500}>Todos</option>
                  </select>
                </div>
                <div className="text-slate-500 font-sans">
                  Exibindo <span className="text-slate-900 font-bold font-mono">{Math.min(sortedAndFilteredProducts.length, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(currentPage * itemsPerPage, sortedAndFilteredProducts.length)}</span> de <span className="text-slate-900 font-bold font-mono">{sortedAndFilteredProducts.length}</span> produtos
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="pagination-first-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === 1 
                      ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" 
                      : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:text-[#D40511]"
                  }`}
                  title="Primeira página"
                >
                  <ChevronLeft className="w-3.5 h-3.5 -mr-1.5" />
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  id="pagination-prev-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === 1 
                      ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" 
                      : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:text-[#D40511]"
                  }`}
                  title="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border font-mono text-xs font-bold transition-all cursor-pointer select-none ${
                      currentPage === p 
                        ? "bg-[#D40511] border-[#D40511] text-white shadow-xs" 
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  id="pagination-next-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === totalPages 
                      ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" 
                      : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:text-[#D40511]"
                  }`}
                  title="Próxima página"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  id="pagination-last-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === totalPages 
                      ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed" 
                      : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:text-[#D40511]"
                  }`}
                  title="Última página"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <ChevronRight className="w-3.5 h-3.5 -ml-1.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {activeView === "detail" && selectedProduct && (
        <ProductDetailPage
          product={selectedProduct}
          allProducts={products}
          chains={chains}
          records={records}
          currentUser={currentUser}
          onBack={() => {
            setActiveView("list");
            setSelectedProductId(null);
          }}
          onRegisterPrice={() => {
            setShowRegisterPriceModal(true);
          }}
          onEditProduct={(prod) => {
            setSelectedProductId(prod.id);
            setActiveView("edit");
            setNewProdName(prod.name);
            setNewProdCategory(prod.category);
            setNewProdSubcategory(prod.subcategory || "Regular");
            setNewProdWeight(prod.weight || "100g");
            setNewProdImageUrl(prod.imageUrl);
            setNewProdBasePrice(prod.basePrice.toString());
            setNewProdIsCompetitor(prod.isCompetitor || false);
            setNewProdBrand(prod.brand || "Dr. Oetker");
            setNewProdInternalCode(prod.internalCode || "");
          }}
          onOpenEditPriceModal={(chain, record, stateName) => {
            handleOpenEditPriceModal(chain, record, stateName);
          }}
          onSelectRecord={(record) => {
            setSelectedRecord(record);
          }}
          onSelectPeerProduct={(peerId) => {
            handleProductClick(peerId);
          }}
        />
      )}

      {(activeView === "create" || activeView === "edit") && (
        <div
          className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden"
          id="product-create-view"
        >
          <div className="bg-[#F5F5F5] border-b border-[#E0E0E0] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <button
              onClick={() => {
                if (onNavigate) onNavigate("settings");
                else setActiveView("list");
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#1A1A1A] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar às Configurações
            </button>
            <h2 className="text-xl font-black text-[#1A1A1A]">
              {activeView === "edit" ? "Editar Produto" : "Criar Novo Produto"}
            </h2>
            <div className="w-[124px] hidden md:block"></div>
          </div>

          {/* Success/Error Feedback */}
          {formFeedback && (
            <div
              className={`p-4 border ${formFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'} rounded-xl m-6`}
            >
              <p className="text-sm font-bold">{formFeedback.message}</p>
            </div>
          )}

          <div className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  if (activeView === "edit" && selectedProductId) {
                    const existingProd = products.find(
                      (p) => p.id === selectedProductId,
                    );
                    if (existingProd) {
                      onEditProduct({
                        ...existingProd,
                        name: newProdName,
                        category: newProdCategory,
                        subcategory: newProdSubcategory,
                        weight: newProdWeight,
                        imageUrl: newProdImageUrl || existingProd.imageUrl,
                        basePrice: parseFloat(newProdBasePrice) || 0,
                        isCompetitor: newProdIsCompetitor,
                        brand: newProdBrand,
                        internalCode: newProdInternalCode.trim() || undefined,
                      });
                    }
                    setFormFeedback({ type: 'success', message: 'Produto editado com sucesso!' });
                  } else {
                    const uniqueId = `prod-add-${Date.now()}`;
                    onAddProduct({
                      id: uniqueId,
                      name: newProdName,
                      category: newProdCategory,
                      subcategory: newProdSubcategory,
                      weight: newProdWeight,
                      imageUrl:
                        newProdImageUrl ||
                        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
                      active: true,
                      basePrice: parseFloat(newProdBasePrice) || 0,
                      isCompetitor: newProdIsCompetitor,
                      brand: newProdBrand,
                      internalCode: newProdInternalCode.trim() || undefined,
                    });
                    setFormFeedback({ type: 'success', message: 'Produto cadastrado com sucesso!' });
                  }
                  setNewProdName("");
                  setNewProdBasePrice("0.00");
                  setNewProdInternalCode("");
                } catch (error) {
                  setFormFeedback({ type: 'error', message: 'Erro ao processar produto. Tente novamente.' });
                }
                if (onNavigate) onNavigate("produtos", null);
              }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-gray-700">
                    NOME DO PRODUTO
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                    placeholder="Ex: Gelatina de Morango 20g"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span>CÓDIGO INTERNO (MARCA PRÓPRIA)</span>
                    <span className="text-[10px] text-gray-400 font-normal">Dr. Oetker / Mavalério</span>
                  </label>
                  <input
                    type="text"
                    value={newProdInternalCode}
                    onChange={(e) => setNewProdInternalCode(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                    placeholder="Ex: OET-1029 ou MAV-4401"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    CATEGORIA
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    SUBCATEGORIA
                  </label>
                  <input
                    type="text"
                    value={newProdSubcategory}
                    onChange={(e) => setNewProdSubcategory(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    MARCA
                  </label>
                  <input
                    type="text"
                    required
                    value={newProdBrand}
                    onChange={(e) => setNewProdBrand(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    GRAMATURA
                  </label>
                  <input
                    type="text"
                    value={newProdWeight}
                    onChange={(e) => setNewProdWeight(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                    placeholder="Ex: 100g"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    PREÇO BASE REFERÊNCIA (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdBasePrice}
                    onChange={(e) => setNewProdBasePrice(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">
                    URL DA IMAGEM
                  </label>
                  <input
                    type="url"
                    value={newProdImageUrl}
                    onChange={(e) => setNewProdImageUrl(e.target.value)}
                    className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-sm bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <label className="text-xs font-bold text-gray-700">
                    É UM CONCORRENTE?
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer max-w-max">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={newProdIsCompetitor}
                      onChange={(e) => setNewProdIsCompetitor(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#D40511]"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      Sim, produto concorrente
                    </span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-[#E0E0E0]">
                <button
                  type="submit"
                  className="bg-[#D40511] text-white px-6 py-2 rounded-xl font-bold shadow hover:bg-red-700 transition"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Lightbox Photo */}
      {selectedRecord && (
        <div
          id="common-lightbox-scroller"
          onClick={() => { setSelectedRecord(null); setShowDeleteConfirm(false); }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="max-w-3xl max-h-[80vh] bg-white rounded-xl p-2 shadow-2xl relative w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedRecord.imageUrl && (
              <img
                src={selectedRecord.imageUrl}
                alt="Auditoria de Gôndola"
                referrerPolicy="no-referrer"
                className="max-h-[70vh] rounded-lg object-contain w-full"
              />
            )}
            {/* Audit Lightbox Info & Actions */}
            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 rounded-b-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-gray-800 uppercase tracking-tight">
                    {chains.find((c) => c.id === selectedRecord.chainId)?.name || "Rede"}
                  </span>
                  {selectedRecord.state && (
                    <span className="text-[10px] font-mono font-bold text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                      {RESEARCH_STATES.find(s => s.name === selectedRecord.state)?.uf || selectedRecord.state}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 font-mono">
                  <span>Preço na foto: <strong className="text-gray-900 font-black">R$ {selectedRecord.price.toFixed(2)}</strong></span>
                  <span>•</span>
                  <span>{formatDateBR(selectedRecord.date)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const ch = chains.find((c) => c.id === selectedRecord.chainId);
                    if (ch) {
                      handleOpenEditPriceModal(ch, selectedRecord, selectedRecord.state);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:border-[#D40511] text-gray-700 hover:text-[#D40511] rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" /> Alterar Preço
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-bold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </div>
            </div>
            
            {showDeleteConfirm && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4 rounded-xl">
                  <p className="text-sm font-bold text-gray-800">Deseja realmente excluir este registro?</p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                          onDeleteRecord?.(selectedRecord.id);
                          setSelectedRecord(null);
                          setShowDeleteConfirm(false);
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

            <button
              onClick={() => { setSelectedRecord(null); setShowDeleteConfirm(false); }}
              className="absolute -top-3 -right-3 bg-[#D40511] text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow hover:bg-red-700 transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Product Image Fullscreen Viewer Modal */}
      {productPhotoModal && (
        <div
          id="product-photo-fullscreen-modal"
          onClick={() => setProductPhotoModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <div
            className="relative flex flex-col items-center max-w-full max-h-full cursor-default select-none animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button with min touch target 44x44px */}
            <button
              onClick={() => setProductPhotoModal(null)}
              className="absolute -top-12 sm:top-2 -right-2 sm:-right-12 text-white hover:text-gray-300 bg-[#E0E0E0]/20 hover:bg-[#E0E0E0]/30 rounded-full w-11 h-11 flex items-center justify-center transition-all cursor-pointer focus:outline-none"
              aria-label="Fechar visualização"
              title="Fechar"
            >
              <X className="w-6 h-6" />
            </button>
            
            <img
              src={productPhotoModal.url}
              alt={productPhotoModal.name}
              referrerPolicy="no-referrer"
              className="max-w-[90vw] max-h-[75vh] md:max-h-[80vh] rounded-xl object-contain shadow-2xl"
            />
            
            <p className="text-center text-sm md:text-base text-white/95 font-bold font-sans mt-4 px-4 py-2 bg-black/60 rounded-lg max-w-[85vw] break-words">
              {productPhotoModal.name}
            </p>
          </div>
        </div>
      )}

      {/* Grid of registered networks modal (Register Price Quick link) */}
      {showRegisterPriceModal && selectedProduct && (
        <div
          id="product-register-price-modal-backdrop"
          onClick={() => setShowRegisterPriceModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full border border-gray-150 overflow-hidden shadow-2xl relative cursor-default"
            onClick={(e) => e.stopPropagation()}
            id="product-register-price-modal-card"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F5F5F5]">
              <div className="flex items-center gap-2.5">
                <div className="bg-[#D40511] text-white p-2 rounded-xl">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#1A1A1A] font-sans uppercase tracking-wider">
                    Registrar Preço Coletado
                  </h3>
                  <p className="text-[10px] text-gray-505 mt-0.5 font-sans font-semibold">
                    Selecione a rede de auditoria para prosseguir com a foto do comprovante.
                  </p>
                </div>
              </div>
              <button
                id="close-register-price-modal-btn"
                onClick={() => setShowRegisterPriceModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Grid of registered networks */}
            <div className="p-6 space-y-4 max-h-[385px] overflow-y-auto">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans mb-1.5">
                  Produto Selecionado
                </p>
                <div className="p-3 bg-red-50/20 border border-red-100 rounded-xl flex items-center gap-2.5">
                  {selectedProduct.imageUrl && (
                    <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 shrink-0" />
                  )}
                  <div>
                    <p className="text-[10px] font-extrabold text-slate-800 leading-snug">{selectedProduct.name}</p>
                    <p className="text-[9px] text-slate-400 font-medium">Categoria: {selectedProduct.category} / Base: R$ {selectedProduct.basePrice.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans">
                  Selecione a Rede (PDV)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {chains.map((chain) => {
                    // find latest price record for this chain to show last registered price if any
                    const latestRec = selectedProductHistory
                      .filter((h) => h.chainId === chain.id)
                      .sort((a, b) => b.date.localeCompare(a.date))[0];

                    return (
                      <button
                        key={chain.id}
                        type="button"
                        onClick={() => {
                          setShowRegisterPriceModal(false);
                          onNavigate?.('registrar', {
                            productId: selectedProduct.id,
                            chainId: chain.id,
                            skipToStep: 3, // skips step 1 & 2 and directly goes to product and price confirmation
                          });
                        }}
                        className="p-3 bg-slate-50 border border-slate-200 hover:border-[#D40511] hover:bg-red-50/5 rounded-xl transition duration-150 flex items-center justify-between text-left cursor-pointer group shadow-2xs h-14"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            style={chain.logoColor?.startsWith("#") ? { backgroundColor: chain.logoColor } : {}}
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-white text-[9px] shrink-0 overflow-hidden border border-gray-100 shadow-2xs ${
                              chain.logoColor?.startsWith("#") ? "" : (chain.logoColor || "bg-gray-400")
                            }`}
                          >
                            {chain.logoUrl ? (
                              <img
                                src={chain.logoUrl}
                                alt={chain.name}
                                className="w-full h-full object-contain p-0.5 bg-white"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{chain.name.substring(0, 2).toUpperCase()}</span>
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-800 leading-snug truncate group-hover:text-[#D40511]">
                              {chain.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono font-medium mt-0.5">
                              {latestRec ? `Último: R$ ${latestRec.price.toFixed(2)}` : 'Sem histórico'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[#D40511] font-bold text-[10px] group-hover:translate-x-0.5 transition-transform shrink-0">
                          &rarr;
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Excel Customizable Export Modal */}
      {showExportModal && (
        <div
          id="custom-excel-export-modal"
          onClick={() => setShowExportModal(false)}
          className="fixed inset-0 z-55 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full border border-gray-150 overflow-hidden shadow-2xl relative cursor-default flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            id="excel-export-modal-card"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F5F5F5]">
              <div className="flex items-center gap-2.5">
                <div className="bg-emerald-600 text-white p-2.5 rounded-xl">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#1A1A1A] font-sans uppercase tracking-wider">
                    Configurar Exportação em Excel
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-sans font-semibold">
                    Selecione quais dados e segmentações deseja incluir na planilha baixada
                  </p>
                </div>
              </div>
              <button
                id="close-export-modal-btn"
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-1 cursor-pointer focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
              
              {/* Step 1: States (Estados) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#D40511] font-mono">
                    1. Filtrar por Estados
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">
                    {exportStates.includes("Todos") ? "Todos os estados selecionados" : `${exportStates.length} selecionado(s)`}
                  </span>
                </div>
                
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none col-span-1 sm:col-span-2 ${
                    exportStates.includes("Todos")
                      ? "border-emerald-500 ring-1 ring-emerald-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={exportStates.includes("Todos")}
                      onChange={() => handleToggleState("Todos")}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-slate-800">Todos os Estados</span>
                  </label>
                  
                  {RESEARCH_STATES.map((st) => (
                    <label
                      key={st.name}
                      className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                        exportStates.includes(st.name) || exportStates.includes("Todos")
                          ? "border-emerald-500 ring-1 ring-emerald-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={exportStates.includes(st.name) || exportStates.includes("Todos")}
                        onChange={() => handleToggleState(st.name)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {st.uf}
                        </span>
                        <span className="text-xs font-bold text-slate-700 truncate">{st.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 2: Chains (Redes) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#D40511] font-mono">
                    2. Filtrar por Redes (PDV)
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">
                    {exportChainIds.includes("Todas") ? "Todas as redes selecionadas" : `${exportChainIds.length} selecionada(s)`}
                  </span>
                </div>
                
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                    exportChainIds.includes("Todas")
                      ? "border-emerald-500 ring-1 ring-emerald-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={exportChainIds.includes("Todas")}
                      onChange={() => handleToggleChain("Todas")}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-slate-800">Todas as Redes</span>
                  </label>
                  
                  {chains.map((ch) => (
                    <label
                      key={ch.id}
                      className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                        exportChainIds.includes(ch.id) || exportChainIds.includes("Todas")
                          ? "border-emerald-500 ring-1 ring-emerald-500/20"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={exportChainIds.includes(ch.id) || exportChainIds.includes("Todas")}
                        onChange={() => handleToggleChain(ch.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 truncate">{ch.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Step 3: Categories */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#D40511] font-mono">
                    3. Filtrar por Categorias
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold">
                    {exportCategories.includes("Todas") ? "Todas as categorias" : `${exportCategories.length} selecionada(s)`}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none col-span-1 sm:col-span-2 ${
                    exportCategories.includes("Todas")
                      ? "border-emerald-500 ring-1 ring-emerald-500/20"
                      : "border-slate-200 hover:border-emerald-500"
                  }`}>
                    <input
                      type="checkbox"
                      checked={exportCategories.includes("Todas")}
                      onChange={() => handleToggleCategory("Todas")}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-slate-800">Todas as Categorias</span>
                  </label>

                  {categories
                    .filter((cat) => cat !== "Todas")
                    .map((cat) => (
                      <label
                        key={cat}
                        className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                          exportCategories.includes(cat) || exportCategories.includes("Todas")
                            ? "border-emerald-500 ring-1 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={exportCategories.includes(cat) || exportCategories.includes("Todas")}
                          onChange={() => handleToggleCategory(cat)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700 truncate">{cat}</span>
                      </label>
                    ))}
                </div>
              </div>

              {/* Step 4: Brands (Marcas) */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#D40511] font-mono block">
                  4. Filtrar por Marcas
                </span>
                
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-150/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label
                    className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                      exportBrandTypes.includes("propria-oetker")
                        ? "border-emerald-500 bg-emerald-50/5 ring-1 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={exportBrandTypes.includes("propria-oetker")}
                      onChange={() => handleToggleBrandType("propria-oetker")}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-800">Dr. Oetker</span>
                      <span className="text-[8px] text-slate-400 font-medium font-semibold">Marca Própria</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                      exportBrandTypes.includes("propria-mavalerio")
                        ? "border-emerald-500 bg-emerald-50/5 ring-1 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={exportBrandTypes.includes("propria-mavalerio")}
                      onChange={() => handleToggleBrandType("propria-mavalerio")}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-800">Mavalério</span>
                      <span className="text-[8px] text-slate-400 font-medium font-semibold">Marca Própria</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 px-3 py-2 bg-white rounded-xl border transition cursor-pointer select-none ${
                      exportBrandTypes.includes("concorrentes")
                        ? "border-emerald-500 bg-emerald-50/5 ring-1 ring-emerald-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={exportBrandTypes.includes("concorrentes")}
                      onChange={() => handleToggleBrandType("concorrentes")}
                      className="w-4 h-4 text-emerald-605 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-800">Concorrentes</span>
                      <span className="text-[8px] text-slate-400 font-medium font-semibold">Todas concorrentes</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 5: Include History Toggle */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#D40511] font-mono block">
                  5. Detalhes e Histórico
                </span>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">Histórico de Visitas Completo</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">
                      Se ativado, cada alteração e pesquisa cadastrada gerará uma linha inteira na primeira aba. Se desativado, pegaremos apenas o último preço gôndola vigente de cada produto por rede.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-[#111827] uppercase tracking-wide">
                      {exportIncludeHistory ? "Histórico Completo" : "Último Apenas"}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={exportIncludeHistory}
                        onChange={(e) => setExportIncludeHistory(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-350 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-gray-100 flex justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition shadow-2xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={exportIsGenerating}
                onClick={handleExecuteExcelExport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold shadow hover:shadow-md transition cursor-pointer flex items-center gap-2"
              >
                {exportIsGenerating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-white" />
                    <span>Baixar Planilha Excel</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Chain Price Modal */}
      {editPriceModal && (
        <div
          id="edit-chain-price-modal-backdrop"
          onClick={() => {
            if (!isSavingPrice) setEditPriceModal(null);
          }}
          className="fixed inset-0 z-55 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 cursor-pointer"
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full border border-gray-150 overflow-hidden shadow-2xl relative cursor-default flex flex-col"
            onClick={(e) => e.stopPropagation()}
            id="edit-chain-price-modal-card"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-[#F8F9FA]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#D40511] border border-red-150 flex items-center justify-center shrink-0">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-[#1A1A1A] font-sans uppercase tracking-wider">
                    Alterar Preço na Rede
                  </h3>
                  <p className="text-[10px] text-gray-500 font-sans font-semibold">
                    {editPriceModal.record ? "Atualize o preço praticado para esta rede" : "Cadastre um preço para esta rede"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingPrice}
                onClick={() => setEditPriceModal(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1 transition cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveEditedPrice} className="p-5 space-y-4">
              {/* Product & Chain Header Summary Card */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden p-1 flex items-center justify-center shrink-0">
                    {editPriceModal.product.imageUrl ? (
                      <img
                        src={editPriceModal.product.imageUrl}
                        alt={editPriceModal.product.name}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase text-[#D40511] font-mono tracking-wide block">
                      {editPriceModal.product.brand || "Dr. Oetker"}
                    </span>
                    <h4 className="text-xs font-black text-slate-800 truncate leading-tight">
                      {editPriceModal.product.name}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Preço Base: R$ {editPriceModal.product.basePrice.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* Chain Badge */}
                <div className="flex flex-col items-end shrink-0 pl-2 border-l border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <span
                      style={editPriceModal.chain.logoColor?.startsWith("#") ? { backgroundColor: editPriceModal.chain.logoColor } : {}}
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[8px] shrink-0 overflow-hidden border border-gray-100 ${
                        editPriceModal.chain.logoColor?.startsWith("#") ? "" : (editPriceModal.chain.logoColor || "bg-gray-400")
                      }`}
                    >
                      {editPriceModal.chain.logoUrl ? (
                        <img
                          src={editPriceModal.chain.logoUrl}
                          alt={editPriceModal.chain.name}
                          className="w-full h-full object-contain p-0.5 bg-white"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{editPriceModal.chain.name.substring(0, 2).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="text-xs font-black text-slate-800">
                      {editPriceModal.chain.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 mt-0.5">
                    {RESEARCH_STATES.find(s => s.name === editPriceModal.stateName)?.uf || editPriceModal.stateName}
                  </span>
                </div>
              </div>

              {/* Price Input Field with Calculator Format */}
              <div className="bg-slate-50 border-2 border-slate-200 focus-within:border-[#D40511] focus-within:bg-white rounded-2xl p-3.5 transition flex flex-col items-center justify-center">
                <label htmlFor="input-edit-price-val" className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Novo Preço de Gôndola (R$) *
                </label>
                <div className="flex items-baseline justify-center gap-1.5 w-full">
                  <span className="text-2xl font-black text-slate-400 font-mono">R$</span>
                  <input
                    id="input-edit-price-val"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    required
                    value={editPriceValue}
                    onChange={(e) => {
                      const val = formatPriceInput(e.target.value);
                      setEditPriceValue(val);
                    }}
                    className="w-48 text-center text-3xl font-black font-mono text-[#D40511] bg-transparent outline-none border-b-2 border-slate-300 focus:border-[#D40511] tracking-tight"
                    placeholder="0,00"
                  />
                </div>
                {/* Quick Shortcuts */}
                <div className="flex items-center gap-2 mt-2.5">
                  {editPriceModal.product.basePrice > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditPriceValue(editPriceModal.product.basePrice.toFixed(2).replace('.', ','))}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded-md transition cursor-pointer"
                    >
                      Preço Base (R$ {editPriceModal.product.basePrice.toFixed(2).replace('.', ',')})
                    </button>
                  )}
                  {editPriceModal.record && editPriceModal.record.price > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditPriceValue(editPriceModal.record!.price.toFixed(2).replace('.', ','))}
                      className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 px-2 py-0.5 rounded-md transition cursor-pointer"
                    >
                      Preço Anterior (R$ {editPriceModal.record.price.toFixed(2).replace('.', ',')})
                    </button>
                  )}
                </div>
              </div>

              {/* Date Field */}
              <div>
                <label htmlFor="input-edit-price-date" className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                  Data de Coleta
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    id="input-edit-price-date"
                    type="date"
                    value={editPriceDate}
                    onChange={(e) => setEditPriceDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-800 focus:outline-none focus:bg-white focus:border-[#D40511]"
                  />
                </div>
              </div>

              {/* Notes / Observação */}
              <div>
                <label htmlFor="input-edit-price-notes" className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                  Observações (Opcional)
                </label>
                <input
                  id="input-edit-price-notes"
                  type="text"
                  placeholder="Ex: Promoção de encarte, etiqueta amarela, etc."
                  value={editPriceNotes}
                  onChange={(e) => setEditPriceNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-[#D40511]"
                />
              </div>

              {/* Feedback Alert */}
              {editPriceFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    editPriceFeedback.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {editPriceFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{editPriceFeedback.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingPrice}
                  onClick={() => setEditPriceModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrice || !editPriceValue || editPriceValue === "0,00"}
                  className="px-6 py-2.5 bg-[#D40511] hover:bg-[#b0040e] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold transition shadow flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
                >
                  {isSavingPrice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Salvar Preço</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
