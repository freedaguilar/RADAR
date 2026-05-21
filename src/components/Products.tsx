import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
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
} from "lucide-react";
import { Product, Chain, PriceRecord } from "../types";

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
  onAddProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
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

  // O(1) map of record.id to its index in the original records list to determine insertion order
  const recordIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((r, idx) => {
      map.set(r.id, idx);
    });
    return map;
  }, [records]);

  // Compare records: youngest/most recent date & index first (descending chronological order)
  const compareRecordsDesc = useMemo(() => {
    return (a: PriceRecord, b: PriceRecord) => {
      const tA = new Date(a.date).getTime();
      const tB = new Date(b.date).getTime();
      if (tA !== tB) {
        return tB - tA;
      }
      const idxA = recordIndexMap.get(a.id) ?? -1;
      const idxB = recordIndexMap.get(b.id) ?? -1;
      return idxB - idxA;
    };
  }, [recordIndexMap]);

  // Compare records: oldest date & index first (ascending chronological order)
  const compareRecordsAsc = useMemo(() => {
    return (a: PriceRecord, b: PriceRecord) => {
      const tA = new Date(a.date).getTime();
      const tB = new Date(b.date).getTime();
      if (tA !== tB) {
        return tA - tB;
      }
      const idxA = recordIndexMap.get(a.id) ?? -1;
      const idxB = recordIndexMap.get(b.id) ?? -1;
      return idxA - idxB;
    };
  }, [recordIndexMap]);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Todas");
  const [selectedChainId, setSelectedChainId] = useState("Todas");
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
  }, [searchTerm, selectedCategory, selectedSubcategory, selectedChainId, selectedWeight, selectedBrandFilters, sortBy]);

  // Audit Photo Modal / Lightbox inside Product Detail
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [compareChainId, setCompareChainId] = useState<string>("");
  const [compareWeight, setCompareWeight] = useState<string>("Todas");
  const [compareByCategory, setCompareByCategory] = useState(true);
  const [compareBySubcategory, setCompareBySubcategory] = useState(true);
  const [compareByWeight, setCompareByWeight] = useState(false);
  const [competitorCompareChainId, setCompetitorCompareChainId] = useState<string>("Todas");

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
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (pageParams?.action === "create") {
      setActiveView("create");
      setNewProdName("");
      setNewProdCategory("Geral Retail");
      setNewProdSubcategory("Regular");
      setNewProdWeight("100g");
      setNewProdImageUrl("");
      setNewProdBasePrice("0.00");
      setNewProdIsCompetitor(false);
      setNewProdBrand("Dr. Oetker");
    } else if (pageParams?.action === "edit" && pageParams.productId) {
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
      }
    } else if (pageParams?.action === "detail" && pageParams.productId) {
      setSelectedProductId(pageParams.productId);
      setActiveView("detail");
    } else {
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

  // Dynamic calculated latest price per retail chain for each product or specific product
  const latestPricePerChainMap = useMemo(() => {
    const productChainPrices: Record<string, Record<string, number>> = {};

    // Sort all records chronologically
    const sortedRecords = [...records].sort(compareRecordsAsc);

    sortedRecords.forEach((r) => {
      if (!productChainPrices[r.productId]) {
        productChainPrices[r.productId] = {};
      }
      productChainPrices[r.productId][r.chainId] = r.price;
    });

    return productChainPrices;
  }, [records, compareRecordsAsc]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (!prod.active) return false;

      const searchTerms = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
      const matchesSearch = searchTerms.every((term) => {
        const nameMatch = prod.name.toLowerCase().includes(term);
        const categoryMatch = prod.category.toLowerCase().includes(term);
        const subcategoryMatch = prod.subcategory ? prod.subcategory.toLowerCase().includes(term) : false;
        const brandMatch = prod.brand ? prod.brand.toLowerCase().includes(term) : false;
        const weightMatch = prod.weight ? prod.weight.toLowerCase().includes(term) : false;
        return nameMatch || categoryMatch || subcategoryMatch || brandMatch || weightMatch;
      });

      const matchesCategory =
        selectedCategory === "Todas" || prod.category === selectedCategory;
      const matchesSubcategory =
        selectedSubcategory === "Todas" ||
        prod.subcategory === selectedSubcategory;

      // Handle brand/competitor division
      let matchesBrand = false;
      if (
        selectedBrandFilters.includes("propria-oetker") &&
        !prod.isCompetitor &&
        prod.brand === "Dr. Oetker"
      ) {
        matchesBrand = true;
      }
      if (
        selectedBrandFilters.includes("propria-mavalerio") &&
        !prod.isCompetitor &&
        (prod.brand?.toLowerCase().includes("mavalerio") ||
          prod.brand?.toLowerCase().includes("mavalério"))
      ) {
        matchesBrand = true;
      }
      if (
        selectedBrandFilters.includes("concorrentes") &&
        !!prod.isCompetitor
      ) {
        matchesBrand = true;
      }

      // If a chain is selected, check if this product has at least one recorded price in that chain
      let matchesChain = true;
      if (selectedChainId !== "Todas") {
        const prices = latestPricePerChainMap[prod.id] || {};
        matchesChain = prices[selectedChainId] !== undefined;
      }

      // Weight filter logic
      const matchesWeight =
        selectedWeight === "Todas" || prod.weight === selectedWeight;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSubcategory &&
        matchesChain &&
        matchesBrand &&
        matchesWeight
      );
    });
  }, [
    products,
    searchTerm,
    selectedCategory,
    selectedSubcategory,
    selectedChainId,
    selectedBrandFilters,
    selectedWeight,
    latestPricePerChainMap,
  ]);

  // Sort mappings
  const productLatestRecordMap = useMemo(() => {
    const map: Record<string, { time: number; index: number }> = {};
    records.forEach((r, idx) => {
      if (selectedChainId !== "Todas" && r.chainId !== selectedChainId) return;
      const t = new Date(r.date).getTime();
      const existing = map[r.productId];
      if (!existing || t > existing.time || (t === existing.time && idx > existing.index)) {
        map[r.productId] = { time: t, index: idx };
      }
    });
    return map;
  }, [records, selectedChainId]);

  const productAveragePriceMap = useMemo(() => {
    const map: Record<string, { sum: number; count: number }> = {};
    records.forEach((r) => {
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
  }, [records]);

  const productDispersionMap = useMemo(() => {
    const prodPrices: Record<string, number[]> = {};
    records.forEach((r) => {
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
  }, [records]);

  const productRecordCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach((r) => {
      if (selectedChainId !== "Todas" && r.chainId !== selectedChainId) return;
      map[r.productId] = (map[r.productId] || 0) + 1;
    });
    return map;
  }, [records, selectedChainId]);

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

  return (
    <div className="space-y-6" id="products-view">
      {activeView === "list" && (
        <>
          {/* Top Banner and Actions */}
          <div
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#E0E0E0] pb-6"
            id="products-header"
          >
            <div>
              <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase font-mono">
                Catálogo de Auditoria
              </span>
              <h1 className="text-3xl font-black text-[#1A1A1A] font-sans">
                Produtos Cadastrados
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Acompanhe o portfólio monitorado nas principais redes e pontos
                de venda.
              </p>
            </div>
          </div>

          {/* Brand Tabs container + View Mode Toggle container */}
          <div
            className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mt-2 mb-4 w-full"
            id="brand-filters-and-modes-container"
          >
            <div
              className="flex flex-wrap bg-[#F5F5F5] p-1.5 rounded-2xl border border-[#E0E0E0] gap-1 w-full lg:w-auto shadow-2xs"
              id="brand-tabs-container"
            >
              <button
                id="brand-tab-todos"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.length === 3) {
                    // Toggle to none, or keep all? Usually Clicking "Todos" should select everything.
                    // Let's toggle: if some are missing, select all. If all are selected, toggle to first one, or allow clearing.
                    // Best behavior: make sure all are selected.
                    setSelectedBrandFilters([
                      "propria-oetker",
                      "propria-mavalerio",
                      "concorrentes",
                    ]);
                  } else {
                    setSelectedBrandFilters([
                      "propria-oetker",
                      "propria-mavalerio",
                      "concorrentes",
                    ]);
                  }
                }}
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedBrandFilters.length === 3
                    ? "bg-white text-[#1A1A1A] shadow-xs border border-[#E0E0E0]/60"
                    : "text-gray-500 hover:text-[#1A1A1A]"
                }`}
              >
                Todos ({products.filter((p) => p.active).length})
              </button>
              <button
                id="brand-tab-propria"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.includes("propria-oetker")) {
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
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBrandFilters.includes("propria-oetker")
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${selectedBrandFilters.includes("propria-oetker") ? "bg-emerald-300" : "bg-emerald-500"}`}
                />
                <span className="truncate">
                  Dr. Oetker (
                  {
                    products.filter(
                      (p) =>
                        p.active && !p.isCompetitor && p.brand === "Dr. Oetker",
                    ).length
                  }
                  )
                </span>
              </button>
              <button
                id="brand-tab-propria-mavalerio"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.includes("propria-mavalerio")) {
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
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBrandFilters.includes("propria-mavalerio")
                    ? "bg-violet-700 text-white shadow-xs"
                    : "text-violet-700 hover:bg-violet-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${selectedBrandFilters.includes("propria-mavalerio") ? "bg-violet-300" : "bg-violet-500"}`}
                />
                <span className="truncate">
                  Mavalério (
                  {
                    products.filter(
                      (p) =>
                        p.active &&
                        !p.isCompetitor &&
                        (p.brand?.toLowerCase().includes("mavalerio") ||
                          p.brand?.toLowerCase().includes("mavalério")),
                    ).length
                  }
                  )
                </span>
              </button>
              <button
                id="brand-tab-concorrentes"
                type="button"
                onClick={() => {
                  if (selectedBrandFilters.includes("concorrentes")) {
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
                className={`flex-1 sm:flex-none justify-center px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedBrandFilters.includes("concorrentes")
                    ? "bg-[#1A1A1A] text-white shadow-xs"
                    : "text-[#D40511] hover:bg-rose-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${selectedBrandFilters.includes("concorrentes") ? "bg-rose-400" : "bg-[#D40511]"}`}
                />
                <span className="truncate">
                  Concorrentes (
                  {products.filter((p) => p.active && p.isCompetitor).length})
                </span>
              </button>
            </div>

            {/* View Mode Switcher + Sorter */}
            <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto animate-fade-in" id="sorting-and-view-toggles">
              {/* View Mode Switcher: Grid vs List */}
              <div
                className="flex bg-[#F5F5F5] p-1 rounded-xl border border-[#E0E0E0] gap-1 shrink-0 w-full sm:w-auto select-none shadow-2xs"
                id="view-mode-toggle"
              >
                <button
                  id="toggle-grid-mode"
                  type="button"
                  onClick={() => setDisplayMode("grid")}
                  className={`flex-1 sm:flex-none justify-center px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
                    displayMode === "grid"
                      ? "bg-white text-[#D40511] shadow-xs border border-[#E0E0E0]/50"
                      : "text-gray-500 hover:text-[#1A1A1A]"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grade</span>
                </button>
                <button
                  id="toggle-list-mode"
                  type="button"
                  onClick={() => setDisplayMode("list")}
                  className={`flex-1 sm:flex-none justify-center px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
                    displayMode === "list"
                      ? "bg-white text-[#D40511] shadow-xs border border-[#E0E0E0]/50"
                      : "text-gray-500 hover:text-[#1A1A1A]"
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista</span>
                </button>
              </div>

              {/* Sorting Select Filter */}
              <div className="flex items-center gap-2 bg-[#F5F5F5] px-3 py-1.5 rounded-xl border border-[#E0E0E0] shadow-2xs select-none w-full sm:w-auto" id="sorting-filter-wrapper">
                <span className="text-[10px] text-gray-400 uppercase font-black whitespace-nowrap tracking-wide">
                  Ordenar por:
                </span>
                <select
                  id="product-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-transparent border-0 text-xs font-black text-[#1A1A1A] focus:outline-none cursor-pointer p-0 pr-1 w-full sm:w-auto"
                >
                  {sortingOptions.map((opt) => (
                    <option key={opt.id} value={opt.id} className="font-semibold text-gray-800 bg-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Filtering Widgets */}
          <div
            className="bg-white p-5 rounded-2xl border border-[#E0E0E0]/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 gap-4"
            id="filters-container"
          >
            {/* Search Input */}
            <div
              className="relative w-full sm:col-span-2 lg:col-span-1 xl:col-span-4"
              id="search-input-wrapper"
            >
              <input
                id="product-search-input"
                type="text"
                placeholder="Pesquisar por nome ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#F5F5F5] border border-[#E0E0E0]/80 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-[#D40511] font-sans"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            </div>

            {/* Category Select Filter */}
            <div className="flex items-center gap-2 xl:col-span-2 min-w-0" id="category-filter-wrapper">
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap shrink-0 lg:min-w-[65px]">
                Categoria:
              </span>
              <select
                id="product-category-filter-select"
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory("Todas"); // Reset subcategory when changing category
                  setSelectedWeight("Todas"); // Reset weight when changing category
                }}
                className="w-full flex-1 bg-[#F5F5F5] border border-[#E0E0E0]/80 rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-semibold focus:outline-none focus:border-[#D40511]"
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
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap shrink-0 lg:min-w-[45px]">
                Subcat:
              </span>
              <select
                id="product-subcategory-filter-select"
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setSelectedWeight("Todas"); // Reset weight when changing subcategory
                }}
                className="w-full flex-1 bg-[#F5F5F5] border border-[#E0E0E0]/80 rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-semibold focus:outline-none focus:border-[#D40511]"
              >
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Weight Select Filter */}
            <div className="flex items-center gap-2 xl:col-span-2 min-w-0" id="weight-filter-wrapper">
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap shrink-0 lg:min-w-[65px]">
                Gramatura:
              </span>
              <select
                id="product-weight-filter-select"
                value={selectedWeight}
                onChange={(e) => setSelectedWeight(e.target.value)}
                className="w-full flex-1 bg-[#F5F5F5] border border-[#E0E0E0]/80 rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-semibold focus:outline-none focus:border-[#D40511]"
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
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap shrink-0 lg:min-w-[65px]">
                Preço em:
              </span>
              <select
                id="product-chain-filter-select"
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(e.target.value)}
                className="w-full flex-1 bg-[#F5F5F5] border border-[#E0E0E0]/80 rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-semibold focus:outline-none focus:border-[#D40511]"
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

          {displayMode === "grid" ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
              id="products-grid"
            >
              {paginatedProducts.map((prod) => {
                // Extract prices across chains for this item
                const pricesMap = (latestPricePerChainMap[prod.id] ||
                  {}) as Record<string, number>;
                const pricesCount = Object.keys(pricesMap).length;

                // Find lowest and highest prices
                const priceValues = Object.values(pricesMap) as number[];
                const minPrice =
                  priceValues.length > 0 ? Math.min(...priceValues) : null;
                const maxPrice =
                  priceValues.length > 0 ? Math.max(...priceValues) : null;

                // Find overall average price
                const averagePrice =
                  priceValues.length > 0
                    ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
                    : prod.basePrice;

                // Find the latest price record for this product based on selectedChainId
                const productRecords = records.filter(
                  (r) =>
                    r.productId === prod.id &&
                    (selectedChainId === "Todas" ||
                      r.chainId === selectedChainId),
                );
                const latestRecord =
                  productRecords.length > 0
                    ? [...productRecords].sort(compareRecordsDesc)[0]
                    : null;
                const currentPrice = latestRecord
                  ? latestRecord.price
                  : prod.basePrice;

                return (
                  <div
                    id={`product-card-${prod.id}`}
                    key={prod.id}
                    onClick={() => handleProductClick(prod.id)}
                    className="bg-white rounded-xl border border-gray-200 hover:border-[#D40511] hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between group h-full relative"
                  >
                    {/* Card Content */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      {/* Top Part: Image, Badges & Brand */}
                      <div>
                        <div className="flex items-start gap-2.5">
                          <div className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden bg-gray-50/50 flex items-center justify-center p-1.5 relative shadow-2xs">
                            <img
                              src={prod.imageUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Brand & Indicators */}
                            <div className="flex flex-wrap items-center gap-1 mb-1 bg-opacity-0">
                              <span
                                className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  prod.isCompetitor
                                    ? "text-slate-600 bg-slate-50 border-slate-200"
                                    : prod.brand?.toLowerCase().includes("mavalerio") || prod.brand?.toLowerCase().includes("mavalério")
                                      ? "text-violet-750 bg-violet-50 border-violet-150"
                                      : "text-emerald-850 bg-emerald-50 border-emerald-150"
                                }`}
                              >
                                {prod.brand || (prod.isCompetitor ? "Competidor" : "Dr. Oetker")}
                              </span>
                              <span className="text-[9px] font-mono text-gray-400 bg-gray-50 border border-gray-150/50 rounded px-1 py-0.5 select-none shrink-0" title="Gramatura">
                                {prod.weight || "N/A"}
                              </span>
                            </div>

                            <h3 className="text-xs font-bold text-[#1A1A1A] line-clamp-2 leading-tight group-hover:text-[#D40511] transition-colors font-sans" title={prod.name}>
                              {prod.name}
                            </h3>
                          </div>
                        </div>

                        {/* Category/Subcategory Small Badges Row */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="inline-block text-[8px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.2 uppercase tracking-wide">
                            {prod.category}
                          </span>
                          {prod.subcategory && (
                            <span className="inline-block text-[8px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.2 uppercase tracking-wide">
                              {prod.subcategory}
                            </span>
                          )}
                        </div>
                                   {/* Center Part: Price & last audit */}
                      <div className="border-t border-gray-100 pt-2.5 flex flex-col justify-between">
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block font-sans select-none mb-1">
                          {selectedChainId === "Todas" ? "ÚLTIMO PREÇO REGISTRADO" : "PREÇO ATUAL"}
                        </span>
                        
                        <div className="flex items-center justify-between gap-2.5">
                          {/* Left Logo + Price */}
                          <div className="flex items-center gap-1.5 min-w-0">
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
                            
                            <span className="text-xl font-extrabold text-[#1A1A1A] font-mono tracking-tight group-hover:text-[#D40511] transition-colors whitespace-nowrap leading-none">
                              R$ {currentPrice.toFixed(2)}
                            </span>
                          </div>

                          {/* Right: Deviation Badges */}
                          <div className="shrink-0">
                            {(() => {
                              if (priceValues.length === 0) return <span className="text-[8px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded px-1">Sem dados</span>;
                              const deviationStatus = currentPrice > averagePrice + 0.01 
                                ? "above" 
                                : currentPrice < averagePrice - 0.01 
                                  ? "below" 
                                  : "average";

                              if (deviationStatus === "below") {
                                return (
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-100 shrink-0 select-none" title="Abaixo da Média">
                                    <TrendingDown className="w-2.5 h-2.5" />
                                    Média
                                  </span>
                                );
                              } else if (deviationStatus === "above") {
                                return (
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-red-700 bg-red-50 px-1 rounded border border-red-100 shrink-0 select-none" title="Acima da Média">
                                    <TrendingUp className="w-2.5 h-2.5" />
                                    Média
                                  </span>
                                );
                              } else {
                                return (
                                  <span className="inline-flex items-center gap-0.5 text-[8px] font-extrabold text-slate-650 bg-slate-50 px-1 rounded border border-slate-150 shrink-0 select-none" title="Na Média">
                                    Na média
                                  </span>
                                );
                              }
                            })()}
                          </div>
                        </div>

                        {/* Audit Details */}
                        <div className="text-[10px] text-gray-400 mt-1 flex items-center justify-between font-sans">
                          {latestRecord ? (
                            <span className="truncate block max-w-[140px]" title={formatDateBR(latestRecord.date)}>
                              Auditado: {formatDateBR(latestRecord.date)}
                            </span>
                          ) : (
                            <span>Base (sem audit.)</span>
                          )}
                          {latestRecord && selectedChainId === "Todas" && (
                            <span className="text-[9px] text-gray-450 font-semibold uppercase font-sans">
                              {chains.find(c => c.id === latestRecord.chainId)?.name.split(" ")[0]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom: Retailers Competitor Pricing Horizontal view */}
                      <div className="border-t border-gray-100 pt-2.5">
                        <div className="flex items-center justify-between text-[9px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5 select-none">
                          <span>Monitor das Redes ({pricesCount})</span>
                          {priceValues.length > 0 && (
                            <span className="font-mono lowercase font-normal">
                              méd: R$ {averagePrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        
                        {pricesCount > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(() => {
                              // Find min price chain and max price chain
                              let minChainId: string | null = null;
                              let maxChainId: string | null = null;

                              Object.entries(pricesMap).forEach(([chainId, price]) => {
                                if (price === minPrice && !minChainId) {
                                  minChainId = chainId;
                                }
                              });
                              Object.entries(pricesMap).forEach(([chainId, price]) => {
                                if (price === maxPrice && !maxChainId && chainId !== minChainId) {
                                  maxChainId = chainId;
                                }
                              });
                              if (!maxChainId && pricesCount > 1) {
                                Object.entries(pricesMap).forEach(([chainId, price]) => {
                                  if (price === maxPrice && !maxChainId) {
                                    maxChainId = chainId;
                                  }
                                });
                              }

                              return chains.map((chain) => {
                                if (chain.id !== minChainId && chain.id !== maxChainId) return null;
                                const price = pricesMap[chain.id];
                                if (price === undefined) return null;
                                const isMin = chain.id === minChainId;
                                const isMax = chain.id === maxChainId;
                                const badgeLabel = isMin && isMax ? "único" : isMin ? "min" : "max";

                                return (
                                  <div 
                                    key={chain.id}
                                    className={`inline-flex items-center gap-1 bg-gray-50/70 border hover:border-gray-300 transition-colors rounded-md p-1 pl-1 pr-1.5 select-none ${
                                      isMin && isMax 
                                        ? "border-gray-150" 
                                        : isMin 
                                          ? "border-emerald-250 bg-emerald-50/20" 
                                          : "border-red-250 bg-red-50/20"
                                    }`}
                                    title={`${chain.name}: R$ ${price.toFixed(2)} (${badgeLabel})`}
                                  >
                                    <RetailerLogo chain={chain} size="sm" />
                                    <span className={`font-mono text-[10px] font-bold ${isMin && isMax ? "text-gray-700" : isMin ? "text-emerald-700" : "text-red-750"}`}>
                                      R${price.toFixed(2)}
                                      <span className="text-[8px] font-sans font-medium text-gray-400 ml-0.5">({badgeLabel})</span>
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-350 italic py-1">Sem comparação ativa</div>
                        )}
                      </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedAndFilteredProducts.length === 0 && (
                <div
                  className="col-span-full bg-white p-12 text-center border border-[#E0E0E0] rounded-2xl"
                  id="empty-products-view"
                >
                  <p className="text-gray-400 italic">
                    Nenhum produto cadastrado corresponde aos filtros.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory("Todas");
                      setSelectedChainId("Todas");
                      setSearchTerm("");
                    }}
                    className="mt-3 text-xs font-bold text-[#D40511] hover:underline"
                  >
                    Limpar filtros de busca
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3" id="products-list-layout">
              {paginatedProducts.map((prod) => {
                // Extract prices across chains for this item
                const pricesMap = (latestPricePerChainMap[prod.id] ||
                  {}) as Record<string, number>;
                const pricesCount = Object.keys(pricesMap).length;

                // Find lowest and highest prices
                const priceValues = Object.values(pricesMap) as number[];
                const minPrice =
                  priceValues.length > 0 ? Math.min(...priceValues) : null;
                const maxPrice =
                  priceValues.length > 0 ? Math.max(...priceValues) : null;

                // Find overall average price
                const averagePrice =
                  priceValues.length > 0
                    ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
                    : prod.basePrice;

                // Find the latest price record for this product based on selectedChainId
                const productRecords = records.filter(
                  (r) =>
                    r.productId === prod.id &&
                    (selectedChainId === "Todas" ||
                      r.chainId === selectedChainId),
                );
                const latestRecord =
                  productRecords.length > 0
                    ? [...productRecords].sort(compareRecordsDesc)[0]
                    : null;
                const currentPrice = latestRecord
                  ? latestRecord.price
                  : prod.basePrice;

                return (
                  <div
                    id={`product-list-row-${prod.id}`}
                    key={prod.id}
                    onClick={() => handleProductClick(prod.id)}
                    className="bg-white rounded-xl border border-gray-200 hover:border-[#D40511] hover:shadow-sm transition-all duration-200 cursor-pointer p-3 flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 group h-full relative"
                  >
                    {/* Column 1: Image, Brand badge, Product info (span 4) */}
                    <div className="flex items-center gap-3 min-w-0 md:col-span-4">
                      {/* Product Image */}
                      <div className="w-11 h-11 rounded-lg flex-shrink-0 bg-gray-50/50 flex items-center justify-center p-1 shadow-2xs relative">
                        <img
                          src={prod.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>

                      {/* Basic details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1 bg-opacity-0">
                          <span
                            className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              prod.isCompetitor
                                ? "text-slate-600 bg-slate-50 border-slate-200"
                                : prod.brand?.toLowerCase().includes("mavalerio") || prod.brand?.toLowerCase().includes("mavalério")
                                  ? "text-violet-750 bg-violet-50 border-violet-150"
                                  : "text-emerald-800 bg-emerald-50 border-emerald-150"
                            }`}
                          >
                            {prod.brand || (prod.isCompetitor ? "Competidor" : "Dr. Oetker")}
                          </span>
                          {prod.weight && (
                            <span className="text-[9px] font-mono text-gray-500 bg-gray-50 border border-gray-150/55 rounded px-1 select-none">
                              {prod.weight}
                            </span>
                          )}
                          <span className="text-[8px] font-bold text-gray-400 bg-gray-50/50 rounded px-1.5 border border-transparent">
                            {prod.category}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-[#1A1A1A] group-hover:text-[#D40511] transition-colors truncate font-sans" title={prod.name}>
                          {prod.name}
                        </h3>
                      </div>
                    </div>

                    {/* Column 2: Market Comparatives (mín, máx, méd) (span 2) */}
                    <div className="md:col-span-2 text-left font-sans">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                        Comparativo Mercado
                      </span>
                      {pricesCount > 0 ? (
                        <div className="space-y-0.5 mt-0.5">
                          <div className="flex items-center gap-2 max-w-[150px] text-[10.5px]">
                            <span className="text-gray-400 min-w-[24px]">Min:</span> 
                            <span className="font-mono font-bold text-emerald-700">R$ {minPrice?.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2 max-w-[150px] text-[10.5px]">
                            <span className="text-gray-400 min-w-[24px]">Méd:</span> 
                            <span className="font-mono font-bold text-slate-700">R$ {averagePrice.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2 max-w-[150px] text-[10.5px]">
                            <span className="text-gray-400 min-w-[24px]">Max:</span> 
                            <span className="font-mono font-bold text-red-700">R$ {maxPrice?.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">Sem dados ativos</span>
                      )}
                    </div>

                    {/* Column 3: Last Audited Price Highlight (span 3) */}
                    <div className="md:col-span-3 flex flex-col justify-center">
                      <div>
                        <span className="text-[9.5px] text-gray-400 font-bold uppercase tracking-wider select-none">
                          {selectedChainId === "Todas" ? "ÚLTIMO PREÇO REGISTRADO" : "PREÇO ATUAL"}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 bg-opacity-0">
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
                          <span
                            className={`text-base font-black font-mono leading-none ${
                              prod.isCompetitor
                                ? "text-blue-700"
                                : prod.brand?.toLowerCase().includes("mavalerio") || prod.brand?.toLowerCase().includes("mavalério")
                                  ? "text-violet-750"
                                  : "text-[#D40511]"
                            }`}
                          >
                            R$ {currentPrice.toFixed(2)}
                          </span>
                          
                          {(() => {
                            if (priceValues.length === 0) return null;
                            const status = currentPrice > averagePrice + 0.01 
                              ? "above" 
                              : currentPrice < averagePrice - 0.01 
                                ? "below" 
                                : "average";

                            if (status === "below") {
                              return (
                                <span className="inline-flex items-center text-[8px] font-extrabold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-100 shrink-0 select-none" title="Abaixo da Média">
                                  <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                                </span>
                              );
                            } else if (status === "above") {
                              return (
                                <span className="inline-flex items-center text-[8px] font-extrabold text-red-700 bg-red-50 px-1 rounded border border-red-150 shrink-0 select-none" title="Acima da Média">
                                  <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="text-[9.5px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis mt-0.5">
                          {latestRecord ? (
                            <span title={formatDateBR(latestRecord.date)}>
                              Auditado em: {formatDateBR(latestRecord.date)} {selectedChainId === "Todas" && `(${chains.find(c => c.id === latestRecord.chainId)?.name.split(" ")[0]})`}
                            </span>
                          ) : (
                            <span>Base (sem audit.)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Column 4: Competitors logos & prices (span 2) */}
                    <div className="md:col-span-2">
                      <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                        Monitor Redes
                      </span>
                      {pricesCount > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            // Find the chain(s) for min and max prices
                            let minChainId: string | null = null;
                            let maxChainId: string | null = null;

                            // Find min price chain id
                            Object.entries(pricesMap).forEach(([chainId, price]) => {
                              if (price === minPrice && !minChainId) {
                                minChainId = chainId;
                              }
                            });

                            // Find max price chain id (ensure it is different from minChainId if there's more than 1 option)
                            Object.entries(pricesMap).forEach(([chainId, price]) => {
                              if (price === maxPrice && !maxChainId && chainId !== minChainId) {
                                maxChainId = chainId;
                              }
                            });

                            // If we couldn't find a different maxChainId, but maxPrice exists and pricesCount > 1, allow same or any other matching
                            if (!maxChainId && pricesCount > 1) {
                              Object.entries(pricesMap).forEach(([chainId, price]) => {
                                if (price === maxPrice && !maxChainId) {
                                  maxChainId = chainId;
                                }
                              });
                            }

                            return chains.map((chain) => {
                              if (chain.id !== minChainId && chain.id !== maxChainId) return null;
                              const price = pricesMap[chain.id];
                              if (price === undefined) return null;
                              const isMin = chain.id === minChainId;
                              const isMax = chain.id === maxChainId;
                              const badgeLabel = isMin && isMax ? "único" : isMin ? "min" : "max";

                              return (
                                <div 
                                  key={chain.id}
                                  className={`inline-flex items-center gap-0.5 bg-gray-50/70 border rounded-md p-1 px-1.5 hover:border-gray-300 transition-colors select-none ${
                                    isMin && isMax 
                                      ? "border-gray-150" 
                                      : isMin 
                                        ? "border-emerald-250 bg-emerald-50/15" 
                                        : "border-red-250 bg-red-50/15"
                                  }`}
                                  title={`${chain.name}: R$ ${price.toFixed(2)} (${badgeLabel})`}
                                >
                                  <RetailerLogo chain={chain} size="sm" />
                                  <span className={`font-mono text-[9px] font-bold ${isMin && isMax ? "text-gray-650" : isMin ? "text-emerald-700" : "text-red-700"}`}>
                                    R${price.toFixed(2)}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-350 italic">Sem amostras</div>
                      )}
                    </div>

                    {/* Column 5: Expand Details Chevron icon (span 1) */}
                    <div className="md:col-span-1 flex items-center md:justify-end">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-lg bg-gray-50/55 hover:bg-red-50 hover:text-[#D40511] border border-gray-200 hover:border-red-150 flex items-center justify-center text-gray-400 transition-all select-none group-hover:scale-105 active:scale-95"
                      >
                        <ChevronLeft className="w-4 h-4 rotate-180" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {sortedAndFilteredProducts.length === 0 && (
                <div
                  className="bg-white p-12 text-center border border-[#E0E0E0]/80 rounded-2xl w-full"
                  id="empty-products-view-list"
                >
                  <p className="text-gray-400 italic">
                    Nenhum produto cadastrado corresponde aos filtros.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategory("Todas");
                      setSelectedChainId("Todas");
                      setSearchTerm("");
                    }}
                    className="mt-3 text-xs font-bold text-[#D40511] hover:underline"
                  >
                    Limpar filtros de busca
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pagination Controls bar */}
          {sortedAndFilteredProducts.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-white border border-[#E0E0E0] rounded-2xl shadow-xs mt-6 font-sans" id="products-pagination-bar">
              {/* Items Per Page Selector & Textual Info */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-400 uppercase tracking-wider text-[10px] font-sans">Itens por página:</span>
                  <select
                    id="pagination-items-per-page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1); // Go back to first page when changing size
                    }}
                    className="bg-[#F5F5F5] border border-[#E0E0E0]/80 rounded-lg px-2 py-1 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-[#D40511] cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="text-gray-400 font-semibold font-sans">
                  Exibindo <span className="text-[#1A1A1A] font-extrabold">{Math.min(sortedAndFilteredProducts.length, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(currentPage * itemsPerPage, sortedAndFilteredProducts.length)}</span> de <span className="text-[#1A1A1A] font-extrabold">{sortedAndFilteredProducts.length}</span> produtos
                </div>
              </div>

              {/* Navigation Button Controls */}
              <div className="flex items-center gap-1.5">
                {/* First Page button */}
                <button
                  type="button"
                  id="pagination-first-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === 1 
                      ? "bg-gray-50 text-gray-300 border-gray-150 cursor-not-allowed" 
                      : "bg-white text-gray-600 hover:bg-gray-50 hover:text-[#D40511] active:scale-95"
                  }`}
                  title="Primeira página"
                >
                  ⏮
                </button>

                {/* Previous Page button */}
                <button
                  type="button"
                  id="pagination-prev-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === 1 
                      ? "bg-gray-50 text-gray-300 border-gray-150 cursor-not-allowed" 
                      : "bg-white text-gray-600 hover:bg-gray-50 hover:text-[#D40511] active:scale-95"
                  }`}
                  title="Página anterior"
                >
                  ◀
                </button>

                {/* Page numbers pages array */}
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border font-mono text-xs font-extrabold transition-all cursor-pointer select-none ${
                      currentPage === p 
                        ? "bg-[#D40511] border-[#D40511] text-white shadow-xs" 
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 active:scale-95"
                    }`}
                  >
                    {p}
                  </button>
                ))}

                {/* Next Page button */}
                <button
                  type="button"
                  id="pagination-next-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === totalPages 
                      ? "bg-gray-50 text-gray-300 border-gray-150 cursor-not-allowed" 
                      : "bg-white text-gray-600 hover:bg-gray-50 hover:text-[#D40511] active:scale-95"
                  }`}
                  title="Próxima página"
                >
                  ▶
                </button>

                {/* Last Page button */}
                <button
                  type="button"
                  id="pagination-last-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 transition-all text-xs font-bold cursor-pointer select-none ${
                    currentPage === totalPages 
                      ? "bg-gray-50 text-gray-300 border-gray-150 cursor-not-allowed" 
                      : "bg-white text-gray-600 hover:bg-gray-50 hover:text-[#D40511] active:scale-95"
                  }`}
                  title="Última página"
                >
                  ⏭
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {activeView === "detail" && (
        /* DETAIL VIEW: Detail page for a selected product */
        <div
          className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm overflow-hidden"
          id="product-detail-view bg"
        >
          {/* Header */}
          <div
            className="bg-[#F5F5F5] border-b border-[#E0E0E0] p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            id="detail-header-panel"
          >
            <button
              id="back-to-products-list-btn"
              onClick={() => {
                setActiveView("list");
                setSelectedProductId(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#1A1A1A] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar ao catálogo
            </button>
          </div>

          <div className="p-6 space-y-8" id="detail-content-area">
            {selectedProduct && (
              <div
                className="grid grid-cols-1 md:grid-cols-4 gap-6"
                id="detail-product-meta-row"
              >
                {/* Main Product Column (Image, Metadata) */}
                <div
                  className="md:col-span-1 flex flex-col items-center text-center p-4 border border-[#E0E0E0] rounded-xl self-start bg-white"
                  id="detail-product-sidebar"
                >
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-50 flex items-center justify-center p-1.5 shadow-2xs">
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h2 className="text-base font-bold text-[#1A1A1A] mt-4 font-sans leading-tight">
                    {selectedProduct.name}
                  </h2>
                  <div className="flex flex-col gap-1.5 mt-2 items-center">
                    <span className="inline-block text-[10px] bg-gray-100 text-gray-700 font-bold rounded-lg px-2.5 py-0.5 uppercase font-mono tracking-wider">
                      {selectedProduct.category}
                    </span>
                    {selectedProduct.subcategory && (
                      <span className="inline-block text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-bold rounded-lg px-2.5 py-0.5 uppercase font-mono tracking-wider">
                        {selectedProduct.subcategory}
                      </span>
                    )}
                    {selectedProduct.weight && (
                      <span className="inline-block text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-lg px-2.5 py-0.5 uppercase font-mono tracking-wider">
                        Gramatura: {selectedProduct.weight}
                      </span>
                    )}
                    {selectedProduct.isCompetitor ? (
                      <span className="inline-block text-[10px] bg-blue-50 text-slate-700 border border-slate-200 font-extrabold rounded-lg px-2.5 py-0.5 uppercase font-mono tracking-wider">
                        {selectedProduct.brand}
                      </span>
                    ) : (
                      <span
                        className={`inline-block text-[10px] font-extrabold border rounded-lg px-2.5 py-0.5 uppercase font-mono tracking-wider ${
                          selectedProduct.brand
                            ?.toLowerCase()
                            .includes("mavalerio") ||
                          selectedProduct.brand
                            ?.toLowerCase()
                            .includes("mavalério")
                            ? "bg-violet-50 text-violet-805 text-violet-750 border-violet-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {selectedProduct.brand || "Dr. Oetker"}
                      </span>
                    )}
                  </div>

                  <div className="w-full border-t border-[#F5F5F5] pt-4 mt-4 space-y-2 text-left text-xs text-gray-500">
                    {selectedProduct.weight && (
                      <div className="flex justify-between">
                        <span>Gramatura:</span>
                        <span className="text-[#1A1A1A] font-bold font-mono">
                          {selectedProduct.weight}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Amostras:</span>
                      <span className="text-[#1A1A1A] font-bold font-mono">
                        {selectedProductHistory.length} registros
                      </span>
                    </div>
                  </div>
                </div>

                {/* Evolution Chart Column */}
                <div
                  className="md:col-span-3 border border-[#E0E0E0] rounded-xl p-5"
                  id="detail-chart-panel"
                >
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    Histórico & Evolução de Gôndola (R$)
                  </h3>

                  {chartData && chartData.uniqueDates.length > 0 ? (
                    <div className="space-y-4">
                      {/* Compact Collapsible Network Selector */}
                      <div className="flex items-center justify-between gap-3 p-1 bg-gray-50/10" id="network-selectors-compact-container">
                        <div className="relative inline-block text-left" id="chain-filter-dropdown-container">
                          <button
                            type="button"
                            onClick={() => setShowChartChainSelector(!showChartChainSelector)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-55 border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-800 shadow-xs transition duration-150 cursor-pointer"
                          >
                            <Filter className="w-3.5 h-3.5 text-gray-550" />
                            <span>Filtrar Redes ({selectedChartChains.length} selecionadas)</span>
                            {showChartChainSelector ? <ChevronUp className="w-3.5 h-3.5 text-gray-450" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-455" />}
                          </button>

                          {showChartChainSelector && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowChartChainSelector(false)}
                              />
                              <div className="absolute left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-55 p-4 space-y-3" id="chain-filter-panel">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider font-sans">
                                    Configurar Visualização
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowChartChainSelector(false)}
                                    className="text-[10px] bg-gray-150 hover:bg-gray-200 text-gray-700 font-bold px-2 py-1 rounded cursor-pointer"
                                  >
                                    Confirmar
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedChartChains(chains.map((c) => c.id))}
                                    className="flex-1 text-[10px] font-bold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 py-1.5 rounded-lg transition text-center cursor-pointer"
                                  >
                                    Selecionar todas
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedChartChains([])}
                                    className="flex-1 text-[10px] font-bold text-gray-700 bg-gray-50 border border-gray-200 hover:bg-red-50 hover:text-[#D40511] hover:border-red-200 py-1.5 rounded-lg transition text-center cursor-pointer"
                                  >
                                    Limpar seleção
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto pr-1">
                                  {chains.map((chain, chainIdx) => {
                                    const isActive = selectedChartChains.includes(chain.id);
                                    const recordCount = selectedProductHistory.filter((r) => r.chainId === chain.id).length;
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
                                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-semibold transition select-none cursor-pointer ${
                                          isActive
                                            ? "border-amber-250 bg-amber-50/20 text-amber-900"
                                            : "border-gray-100 bg-white hover:bg-gray-55 text-gray-400 hover:text-gray-700"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: isActive ? strokeColor : "#cbd5e1" }}
                                          />
                                          <span className="truncate">{chain.name}</span>
                                        </div>
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono bg-black/5 text-gray-500 font-bold shrink-0">
                                          {recordCount} pts
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Line Chart Workspace */}
                      <div className="relative border border-gray-100 rounded-xl p-3 bg-[#FCFCFC]" id="line-chart-container">
                        {/* Interactive Custom SVG Line Chart */}
                        <svg
                          viewBox="0 0 500 240"
                          className="w-full h-60"
                          fill="none"
                          id="line-chart-svg"
                        >
                          {/* Grid lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                            const y = 30 + ratio * 160;
                            const priceVal =
                              chartData.maxPrice -
                              ratio * (chartData.maxPrice - chartData.minPrice);
                            return (
                              <g key={i}>
                                <line
                                  x1="40"
                                  y1={y}
                                  x2="480"
                                  y2={y}
                                  stroke="#F2F2F2"
                                  strokeWidth="1"
                                />
                                <text
                                  x="35"
                                  y={y + 3}
                                  fill="#9ca3af"
                                  fontSize="8"
                                  fontFamily="monospace"
                                  textAnchor="end"
                                >
                                  {priceVal.toFixed(2)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Date x-axis ticks */}
                          {chartData.uniqueDates.map((date, idx, arr) => {
                            const spacing =
                              arr.length > 1 ? 440 / (arr.length - 1) : 440;
                            const x = 40 + idx * spacing;
                            return (
                              <g key={idx}>
                                <line
                                  x1={x}
                                  y1="30"
                                  x2={x}
                                  y2="195"
                                  stroke="#FDFDFD"
                                  strokeWidth="1"
                                />
                                <text
                                  x={x}
                                  y="212"
                                  fill="#9ca3af"
                                  fontSize="7.5"
                                  fontFamily="sans-serif"
                                  textAnchor="middle"
                                >
                                  {formatDateBR(date).substring(0, 5)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Draw Line for each selected chain */}
                          {chains.map((chain, chainIdx) => {
                            // Filter out unselected chains
                            if (!selectedChartChains.includes(chain.id)) return null;

                            const series = chartData.chainSeries[chain.id] || [];
                            if (series.length === 0) return null;

                            // Map dates to points
                            const points = series.map((pt) => {
                              const dateIdx = chartData.uniqueDates.indexOf(pt.date);
                              const spacing =
                                chartData.uniqueDates.length > 1
                                  ? 440 / (chartData.uniqueDates.length - 1)
                                  : 440;
                              const x = 40 + dateIdx * spacing;

                              // Map price value to grid coordinate [30, 190]
                              const priceRatio =
                                (pt.price - chartData.minPrice) /
                                (chartData.maxPrice - chartData.minPrice || 1);
                              const y = 190 - priceRatio * 160;

                              return { x, y, price: pt.price, date: pt.date };
                            });

                            // Generate SVG path description
                            const pathD = points.reduce((acc, pt, idx) => {
                              return acc + `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y} `;
                            }, "");

                            const strokeColor = getChainColor(chain.id);

                            return (
                              <g key={chain.id}>
                                {/* Sleeker line layout */}
                                <path
                                  d={pathD}
                                  stroke={strokeColor}
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  opacity="0.95"
                                />

                                {/* Interactive dots */}
                                {points.map((pt, pIdx) => (
                                  <g key={pIdx}>
                                    <circle
                                      cx={pt.x}
                                      cy={pt.y}
                                      r="2.2"
                                      fill="#ffffff"
                                      stroke={strokeColor}
                                      strokeWidth="2"
                                    />
                                    {/* Large invisible interactive hover overlay zone */}
                                    <circle
                                      cx={pt.x}
                                      cy={pt.y}
                                      r="14"
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
                                      onMouseLeave={() => {
                                        setHoveredPoint(null);
                                      }}
                                      onClick={() => {
                                        setHoveredPoint({
                                          chainId: chain.id,
                                          chainName: chain.name,
                                          date: pt.date,
                                          price: pt.price,
                                          x: pt.x,
                                          y: pt.y,
                                        });
                                      }}
                                    />
                                  </g>
                                ))}
                              </g>
                            );
                          })}
                        </svg>

                        {/* Interactive Tooltip Overlay */}
                        {hoveredPoint && (
                          <div
                            className="absolute z-10 bg-white/95 backdrop-blur-xs border border-gray-150 rounded-lg p-2.5 shadow-md pointer-events-none transform -translate-x-1/2 -translate-y-[105%] transition-all duration-75 ease-out min-w-[130px] text-left"
                            style={{
                              left: `${(hoveredPoint.x / 500) * 100}%`,
                              top: `${(hoveredPoint.y / 240) * 100}%`,
                            }}
                          >
                            <div className="flex items-center gap-1.5 leading-none">
                              <span
                                className="w-2 rounded-full h-2 shrink-0 animate-pulse"
                                style={{ backgroundColor: getChainColor(hoveredPoint.chainId) }}
                              />
                              <span className="text-[10px] font-black text-gray-800 font-sans truncate">
                                {hoveredPoint.chainName}
                              </span>
                            </div>
                            <div className="mt-1.5 text-xs font-black font-mono text-gray-900">
                              R$ {hoveredPoint.price.toFixed(2)}
                            </div>
                            <div className="text-[9px] text-gray-400 font-mono mt-0.5 leading-none">
                              {formatDateBR(hoveredPoint.date)}
                            </div>
                          </div>
                        )}

                        {/* Clickable colored sub-legend */}
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-gray-100" id="chart-active-legend">
                          {chains.filter(c => selectedChartChains.includes(c.id)).map((chain) => {
                            const strokeColor = getChainColor(chain.id);
                            return (
                              <button
                                key={chain.id}
                                type="button"
                                onClick={() => setSelectedChartChains(selectedChartChains.filter((id) => id !== chain.id))}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:border-gray-300 text-[10px] font-semibold text-gray-700 transition cursor-pointer hover:bg-gray-50"
                                title="Clique para remover do gráfico"
                              >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: strokeColor }} />
                                <span className="truncate max-w-[100px]">{chain.name}</span>
                                <span className="text-[8px] text-gray-400 font-bold">&times;</span>
                              </button>
                            );
                          })}
                          {selectedChartChains.length === 0 && (
                            <span className="text-[10px] text-gray-400 italic">Nenhuma rede selecionada. Ative no botão de filtro.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 bg-[#F5F5F5] rounded-xl flex flex-col items-center justify-center text-center p-6 text-[#1A1A1A]/50">
                      <FileText className="w-8 h-8 mb-2" />
                      <p className="text-xs font-sans">
                        Histórico de preços insuficiente para plotagem.
                      </p>
                      <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                        Registre preços usando a câmera ou selecione da galeria.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Comparisons Box */}
            {(() => {
              const currentPricesList = chains.map((chain) => {
                const chainRecords = selectedProductHistory.filter((r) => r.chainId === chain.id);
                const latestRecord = chainRecords[chainRecords.length - 1];
                return { chain, latestRecord };
              });

              const pricedRecords = currentPricesList.filter((item) => item.latestRecord !== undefined);
              
              let averagePrice = 0;
              let minPriceItem: typeof currentPricesList[number] | null = null;
              let maxPriceItem: typeof currentPricesList[number] | null = null;

              if (pricedRecords.length > 0) {
                const sum = pricedRecords.reduce((acc, r) => acc + r.latestRecord!.price, 0);
                averagePrice = sum / pricedRecords.length;
                
                minPriceItem = pricedRecords[0];
                maxPriceItem = pricedRecords[0];
                
                pricedRecords.forEach((item) => {
                  if (item.latestRecord!.price < minPriceItem!.latestRecord!.price) {
                    minPriceItem = item;
                  }
                  if (item.latestRecord!.price > maxPriceItem!.latestRecord!.price) {
                    maxPriceItem = item;
                  }
                });
              }

              return (
                <div
                  className="border border-[#E0E0E0] rounded-xl p-5 bg-white space-y-4"
                  id="detail-comparison-block"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F5F5F5] pb-3">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block font-sans">
                        Visão Geral de Pontos de Venda
                      </span>
                      <h3 className="text-sm font-black text-[#1A1A1A] font-sans mt-0.5">
                        Comparativo de Preços Atuais
                      </h3>
                    </div>
                  </div>

                  {/* Highlights Summary KPI (KPI Superior Compacto) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" id="current-prices-highlights">
                    {/* Média Geral */}
                    <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-3 flex items-center justify-between" id="highlight-avg-price">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-sans">
                          📊 Média Geral
                        </span>
                        <div className="text-base font-black font-mono text-gray-900 mt-0.5">
                          {pricedRecords.length > 0 ? `R$ ${averagePrice.toFixed(2)}` : "Sem dados"}
                        </div>
                        <p className="text-[10px] text-gray-400 font-sans truncate mt-0.5">
                          {pricedRecords.length > 0 ? `Cálculo sobre ${pricedRecords.length} redes` : "Nenhum preço coletado"}
                        </p>
                      </div>
                    </div>

                    {/* Menor Preço */}
                    <div className="bg-emerald-50/30 border border-emerald-250/60 rounded-xl p-3 flex items-center justify-between" id="highlight-min-price">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider font-sans">
                            🟢 Menor Preço
                          </span>
                        </div>
                        <div className="text-base font-black font-mono text-emerald-950 mt-0.5">
                          {minPriceItem ? `R$ ${minPriceItem.latestRecord!.price.toFixed(2)}` : "Sem dados"}
                        </div>
                        <p className="text-[10px] text-emerald-700 font-medium truncate mt-0.5 font-sans">
                          {minPriceItem ? minPriceItem.chain.name : "Nenhum canal ativo"}
                        </p>
                      </div>
                      <div className="p-2 bg-emerald-100/50 rounded-lg text-emerald-700 shrink-0">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Maior Preço */}
                    <div className="bg-red-50/30 border border-red-200/60 rounded-xl p-3 flex items-center justify-between" id="highlight-max-price">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                          <span className="text-[9px] font-bold text-red-800 uppercase tracking-wider font-sans">
                            🔴 Maior Preço
                          </span>
                        </div>
                        <div className="text-base font-black font-mono text-red-950 mt-0.5">
                          {maxPriceItem ? `R$ ${maxPriceItem.latestRecord!.price.toFixed(2)}` : "Sem dados"}
                        </div>
                        <p className="text-[10px] text-red-700 font-medium truncate mt-0.5 font-sans">
                          {maxPriceItem ? maxPriceItem.chain.name : "Nenhum canal ativo"}
                        </p>
                      </div>
                      <div className="p-2 bg-red-100/50 rounded-lg text-red-700 shrink-0">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Compact Grid of Cards (Visual BI) */}
                  <div 
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" 
                    id="current-prices-cards-grid"
                  >
                    {pricedRecords.length > 0 ? (
                      pricedRecords.map(({ chain, latestRecord }) => {
                        const calculatedPercent =
                          latestRecord && selectedProduct
                            ? ((latestRecord.price - selectedProduct.basePrice) /
                                selectedProduct.basePrice) *
                              100
                            : null;

                        // Redesign comparison indicators & colors as instructed
                        let borderStyle = "border-l-4 border-l-gray-300";
                        let bgStyle = "bg-white border-y border-r border-[#E0E0E0] text-gray-700 hover:border-gray-300";
                        let indicatorText = "Na Média";
                        let indicatorColorClass = "text-blue-600 bg-blue-50 border-blue-150";

                        if (latestRecord && pricedRecords.length > 1) {
                          const diff = latestRecord.price - averagePrice;
                          if (diff < -0.01) {
                            borderStyle = "border-l-4 border-l-emerald-500";
                            bgStyle = "bg-gradient-to-r from-emerald-50/10 to-white/90 border-y border-r border-emerald-200/70 text-emerald-950 hover:bg-emerald-50/20 hover:border-emerald-300/80";
                            indicatorText = "- Média";
                            indicatorColorClass = "text-emerald-700 bg-emerald-50 border-emerald-150";
                          } else if (diff > 0.01) {
                            borderStyle = "border-l-4 border-l-red-500";
                            bgStyle = "bg-gradient-to-r from-red-50/10 to-white/90 border-y border-r border-red-150/70 text-red-950 hover:bg-red-50/20 hover:border-red-250/80";
                            indicatorText = "+ Média";
                            indicatorColorClass = "text-red-700 bg-red-50 border-red-150";
                          } else {
                            borderStyle = "border-l-4 border-l-gray-350";
                            bgStyle = "bg-gradient-to-r from-gray-50/10 to-white/90 border-y border-r border-gray-200 text-gray-800 hover:bg-gray-50/20 hover:border-gray-350";
                            indicatorText = "No Preço";
                            indicatorColorClass = "text-gray-650 bg-gray-50 border-gray-200";
                          }
                        }

                        const tooltipText = latestRecord
                          ? `Registrado por: ${latestRecord.userName || "N/A"} • Preço Base: R$ ${selectedProduct.basePrice.toFixed(2)} (${calculatedPercent !== null ? `${calculatedPercent > 0 ? "+" : ""}${calculatedPercent.toFixed(1)}%` : "0%"})`
                          : "Nenhum histórico nesta rede";

                        return (
                          <div
                            key={chain.id}
                            title={tooltipText}
                            className={`rounded-lg p-3 transition-all duration-150 flex flex-col justify-between shadow-sm min-h-[110px] ${borderStyle} ${bgStyle}`}
                            id={`current-price-card-${chain.id}`}
                          >
                            {/* Top Row: Logo larger (increased to w-7 h-7) & Chain Name smaller/discrete */}
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                style={chain.logoColor?.startsWith("#") ? { backgroundColor: chain.logoColor } : {}}
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-[10px] shrink-0 overflow-hidden border border-gray-100 shadow-xs relative ${
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
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight truncate block leading-none flex-1">
                                {chain.name}
                              </span>
                            </div>

                            {/* Price in maximum prominence (Display typography style) */}
                            <div className="my-2.5 text-left">
                              {latestRecord ? (
                                <div className="text-base font-black font-mono tracking-tight text-[#1A1A1A] leading-tight flex items-baseline">
                                  <span className="text-[10px] font-normal text-gray-400 mr-0.5">R$</span>
                                  {latestRecord.price.toFixed(2)}
                                </div>
                              ) : (
                                <div className="text-[10px] font-bold text-gray-350 italic">
                                  ————
                                </div>
                              )}
                            </div>

                            {/* Footer Row: Date & Small Pill Status Info */}
                            <div className="flex items-center justify-between gap-1 mt-0.5 border-t border-black/5 pt-1.5 min-w-0">
                              <span className="text-[8px] text-gray-400 font-mono flex items-center gap-0.5 min-w-0">
                                {latestRecord ? (
                                  <>
                                    <Clock className="w-2 h-2 text-gray-300 shrink-0" />
                                    <span className="truncate">{formatDateBR(latestRecord.date).substring(0, 5)}</span>
                                  </>
                                ) : (
                                  "-"
                                )}
                              </span>
                              
                              <span className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded border tracking-tight truncate shrink-0 ${indicatorColorClass}`}>
                                {indicatorText}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-full py-8 text-center text-xs font-medium text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 font-sans italic" id="no-current-prices-alert">
                        Nenhum preço coletado atualmente para este produto.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Comparar com Concorrentes */}
            {selectedProduct && (
              <div
                className="border border-[#E0E0E0] rounded-xl p-5 bg-white space-y-5"
                id="detail-competitor-comparison-segment"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#F5F5F5] pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans">
                      Posicionamento de Mercado
                    </span>
                    <h2 className="text-base font-black text-[#1A1A1A] font-sans mt-0.5">
                      Comparar com Concorrentes
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Toggles Side-by-Side */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1 border border-gray-200 rounded-xl" id="comparer-toggles-box">
                      <button
                        type="button"
                        onClick={() => {
                          const activeCount = (compareByCategory ? 1 : 0) + (compareBySubcategory ? 1 : 0) + (compareByWeight ? 1 : 0);
                          if (compareByCategory && activeCount === 1) {
                            setCompareBySubcategory(true);
                            setCompareByCategory(false);
                          } else {
                            setCompareByCategory(!compareByCategory);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                          compareByCategory
                            ? "bg-white text-gray-800 shadow-xs border border-gray-200"
                            : "text-gray-400 hover:text-gray-600 border border-transparent"
                        }`}
                      >
                        Categoria: {selectedProduct.category || "Indefinida"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const activeCount = (compareByCategory ? 1 : 0) + (compareBySubcategory ? 1 : 0) + (compareByWeight ? 1 : 0);
                          if (compareBySubcategory && activeCount === 1) {
                            setCompareByCategory(true);
                            setCompareBySubcategory(false);
                          } else {
                            setCompareBySubcategory(!compareBySubcategory);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                          compareBySubcategory
                            ? "bg-white text-gray-800 shadow-xs border border-gray-200"
                            : "text-gray-400 hover:text-gray-600 border border-transparent"
                        }`}
                      >
                        Subcategoria: {selectedProduct.subcategory || "Indefinida"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const activeCount = (compareByCategory ? 1 : 0) + (compareBySubcategory ? 1 : 0) + (compareByWeight ? 1 : 0);
                          if (compareByWeight && activeCount === 1) {
                            setCompareByCategory(true);
                            setCompareByWeight(false);
                          } else {
                            setCompareByWeight(!compareByWeight);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-150 cursor-pointer ${
                          compareByWeight
                            ? "bg-white text-gray-800 shadow-xs border border-gray-200"
                            : "text-gray-400 hover:text-gray-600 border border-transparent"
                        }`}
                      >
                        Gramatura: {selectedProduct.weight || "Indefinida"}
                      </button>
                    </div>

                    {/* Selector de Redes para comparar */}
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="competitor-compare-chain"
                        className="text-xs text-gray-500 font-sans font-semibold shrink-0"
                      >
                        Rede:
                      </label>
                      <select
                        id="competitor-compare-chain"
                        value={competitorCompareChainId}
                        onChange={(e) => setCompetitorCompareChainId(e.target.value)}
                        className="bg-white border border-gray-250 hover:border-gray-350 rounded-xl px-3 py-1.5 text-xs text-gray-800 font-bold focus:outline-none focus:border-[#D40511] cursor-pointer shadow-xs transition duration-150"
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
                </div>

                {(() => {
                  // Find peer products matching comparison toggles
                  const peers = products.filter((p) => {
                    if (!p.active) return false;
                    // Maintain selected product as reference anchor, but show only actual competitors for all other peers if selectedProduct is not a competitor
                    if (p.id !== selectedProduct.id && !selectedProduct.isCompetitor && !p.isCompetitor) return false;
                    
                    if (compareByCategory && p.category !== selectedProduct.category) return false;
                    if (compareBySubcategory && p.subcategory !== selectedProduct.subcategory) return false;
                    if (compareByWeight && p.weight !== selectedProduct.weight) return false;
                    return true;
                  });

                  if (peers.length === 0) {
                    return (
                      <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-400 text-xs italic">
                        Nenhum produto correspondente aos filtros selecionados para comparação.
                      </div>
                    );
                  }

                  // Retrieve latest price for peers across all retail chains and calculate averages & minimum prices
                  const peerCalculatedData = peers
                    .map((p) => {
                      const productRecords = records.filter((r) => {
                        if (r.productId !== p.id) return false;
                        if (competitorCompareChainId !== "Todas" && r.chainId !== competitorCompareChainId) return false;
                        return true;
                      });
                      
                      const latestByChain: Record<string, PriceRecord> = {};
                      productRecords.forEach((r) => {
                        const current = latestByChain[r.chainId];
                        if (!current) {
                          latestByChain[r.chainId] = r;
                        } else {
                          const tR = new Date(r.date).getTime();
                          const tC = new Date(current.date).getTime();
                          if (tR > tC) {
                            latestByChain[r.chainId] = r;
                          } else if (tR === tC) {
                            const idxR = recordIndexMap.get(r.id) ?? -1;
                            const idxC = recordIndexMap.get(current.id) ?? -1;
                            if (idxR > idxC) {
                              latestByChain[r.chainId] = r;
                            }
                          }
                        }
                      });
                      
                      const latestRecordsList = Object.values(latestByChain).filter((r) => r.price > 0);
                      
                      if (latestRecordsList.length === 0) {
                        return null; // Exclude products with no registered price or zero price
                      }
                      
                      const sum = latestRecordsList.reduce((acc, r) => acc + r.price, 0);
                      const averagePrice = sum / latestRecordsList.length;
                      
                      let minRec = latestRecordsList[0];
                      latestRecordsList.forEach((r) => {
                        if (r.price < minRec.price) {
                          minRec = r;
                        }
                      });
                      const minPrice = minRec.price;
                      const minPriceChainId = minRec.chainId;
                      
                      const minChain = chains.find((c) => c.id === minPriceChainId);
                      const minChainName = minChain
                        ? minChain.name
                        : competitorCompareChainId !== "Todas"
                          ? `${chains.find((c) => c.id === competitorCompareChainId)?.name || ""}`
                          : "Preço de tabela";
                      
                      return {
                        product: p,
                        averagePrice,
                        minPrice,
                        minChainName,
                        isSelf: p.id === selectedProduct.id,
                      };
                    })
                    .filter(Boolean) as {
                      product: Product;
                      averagePrice: number;
                      minPrice: number;
                      minChainName: string;
                      isSelf: boolean;
                    }[];

                  // Sort from lowest average price to highest
                  const sortedPeers = [...peerCalculatedData].sort((a, b) => a.averagePrice - b.averagePrice);

                  if (sortedPeers.length === 0) {
                    return (
                      <div className="p-6 bg-gray-50 rounded-xl text-center text-gray-400 text-xs italic">
                        Nenhum produto concorrente com preço válido registrado para comparação.
                      </div>
                    );
                  }

                  const maxAveragePrice = Math.max(...sortedPeers.map(p => p.averagePrice), 10);

                  return (
                    <div className="space-y-4">
                      <div className="text-xs text-gray-500 font-sans">
                        Mostrando {sortedPeers.length} produtos correspondentes ordenados pelo menor preço médio mais recente:
                      </div>

                      <div className="space-y-3" id="comparer-peers-list font-sans">
                        {sortedPeers.map((item) => {
                          const barWidth = Math.max(10, (item.averagePrice / maxAveragePrice) * 100);
                          const isSelf = item.isSelf;
                          
                          return (
                            <div
                              key={item.product.id}
                              onClick={() => {
                                handleProductClick(item.product.id);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className={`p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                                isSelf
                                  ? "bg-amber-50/20 border-amber-300 shadow-xs ring-2 ring-amber-500/20"
                                  : "bg-white border-gray-150 hover:border-gray-250 hover:bg-gray-100/45 hover:shadow-2xs"
                              }`}
                              id={`peer-row-${item.product.id}`}
                            >
                              <div className="flex items-start sm:items-center gap-3">
                                {/* Product Image Thumbnail */}
                                <div className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center relative">
                                  {item.product.imageUrl ? (
                                    <img
                                      src={item.product.imageUrl}
                                      alt={item.product.name}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center p-1">
                                      <Package className="w-4 h-4 text-gray-300" />
                                      <span className="text-[7px] text-gray-400 font-mono scale-90">Sem Foto</span>
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span
                                        className={`font-sans text-sm ${
                                          isSelf ? "text-amber-950 font-black" : "text-gray-900 font-bold"
                                        }`}
                                      >
                                        {item.product.name}
                                      </span>
                                      <span
                                        className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                          isSelf
                                            ? "bg-amber-100 text-amber-900 border border-amber-200"
                                            : item.product.isCompetitor
                                              ? "bg-blue-50 text-blue-800 border border-blue-100"
                                              : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                        }`}
                                      >
                                        {item.product.brand || "Dr. Oetker"}
                                      </span>
                                      {isSelf && (
                                        <span className="bg-[#D40511] text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                          Este Produto
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-sans mt-1 flex-wrap">
                                      <span className="font-medium text-gray-400">Menor oferta em:</span>
                                      <span className="font-extrabold text-gray-700">{item.minChainName}</span>
                                      <span className="text-gray-200 font-normal">|</span>
                                      <span className="font-medium text-gray-400">Menor preço:</span>
                                      <span className="font-mono font-black text-emerald-650 bg-emerald-50 px-1 py-0.2 rounded">
                                        R$ {item.minPrice.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="text-left sm:text-right shrink-0 mt-1 sm:mt-0">
                                    <span className="block text-[9px] uppercase font-bold text-gray-400 font-sans tracking-wider">
                                      Preço Médio
                                    </span>
                                    <span className={`text-sm font-black font-mono leading-none ${isSelf ? "text-amber-900 animate-none" : "text-gray-900"}`}>
                                      R$ {item.averagePrice.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Sleek Horizontal Bar graph indicator */}
                              <div className="mt-2.5 w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-150 relative">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isSelf
                                      ? "bg-gradient-to-r from-amber-500 to-amber-350 shadow-xs"
                                      : item.product.isCompetitor
                                        ? "bg-gradient-to-r from-blue-500 to-blue-350"
                                        : "bg-gradient-to-r from-emerald-500 to-emerald-350"
                                  }`}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Product Specific Audit Gallery Stream */}
            <div
              className="border border-[#E0E0E0] rounded-xl p-5"
              id="detail-audits-grid-block"
            >
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Histórico de Fotos de Auditoria (Gôndola)
              </h3>

              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
                id="detail-audit-photos-grid"
              >
                {selectedProductHistory
                  .filter((r) => r.imageUrl)
                  .map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => setLightboxPhoto(rec.imageUrl)}
                      className="group pointer-events-auto cursor-pointer border border-[#E0E0E0] rounded-lg overflow-hidden hover:border-[#D40511] transition-all bg-[#F5F5F5]"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-gray-200 relative">
                        <img
                          src={rec.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-[#D40511]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="p-2 text-[10px]">
                        <p className="font-bold text-[#1A1A1A] truncate">
                          {chains.find((c) => c.id === rec.chainId)?.name}
                        </p>
                        <div className="flex justify-between text-gray-400 mt-1 font-mono">
                          <span>R$ {rec.price.toFixed(2)}</span>
                          <span>{formatDateBR(rec.date).substring(0, 5)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                {selectedProductHistory.filter((r) => r.imageUrl).length ===
                  0 && (
                  <p className="text-xs text-gray-400 italic col-span-full">
                    Nenhuma imagem registrada para este produto.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
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
                    });
                    setFormFeedback({ type: 'success', message: 'Produto cadastrado com sucesso!' });
                  }
                  setNewProdName("");
                  setNewProdBasePrice("0.00");
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
      {lightboxPhoto && (
        <div
          id="common-lightbox-scroller"
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            className="max-w-3xl max-h-[80vh] bg-white rounded-xl p-2 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto}
              alt="Auditoria de Gôndola"
              referrerPolicy="no-referrer"
              className="max-h-[70vh] rounded-lg object-contain w-full"
            />
            <p className="text-center text-xs text-gray-500 mt-2 font-sans font-medium">
              Foto de Auditoria Comprobatória
            </p>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-3 -right-3 bg-[#D40511] text-white rounded-full w-7 h-7 flex items-center justify-center font-bold shadow hover:bg-red-700 transition-colors"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
