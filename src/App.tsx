import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Camera,
  FileCheck2,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ShieldAlert,
  Loader2,
} from "lucide-react";

import { AppState, Product, Chain, PriceRecord, User } from "./types";
import { getInitialState, saveStateToLocalStorage } from "./mockData";
import { useSupabaseSync } from "./lib/useSupabaseSync";
import { supabase } from "./lib/supabase";

// import Components
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { Products } from "./components/Products";
import { RegisterPrice } from "./components/RegisterPrice";
import { Audit } from "./components/Audit";
import { Settings } from "./components/Settings";

export default function App() {
  const { isConfigured, fetchAll } = useSupabaseSync();
  const [isInitializing, setIsInitializing] = useState(true);

  // Global app state
  const [state, setState] = useState<AppState>(() => {
    const loaded = getInitialState();
    return loaded;
  });

  useEffect(() => {
    async function loadData() {
      if (isConfigured) {
        try {
          const data = await fetchAll();
          if (data && data.users.length > 0) {
            setState((prev) => ({
              ...prev,
              products: data.products,
              chains: data.chains,
              records: data.records,
              users: data.users,
            }));
          } else if (data && data.users.length === 0) {
            // Seed database with mock data if it's completely empty
            const initialData = getInitialState();

            // Just populate users directly to supabase so they can login
            // Optional: you can seed products and chains here too
            if (initialData.users.length > 0) {
              const usersToInsert = initialData.users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                active: u.active,
                avatar_url: u.avatarUrl,
              }));
              await supabase.from("app_users").insert(usersToInsert);

              // Seed chains
              if (initialData.chains.length > 0) {
                const chainsToInsert = initialData.chains.map((c) => ({
                  id: c.id,
                  name: c.name,
                  logo_color: c.logoColor,
                  active: c.active,
                }));
                await supabase.from("chains").insert(chainsToInsert);
              }

              // Seed products
              if (initialData.products.length > 0) {
                const productsToInsert = initialData.products.map((p) => ({
                  id: p.id,
                  name: p.name,
                  category: p.category,
                  subcategory: p.subcategory,
                  weight: p.weight,
                  image_url: p.imageUrl,
                  active: p.active,
                  base_price: p.basePrice,
                  is_competitor: p.isCompetitor,
                  brand: p.brand,
                }));
                await supabase.from("products").insert(productsToInsert);
              }

              // Refresh after seeding
              const seededData = await fetchAll();
              if (seededData) {
                setState((prev) => ({
                  ...prev,
                  products: seededData.products,
                  chains: seededData.chains,
                  records: seededData.records,
                  users: seededData.users,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Failed to load generic data from Supabase", error);
        }
      }
      setIsInitializing(false);
    }

    loadData();
  }, [isConfigured]);

  // UI Navigation state
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "produtos" | "registrar" | "auditoria" | "settings"
  >("dashboard");
  const [selectedAuditRecordId, setSelectedAuditRecordId] = useState<
    string | null
  >(null);
  const [productPageParams, setProductPageParams] = useState<any>(null);

  // Mobile menu visibility for structural safety
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-backup to localStorage whenever state modifies
  useEffect(() => {
    saveStateToLocalStorage(state);
  }, [state]);

  // Session login
  const handleLoginSuccess = (user: User) => {
    setState((prev) => ({
      ...prev,
      currentUser: user,
    }));
    setActiveTab("dashboard");
  };

  // Session logout
  const handleLogout = () => {
    setState((prev) => ({
      ...prev,
      currentUser: null,
    }));
  };

  // State modification callbacks
  const handleAddProduct = useCallback(
    async (newProduct: Product) => {
      setState((prev) => ({
        ...prev,
        products: [newProduct, ...prev.products],
      }));

      if (isConfigured) {
        const { error } = await supabase.from("products").insert({
          id: newProduct.id,
          name: newProduct.name,
          category: newProduct.category,
          subcategory: newProduct.subcategory,
          weight: newProduct.weight,
          image_url: newProduct.imageUrl,
          active: newProduct.active,
          base_price: newProduct.basePrice,
          is_competitor: newProduct.isCompetitor,
          brand: newProduct.brand,
        });
        if (error) console.error("Error inserting product:", error);
      }
    },
    [isConfigured],
  );

  const handleEditProduct = useCallback(
    async (updatedProduct: Product) => {
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === updatedProduct.id ? updatedProduct : p,
        ),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("products")
          .update({
            name: updatedProduct.name,
            category: updatedProduct.category,
            subcategory: updatedProduct.subcategory,
            weight: updatedProduct.weight,
            image_url: updatedProduct.imageUrl,
            active: updatedProduct.active,
            base_price: updatedProduct.basePrice,
            is_competitor: updatedProduct.isCompetitor,
            brand: updatedProduct.brand,
          })
          .eq("id", updatedProduct.id);
        if (error) console.error("Error updating product:", error);
      }
    },
    [isConfigured],
  );

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      setState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
        // Cascading delete for clean audit historical state
        records: prev.records.filter((r) => r.productId !== productId),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("products")
          .delete()
          .eq("id", productId);
        if (error) console.error("Error deleting product:", error);
      }
    },
    [isConfigured],
  );

  const handleAddChain = useCallback(
    async (newChain: Chain) => {
      setState((prev) => ({
        ...prev,
        chains: [...prev.chains, newChain],
      }));

      if (isConfigured) {
        const { error } = await supabase.from("chains").insert({
          id: newChain.id,
          name: newChain.name,
          logo_color: newChain.logoColor,
          logo_url: newChain.logoUrl,
          active: newChain.active,
        });
        if (error) console.error("Error inserting chain:", error);
      }
    },
    [isConfigured],
  );

  const handleEditChain = useCallback(
    async (updatedChain: Chain) => {
      setState((prev) => ({
        ...prev,
        chains: prev.chains.map((c) => (c.id === updatedChain.id ? updatedChain : c)),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("chains")
          .update({
            name: updatedChain.name,
            logo_color: updatedChain.logoColor,
            logo_url: updatedChain.logoUrl,
            active: updatedChain.active,
          })
          .eq("id", updatedChain.id);
        if (error) console.error("Error updating chain:", error);
      }
    },
    [isConfigured],
  );

  const handleDeleteChain = useCallback(
    async (chainId: string) => {
      setState((prev) => ({
        ...prev,
        chains: prev.chains.filter((c) => c.id !== chainId),
        records: prev.records.filter((r) => r.chainId !== chainId),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("chains")
          .delete()
          .eq("id", chainId);
        if (error) console.error("Error deleting chain:", error);
      }
    },
    [isConfigured],
  );

  const handleAddUser = useCallback(
    async (newUser: User) => {
      setState((prev) => ({
        ...prev,
        users: [...prev.users, newUser],
      }));

      if (isConfigured) {
        const { error } = await supabase.from("app_users").insert({
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          active: newUser.active,
          avatar_url: newUser.avatarUrl,
        });
        if (error) console.error("Error inserting user:", error);
      }
    },
    [isConfigured],
  );

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("app_users")
          .delete()
          .eq("id", userId);
        if (error) console.error("Error deleting user:", error);
      }
    },
    [isConfigured],
  );

  const handleSavePriceRecord = useCallback(
    async (newRecord: PriceRecord) => {
      setState((prev) => ({
        ...prev,
        records: [newRecord, ...prev.records],
      }));

      if (isConfigured) {
        const { error } = await supabase.from("price_records").insert({
          id: newRecord.id,
          product_id: newRecord.productId,
          chain_id: newRecord.chainId,
          price: newRecord.price,
          date: newRecord.date,
          image_url: newRecord.imageUrl,
          notes: newRecord.notes,
          user_name: newRecord.userName,
          user_email: newRecord.userEmail,
        });
        if (error) console.error("Error inserting price record:", error);
      }
    },
    [isConfigured],
  );

  // Quick navigation with deep parameters support (e.g. going directly to view photo)
  const handleNavigate = useCallback((page: string, params?: any) => {
    if (page === "auditoria") {
      setActiveTab("auditoria");
      if (params && params.recordId) {
        setSelectedAuditRecordId(params.recordId);
      } else {
        setSelectedAuditRecordId(null);
      }
    } else if (page === "produtos") {
      setActiveTab("produtos");
      if (params) {
        setProductPageParams(params);
      } else {
        setProductPageParams(null);
      }
    } else if (page === "registrar") {
      setActiveTab("registrar");
    }
  }, []);

  // Guard routing: if no active profile, force Login screen
  if (!state.currentUser) {
    if (isInitializing) {
      return (
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center font-sans">
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-[#D40511] animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium">
              Carregando dados...
            </p>
          </div>
        </div>
      );
    }
    return <Login onLoginSuccess={handleLoginSuccess} users={state.users} />;
  }

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "produtos", label: "Produtos", icon: ShoppingBag },
    { id: "registrar", label: "Registrar Preço", icon: Camera },
    { id: "auditoria", label: "Auditoria", icon: FileCheck2 },
    { id: "settings", label: "Configurações", icon: SettingsIcon },
  ];

  return (
    <div
      className="min-h-screen bg-[#F5F5F5] font-sans antialiased text-[#1A1A1A] flex flex-col lg:flex-row pb-20 lg:pb-0"
      id="app-viewport"
    >
      {/* 1. DESKTOP NAVIGATION SIDEBAR MENU */}
      <aside
        className="hidden lg:flex lg:w-64 bg-white border-r border-[#E0E0E0] flex-col justify-between shrink-0 h-screen sticky top-0"
        id="desktop-sidebar"
      >
        <div>
          {/* Logo Brand Brand Header */}
          <div
            className="p-6 border-b border-[#E0E0E0] flex items-center justify-between"
            id="sidebar-logo-header"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white overflow-hidden flex items-center justify-center border border-gray-100 shrink-0">
                <img
                  src="https://i.imgur.com/TGgcoZg.png"
                  alt="PriceHub Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-md font-extrabold tracking-tight font-sans">
                  <span className="text-[#0F379A]">Price</span><span className="text-[#E91617]">Hub</span>
                </h1>
                <span className="text-[9px] text-gray-400 font-mono tracking-wider block uppercase">
                  MONITORIA DE PREÇOS
                </span>
              </div>
            </div>
            <span className="text-[9px] bg-red-100 text-[#D40511] font-bold px-1.5 py-0.5 rounded uppercase font-sans">
              BETA
            </span>
          </div>

          {/* Navigation Links list */}
          <nav className="p-4 space-y-1.5" id="sidebar-navigation">
            {menuItems.map((item) => {
              const IconComp = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  id={`sidebar-link-${item.id}`}
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setSelectedAuditRecordId(null); // clear sub-routes parameters
                    setProductPageParams(null); // ensure product view is cleaned
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all relative border border-transparent cursor-pointer ${
                    isSelected
                      ? "bg-red-50 text-[#D40511] border-red-100"
                      : "text-gray-500 hover:text-gray-800 hover:bg-[#F5F5F5]"
                  }`}
                >
                  {/* Visual selection left line bar */}
                  {isSelected && (
                    <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#D40511] rounded-r"></span>
                  )}
                  <IconComp
                    className={`w-4 h-4 ${isSelected ? "text-[#D40511]" : "text-gray-400"}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Active User Sidebar Footer and logout */}
        <div className="p-4 border-t border-[#E0E0E0]" id="sidebar-footer">
          <div
            className="flex items-center justify-between p-2 rounded-xl bg-[#F5F5F5] mb-2"
            id="sidebar-user-card"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[#D40511] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 overflow-hidden">
                {state.currentUser.avatarUrl && (state.currentUser.avatarUrl.startsWith("http") || state.currentUser.avatarUrl.startsWith("data:")) ? (
                  <img
                    src={state.currentUser.avatarUrl}
                    alt={state.currentUser.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  state.currentUser.avatarUrl || "JA"
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-mono font-bold text-[#1A1A1A] truncate">
                  {state.currentUser.name}
                </p>
                <p className="text-[10px] text-gray-500 truncate lowercase">
                  {state.currentUser.role === "gestor" ? "Gestor/Administrador" : "Vendedor / Campo"}
                </p>
              </div>
            </div>
          </div>

          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-transparent text-gray-400 hover:text-[#D40511] text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* 2. MOBILE TOP ACTION BAR HEADER (Phone Layout) */}
      <header
        className="lg:hidden bg-white border-b border-[#E0E0E0] px-4 py-3 h-14 flex items-center justify-between sticky top-0 z-40"
        id="mobile-top-header"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-white overflow-hidden flex items-center justify-center border border-gray-100 shrink-0">
            <img
              src="https://i.imgur.com/TGgcoZg.png"
              alt="PriceHub Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-sm font-black leading-none">
              <span className="text-[#0F379A]">Price</span><span className="text-[#E91617]">Hub</span>
            </h1>
            <span className="text-[8px] text-gray-400 uppercase font-mono tracking-wider">
              Dr.Oetker Brasil
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick active profile bubble */}
          <span className="w-7 h-7 rounded-full bg-red-100 text-[#D40511] flex items-center justify-center font-bold text-[10px] uppercase overflow-hidden shrink-0">
            {state.currentUser.avatarUrl && (state.currentUser.avatarUrl.startsWith("http") || state.currentUser.avatarUrl.startsWith("data:")) ? (
              <img
                src={state.currentUser.avatarUrl}
                alt={state.currentUser.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              state.currentUser.avatarUrl || "JA"
            )}
          </span>
          <button
            id="mobile-quick-logout-btn"
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-[#D40511] hover:bg-gray-100 rounded-lg"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3. DYNAMIC WORKING AREA / WRAPPER ZONE */}
      <main
        className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full font-sans"
        id="app-main-content"
      >
        {activeTab === "dashboard" && (
          <Dashboard
            products={state.products}
            chains={state.chains}
            records={state.records}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === "produtos" && (
          <Products
            products={state.products}
            chains={state.chains}
            records={state.records}
            onDeleteProduct={handleDeleteProduct}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            pageParams={productPageParams}
          />
        )}

        {activeTab === "registrar" && (
          <RegisterPrice
            products={state.products}
            chains={state.chains}
            records={state.records}
            onSaveRecord={handleSavePriceRecord}
            currentUser={state.currentUser}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === "auditoria" && (
          <Audit
            records={state.records}
            products={state.products}
            chains={state.chains}
            initialSelectedRecordId={selectedAuditRecordId}
          />
        )}

        {activeTab === "settings" && (
          <Settings
            products={state.products}
            chains={state.chains}
            users={state.users}
            currentUser={state.currentUser}
            onAddProduct={handleAddProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddChain={handleAddChain}
            onDeleteChain={handleDeleteChain}
            onEditChain={handleEditChain}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onEditProduct={handleEditProduct}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      {/* 4. MOBILE BOTTOM TAB NAVIGATION MENU */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E0E0E0] px-2 flex items-center justify-around z-35 shadow-lg"
        id="mobile-bottom-tabs"
      >
        {menuItems.map((item) => {
          const IconComp = item.icon;
          const isSelected = activeTab === item.id;
          return (
            <button
              id={`mobile-link-${item.id}`}
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setSelectedAuditRecordId(null);
                setProductPageParams(null); // ensure product view is cleaned
              }}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer"
            >
              <IconComp
                className={`w-[20px] h-[20px] transition-colors ${isSelected ? "text-[#D40511]" : "text-gray-400"}`}
              />
              <span
                className={`text-[9px] mt-1 font-sans truncate font-medium max-w-[65px] ${isSelected ? "text-[#D40511] font-bold" : "text-gray-400"}`}
              >
                {item.id === "registrar" ? "Registrar" : item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
