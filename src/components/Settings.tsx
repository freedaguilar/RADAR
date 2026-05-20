import React, { useState } from "react";
import {
  Settings as SettingsIcon,
  Package,
  Layers,
  Users2,
  Shield,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  ChevronLeft,
  Upload,
  Loader2,
} from "lucide-react";
import { Product, Chain, User } from "../types";
import { uploadToSupabaseStorage } from "../lib/supabase";

function extractDominantColor(fileOrUrl: File | string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve("#4b5563");
          return;
        }
        canvas.width = 32;
        canvas.height = 32;
        ctx.drawImage(img, 0, 0, 32, 32);
        
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const data = imgData.data;
        
        const colors: { [key: string]: number } = {};
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          
          if (a < 50) continue;
          if (r > 240 && g > 240 && b > 240) continue;
          if (r < 15 && g < 15 && b < 15) continue;
          
          const qr = Math.round(r / 15) * 15;
          const qg = Math.round(g / 15) * 15;
          const qb = Math.round(b / 15) * 15;
          
          const rgbStr = `rgb(${qr},${qg},${qb})`;
          colors[rgbStr] = (colors[rgbStr] || 0) + 1;
        }
        
        let maxCount = 0;
        let dominantRgb = "rgb(75,85,99)";
        
        Object.entries(colors).forEach(([rgb, count]) => {
          if (count > maxCount) {
            maxCount = count;
            dominantRgb = rgb;
          }
        });
        
        const match = dominantRgb.match(/rgb\((\d+),(\d+),(\d+)\)/);
        if (match) {
          const r = parseInt(match[1]);
          const g = parseInt(match[2]);
          const b = parseInt(match[3]);
          const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
          resolve(hex);
        } else {
          resolve("#4b5563");
        }
      } catch (err) {
        console.error("Failed to extract dominant color:", err);
        resolve("#4b5563");
      }
    };
    
    img.onerror = () => {
      resolve("#4b5563");
    };
    
    if (typeof fileOrUrl === "string") {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          resolve("#4b5563");
        }
      };
      reader.onerror = () => resolve("#4b5563");
      reader.readAsDataURL(fileOrUrl);
    }
  });
}

interface SettingsProps {
  products: Product[];
  chains: Chain[];
  users: User[];
  onAddProduct: (newProduct: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddChain: (newChain: Chain) => void;
  onEditChain: (chain: Chain) => void;
  onDeleteChain: (id: string) => void;
  onAddUser: (newUser: User) => void;
  onDeleteUser: (id: string) => void;
  onNavigate: (page: string, params?: any) => void;
}

export function Settings({
  products,
  chains,
  users,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onAddChain,
  onEditChain,
  onDeleteChain,
  onAddUser,
  onDeleteUser,
  onNavigate,
}: SettingsProps) {
  // Navigation tabs inside Settings
  const [activeTab, setActiveTab] = useState<"products" | "chains" | "users">(
    "products",
  );

  // Native product editing/creating view: 'list' | 'create' | 'edit'
  const [productView, setProductView] = useState<"list" | "create" | "edit">("list");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Input states for Products creator/editor
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Geral Retail");
  const [newProdSubcategory, setNewProdSubcategory] = useState("Regular");
  const [newProdWeight, setNewProdWeight] = useState("100g");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [newProdBasePrice, setNewProdBasePrice] = useState("0.00");
  const [newProdIsCompetitor, setNewProdIsCompetitor] = useState(false);
  const [newProdBrand, setNewProdBrand] = useState("Dr. Oetker");
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);

  // Custom confirmation modal for sandboxed iframes
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "product" | "chain" | "user";
    id: string;
    name: string;
  } | null>(null);

  // Input states for Chains creator/editor
  const [editingChainId, setEditingChainId] = useState<string | null>(null);
  const [newChainName, setNewChainName] = useState("");
  const [newChainLogoColor, setNewChainLogoColor] = useState("bg-blue-600");
  const [newChainLogoUrl, setNewChainLogoUrl] = useState("");
  const [isUploadingChainLogo, setIsUploadingChainLogo] = useState(false);
  const [chainLogoDragActive, setChainLogoDragActive] = useState(false);
  const [chainFormError, setChainFormError] = useState("");

  // Input states for Users creator
  const [newUserImg, setNewUserImg] = useState("RL");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"gestor" | "vendedor">(
    "vendedor",
  );
  const [userFormError, setUserFormError] = useState("");

  const [filterText, setFilterText] = useState("");

  const filteredProducts = products.filter((p) => {
    const searchTerms = filterText.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return searchTerms.every((term) => {
      const nameMatch = p.name.toLowerCase().includes(term);
      const categoryMatch = p.category.toLowerCase().includes(term);
      const subcategoryMatch = p.subcategory ? p.subcategory.toLowerCase().includes(term) : false;
      const brandMatch = p.brand ? p.brand.toLowerCase().includes(term) : false;
      const weightMatch = p.weight ? p.weight.toLowerCase().includes(term) : false;
      return nameMatch || categoryMatch || subcategoryMatch || brandMatch || weightMatch;
    });
  });

  // Success Feedback
  const [successBanner, setSuccessBanner] = useState("");

  const triggerSuccessMsg = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => {
      setSuccessBanner("");
    }, 3000);
  };

  const handleProductImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormFeedback({ type: "error", message: "Por favor, selecione um arquivo de imagem válido (PNG/JPG/WEBP)." });
      return;
    }

    setIsUploadingProductImage(true);
    setFormFeedback(null);
    try {
      const uploadedUrl = await uploadToSupabaseStorage(file, "images");
      setNewProdImageUrl(uploadedUrl);
      setFormFeedback({ type: "success", message: "Imagem enviada e hospedada com sucesso!" });
    } catch (err) {
      console.error("Erro ao subir imagem do produto:", err);
      setFormFeedback({ type: "error", message: "Erro ao fazer upload da imagem do produto." });
    } finally {
      setIsUploadingProductImage(false);
    }
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    const priceNum = parseFloat(newProdBasePrice) || 0;

    try {
      if (productView === "edit" && selectedProductId) {
        const existingProd = products.find((p) => p.id === selectedProductId);
        if (existingProd) {
          onEditProduct({
            ...existingProd,
            name: newProdName,
            category: newProdCategory,
            subcategory: newProdSubcategory,
            weight: newProdWeight,
            imageUrl: newProdImageUrl || existingProd.imageUrl,
            basePrice: priceNum,
            isCompetitor: newProdIsCompetitor,
            brand: newProdBrand,
          });
          triggerSuccessMsg("Produto editado com sucesso!");
        }
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
          basePrice: priceNum,
          isCompetitor: newProdIsCompetitor,
          brand: newProdBrand,
        });
        triggerSuccessMsg("Produto cadastrado com sucesso!");
      }
      setProductView("list");
      setSelectedProductId(null);
    } catch (err) {
      setFormFeedback({ type: "error", message: "Erro ao processar produto. Tente novamente." });
    }
  };

  const handleChainLogoFileChange = async (file: File) => {
    if (!file) return;
    
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setChainFormError("Formato de arquivo inválido. Apenas PNG, JPG e SVG são aceitos.");
      return;
    }
    
    setIsUploadingChainLogo(true);
    setChainFormError("");
    
    try {
      const url = await uploadToSupabaseStorage(file, "images", "logos/redes");
      setNewChainLogoUrl(url);
      
      const domColor = await extractDominantColor(file);
      setNewChainLogoColor(domColor);
    } catch (err) {
      console.error("Error uploading logo:", err);
      setChainFormError("Erro ao enviar imagem do logo. Tente novamente.");
    } finally {
      setIsUploadingChainLogo(false);
    }
  };

  const handleChainLogoDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setChainLogoDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setChainLogoDragActive(false);
    }
  };

  const handleChainLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setChainLogoDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleChainLogoFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleCreateChainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChainFormError("");

    if (!newChainName.trim()) {
      setChainFormError("Por favor informe o nome da rede.");
      return;
    }

    const nameExists = chains.some(
      (c) => c.id !== editingChainId && c.name.toLowerCase() === newChainName.trim().toLowerCase()
    );
    if (nameExists) {
      setChainFormError("Esta rede já está cadastrada no sistema.");
      return;
    }

    if (editingChainId) {
      const updatedChain: Chain = {
        id: editingChainId,
        name: newChainName.trim(),
        logoColor: newChainLogoColor,
        logoUrl: newChainLogoUrl || undefined,
        active: true,
      };

      onEditChain(updatedChain);
      setEditingChainId(null);
      setNewChainName("");
      setNewChainLogoColor("bg-blue-600");
      setNewChainLogoUrl("");
      triggerSuccessMsg("Rede/Bandeira editada com sucesso!");
    } else {
      const uniqueId = `chain-add-${Date.now()}`;
      const newChain: Chain = {
        id: uniqueId,
        name: newChainName.trim(),
        logoColor: newChainLogoColor,
        logoUrl: newChainLogoUrl || undefined,
        active: true,
      };

      onAddChain(newChain);
      setNewChainName("");
      setNewChainLogoColor("bg-blue-600");
      setNewChainLogoUrl("");
      triggerSuccessMsg("Rede/Bandeira cadastrada com sucesso!");
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError("");

    if (!newUserName.trim() || !newUserEmail.trim()) {
      setUserFormError("Preencha os dados obrigatórios nome e e-mail.");
      return;
    }

    if (
      users.some(
        (u) => u.email.toLowerCase() === newUserEmail.trim().toLowerCase(),
      )
    ) {
      setUserFormError("O e-mail informado já está cadastrado.");
      return;
    }

    const uniqueId = `user-add-${Date.now()}`;
    const cleanInitials =
      newUserName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2) || "US";

    const newUserObj: User = {
      id: uniqueId,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      active: true,
      avatarUrl: cleanInitials,
    };

    onAddUser(newUserObj);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserRole("vendedor");
    triggerSuccessMsg("Usuário cadastrado com sucesso!");
  };

  return (
    <div className="space-y-6" id="settings-view">
      {/* Settings Title */}
      <div className="border-b border-[#E0E0E0] pb-6" id="settings-header">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase font-mono">
          Painel de Gerenciamento do Gestor
        </span>
        <h1 className="text-3xl font-black text-[#1A1A1A] font-sans">
          Configurações do RADAR
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gerencie o catálogo de produtos ativos, credencie novas
          redes/bandeiras do varejo e configure o acesso de colaboradores.
        </p>
      </div>

      {successBanner && (
        <div
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2"
          id="settings-success-alert"
        >
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Grid containing Tab Navigation (Sidebar style) and Tab Contents */}
      <div
        className="grid grid-cols-1 lg:grid-cols-4 gap-6"
        id="settings-content-grid"
      >
        {/* Tab Left Navigation Menu */}
        <div className="lg:col-span-1 space-y-2" id="settings-tabs-menu">
          <button
            id="settings-tab-products"
            onClick={() => setActiveTab("products")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold leading-none flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeTab === "products"
                ? "bg-[#1A1A1A] text-white"
                : "bg-[#F5F5F5] text-gray-600 hover:bg-[#E0E0E0]"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Portfólio de Produtos</span>
          </button>

          <button
            id="settings-tab-chains"
            onClick={() => setActiveTab("chains")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold leading-none flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeTab === "chains"
                ? "bg-[#1A1A1A] text-white"
                : "bg-[#F5F5F5] text-gray-600 hover:bg-[#E0E0E0]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Redes / Lojas</span>
          </button>

          <button
            id="settings-tab-users"
            onClick={() => setActiveTab("users")}
            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold leading-none flex items-center gap-2.5 transition-colors cursor-pointer ${
              activeTab === "users"
                ? "bg-[#1A1A1A] text-white"
                : "bg-[#F5F5F5] text-gray-600 hover:bg-[#E0E0E0]"
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>Colaboradores / Usuários</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <div
          className="lg:col-span-3 bg-white border border-[#E0E0E0] rounded-2xl p-6"
          id="settings-tab-content-panel"
        >
          {/* TAB 1: PRODUCT LIST & TOGGLES */}
          {activeTab === "products" && (
            <div className="space-y-6" id="settings-tab-products-panel">
              {productView === "list" ? (
                <>
                  <div className="flex justify-between items-center bg-white mb-6">
                    <div>
                      <h3 className="text-md font-bold text-[#1A1A1A] font-sans">
                        Controle de Portfólio
                      </h3>
                      <p className="text-xs text-gray-400">
                        Total de {products.length} itens registrados na base de
                        dados.
                      </p>
                    </div>
                  </div>

                  {/* Filtros e Busca */}
                  <div
                    className="border border-[#E0E0E0] rounded-xl p-4 bg-[#F5F5F5]/50 mb-6 flex flex-col md:flex-row gap-4 items-end justify-between"
                    id="add-product-form-container"
                  >
                    <div className="w-full md:w-1/2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                        Buscar na Base
                      </label>
                      <input
                        type="text"
                        placeholder="Pesquisar por nome ou categoria..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProductView("create");
                        setNewProdName("");
                        setNewProdCategory("Geral Retail");
                        setNewProdSubcategory("Regular");
                        setNewProdWeight("100g");
                        setNewProdImageUrl("");
                        setNewProdBasePrice("0.00");
                        setNewProdIsCompetitor(false);
                        setNewProdBrand("Dr. Oetker");
                        setFormFeedback(null);
                      }}
                      className="bg-[#D40511] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition whitespace-nowrap cursor-pointer"
                    >
                      Cadastrar Novo Produto
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table
                      className="w-full text-left text-xs border-collapse"
                      id="settings-products-table"
                    >
                      <thead>
                        <tr className="border-b border-[#E0E0E0] text-[10px] text-gray-400 font-bold uppercase">
                          <th className="pb-3">Visual</th>
                          <th className="pb-3">Nome do Produto</th>
                          <th className="pb-3">Categoria</th>
                          <th className="pb-3">Preço Base</th>
                          <th className="pb-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F5F5F5]">
                        {filteredProducts.map((prod) => (
                          <tr
                            key={prod.id}
                            className="hover:bg-gray-50/55 transition-colors"
                          >
                            <td className="py-2.5">
                              <img
                                src={prod.imageUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded border border-[#E0E0E0] p-0.5 object-contain"
                              />
                            </td>
                            <td className="py-2.5 font-semibold text-gray-800">
                              {prod.name}
                            </td>
                            <td className="py-2.5 text-gray-500 font-sans">
                              {prod.category}
                            </td>
                            <td className="py-2.5 font-mono">
                              R$ {prod.basePrice.toFixed(2)}
                            </td>
                            <td className="py-2.5 text-right flex items-center justify-end gap-1">
                              <button
                                id={`edit-product-setting-${prod.id}`}
                                onClick={() => {
                                  setSelectedProductId(prod.id);
                                  setProductView("edit");
                                  setNewProdName(prod.name);
                                  setNewProdCategory(prod.category);
                                  setNewProdSubcategory(prod.subcategory || "Regular");
                                  setNewProdWeight(prod.weight || "100g");
                                  setNewProdImageUrl(prod.imageUrl || "");
                                  setNewProdBasePrice(prod.basePrice.toString());
                                  setNewProdIsCompetitor(prod.isCompetitor || false);
                                  setNewProdBrand(prod.brand || "Dr. Oetker");
                                  setFormFeedback(null);
                                }}
                                className="text-gray-400 hover:text-[#1A1A1A] p-1.5 rounded transition-colors cursor-pointer"
                                title="Editar produto"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                id={`delete-product-setting-${prod.id}`}
                                onClick={() => {
                                  setDeleteConfirm({
                                    type: "product",
                                    id: prod.id,
                                    name: prod.name,
                                  });
                                }}
                                className="text-gray-400 hover:text-[#D40511] p-1.5 rounded transition-colors cursor-pointer"
                                title="Remover produto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div id="product-native-form" className="space-y-6">
                  <div className="flex items-center justify-between border-b border-[#E0E0E0] pb-4">
                    <button
                      type="button"
                      onClick={() => setProductView("list")}
                      className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-[#1A1A1A] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Voltar ao Portfólio
                    </button>
                    <h3 className="text-base font-bold text-[#1A1A1A]">
                      {productView === "edit" ? "Editar Produto" : "Criar Novo Produto"}
                    </h3>
                    <div className="w-[124px] hidden md:block border-none"></div>
                  </div>

                  {formFeedback && (
                    <div
                      className={`p-4 border ${
                        formFeedback.type === "success"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-red-50 border-red-200 text-red-800"
                      } rounded-xl`}
                    >
                      <p className="text-sm font-bold">{formFeedback.message}</p>
                    </div>
                  )}

                  <form onSubmit={handleProductSubmit} className="space-y-6">
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
                      <div className="space-y-2 md:col-span-2 border-t border-[#E0E0E0] pt-4">
                        <label className="text-xs font-bold text-gray-700 block mb-2 uppercase tracking-wide">
                          Imagem do Produto
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                          {/* Visual Image Preview */}
                          <div className="flex justify-center items-center border border-[#E0E0E0] rounded-xl bg-[#F5F5F5] p-2 aspect-square max-h-32 w-full overflow-hidden">
                            {newProdImageUrl ? (
                              <img
                                src={newProdImageUrl}
                                alt="Pre-visualização"
                                referrerPolicy="no-referrer"
                                className="object-contain h-full w-full"
                              />
                            ) : (
                              <span className="text-[10px] text-gray-400 font-sans text-center">
                                Sem imagem selecionada
                              </span>
                            )}
                          </div>

                          {/* Upload Area / Input */}
                          <div className="md:col-span-2 space-y-3">
                            <div>
                              <p className="text-[11px] font-bold text-gray-500 mb-1">
                                Enviar do Computador (Hospedar no Supabase)
                              </p>
                              <label className="w-full border border-dashed border-[#E0E0E0] rounded-xl p-4 bg-white hover:bg-gray-50 flex flex-col items-center justify-center cursor-pointer transition relative">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700">
                                  {isUploadingProductImage ? (
                                    <>
                                      <Loader2 className="w-4 h-4 text-[#D40511] animate-spin" />
                                      Enviando imagem...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 text-gray-400" />
                                      Escolher foto local
                                    </>
                                  )}
                                </span>
                                <span className="text-[9px] text-gray-400 mt-1">
                                  PNG, JPG, JPEG ou WEBP até 5MB
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingProductImage}
                                  onChange={handleProductImageFileChange}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <div className="relative">
                              <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">
                                Ou insira um link direto de imagem
                              </label>
                              <input
                                type="url"
                                value={newProdImageUrl}
                                onChange={(e) => setNewProdImageUrl(e.target.value)}
                                className="w-full border border-[#E0E0E0] rounded-xl px-3 py-2 text-xs bg-[#F5F5F5] focus:outline-none focus:border-[#D40511]"
                                placeholder="http://... ou https://..."
                              />
                            </div>
                          </div>
                        </div>
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
                        disabled={isUploadingProductImage}
                        className="bg-[#D40511] disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-bold shadow hover:bg-red-700 transition cursor-pointer inline-flex items-center gap-2"
                      >
                        {isUploadingProductImage && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>Salvar Produto</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHAINS MANAGEMENT */}
          {activeTab === "chains" && (
            <div className="space-y-6" id="settings-tab-chains-panel">
              {/* Creator form */}
              <div className="border border-[#E0E0E0] rounded-xl p-4 bg-[#F5F5F5]/50">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  {editingChainId ? `Editar Rede: ${newChainName}` : "Cadastrar Nova Loja / Rede"}
                </h4>
                <form
                  onSubmit={handleCreateChainSubmit}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                  id="add-chain-micro-form"
                >
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Nome da Rede
                    </label>
                    <input
                      id="new-chain-name-input"
                      type="text"
                      placeholder="Ex: Supermercados Extra"
                      value={newChainName}
                      onChange={(e) => setNewChainName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
                      required
                    />
                  </div>

                  {/* Manual / Preset Color Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Cor Identificadora
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChainLogoColor.startsWith("#") ? newChainLogoColor : ""}
                        onChange={(e) => setNewChainLogoColor(e.target.value || "bg-blue-600")}
                        placeholder="#FF0000"
                        className="px-2 py-1.5 border border-[#E0E0E0] rounded-lg text-xs font-mono w-20 uppercase text-center focus:border-[#D40511] focus:outline-none bg-white"
                        title="Hexadecimal da cor predominante"
                      />
                      <div className="flex gap-1">
                        {["bg-blue-600", "bg-emerald-700", "bg-red-500", "bg-amber-600", "bg-purple-600"].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setNewChainLogoColor(preset)}
                            className={`w-4 h-4 rounded-full border transition ${preset} ${
                              newChainLogoColor === preset ? "border-gray-800 scale-110" : "border-transparent"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Upload Area for Chain Logo */}
                  <div className="col-span-full mt-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                      Logotipo da Rede (Formatos: PNG, JPG ou SVG)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Logo Preview */}
                      <div className="flex flex-col items-center justify-center p-3 border border-[#E0E0E0] rounded-xl bg-white min-h-[105px]">
                        {newChainLogoUrl ? (
                          <div className="relative group">
                            <img
                              src={newChainLogoUrl}
                              alt="Logo"
                              className="max-h-[60px] max-w-[125px] object-contain"
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setNewChainLogoUrl("");
                                setNewChainLogoColor("bg-blue-600");
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 text-[8px] hover:bg-red-700 font-bold transition shadow flex items-center justify-center"
                              title="Remover logotipo"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <div
                            style={newChainLogoColor.startsWith("#") ? { backgroundColor: newChainLogoColor } : {}}
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-base shadow-sm ${
                              newChainLogoColor.startsWith("#") ? "" : (newChainLogoColor || "bg-gray-400")
                            }`}
                          >
                            {newChainName ? newChainName.substring(0, 2).toUpperCase() : "RD"}
                          </div>
                        )}
                        <span className="text-[8px] text-gray-400 mt-2 font-mono uppercase tracking-wider text-center">
                          {newChainLogoColor.startsWith("#") ? `COR: ${newChainLogoColor}` : "Iniciais"}
                        </span>
                      </div>

                      {/* Drag & Drop Select Zone */}
                      <div className="md:col-span-3">
                        <div
                          onDragEnter={handleChainLogoDrag}
                          onDragOver={handleChainLogoDrag}
                          onDragLeave={handleChainLogoDrag}
                          onDrop={handleChainLogoDrop}
                          className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition relative bg-white min-h-[105px] ${
                            chainLogoDragActive
                              ? "border-[#D40511] bg-red-50/20"
                              : "border-[#E0E0E0] hover:border-gray-400 hover:bg-gray-50/30"
                          }`}
                        >
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/jpg,image/svg+xml"
                            disabled={isUploadingChainLogo}
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleChainLogoFileChange(e.target.files[0]);
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Upload
                            className={`w-5 h-5 mb-1 ${
                              isUploadingChainLogo ? "text-[#D40511] animate-spin" : "text-gray-400"
                            }`}
                          />
                          <span className="text-[11px] font-bold text-gray-700 text-center">
                            {isUploadingChainLogo
                              ? "Identificando e salvando logo..."
                              : "Arraste ou clique para enviar logotipo"}
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">
                            PNG, JPG, SVG | Cor predominante automática
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {chainFormError && (
                    <div className="col-span-full text-red-700 text-xs mt-1 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>{chainFormError}</span>
                    </div>
                  )}

                  <div className="col-span-full pt-2 flex justify-end gap-2">
                    {editingChainId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingChainId(null);
                          setNewChainName("");
                          setNewChainLogoColor("bg-blue-600");
                          setNewChainLogoUrl("");
                        }}
                        className="px-4 py-2 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold transition border border-gray-350"
                      >
                        Cancelar
                      </button>
                    )}
                    <button
                      id="submit-chain-form-btn"
                      type="submit"
                      disabled={isUploadingChainLogo}
                      className="bg-[#D40511] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {editingChainId ? "Salvar Alterações" : "Adicionar Loja / Rede"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Registered list */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Lojas e Redes Cadastradas
                </h3>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  id="chains-settings-list"
                >
                  {chains.map((chain) => (
                    <div
                      key={chain.id}
                      className="p-4 bg-white border border-[#E0E0E0] rounded-xl flex items-center justify-between shadow-sm hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          style={chain.logoColor?.startsWith("#") ? { backgroundColor: chain.logoColor } : {}}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs overflow-hidden ${
                            chain.logoColor?.startsWith("#") ? "" : (chain.logoColor || "bg-gray-400")
                          }`}
                        >
                          {chain.logoUrl ? (
                            <img
                              src={chain.logoUrl}
                              alt={chain.name}
                              className="w-full h-full object-contain p-1 bg-white"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{chain.name.substring(0, 2).toUpperCase()}</span>
                          )}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#1A1A1A] font-sans">
                            {chain.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{
                                backgroundColor: chain.logoColor?.startsWith("#")
                                  ? chain.logoColor
                                  : chain.logoColor === "bg-blue-600"
                                    ? "#2563eb"
                                    : chain.logoColor === "bg-emerald-700"
                                      ? "#047857"
                                      : chain.logoColor === "bg-red-500"
                                        ? "#ef4444"
                                        : chain.logoColor === "bg-amber-600"
                                          ? "#d97706"
                                          : "#7c3aed",
                              }}
                            />
                            {chain.logoColor?.startsWith("#") ? "Cor Extraída" : "Cor Predefinida"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingChainId(chain.id);
                            setNewChainName(chain.name);
                            setNewChainLogoColor(chain.logoColor || "bg-blue-600");
                            setNewChainLogoUrl(chain.logoUrl || "");
                            document
                              .getElementById("settings-tab-chains-panel")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition cursor-pointer"
                          title="Editar Rede"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`delete-chain-btn-${chain.id}`}
                          onClick={() => {
                            setDeleteConfirm({
                              type: "chain",
                              id: chain.id,
                              name: chain.name,
                            });
                          }}
                          className="text-gray-400 hover:text-[#D40511] p-1 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Remover Rede"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: USER MANAGEMENT */}
          {activeTab === "users" && (
            <div className="space-y-6" id="settings-tab-users-panel">
              {/* Creator Form */}
              <div className="border border-[#E0E0E0] rounded-xl p-4 bg-[#F5F5F5]/50">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                  Cadastrar Novo Auditor / Gestor
                </h4>
                <form
                  onSubmit={handleCreateUserSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end"
                  id="add-user-micro-form"
                >
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Nome Completo
                    </label>
                    <input
                      id="new-user-name-input"
                      type="text"
                      placeholder="Ex: João da Silva"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      E-mail Corporativo
                    </label>
                    <input
                      id="new-user-email-input"
                      type="email"
                      placeholder="joao@oetker.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Nível de Acesso (Perfil)
                    </label>
                    <select
                      id="new-user-role-select"
                      value={newUserRole}
                      onChange={(e) =>
                        setNewUserRole(e.target.value as "gestor" | "vendedor")
                      }
                      className="w-full px-3 py-2 bg-white border border-[#E0E0E0] rounded-lg text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D40511]"
                    >
                      <option value="vendedor">
                        Vendedor / Campo (Somente envia dados)
                      </option>
                      <option value="gestor">
                        Gestor / Administrador (Visualiza tudo)
                      </option>
                    </select>
                  </div>

                  {userFormError && (
                    <div className="col-span-full text-red-700 text-xs mt-1 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      <span>{userFormError}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      id="submit-user-form-btn"
                      type="submit"
                      className="bg-[#D40511] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition"
                    >
                      Adicionar Usuário
                    </button>
                  </div>
                </form>
              </div>

              {/* Registered user cards */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Colaboradores Monitorados
                </h3>
                <div className="space-y-3" id="users-settings-list">
                  {users.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-white border border-[#E0E0E0] rounded-xl flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-red-100 text-[#D40511] flex items-center justify-center font-bold text-xs uppercase">
                          {item.avatarUrl ||
                            item.name.substring(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#1A1A1A] font-sans">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {item.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Profile role badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                            item.role === "gestor"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.role === "gestor" ? "Gestor" : "Vendedor"}
                        </span>

                        <button
                          id={`delete-user-btn-${item.id}`}
                          onClick={() => {
                            setDeleteConfirm({
                              type: "user",
                              id: item.id,
                              name: item.name,
                            });
                          }}
                          className="text-gray-400 hover:text-[#D40511] p-1 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Remover Usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#E0E0E0] animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-red-50 rounded-xl text-[#D40511]">
                <AlertCircle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#1A1A1A] font-sans">
                  Confirmar Exclusão
                </h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Tem certeza que deseja remover permanentemente{" "}
                  <strong className="text-gray-800">
                    "{deleteConfirm.name}"
                  </strong>
                  {deleteConfirm.type === "product"
                    ? " do catálogo? Esta ação também removerá todo o histórico de preços relacionado."
                    : deleteConfirm.type === "chain"
                    ? " do sistema? Todos os relatórios desta rede serão desassociados."
                    : " do sistema?"}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-[#E0E0E0] text-gray-700 bg-white rounded-xl text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    if (deleteConfirm.type === "product") {
                      onDeleteProduct(deleteConfirm.id);
                      triggerSuccessMsg("Produto removido com sucesso.");
                    } else if (deleteConfirm.type === "chain") {
                      onDeleteChain(deleteConfirm.id);
                      triggerSuccessMsg("Rede removida com sucesso.");
                    } else if (deleteConfirm.type === "user") {
                      onDeleteUser(deleteConfirm.id);
                      triggerSuccessMsg("Usuário removido com sucesso.");
                    }
                  } catch (e) {
                    console.error("Erro ao deletar:", e);
                  }
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 bg-[#D40511] text-white rounded-xl text-xs font-bold hover:bg-red-700 transition cursor-pointer"
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
