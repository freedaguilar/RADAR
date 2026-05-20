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
} from "lucide-react";
import { Product, Chain, PriceRecord } from "../types";

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

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedSubcategory, setSelectedSubcategory] = useState("Todas");
  const [selectedChainId, setSelectedChainId] = useState("Todas");
  const [selectedWeight, setSelectedWeight] = useState("Todas");
  const [selectedBrandFilters, setSelectedBrandFilters] = useState<
    ("propria-oetker" | "propria-mavalerio" | "concorrentes")[]
  >(["propria-oetker", "propria-mavalerio"]);

  // Audit Photo Modal / Lightbox inside Product Detail
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [compareChainId, setCompareChainId] = useState<string>("");
  const [compareWeight, setCompareWeight] = useState<string>("Todas");

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
    } else {
      setActiveView("list");
    }
  }, [pageParams, products]);

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
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [records, selectedProductId]);

  // Dynamic calculated latest price per retail chain for each product or specific product
  const latestPricePerChainMap = useMemo(() => {
    const productChainPrices: Record<string, Record<string, number>> = {};

    // Sort all records chronologically
    const sortedRecords = [...records].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    sortedRecords.forEach((r) => {
      if (!productChainPrices[r.productId]) {
        productChainPrices[r.productId] = {};
      }
      productChainPrices[r.productId][r.chainId] = r.price;
    });

    return productChainPrices;
  }, [records]);

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

            {/* View Mode Switcher: Grid vs List */}
            <div
              className="flex bg-[#F5F5F5] p-1 rounded-xl border border-[#E0E0E0] gap-1 shrink-0 w-full sm:w-auto select-none shadow-2xs animate-fade-in"
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
          </div>

          {/* Filtering Widgets */}
          <div
            className="bg-white p-4 rounded-xl border border-[#E0E0E0] shadow-sm grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row lg:items-center gap-4"
            id="filters-container"
          >
            {/* Search Input */}
            <div
              className="relative w-full md:col-span-2 lg:col-span-1 lg:min-w-[250px] lg:flex-1"
              id="search-input-wrapper"
            >
              <input
                id="product-search-input"
                type="text"
                placeholder="Pesquisar por nome ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-[#D40511]"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            </div>

            {/* Category Select Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap">
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
                className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategory Select Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap">
                Subcat:
              </span>
              <select
                id="product-subcategory-filter-select"
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setSelectedWeight("Todas"); // Reset weight when changing subcategory
                }}
                className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
              >
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Weight Select Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap">
                Gramatura:
              </span>
              <select
                id="product-weight-filter-select"
                value={selectedWeight}
                onChange={(e) => setSelectedWeight(e.target.value)}
                className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
              >
                {weights.map((w) => (
                  <option key={w} value={w}>
                    {w === "Todas" ? "Todas" : w}
                  </option>
                ))}
              </select>
            </div>

            {/* Retail Chain Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 uppercase font-bold whitespace-nowrap">
                Preço em:
              </span>
              <select
                id="product-chain-filter-select"
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(e.target.value)}
                className="w-full bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
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
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              id="products-grid"
            >
              {filteredProducts.map((prod) => {
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

                // Find the latest price record for this product based on selectedChainId
                const productRecords = records.filter(
                  (r) =>
                    r.productId === prod.id &&
                    (selectedChainId === "Todas" ||
                      r.chainId === selectedChainId),
                );
                const latestRecord =
                  productRecords.length > 0
                    ? [...productRecords].sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )[0]
                    : null;
                const currentPrice = latestRecord
                  ? latestRecord.price
                  : prod.basePrice;

                return (
                  <div
                    id={`product-card-${prod.id}`}
                    key={prod.id}
                    onClick={() => handleProductClick(prod.id)}
                    className="bg-white rounded-2xl border border-[#E0E0E0] shadow-sm hover:border-[#D40511] hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between group"
                  >
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="w-16 h-16 rounded-xl border border-[#E0E0E0] flex-shrink-0 overflow-hidden bg-[#F5F5F5] flex items-center justify-center p-1">
                          <img
                            src={prod.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain transition-transform group-hover:scale-105"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap gap-1 mb-1.5 bg-opacity-0">
                            <span className="inline-block text-[9px] font-bold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono">
                              {prod.category}
                            </span>
                            {prod.subcategory && (
                              <span className="inline-block text-[9px] font-bold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono">
                                {prod.subcategory}
                              </span>
                            )}
                            {prod.weight && (
                              <span className="inline-block text-[9px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono">
                                {prod.weight}
                              </span>
                            )}
                            {prod.isCompetitor ? (
                              <span className="inline-block text-[9px] font-extrabold text-blue-700 bg-blue-50 border border-blue-250 border-blue-200/50 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono">
                                Competidor: {prod.brand || "Concorrente"}
                              </span>
                            ) : (
                              <span
                                className={`inline-block text-[9px] font-extrabold border rounded px-1.5 py-0.5 tracking-wider uppercase font-mono ${
                                  prod.brand
                                    ?.toLowerCase()
                                    .includes("mavalerio") ||
                                  prod.brand
                                    ?.toLowerCase()
                                    .includes("mavalério")
                                    ? "text-violet-850 text-violet-800 bg-violet-50 border-violet-200/50"
                                    : "text-emerald-800 bg-emerald-50 border-emerald-250 border-emerald-200/50"
                                }`}
                              >
                                Nossa Marca: {prod.brand || "Dr. Oetker"}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-[#1A1A1A] line-clamp-2 leading-snug group-hover:text-[#D40511] transition-colors font-sans">
                            {prod.name}
                          </h3>
                        </div>
                      </div>

                      {/* Destaque do Preço Atual */}
                      <div
                        className={`mt-4 border rounded-xl p-3.5 flex items-center justify-between shadow-2xs ${
                          prod.isCompetitor
                            ? "bg-blue-50/40 border-blue-100/50"
                            : prod.brand?.toLowerCase().includes("mavalerio") ||
                                prod.brand?.toLowerCase().includes("mavalério")
                              ? "bg-violet-50/40 border-violet-100/60"
                              : "bg-[#FFF5F5]/85 border-red-100/60"
                        }`}
                      >
                        <div>
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block font-sans">
                            {selectedChainId !== "Todas"
                              ? "Preço na Rede Selecionada"
                              : "Último Preço Auditado"}
                          </span>
                          {latestRecord ? (
                            <span
                              className="text-[10px] text-gray-400 font-sans block mt-0.5 truncate max-w-[130px]"
                              title={
                                chains.find(
                                  (c) => c.id === latestRecord.chainId,
                                )?.name
                              }
                            >
                              {
                                chains
                                  .find((c) => c.id === latestRecord.chainId)
                                  ?.name.split(" ")[0]
                              }{" "}
                              • {formatDateBR(latestRecord.date)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                              Preço Base Sem Histórico
                            </span>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span
                            className={`text-2xl font-black font-mono leading-none ${
                              prod.isCompetitor
                                ? "text-blue-700"
                                : prod.brand
                                      ?.toLowerCase()
                                      .includes("mavalerio") ||
                                    prod.brand
                                      ?.toLowerCase()
                                      .includes("mavalério")
                                  ? "text-violet-750"
                                  : "text-[#D40511]"
                            }`}
                          >
                            R$ {currentPrice.toFixed(2)}
                          </span>
                          <span
                            className={`text-[8px] uppercase tracking-widest font-bold mt-1 ${
                              prod.isCompetitor
                                ? "text-blue-700/70"
                                : prod.brand
                                      ?.toLowerCase()
                                      .includes("mavalerio") ||
                                    prod.brand
                                      ?.toLowerCase()
                                      .includes("mavalério")
                                  ? "text-violet-700/70"
                                  : "text-[#D40511]/70"
                            }`}
                          >
                            VALOR ATUAL
                          </span>
                        </div>
                      </div>

                      {/* Compare Quick View */}
                      <div className="mt-4 pt-3 border-t border-[#F5F5F5] space-y-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans">
                          Comparativo de Preços ({pricesCount} Redes)
                        </span>

                        {pricesCount > 0 ? (
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="bg-[#F5F5F5] p-2 rounded-lg border border-transparent">
                              <span className="text-[9px] text-gray-400 block font-sans">
                                Mínimo Registrado
                              </span>
                              <span className="text-[11px] font-mono font-black text-emerald-700">
                                R$ {minPrice?.toFixed(2)}
                              </span>
                            </div>
                            <div className="bg-[#F5F5F5] p-2 rounded-lg">
                              <span className="text-[9px] text-gray-400 block font-sans">
                                Máximo Registrado
                              </span>
                              <span className="text-[11px] font-mono font-black text-red-700">
                                R$ {maxPrice?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-[#F5F5F5] rounded-xl flex items-center gap-1.5 text-gray-400">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-sans">
                              Sem histórico de preços ainda
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer metadata */}
                    <div className="bg-[#F5F5F5] px-5 py-3 border-t border-[#E0E0E0] flex items-center justify-between text-[11px] text-gray-500">
                      <span className="font-sans font-medium text-gray-400">
                        Preço Base: R$ {prod.basePrice.toFixed(2)}
                      </span>
                      <span className="text-[#D40511] font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-0.5">
                        Análise detalhada &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
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
              {filteredProducts.map((prod) => {
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

                // Find the latest price record for this product based on selectedChainId
                const productRecords = records.filter(
                  (r) =>
                    r.productId === prod.id &&
                    (selectedChainId === "Todas" ||
                      r.chainId === selectedChainId),
                );
                const latestRecord =
                  productRecords.length > 0
                    ? [...productRecords].sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime(),
                      )[0]
                    : null;
                const currentPrice = latestRecord
                  ? latestRecord.price
                  : prod.basePrice;

                return (
                  <div
                    id={`product-list-row-${prod.id}`}
                    key={prod.id}
                    onClick={() => handleProductClick(prod.id)}
                    className="bg-white rounded-xl border border-[#E0E0E0]/80 shadow-xs hover:border-[#D40511] hover:shadow-sm transition-all cursor-pointer p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    {/* Left Column: Image & Basic Names */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-12 h-12 rounded-lg border border-[#E0E0E0] flex-shrink-0 overflow-hidden bg-[#F5F5F5] flex items-center justify-center p-1">
                        <img
                          src={prod.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="inline-block text-[8px] font-extrabold text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono">
                            {prod.category}
                          </span>
                          {prod.subcategory && (
                            <span className="inline-block text-[8px] font-extrabold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono">
                              {prod.subcategory}
                            </span>
                          )}
                          {prod.weight && (
                            <span className="inline-block text-[8px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 tracking-wider uppercase font-mono border border-amber-100/60">
                              {prod.weight}
                            </span>
                          )}
                          <span
                            className={`inline-block text-[8px] font-black border rounded px-1.5 py-0.5 tracking-wider uppercase font-mono ${
                              prod.isCompetitor
                                ? "text-blue-700 bg-blue-50 border-blue-200/50"
                                : prod.brand
                                      ?.toLowerCase()
                                      .includes("mavalerio") ||
                                    prod.brand
                                      ?.toLowerCase()
                                      .includes("mavalério")
                                  ? "text-violet-750 bg-violet-50 border-violet-200/50"
                                  : "text-emerald-800 bg-emerald-50 border-emerald-250 border-emerald-200/50"
                            }`}
                          >
                            {prod.isCompetitor
                              ? `Competidor: ${prod.brand || "Concorrente"}`
                              : `Nossa Marca: ${prod.brand || "Dr. Oetker"}`}
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-[#1A1A1A] group-hover:text-[#D40511] transition-colors truncate font-sans">
                          {prod.name}
                        </h3>
                      </div>
                    </div>

                    {/* Middle Column: Price comparison stats strip */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-left font-sans hidden md:block">
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                          Comparativos ({pricesCount} Redes)
                        </span>
                        {pricesCount > 0 ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-emerald-700 font-mono font-bold">
                              Mín: R$ {minPrice?.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-gray-300">|</span>
                            <span className="text-[10px] text-red-700 font-mono font-bold">
                              Máx: R$ {maxPrice?.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Sem registros
                          </span>
                        )}
                      </div>

                      {/* Right Column: price tag */}
                      <div
                        className={`px-4 py-2 rounded-xl flex items-center gap-3 border ${
                          prod.isCompetitor
                            ? "bg-blue-50/40 border-blue-100/50"
                            : prod.brand?.toLowerCase().includes("mavalerio") ||
                                prod.brand?.toLowerCase().includes("mavalério")
                              ? "bg-violet-50/40 border-violet-100/60"
                              : "bg-[#FFF5F5]/85 border-red-100/60"
                        }`}
                      >
                        <div className="text-right">
                          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block font-sans">
                            {selectedChainId !== "Todas"
                              ? "Nesta Rede"
                              : "Atual"}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono block">
                            {latestRecord
                              ? formatDateBR(latestRecord.date)
                              : "Base"}
                          </span>
                        </div>
                        <span
                          className={`text-base sm:text-lg font-black font-mono leading-none ${
                            prod.isCompetitor
                              ? "text-blue-700"
                              : prod.brand
                                    ?.toLowerCase()
                                    .includes("mavalerio") ||
                                  prod.brand
                                    ?.toLowerCase()
                                    .includes("mavalério")
                                ? "text-violet-750"
                                : "text-[#D40511]"
                          }`}
                        >
                          R$ {currentPrice.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-gray-300 group-hover:text-[#D40511] transition-transform">
                        <ChevronLeft className="w-4 h-4 rotate-180" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
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
                  <div className="w-24 h-24 rounded-2xl border border-[#E0E0E0] overflow-hidden bg-[#F5F5F5] flex items-center justify-center p-1">
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
                      <span className="inline-block text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-extrabold rounded-lg px-2.5 py-0.5 uppercase font-mono tracking-wider">
                        Competidor: {selectedProduct.brand}
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
                            ? "bg-violet-50 text-violet-800 border-violet-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {selectedProduct.brand || "Dr. Oetker"} (Nossa Marca)
                      </span>
                    )}
                  </div>

                  <div className="w-full border-t border-[#F5F5F5] pt-4 mt-4 space-y-2 text-left text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Cálculo base:</span>
                      <span className="text-[#1A1A1A] font-bold font-mono">
                        R$ {selectedProduct.basePrice.toFixed(2)}
                      </span>
                    </div>
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
                    <div className="relative" id="line-chart-container">
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
                                stroke="#F0F0F0"
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
                                stroke="#F5F5F5"
                                strokeWidth="1"
                              />
                              <text
                                x={x}
                                y="210"
                                fill="#9ca3af"
                                fontSize="7"
                                fontFamily="sans-serif"
                                textAnchor="middle"
                              >
                                {formatDateBR(date).substring(0, 5)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Draw Line for each chain */}
                        {chains.map((chain, chainIdx) => {
                          const series = chartData.chainSeries[chain.id] || [];
                          if (series.length === 0) return null;

                          // Map dates to points
                          const points = series.map((pt) => {
                            const dateIdx = chartData.uniqueDates.indexOf(
                              pt.date,
                            );
                            const spacing =
                              chartData.uniqueDates.length > 1
                                ? 440 / (chartData.uniqueDates.length - 1)
                                : 440;
                            const x = 40 + dateIdx * spacing;

                            // Map price value to grid coordinate [30, 190]
                            const priceRatio =
                              (pt.price - chartData.minPrice) /
                              (chartData.maxPrice - chartData.minPrice);
                            const y = 190 - priceRatio * 160;

                            return { x, y, price: pt.price };
                          });

                          // Generate SVG path description
                          const pathD = points.reduce((acc, pt, idx) => {
                            return (
                              acc + `${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y} `
                            );
                          }, "");

                          // Select line stroke color
                          const strokeColor =
                            chainIdx === 0
                              ? "#D40511"
                              : chainIdx === 1
                                ? "#0284c7"
                                : chainIdx === 2
                                  ? "#16a34a"
                                  : chainIdx === 3
                                    ? "#ea580c"
                                    : "#4b5563";

                          return (
                            <g key={chain.id}>
                              {/* Glowing background line */}
                              <path
                                d={pathD}
                                stroke={strokeColor}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                opacity="0.9"
                              />

                              {/* Interactive dots */}
                              {points.map((pt, pIdx) => (
                                <g key={pIdx}>
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r="3"
                                    fill="#ffffff"
                                    stroke={strokeColor}
                                    strokeWidth="2"
                                  />
                                  <rect
                                    x={pt.x - 20}
                                    y={pt.y - 12}
                                    width="40"
                                    height="9"
                                    rx="2"
                                    fill={strokeColor}
                                    opacity="0.1"
                                  />
                                  <text
                                    x={pt.x}
                                    y={pt.y - 15}
                                    fill="#1a1a1a"
                                    fontSize="7"
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {pt.price.toFixed(2)}
                                  </text>
                                </g>
                              ))}
                            </g>
                          );
                        })}
                      </svg>

                      {/* Legend below the SVG */}
                      <div
                        className="flex flex-wrap items-center justify-center gap-4 mt-2"
                        id="chart-legend-grid"
                      >
                        {chains.map((chain, chainIdx) => {
                          const strokeColor =
                            chainIdx === 0
                              ? "bg-[#D40511]"
                              : chainIdx === 1
                                ? "bg-sky-600"
                                : chainIdx === 2
                                  ? "bg-emerald-600"
                                  : chainIdx === 3
                                    ? "bg-orange-600"
                                    : "bg-gray-600";

                          const series = chartData.chainSeries[chain.id] || [];
                          if (series.length === 0) return null;

                          return (
                            <div
                              key={chain.id}
                              className="flex items-center gap-1.5 text-[10px]"
                            >
                              <span
                                className={`w-3 h-1 rounded ${strokeColor}`}
                              ></span>
                              <span className="text-gray-600 font-sans font-medium">
                                {chain.name}
                              </span>
                            </div>
                          );
                        })}
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
            <div
              className="border border-[#E0E0E0] rounded-xl p-5"
              id="detail-comparison-block"
            >
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Tabela Comparativa de Preços Atuais
              </h3>
              <div className="overflow-x-auto">
                <table
                  className="w-full text-left text-xs border-collapse"
                  id="comparison-details-table"
                >
                  <thead>
                    <tr className="border-b border-[#E0E0E0] text-[10px] uppercase text-gray-400">
                      <th className="pb-2 font-bold select-none">
                        Bandeira / Rede
                      </th>
                      <th className="pb-2 font-bold select-none text-center">
                        Último Preço
                      </th>
                      <th className="pb-2 font-bold select-none text-center">
                        Data do Registro
                      </th>
                      <th className="pb-2 font-bold select-none">
                        Registrado por
                      </th>
                      <th className="pb-2 font-bold select-none text-right">
                        Comparativo c/ Base
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F5F5]">
                    {chains.map((chain) => {
                      // Find latest record for this product in this chain
                      const chainRecords = selectedProductHistory.filter(
                        (r) => r.chainId === chain.id,
                      );
                      const latestRecord =
                        chainRecords[chainRecords.length - 1];

                      const calculatedPercent =
                        latestRecord && selectedProduct
                          ? ((latestRecord.price - selectedProduct.basePrice) /
                              selectedProduct.basePrice) *
                            100
                          : null;

                      return (
                        <tr
                          key={chain.id}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="py-3 font-medium text-[#1A1A1A]">
                            {chain.name}
                          </td>
                          <td className="py-3 text-center font-mono font-bold">
                            {latestRecord ? (
                              `R$ ${latestRecord.price.toFixed(2)}`
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-3 text-center text-gray-500 font-sans">
                            {latestRecord ? (
                              formatDateBR(latestRecord.date)
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-3 text-gray-600 font-sans">
                            {latestRecord ? (
                              latestRecord.userName
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-3 text-right">
                            {calculatedPercent !== null ? (
                              <span
                                className={`inline-flex items-center gap-0.5 text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                                  calculatedPercent > 0
                                    ? "bg-red-50 text-[#D40511]"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {calculatedPercent > 0 ? "+" : ""}
                                {calculatedPercent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Price Evolution Comparison in a Specific Retail Chain */}
            {selectedProduct && chains.length > 0 && (
              <div
                className="border border-[#E0E0E0] rounded-xl p-5 bg-white space-y-4"
                id="detail-chain-comparison-segment"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#F5F5F5] pb-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans">
                      Análise de Evolução por Rede (Subcategoria:{" "}
                      {selectedProduct.subcategory || "Sem Subcategoria"})
                    </span>
                    <h3 className="text-sm font-black text-[#1A1A1A] font-sans mt-0.5">
                      Comparativo de Variação de Preços na Bandeira
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Weight Filter dropdown */}
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="compare-weight-select"
                        className="text-xs text-gray-500 font-sans font-semibold"
                      >
                        Gramatura:
                      </label>
                      <select
                        id="compare-weight-select"
                        value={compareWeight}
                        onChange={(e) => setCompareWeight(e.target.value)}
                        className="bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-[#D40511]"
                      >
                        <option value="Todas">
                          Todas ({availableWeightsForSelected.length})
                        </option>
                        {availableWeightsForSelected.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Chain Dropdown selector */}
                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor="compare-chain-select"
                        className="text-xs text-gray-500 font-sans font-semibold"
                      >
                        Rede:
                      </label>
                      <select
                        id="compare-chain-select"
                        value={compareChainId || chains[0]?.id || ""}
                        onChange={(e) => setCompareChainId(e.target.value)}
                        className="bg-[#F5F5F5] border border-[#E0E0E0] rounded-lg px-2.5 py-1.5 text-xs text-[#1A1A1A] font-bold focus:outline-none focus:border-[#D40511]"
                      >
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
                  const activeCompareChainId =
                    compareChainId || chains[0]?.id || "";
                  const activeChain = chains.find(
                    (c) => c.id === activeCompareChainId,
                  );

                  // Get products in same category and either same subcategory or matching the selected weight (always keep selectedProduct)
                  const peers = products.filter(
                    (p) =>
                      p.category === selectedProduct.category &&
                      p.active &&
                      (p.id === selectedProduct.id ||
                        (compareWeight === "Todas"
                          ? p.subcategory === selectedProduct.subcategory
                          : p.weight === compareWeight)),
                  );

                  // Retrieve history for peers in this supermarket
                  const peerHistories = peers.map((p) => {
                    const historyInChain = records
                      .filter(
                        (r) =>
                          r.productId === p.id &&
                          r.chainId === activeCompareChainId,
                      )
                      .sort(
                        (a, b) =>
                          new Date(a.date).getTime() -
                          new Date(b.date).getTime(),
                      );
                    return {
                      product: p,
                      history: historyInChain,
                      latestPrice:
                        historyInChain.length > 0
                          ? historyInChain[historyInChain.length - 1].price
                          : p.basePrice,
                      minPrice:
                        historyInChain.length > 0
                          ? Math.min(...historyInChain.map((h) => h.price))
                          : p.basePrice,
                      maxPrice:
                        historyInChain.length > 0
                          ? Math.max(...historyInChain.map((h) => h.price))
                          : p.basePrice,
                    };
                  });

                  // Extract all distinct dates across these products inside this chain
                  const allDatesInChain = Array.from(
                    new Set(
                      records
                        .filter(
                          (r) =>
                            r.chainId === activeCompareChainId &&
                            peers.some((p) => p.id === r.productId),
                        )
                        .map((r) => r.date),
                    ),
                  ).sort();

                  const hasEnoughData =
                    allDatesInChain.length > 0 &&
                    peerHistories.some((ph) => ph.history.length > 0);

                  if (!hasEnoughData) {
                    return (
                      <div className="p-6 bg-[#F9F9F9] rounded-xl text-center text-gray-500 text-xs italic">
                        Não existem registros de auditoria salvos para a
                        subcategoria "
                        {selectedProduct.subcategory || "Sem Subcategoria"}"{" "}
                        {compareWeight !== "Todas"
                          ? `com gramatura "${compareWeight}" `
                          : ""}
                        na rede selecionada ({activeChain?.name}).
                        <p className="text-[11px] text-gray-400 mt-1 font-sans">
                          Cadastre preços na página de Auditoria para alimentar
                          a análise comparativa por estabelecimento.
                        </p>
                      </div>
                    );
                  }

                  // Determine Y-Axis scale limits for plot
                  const allPoints = records
                    .filter(
                      (r) =>
                        r.chainId === activeCompareChainId &&
                        peers.some((p) => p.id === r.productId),
                    )
                    .map((r) => r.price);
                  if (allPoints.length === 0)
                    allPoints.push(selectedProduct.basePrice);

                  const peakPrice = Math.max(...allPoints, 3) * 1.15;
                  const floorPrice = Math.max(
                    0,
                    Math.min(...allPoints, 1) * 0.85,
                  );

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* SVG Comparison Timeline Chart */}
                        <div className="lg:col-span-2 border border-[#E0E0E0]/80 rounded-xl p-4 bg-[#FDFDFD]">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans mb-3">
                            Evolução Temporal de Preços - {activeChain?.name}
                          </span>

                          <div className="relative">
                            <svg
                              viewBox="0 0 500 220"
                              className="w-full h-56"
                              fill="none"
                            >
                              {/* Horizontal axis grid */}
                              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                                const y = 25 + ratio * 150;
                                const val =
                                  peakPrice - ratio * (peakPrice - floorPrice);
                                return (
                                  <g key={i}>
                                    <line
                                      x1="45"
                                      y1={y}
                                      x2="480"
                                      y2={y}
                                      stroke="#F0F0F0"
                                      strokeWidth="1"
                                      strokeDasharray="2,2"
                                    />
                                    <text
                                      x="38"
                                      y={y + 3}
                                      fill="#9ca3af"
                                      fontSize="8"
                                      fontFamily="monospace"
                                      textAnchor="end"
                                    >
                                      R$ {val.toFixed(2)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Vertical date ticks */}
                              {allDatesInChain.map((date, idx, arr) => {
                                const spacing =
                                  arr.length > 1 ? 425 / (arr.length - 1) : 425;
                                const x = 45 + idx * spacing;
                                return (
                                  <g key={idx}>
                                    <line
                                      x1={x}
                                      y1="25"
                                      x2={x}
                                      y2="180"
                                      stroke="#EFEFEF"
                                      strokeWidth="1"
                                    />
                                    <text
                                      x={x}
                                      y="195"
                                      fill="#6B7280"
                                      fontSize="7"
                                      fontWeight="bold"
                                      fontFamily="sans-serif"
                                      textAnchor="middle"
                                    >
                                      {formatDateBR(date).substring(0, 5)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Plots for products */}
                              {peerHistories.map((ph, idx) => {
                                if (ph.history.length === 0) return null;

                                // Generate sequence of coordinates
                                const points = ph.history.map((h) => {
                                  const dateIdx = allDatesInChain.indexOf(
                                    h.date,
                                  );
                                  const spacing =
                                    allDatesInChain.length > 1
                                      ? 425 / (allDatesInChain.length - 1)
                                      : 425;
                                  const x = 45 + dateIdx * spacing;

                                  const ratio =
                                    (h.price - floorPrice) /
                                    (peakPrice - floorPrice);
                                  const y = 175 - ratio * 150;
                                  return { x, y, price: h.price };
                                });

                                const pathD = points.reduce((acc, pt, pIdx) => {
                                  return (
                                    acc +
                                    `${pIdx === 0 ? "M" : "L"} ${pt.x} ${pt.y} `
                                  );
                                }, "");

                                // Custom distinct solid palette for peers
                                const isSelf =
                                  ph.product.id === selectedProduct.id;
                                const colors = [
                                  "#0284C7", // Sky Blue
                                  "#059669", // Emerald
                                  "#7C3AED", // Violet
                                  "#EA580C", // Orange
                                  "#DB2777", // Pink
                                  "#0891B2", // Cyan
                                  "#4F46E5", // Indigo
                                  "#2563EB", // Blue
                                ];

                                let strokeColor = "#D40511"; // Our product
                                if (!isSelf) {
                                  const nonSelfPeers = peers.filter(
                                    (p) => p.id !== selectedProduct.id,
                                  );
                                  const pIdx = nonSelfPeers.findIndex(
                                    (p) => p.id === ph.product.id,
                                  );
                                  strokeColor =
                                    colors[pIdx % colors.length] || "#4B5563";
                                }

                                return (
                                  <g key={ph.product.id}>
                                    <path
                                      d={pathD}
                                      stroke={strokeColor}
                                      strokeWidth={isSelf ? "3.5" : "2.2"}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      opacity="1"
                                    />
                                    {points.map((pt, pIdx) => (
                                      <g key={pIdx}>
                                        <circle
                                          cx={pt.x}
                                          cy={pt.y}
                                          r={isSelf ? "4.5" : "3.5"}
                                          fill={isSelf ? "#D40511" : "#FFFFFF"}
                                          stroke={strokeColor}
                                          strokeWidth="2"
                                        />
                                        {isSelf && (
                                          <text
                                            x={pt.x}
                                            y={pt.y - 10}
                                            fill="#111827"
                                            fontSize="8"
                                            fontWeight="bold"
                                            fontFamily="monospace"
                                            textAnchor="middle"
                                          >
                                            R${pt.price.toFixed(2)}
                                          </text>
                                        )}
                                      </g>
                                    ))}
                                  </g>
                                );
                              })}
                            </svg>
                          </div>

                          {/* Chart sub-legend */}
                          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-3 pt-3 border-t border-[#F5F5F5]">
                            {peerHistories.map((ph) => {
                              if (ph.history.length === 0) return null;

                              const isSelf =
                                ph.product.id === selectedProduct.id;
                              const colors = [
                                "#0284C7", // Sky Blue
                                "#059669", // Emerald
                                "#7C3AED", // Violet
                                "#EA580C", // Orange
                                "#DB2777", // Pink
                                "#0891B2", // Cyan
                                "#4F46E5", // Indigo
                                "#2563EB", // Blue
                              ];

                              let dotColor = "#D40511";
                              if (!isSelf) {
                                const nonSelfPeers = peers.filter(
                                  (p) => p.id !== selectedProduct.id,
                                );
                                const pIdx = nonSelfPeers.findIndex(
                                  (p) => p.id === ph.product.id,
                                );
                                dotColor =
                                  colors[pIdx % colors.length] || "#4B5563";
                              }

                              return (
                                <div
                                  key={ph.product.id}
                                  className="flex items-center gap-1.5 text-[10px]"
                                >
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full ${isSelf ? "ring-2 ring-red-200" : ""}`}
                                    style={{ backgroundColor: dotColor }}
                                  />
                                  <span
                                    className={`font-sans font-medium ${isSelf ? "text-gray-950 font-black" : "text-gray-500"}`}
                                  >
                                    {ph.product.name
                                      .split(" ")
                                      .slice(0, 4)
                                      .join(" ")}{" "}
                                    {isSelf ? "(Aqui)" : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Benchmark Analysis and variation indicators */}
                        <div className="flex flex-col gap-4">
                          <div className="border border-[#E0E0E0]/80 rounded-xl p-4 bg-[#FDFDFD] flex-1 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-sans mb-3">
                                Desempenho de Flutuação (Subcategoria)
                              </span>

                              <div className="space-y-3">
                                {(() => {
                                  const selectedPH = peerHistories.find(
                                    (ph) =>
                                      ph.product.id === selectedProduct.id,
                                  );
                                  const selectedLatestPrice = selectedPH
                                    ? selectedPH.latestPrice
                                    : selectedProduct.basePrice;

                                  return peerHistories.map((ph) => {
                                    const historyLen = ph.history.length;
                                    if (historyLen === 0) return null;

                                    const firstPriceInChain =
                                      ph.history[0].price;
                                    const latestPriceInChain = ph.latestPrice;
                                    const variationVal =
                                      latestPriceInChain - firstPriceInChain;
                                    const variationPercent =
                                      firstPriceInChain > 0
                                        ? (variationVal / firstPriceInChain) *
                                          100
                                        : 0;
                                    const isSelf =
                                      ph.product.id === selectedProduct.id;

                                    // Calc comparison against chosen product
                                    const diffVal =
                                      latestPriceInChain - selectedLatestPrice;
                                    const diffPercent =
                                      selectedLatestPrice > 0
                                        ? (diffVal / selectedLatestPrice) * 100
                                        : 0;

                                    return (
                                      <div
                                        key={ph.product.id}
                                        className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${
                                          isSelf
                                            ? "bg-red-50/50 border-red-200"
                                            : "bg-white border-gray-100"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <div className="min-w-0 pr-1 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <p
                                                className={`text-xs font-black truncate max-w-[140px] ${isSelf ? "text-[#D40511]" : "text-gray-950"}`}
                                              >
                                                {ph.product.name}
                                              </p>
                                              <span
                                                className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                                  isSelf
                                                    ? "bg-red-100 text-[#D40511]"
                                                    : ph.product.isCompetitor
                                                      ? "bg-blue-100 text-blue-800"
                                                      : "bg-gray-100 text-gray-650"
                                                }`}
                                              >
                                                {ph.product.brand ||
                                                  "Dr. Oetker"}
                                              </span>
                                            </div>
                                            <span className="text-[9px] text-gray-400 block font-mono mt-0.5">
                                              Inicial: R${" "}
                                              {firstPriceInChain.toFixed(2)}{" "}
                                              &rarr; R${" "}
                                              {latestPriceInChain.toFixed(2)}
                                            </span>
                                          </div>

                                          <div className="text-right shrink-0">
                                            <span className="text-xs font-extrabold text-[#1A1A1A] font-mono block">
                                              R$ {latestPriceInChain.toFixed(2)}
                                            </span>
                                            <span
                                              className={`inline-flex items-center gap-0.5 text-[8px] font-bold font-mono px-1 rounded mt-0.5 ${
                                                variationVal > 0
                                                  ? "bg-red-50 text-red-700"
                                                  : variationVal < 0
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "bg-gray-100 text-gray-500"
                                              }`}
                                            >
                                              Variação:{" "}
                                              {variationVal > 0
                                                ? "▲"
                                                : variationVal < 0
                                                  ? "▼"
                                                  : "●"}{" "}
                                              {variationPercent.toFixed(1)}%
                                            </span>
                                          </div>
                                        </div>

                                        {/* Difference vs the Selected Product */}
                                        {!isSelf && (
                                          <div className="flex items-center justify-between text-[10px] bg-[#F9F9F9] border border-gray-100/60 rounded px-2 py-1">
                                            <span className="text-gray-450 text-xs shrink-0 font-sans">
                                              Diferença vs Nós:
                                            </span>
                                            <span
                                              className={`font-bold font-mono px-1 rounded ${
                                                diffVal > 0
                                                  ? "text-red-750 bg-red-50"
                                                  : diffVal < 0
                                                    ? "text-emerald-750 bg-emerald-50"
                                                    : "text-gray-500 bg-gray-100"
                                              }`}
                                            >
                                              {diffVal > 0 ? "+" : ""}R${" "}
                                              {diffVal.toFixed(2)} (
                                              {diffVal > 0 ? "+" : ""}
                                              {diffPercent.toFixed(1)}%)
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1.5 font-sans">
                              <AlertCircle className="w-3.5 h-3.5 text-gray-300" />
                              <span>
                                Calculado com base na diferença entre o primeiro
                                e o último registro de auditoria nesta rede.
                              </span>
                            </div>
                          </div>
                        </div>
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
