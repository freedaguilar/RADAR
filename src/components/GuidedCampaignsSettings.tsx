import React, { useState, useMemo } from "react";
import {
  Target,
  Plus,
  Search,
  Check,
  X,
  Edit2,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Package,
  Layers,
  MapPin,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import {
  Product,
  Chain,
  User,
  GuidedCampaign,
  RESEARCH_STATES,
  getChainStates,
} from "../types";
import { normalizeString } from "../lib/textUtils";

interface GuidedCampaignsSettingsProps {
  products: Product[];
  chains: Chain[];
  guidedCampaigns: GuidedCampaign[];
  onAddCampaign: (campaign: GuidedCampaign) => void;
  onUpdateCampaign: (campaign: GuidedCampaign) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onToggleCampaign: (campaignId: string, active: boolean) => void;
  currentUser: User | null;
  onNavigate?: (page: string, params?: any) => void;
}

export function GuidedCampaignsSettings({
  products,
  chains,
  guidedCampaigns,
  onAddCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onToggleCampaign,
  currentUser,
}: GuidedCampaignsSettingsProps) {
  // Mode: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">("list");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formChainId, setFormChainId] = useState("");
  const [formState, setFormState] = useState("Minas Gerais");
  const [formActive, setFormActive] = useState(true);
  const [formNotes, setFormNotes] = useState("");
  const [formProductIds, setFormProductIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filters for product selector in form
  const [prodSearch, setProdSearch] = useState("");
  const [prodBrandFilter, setProdBrandFilter] = useState("todos");
  const [prodCategoryFilter, setProdCategoryFilter] = useState("todas");

  // Filters for campaign list
  const [listSearch, setListSearch] = useState("");
  const [listChainFilter, setListChainFilter] = useState("todas");
  const [listStateFilter, setListStateFilter] = useState("todos");
  const [listStatusFilter, setListStatusFilter] = useState<"todos" | "active" | "inactive">("todos");

  // Delete modal state
  const [deleteModalCampaign, setDeleteModalCampaign] = useState<GuidedCampaign | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner(null);
    }, 3500);
  };

  // Available categories for product filter
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Available brands for product filter
  const productBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach((p) => {
      if (p.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [products]);

  // Reset form
  const handleOpenCreate = () => {
    const defaultChainId = chains[0]?.id || "";
    const defaultChain = chains.find((c) => c.id === defaultChainId);
    const defaultStates = defaultChain ? getChainStates(defaultChain) : ["Minas Gerais"];
    const firstState = defaultStates[0] || "Minas Gerais";

    // Auto-preselect own brand products as starting recommendation (Dr. Oetker)
    const suggestedProducts = products
      .filter((p) => p.active && !p.isCompetitor)
      .slice(0, 8)
      .map((p) => p.id);

    setEditingCampaignId(null);
    setFormTitle(`Pesquisa Guiada - ${defaultChain?.name || "Rede"} (${firstState})`);
    setFormChainId(defaultChainId);
    setFormState(firstState);
    setFormActive(true);
    setFormNotes("");
    setFormProductIds(suggestedProducts);
    setFormError("");
    setProdSearch("");
    setProdBrandFilter("todos");
    setProdCategoryFilter("todas");
    setViewMode("create");
  };

  // Open edit
  const handleOpenEdit = (campaign: GuidedCampaign) => {
    setEditingCampaignId(campaign.id);
    setFormTitle(campaign.title);
    setFormChainId(campaign.chainId);
    setFormState(campaign.state);
    setFormActive(campaign.active);
    setFormNotes(campaign.notes || "");
    setFormProductIds([...campaign.productIds]);
    setFormError("");
    setProdSearch("");
    setProdBrandFilter("todos");
    setProdCategoryFilter("todas");
    setViewMode("edit");
  };

  // Duplicate campaign
  const handleDuplicate = (campaign: GuidedCampaign) => {
    const newId = `campaign-${Date.now()}`;
    const duplicated: GuidedCampaign = {
      ...campaign,
      id: newId,
      title: `${campaign.title} (Cópia)`,
      active: false, // Inicia pausada para o gestor ajustar rede/estado
      createdAt: new Date().toISOString(),
      updatedAt: undefined,
      createdBy: currentUser?.name || "Gestor",
    };
    onAddCampaign(duplicated);
    showFeedback("success", `Pesquisa duplicada com sucesso! Ajuste a rede ou estado conforme desejado.`);
  };

  // Chain states based on selected chain in form
  const availableFormStates = useMemo(() => {
    const currentChain = chains.find((c) => c.id === formChainId);
    if (!currentChain) return RESEARCH_STATES.map((s) => s.name);
    const cStates = getChainStates(currentChain);
    return cStates.length > 0 ? cStates : RESEARCH_STATES.map((s) => s.name);
  }, [chains, formChainId]);

  // Filtered available products for selection
  const filteredCatalogProducts = useMemo(() => {
    const activeProds = products.filter((p) => p.active);
    const term = normalizeString(prodSearch.trim());

    return activeProds.filter((p) => {
      // Search term
      if (term) {
        const nameMatch = normalizeString(p.name).includes(term);
        const codeMatch = p.internalCode ? normalizeString(p.internalCode).includes(term) : false;
        const brandMatch = p.brand ? normalizeString(p.brand).includes(term) : false;
        const catMatch = normalizeString(p.category).includes(term);
        if (!nameMatch && !codeMatch && !brandMatch && !catMatch) return false;
      }

      // Brand filter
      if (prodBrandFilter !== "todos") {
        if (prodBrandFilter === "propria") {
          if (p.isCompetitor) return false;
        } else if (prodBrandFilter === "concorrente") {
          if (!p.isCompetitor) return false;
        } else if (p.brand !== prodBrandFilter) {
          return false;
        }
      }

      // Category filter
      if (prodCategoryFilter !== "todas" && p.category !== prodCategoryFilter) {
        return false;
      }

      return true;
    });
  }, [products, prodSearch, prodBrandFilter, prodCategoryFilter]);

  // Selected products mapped objects in exact order
  const selectedProductsList = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return formProductIds
      .map((id) => map.get(id))
      .filter((p): p is Product => !!p);
  }, [products, formProductIds]);

  // Product selection toggle
  const handleToggleProduct = (productId: string) => {
    setFormProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  // Reorder product up
  const handleMoveProductUp = (index: number) => {
    if (index <= 0) return;
    setFormProductIds((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Reorder product down
  const handleMoveProductDown = (index: number) => {
    if (index >= formProductIds.length - 1) return;
    setFormProductIds((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Select all visible filtered products
  const handleSelectAllVisible = () => {
    const visibleIds = filteredCatalogProducts.map((p) => p.id);
    setFormProductIds((prev) => {
      const set = new Set(prev);
      visibleIds.forEach((id) => set.add(id));
      return Array.from(set);
    });
  };

  // Clear all selected products
  const handleClearSelection = () => {
    setFormProductIds([]);
  };

  // Save form
  const handleSaveCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formChainId) {
      setFormError("Por favor, selecione a rede de lojas para a pesquisa guiada.");
      return;
    }

    if (!formState) {
      setFormError("Por favor, selecione o estado de atuação da pesquisa guiada.");
      return;
    }

    if (formProductIds.length === 0) {
      setFormError("Por favor, selecione pelo menos 1 produto para compor a fila da pesquisa guiada.");
      return;
    }

    const chain = chains.find((c) => c.id === formChainId);
    const finalTitle = formTitle.trim() || `Pesquisa Guiada - ${chain?.name || "Rede"} (${formState})`;

    if (viewMode === "edit" && editingCampaignId) {
      const updated: GuidedCampaign = {
        id: editingCampaignId,
        title: finalTitle,
        chainId: formChainId,
        state: formState,
        productIds: formProductIds,
        active: formActive,
        createdAt:
          guidedCampaigns.find((c) => c.id === editingCampaignId)?.createdAt ||
          new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy:
          guidedCampaigns.find((c) => c.id === editingCampaignId)?.createdBy ||
          currentUser?.name ||
          "Gestor",
        notes: formNotes.trim() || undefined,
      };
      onUpdateCampaign(updated);
      showFeedback("success", `Pesquisa guiada "${finalTitle}" atualizada com sucesso!`);
    } else {
      const newCampaign: GuidedCampaign = {
        id: `campaign-${Date.now()}`,
        title: finalTitle,
        chainId: formChainId,
        state: formState,
        productIds: formProductIds,
        active: formActive,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || "Gestor",
        notes: formNotes.trim() || undefined,
      };
      onAddCampaign(newCampaign);
      showFeedback("success", `Pesquisa guiada "${finalTitle}" liberada com sucesso!`);
    }

    setViewMode("list");
  };

  // Filtered list of campaigns
  const filteredCampaigns = useMemo(() => {
    return guidedCampaigns.filter((camp) => {
      // Search
      if (listSearch.trim()) {
        const term = normalizeString(listSearch.trim());
        const titleMatch = normalizeString(camp.title).includes(term);
        const chainName = chains.find((c) => c.id === camp.chainId)?.name || "";
        const chainMatch = normalizeString(chainName).includes(term);
        const stateMatch = normalizeString(camp.state).includes(term);
        if (!titleMatch && !chainMatch && !stateMatch) return false;
      }

      // Chain
      if (listChainFilter !== "todas" && camp.chainId !== listChainFilter) {
        return false;
      }

      // State
      if (listStateFilter !== "todos" && camp.state !== listStateFilter) {
        return false;
      }

      // Status
      if (listStatusFilter === "active" && !camp.active) return false;
      if (listStatusFilter === "inactive" && camp.active) return false;

      return true;
    });
  }, [guidedCampaigns, chains, listSearch, listChainFilter, listStateFilter, listStatusFilter]);

  const activeCount = guidedCampaigns.filter((c) => c.active).length;

  return (
    <div className="space-y-6" id="guided-campaigns-manager">
      {/* Alert banner */}
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            feedbackBanner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIEW: LIST OF CAMPAIGNS */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-red-950/80 via-black/90 to-red-950/80 border border-red-500/30 rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-600/30 border border-red-500/40 text-red-400">
                  <Target className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider text-red-300 font-bold">
                  Controle de Auditoria Direcionada
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight">
                Pesquisas Guiadas por Rede & Estado
              </h2>
              <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
                Defina filas de produtos personalizadas para redes e estados específicos.
                Quando ativas, usuários convidados e pesquisadores auditarão rigorosamente
                esta seleção de produtos. Redes sem pesquisa ativa mantêm a fila inteligente padrão.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex flex-col items-end pr-3 border-r border-white/10">
                <span className="text-[10px] text-gray-400 font-mono">Status Geral</span>
                <span className="text-sm font-black font-mono text-emerald-400">
                  {activeCount} {activeCount === 1 ? "ativa" : "ativas"}
                </span>
              </div>
              <button
                type="button"
                id="create-guided-campaign-btn"
                onClick={handleOpenCreate}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#D40511] hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-lg shadow-red-900/40 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Pesquisa Guiada</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-3.5 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  placeholder="Buscar pesquisa, rede ou UF..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-red-500 font-sans"
                />
                {listSearch && (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chain filter */}
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                <select
                  value={listChainFilter}
                  onChange={(e) => setListChainFilter(e.target.value)}
                  className="w-full py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="todas">Todas as Redes</option>
                  {chains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* State filter */}
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                <select
                  value={listStateFilter}
                  onChange={(e) => setListStateFilter(e.target.value)}
                  className="w-full py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="todos">Todos os Estados</option>
                  {RESEARCH_STATES.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.uf})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                <select
                  value={listStatusFilter}
                  onChange={(e) => setListStatusFilter(e.target.value as any)}
                  className="w-full py-2 px-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="active">Apenas Ativas ({activeCount})</option>
                  <option value="inactive">Apenas Inativas ({guidedCampaigns.length - activeCount})</option>
                </select>
              </div>
            </div>
          </div>

          {/* Campaigns Cards List */}
          {filteredCampaigns.length === 0 ? (
            <div className="p-8 text-center bg-white border border-dashed border-gray-300 rounded-2xl">
              <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-700">Nenhuma pesquisa guiada encontrada</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {guidedCampaigns.length === 0
                  ? "Crie a primeira pesquisa guiada para liberar uma fila de produtos personalizada para os pesquisadores."
                  : "Nenhum resultado corresponde aos filtros aplicados. Tente alterar os filtros de busca."}
              </p>
              {guidedCampaigns.length === 0 && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-4 px-4 py-2 bg-[#D40511] text-white rounded-xl text-xs font-bold hover:bg-red-700 transition"
                >
                  + Criar Primeira Pesquisa
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCampaigns.map((camp) => {
                const chain = chains.find((c) => c.id === camp.chainId);
                const campProducts = camp.productIds
                  .map((id) => products.find((p) => p.id === id))
                  .filter((p): p is Product => !!p);

                const uf = RESEARCH_STATES.find((s) => s.name === camp.state)?.uf || camp.state;

                return (
                  <div
                    key={camp.id}
                    className={`bg-white border-2 rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col justify-between ${
                      camp.active
                        ? "border-emerald-300 ring-2 ring-emerald-500/20 shadow-emerald-50"
                        : "border-gray-200 opacity-90 hover:opacity-100"
                    }`}
                  >
                    <div>
                      {/* Top Bar: Badges + Switch Toggle */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Active / Inactive badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              camp.active
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-gray-100 text-gray-600 border border-gray-300"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                camp.active ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                              }`}
                            />
                            {camp.active ? "Ativa para Pesquisa" : "Pausada"}
                          </span>

                          {/* State badge */}
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                            <MapPin className="w-3 h-3 text-blue-500" />
                            {camp.state} ({uf})
                          </span>
                        </div>

                        {/* Instant Switch Toggle */}
                        <label
                          htmlFor={`toggle-campaign-${camp.id}`}
                          className="flex items-center gap-2 cursor-pointer select-none"
                          title={camp.active ? "Clique para desativar esta pesquisa" : "Clique para ativar esta pesquisa"}
                        >
                          <span className="text-[10px] font-bold text-gray-500 hidden xs:inline">
                            {camp.active ? "Ativa" : "Inativa"}
                          </span>
                          <div className="relative inline-flex items-center">
                            <input
                              type="checkbox"
                              id={`toggle-campaign-${camp.id}`}
                              checked={camp.active}
                              onChange={(e) => {
                                onToggleCampaign(camp.id, e.target.checked);
                                showFeedback(
                                  "success",
                                  e.target.checked
                                    ? `Pesquisa "${camp.title}" ativada! Convidados seguirão esta fila.`
                                    : `Pesquisa "${camp.title}" pausada. Rede voltou à regra padrão.`
                                );
                              }}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </div>
                        </label>
                      </div>

                      {/* Title & Chain */}
                      <h3 className="text-base font-black text-[#1A1A1A] font-sans leading-tight">
                        {camp.title}
                      </h3>

                      {/* Chain identity row */}
                      <div className="flex items-center gap-2 mt-2">
                        <div
                          className={`w-6 h-6 rounded-lg ${
                            chain?.logoColor || "bg-gray-600"
                          } text-white flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden shadow-2xs`}
                        >
                          {chain?.logoUrl ? (
                            <img
                              src={chain.logoUrl}
                              alt={chain.name}
                              className="w-full h-full object-contain p-0.5"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            chain?.name?.substring(0, 2).toUpperCase() || "RD"
                          )}
                        </div>
                        <span className="text-xs font-bold text-gray-800">
                          {chain?.name || "Rede Desconhecida"}
                        </span>
                        <span className="text-[11px] text-gray-400">•</span>
                        <span className="text-xs font-mono font-bold text-[#D40511]">
                          {camp.productIds.length} {camp.productIds.length === 1 ? "produto na fila" : "produtos na fila"}
                        </span>
                      </div>

                      {/* Notes / Instructions */}
                      {camp.notes && (
                        <p className="text-[11px] text-gray-500 italic mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          "{camp.notes}"
                        </p>
                      )}

                      {/* Products preview chips */}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono block mb-1.5">
                          Sequência da Fila Guiada:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {campProducts.slice(0, 5).map((p, idx) => (
                            <div
                              key={p.id}
                              className="inline-flex items-center gap-1 text-[10px] bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md border border-gray-200 font-sans"
                              title={p.name}
                            >
                              <span className="font-mono font-bold text-gray-400">#{idx + 1}</span>
                              <span className="font-bold truncate max-w-[120px]">{p.name}</span>
                            </div>
                          ))}
                          {campProducts.length > 5 && (
                            <span className="text-[10px] font-bold font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                              +{campProducts.length - 5} outros
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <span className="text-[9px] text-gray-400 font-mono">
                        Criada por {camp.createdBy || "Gestor"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(camp)}
                          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                          title="Duplicar esta pesquisa guiada para outra rede/estado"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(camp)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteModalCampaign(camp)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Excluir pesquisa guiada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: CREATE / EDIT CAMPAIGN FORM */}
      {(viewMode === "create" || viewMode === "edit") && (
        <form onSubmit={handleSaveCampaign} className="space-y-6 animate-in fade-in duration-200">
          {/* Top Return & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 transition cursor-pointer"
                title="Voltar para a lista"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-red-600 font-bold">
                  {viewMode === "create" ? "Nova Configuração" : "Edição de Pesquisa"}
                </span>
                <h2 className="text-xl font-black text-[#1A1A1A] font-sans">
                  {viewMode === "create" ? "Liberar Nova Pesquisa Guiada" : "Editar Pesquisa Guiada"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="save-guided-campaign-btn"
                className="px-5 py-2 bg-[#D40511] hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Salvar & Liberar</span>
              </button>
            </div>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Form Basic Info Card */}
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">
              1. Identificação, Rede e Estado
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Campaign Title */}
              <div className="sm:col-span-3 space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Título da Pesquisa Guiada
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Auditoria Dr. Oetker - Rede Super Nosso (MG)"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-red-500 font-medium"
                />
              </div>

              {/* Select Chain */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Rede de Lojas Alvo <span className="text-red-500">*</span>
                </label>
                <select
                  value={formChainId}
                  onChange={(e) => {
                    const newChainId = e.target.value;
                    setFormChainId(newChainId);
                    const chainObj = chains.find((c) => c.id === newChainId);
                    const states = chainObj ? getChainStates(chainObj) : ["Minas Gerais"];
                    if (!states.includes(formState)) {
                      setFormState(states[0] || "Minas Gerais");
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                  required
                >
                  <option value="" disabled>
                    Selecione a Rede
                  </option>
                  {chains.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select State */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Estado da Pesquisa <span className="text-red-500">*</span>
                </label>
                <select
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium focus:outline-none focus:border-red-500 cursor-pointer"
                  required
                >
                  {availableFormStates.map((st) => {
                    const uf = RESEARCH_STATES.find((s) => s.name === st)?.uf || st;
                    return (
                      <option key={st} value={st}>
                        {st} ({uf})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Active Toggle */}
              <div className="space-y-1 flex flex-col justify-end">
                <label className="flex items-center gap-2.5 p-2 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition select-none">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-800 block">
                      Ativar Imediatamente
                    </span>
                    <span className="text-[10px] text-gray-500 block">
                      Disponibilizar para convidados e pesquisadores
                    </span>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div className="sm:col-span-3 space-y-1">
                <label className="block text-xs font-bold text-gray-700">
                  Instruções / Observações para o Pesquisador (Opcional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: Focar na conferência dos preços das gelatinas e pizzas no balcão frontal."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-red-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Products Queue Selection & Ordering */}
          <div className="bg-white border border-[#E0E0E0] rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">
                  2. Seleção e Ordem dos Produtos da Fila Guiada
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Selecione os produtos e utilize as setas para ajustar a ordem exata em que aparecerão na câmera.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-red-50 text-[#D40511] border border-red-200">
                  {formProductIds.length} produtos selecionados
                </span>
                {formProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-[11px] text-gray-500 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-gray-100 transition"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Split layout: Catalog on Left, Chosen Queue on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* LEFT: Available Catalog (7 cols) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 font-sans">
                    Catálogo Disponível ({filteredCatalogProducts.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                  >
                    + Selecionar Todos Filtrados
                  </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="relative sm:col-span-1">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={prodSearch}
                      onChange={(e) => setProdSearch(e.target.value)}
                      placeholder="Buscar produto..."
                      className="w-full pl-8 pr-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-red-500"
                    />
                  </div>

                  <select
                    value={prodBrandFilter}
                    onChange={(e) => setProdBrandFilter(e.target.value)}
                    className="py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-red-500"
                  >
                    <option value="todos">Todas as Marcas</option>
                    <option value="propria">Marca Própria (Dr. Oetker/Mavalério)</option>
                    <option value="concorrente">Concorrentes</option>
                    {productBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <select
                    value={prodCategoryFilter}
                    onChange={(e) => setProdCategoryFilter(e.target.value)}
                    className="py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:outline-none focus:border-red-500"
                  >
                    <option value="todas">Todas Categorias</option>
                    {productCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Products list container */}
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto divide-y divide-gray-100 bg-white">
                  {filteredCatalogProducts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Nenhum produto encontrado com os filtros atuais.
                    </div>
                  ) : (
                    filteredCatalogProducts.map((p) => {
                      const isSelected = formProductIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleToggleProduct(p.id)}
                          className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-red-50/70 hover:bg-red-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Product thumbnail */}
                            <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Package className="w-4 h-4 text-gray-400" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-800 truncate">
                                {p.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap">
                                <span className={`font-bold font-mono px-1 rounded ${
                                  !p.isCompetitor ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                  {p.brand || (!p.isCompetitor ? "Dr. Oetker" : "Concorrente")}
                                </span>
                                {p.weight && <span>• {p.weight}</span>}
                                {p.category && <span>• {p.category}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
                                isSelected
                                  ? "bg-[#D40511] text-white"
                                  : "border border-gray-300 text-gray-400 hover:border-gray-500"
                              }`}
                            >
                              {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* RIGHT: Ordered Queue Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 font-sans">
                    Ordem na Câmera Guiada ({selectedProductsList.length})
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    Use ↑ ↓ para ordenar
                  </span>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto divide-y divide-gray-100 bg-gray-50">
                  {selectedProductsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400">
                      <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      Nenhum produto na fila ainda.
                      <p className="text-[11px] text-gray-400 mt-1">
                        Clique nos produtos do catálogo ao lado para adicioná-los.
                      </p>
                    </div>
                  ) : (
                    selectedProductsList.map((p, index) => (
                      <div
                        key={p.id}
                        className="p-2 bg-white flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Position badge */}
                          <span className="w-5 h-5 rounded-full bg-red-100 text-[#D40511] font-mono font-black text-[10px] flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>

                          <div className="w-7 h-7 rounded bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-contain p-0.5"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate" title={p.name}>
                              {p.name}
                            </p>
                            <span className="text-[9px] text-gray-500 font-mono">
                              {p.brand || "Dr. Oetker"} {p.weight ? `• ${p.weight}` : ""}
                            </span>
                          </div>
                        </div>

                        {/* Order arrows and remove */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveProductUp(index)}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400"
                            title="Mover para cima"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveProductDown(index)}
                            disabled={index === selectedProductsList.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleProduct(p.id)}
                            className="p-1 text-red-400 hover:text-red-700 ml-0.5"
                            title="Remover da fila"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save bar */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-gray-500">
              * Ao salvar com o status <strong>Ativa</strong>, todos os convidados que selecionarem{" "}
              <strong>{chains.find((c) => c.id === formChainId)?.name || "esta rede"}</strong> em{" "}
              <strong>{formState}</strong> terão esta fila prioritária.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="px-4 py-2 border border-gray-300 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                id="save-guided-campaign-btn-bottom"
                className="px-5 py-2 bg-[#D40511] hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Salvar & Liberar</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalCampaign && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-xl text-red-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-gray-900 font-sans">
                  Excluir Pesquisa Guiada
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Tem certeza que deseja remover a pesquisa{" "}
                  <strong className="text-gray-800">
                    "{deleteModalCampaign.title}"
                  </strong>
                  ? A rede associada voltará imediatamente à regra padrão de produtos.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteModalCampaign(null)}
                className="px-3.5 py-1.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="confirm-delete-guided-campaign-btn"
                onClick={() => {
                  onDeleteCampaign(deleteModalCampaign.id);
                  showFeedback("success", `Pesquisa "${deleteModalCampaign.title}" excluída.`);
                  setDeleteModalCampaign(null);
                }}
                className="px-4 py-1.5 bg-[#D40511] text-white text-xs font-bold rounded-xl hover:bg-red-700 transition"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
