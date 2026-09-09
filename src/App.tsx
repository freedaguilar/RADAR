import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
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
import { parsePriceRecordMeta } from "./lib/textUtils";

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
                password: u.password || '123',
              }));
              await supabase.from("app_users").insert(usersToInsert);

              // Seed chains
              if (initialData.chains.length > 0) {
                const chainsToInsert = initialData.chains.map((c) => {
                  const sList = c.states && c.states.length > 0 ? c.states : [c.state || 'Minas Gerais'];
                  return {
                    id: c.id,
                    name: c.name,
                    logo_color: c.logoColor,
                    logo_url: c.logoUrl,
                    active: c.active,
                    state: sList.join(', '),
                  };
                });
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
                  internal_code: p.internalCode || null,
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
  const [registerPageParams, setRegisterPageParams] = useState<any>(null);

  // Mobile menu visibility for structural safety
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-backup to localStorage whenever state modifies
  useEffect(() => {
    saveStateToLocalStorage(state);
  }, [state]);

  // Session login
  const handleLoginSuccess = (user: User) => {
    setState((prev) => {
      const exists = prev.users.some(
        (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
      );
      return {
        ...prev,
        users: exists ? prev.users : [...prev.users, user],
        currentUser: user,
      };
    });
    if (user.isGuest) {
      setActiveTab("registrar");
    } else {
      setActiveTab("dashboard");
    }
  };

  // Session check on load
  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.email) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('app_users')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();
          
          if (profile) {
            setState(prev => ({
              ...prev,
              currentUser: {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                active: profile.active,
                avatarUrl: profile.avatar_url,
              }
            }));
          }
        }
      } catch (err) {
        console.debug("Session check exception caught:", err);
      } finally {
        setIsInitializing(false);
      }
    }
    
    // Only check session if it's the very first load and not already initialized
    if (isInitializing) {
      checkSession();
    }
  }, []);

  // Logout confirmation modal state
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);

  // Session logout execution
  const executeLogout = useCallback(() => {
    setShowLogoutConfirmModal(false);
    // 1. Immediately reset active user in state and localStorage synchronously
    setState((prev) => {
      const updated: AppState = {
        ...prev,
        currentUser: null,
      };
      saveStateToLocalStorage(updated);
      return updated;
    });

    // 2. Clear route and prefill parameters
    setActiveTab("dashboard");
    setSelectedAuditRecordId(null);
    setProductPageParams(null);
    setRegisterPageParams(null);

    // 3. Clear any auth tokens or cached session items
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-") || key.includes("supabase.auth") || key.includes("auth.token")) {
          localStorage.removeItem(key);
        }
      });
    } catch (err) {
      console.debug("Cleanup storage error:", err);
    }

    // 4. Fire-and-forget Supabase signout in background without blocking state
    if (isConfigured) {
      try {
        Promise.race([
          supabase.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]).catch((err) => {
          console.debug("Supabase signOut error:", err);
        });
      } catch (err) {
        console.debug("SignOut call caught:", err);
      }
    }
  }, [isConfigured]);

  // Trigger confirmation modal
  const handleRequestLogout = useCallback(() => {
    setShowLogoutConfirmModal(true);
  }, []);

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
          internal_code: newProduct.internalCode || null,
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
            internal_code: updatedProduct.internalCode || null,
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
        const sList = newChain.states && newChain.states.length > 0 ? newChain.states : [newChain.state || 'Minas Gerais'];
        const { error } = await supabase.from("chains").insert({
          id: newChain.id,
          name: newChain.name,
          logo_color: newChain.logoColor,
          logo_url: newChain.logoUrl,
          active: newChain.active,
          state: sList.join(', '),
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
        const sList = updatedChain.states && updatedChain.states.length > 0 ? updatedChain.states : [updatedChain.state || 'Minas Gerais'];
        const { error } = await supabase
          .from("chains")
          .update({
            name: updatedChain.name,
            logo_color: updatedChain.logoColor,
            logo_url: updatedChain.logoUrl,
            active: updatedChain.active,
            state: sList.join(', '),
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
          password: newUser.password,
        });
        if (error) console.error("Error inserting user:", error);
      }
    },
    [isConfigured],
  );

  const handleUpdateUser = useCallback(
    async (updatedUser: User) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
        currentUser: prev.currentUser?.id === updatedUser.id ? updatedUser : prev.currentUser,
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("app_users")
          .update({
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            active: updatedUser.active,
            avatar_url: updatedUser.avatarUrl,
            password: updatedUser.password,
          })
          .eq("id", updatedUser.id);
        if (error) console.error("Error updating user:", error);
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
          product_id: newRecord.productId || null,
          chain_id: newRecord.chainId,
          price: newRecord.price,
          date: newRecord.date,
          image_url: newRecord.imageUrl,
          notes: newRecord.notes,
          user_name: newRecord.userName,
          user_email: newRecord.userEmail,
          state: newRecord.state || 'Minas Gerais',
        });
        if (error) console.error("Error inserting price record:", error);
      }
    },
    [isConfigured],
  );

  const handleUpdatePriceRecord = useCallback(
    async (updatedRecord: PriceRecord) => {
      setState((prev) => ({
        ...prev,
        records: prev.records.map((r) =>
          r.id === updatedRecord.id ? updatedRecord : r
        ),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("price_records")
          .update({
            product_id: updatedRecord.productId || null,
            chain_id: updatedRecord.chainId,
            price: updatedRecord.price,
            date: updatedRecord.date,
            image_url: updatedRecord.imageUrl,
            notes: updatedRecord.notes,
            user_name: updatedRecord.userName,
            user_email: updatedRecord.userEmail,
            state: updatedRecord.state || 'Minas Gerais',
          })
          .eq("id", updatedRecord.id);
        if (error) console.error("Error updating price record:", error);
      }
    },
    [isConfigured],
  );

  const handleDeletePriceRecord = useCallback(
    async (recordId: string) => {
      setState((prev) => ({
        ...prev,
        records: prev.records.filter((r) => r.id !== recordId),
      }));

      if (isConfigured) {
        const { error } = await supabase
          .from("price_records")
          .delete()
          .eq("id", recordId);
        if (error) console.error("Error deleting price record:", error);
      }
    },
    [isConfigured],
  );

  // Enforce guest tab lock
  useEffect(() => {
    if (state.currentUser?.isGuest && activeTab !== "registrar") {
      setActiveTab("registrar");
    }
  }, [state.currentUser?.isGuest, activeTab]);

  // Quick navigation with deep parameters support (e.g. going directly to view photo)
  const handleNavigate = useCallback(
    (page: string, params?: any) => {
      // For guest users, navigation to dashboard, produtos, auditoria, and settings is blocked
      if (state.currentUser?.isGuest) {
        setActiveTab("registrar");
        if (params) {
          setRegisterPageParams(params);
        } else {
          setRegisterPageParams(null);
        }
        return;
      }

      if (page === "auditoria") {
        if (state.currentUser?.role === "promotor") return;
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
        if (params) {
          setRegisterPageParams(params);
        } else {
          setRegisterPageParams(null);
        }
      } else if (page === "dashboard") {
        setActiveTab("dashboard");
      } else if (page === "configuracoes" || page === "settings") {
        if (state.currentUser?.role === "gestor") {
          setActiveTab("settings");
        }
      }
    },
    [state.currentUser],
  );

  // Pull to refresh pull gesture state hooks & touch engine handlers (mobile/tablet only)
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleRefreshData = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const data = await fetchAll();
      if (data) {
        setState((prev) => ({
          ...prev,
          products: data.products,
          chains: data.chains,
          records: data.records,
          users: data.users,
        }));
      }
    } catch (err) {
      console.error("Erro ao recarregar dados do database via gesture:", err);
    }
  }, [isConfigured, fetchAll]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      // Allow pull gesture only if the view scrolls are totally at the very top (0)
      const isAtTop = e.currentTarget.scrollTop <= 1 && window.scrollY <= 1;
      if (!isAtTop || isRefreshing) {
        setTouchStartY(null);
        return;
      }
      setTouchStartY(e.touches[0].clientY);
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      if (touchStartY === null || isRefreshing) return;

      const isAtTop = e.currentTarget.scrollTop <= 1 && window.scrollY <= 1;
      if (!isAtTop) {
        setTouchStartY(null);
        setIsPulling(false);
        setPullY(0);
        return;
      }

      const currentY = e.touches[0].clientY;
      const diffY = currentY - touchStartY;

      // Handle downward dragging
      if (diffY > 10) {
        setIsPulling(true);
        // Apply responsive damp physical physics limits
        const newPullY = Math.min(diffY * 0.45, 100);
        setPullY(newPullY);

        // Cancel browser native overscroll bouncing/pull reload effects on top
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    },
    [touchStartY, isRefreshing]
  );

  const handleTouchEnd = useCallback(() => {
    if (touchStartY === null || isRefreshing) return;

    if (isPulling && pullY >= 50) {
      setIsRefreshing(true);
      setPullY(50); // locks loading visual position during download

      handleRefreshData().then(() => {
        // Delay to allow complete loading visualization smoothness
        setTimeout(() => {
          setIsRefreshing(false);
          setIsPulling(false);
          setPullY(0);
        }, 1000);
      });
    } else {
      setIsPulling(false);
      setPullY(0);
    }
    setTouchStartY(null);
  }, [touchStartY, isPulling, pullY, isRefreshing, handleRefreshData]);

  const pendingCount = React.useMemo(() => {
    return state.records.filter((r) => {
      const { isPending } = parsePriceRecordMeta(r.notes);
      return !r.productId || isPending;
    }).length;
  }, [state.records]);

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
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        availableUsers={state.users}
      />
    );
  }

  const isGuest = Boolean(state.currentUser?.isGuest);
  const isGestor = state.currentUser?.role === "gestor";

  // Menu items are strictly exclusive to registered managers/gestores (and allowed staff), hidden completely for guests
  const menuItems = isGuest
    ? []
    : [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "produtos", label: "Produtos", icon: ShoppingBag },
        { id: "registrar", label: "Registrar Preço", icon: Camera },
        { id: "auditoria", label: "Auditoria", icon: FileCheck2 },
        { id: "settings", label: "Configurações", icon: SettingsIcon },
      ].filter((item) => {
        if (state.currentUser?.role === "promotor") {
          return item.id !== "auditoria" && item.id !== "settings";
        }
        return true;
      });

  // Modal de Confirmação de Logout
  const renderLogoutConfirmModal = () => (
    <AnimatePresence>
      {showLogoutConfirmModal && (
        <div
          id="logout-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowLogoutConfirmModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.16 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-14 h-14 rounded-2xl bg-red-50 text-[#D40511] flex items-center justify-center border border-red-100 shadow-2xs mb-4">
              <LogOut className="w-7 h-7 shrink-0 -translate-x-0.5" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Deseja sair da conta?
            </h3>

            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mt-2 mb-4">
              {state.currentUser?.isGuest
                ? "Você sairá do modo convidado e precisará entrar novamente para registrar preços."
                : "Sua sessão atual será encerrada. Você precisará fazer login novamente para acessar o sistema."}
            </p>

            {state.currentUser && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl mb-5 text-left">
                <span className="w-9 h-9 rounded-full bg-red-100 text-[#D40511] flex items-center justify-center font-bold text-xs uppercase shrink-0 overflow-hidden">
                  {state.currentUser.avatarUrl &&
                  (state.currentUser.avatarUrl.startsWith("http") ||
                    state.currentUser.avatarUrl.startsWith("data:")) ? (
                    <img
                      src={state.currentUser.avatarUrl}
                      alt={state.currentUser.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    state.currentUser.avatarUrl ||
                    state.currentUser.name.substring(0, 2).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {state.currentUser.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium capitalize truncate">
                    {state.currentUser.isGuest
                      ? "Acesso Convidado"
                      : state.currentUser.role === "gestor"
                      ? "Gestor / Administrador"
                      : state.currentUser.role === "promotor"
                      ? "Promotor"
                      : "Vendedor / Campo"}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                id="btn-confirm-logout"
                onClick={executeLogout}
                className="w-full py-3 px-4 bg-[#D40511] hover:bg-[#b0040e] active:scale-98 text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sim, Sair da Conta</span>
              </button>

              <button
                type="button"
                id="btn-cancel-logout"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center cursor-pointer border border-slate-250"
              >
                Permanecer Conectado
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // =========================================================================
  // GUEST USER LAYOUT (Dedicated, focused view without navigation menus)
  // =========================================================================
  if (isGuest) {
    return (
      <div
        className="min-h-screen bg-[#F5F5F5] font-sans antialiased text-[#1A1A1A] flex flex-col pb-8"
        id="app-viewport-guest"
      >
        {/* Dedicated Guest Top Navigation Bar */}
        <header
          className="bg-white border-b border-[#E0E0E0] px-4 lg:px-8 py-3.5 sticky top-0 z-40 shadow-xs"
          id="guest-top-header"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Brand Logo */}
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
                <h1 className="text-base font-extrabold tracking-tight font-sans leading-none">
                  <span className="text-[#0F379A]">Price</span><span className="text-[#E91617]">Hub</span>
                </h1>
                <span className="text-[9px] text-gray-400 font-mono tracking-wider block uppercase mt-0.5">
                  aquilas.tech
                </span>
              </div>
            </div>

            {/* Guest Identification & Exit Button */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2 bg-amber-50/90 border border-amber-200/90 px-3 py-1.5 rounded-xl">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-[10px] uppercase font-mono shrink-0">
                  {state.currentUser.avatarUrl || "CV"}
                </span>
                <span className="text-xs font-bold text-gray-900 whitespace-nowrap">
                  {state.currentUser.name}
                </span>
              </div>

              <button
                id="guest-logout-btn"
                onClick={handleRequestLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[#D40511] border border-red-200 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs group"
                title="Sair do modo convidado"
              >
                <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden xs:inline sm:inline">Sair</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Guest Working Area (Exclusively Registrar Preço) */}
        <main
          className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full font-sans relative"
          id="app-main-content-guest"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Pull-to-Refresh Gestures Panel Indicator wrapper */}
          <AnimatePresence>
            {(pullY > 0 || isRefreshing) && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ 
                  opacity: 1, 
                  height: isRefreshing ? 52 : Math.max(0, pullY),
                  marginBottom: isRefreshing ? 14 : Math.min(14, pullY / 3.5)
                }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 26 }}
                className="w-full flex items-center justify-center overflow-hidden border border-dashed border-[#D40511]/15 bg-[#D40511]/5 rounded-2xl select-none pointer-events-none"
                id="pull-to-refresh-visual-indicator"
              >
                <div className="flex items-center gap-2.5 py-2">
                  <Loader2 
                    className={`w-5 h-5 text-[#D40511] ${isRefreshing ? "animate-spin" : ""}`}
                    style={{
                      transform: isRefreshing ? undefined : `rotate(${pullY * 6}deg)`,
                    }}
                  />
                  <span className="text-[11px] text-[#D40511] font-bold font-sans tracking-wider uppercase">
                    {isRefreshing ? "Atualizando dados..." : pullY >= 50 ? "Solte para atualizar" : "Puxe para atualizar"}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <RegisterPrice
            products={state.products}
            chains={state.chains}
            records={state.records}
            onSaveRecord={handleSavePriceRecord}
            onUpdateRecord={handleUpdatePriceRecord}
            onDeleteRecord={handleDeletePriceRecord}
            currentUser={state.currentUser}
            onNavigate={handleNavigate}
            pageParams={registerPageParams}
            onLogout={handleRequestLogout}
          />
        </main>

        {renderLogoutConfirmModal()}
      </div>
    );
  }

  // =========================================================================
  // STANDARD LAYOUT FOR MANAGERS & REGISTERED TEAM MEMBERS
  // =========================================================================
  return (
    <div
      className="min-h-screen bg-[#F5F5F5] font-sans antialiased text-[#1A1A1A] flex flex-col lg:flex-row pb-20 lg:pb-0"
      id="app-viewport"
    >
      {/* 1. DESKTOP NAVIGATION SIDEBAR MENU (Exclusivo para Gestores e equipe cadastrada) */}
      <aside
        className="hidden lg:flex lg:w-64 bg-white border-r border-[#E0E0E0] flex-col justify-between shrink-0 h-screen sticky top-0 overflow-hidden"
        id="desktop-sidebar"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Brand Header */}
          <div
            className="p-6 border-b border-[#E0E0E0] flex items-center justify-between shrink-0"
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
                  aquilas.tech
                </span>
              </div>
            </div>
            <span className="text-[9px] bg-red-100 text-[#D40511] font-bold px-1.5 py-0.5 rounded uppercase font-sans">
              BETA
            </span>
          </div>

          {/* Navigation Links list */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5" id="sidebar-navigation">
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
                    setRegisterPageParams(null); // ensure prefill params are reset
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
                  {item.id === "auditoria" && pendingCount > 0 && (
                    <span 
                      id="sidebar-pending-badge"
                      className="ml-auto bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded-full text-[9px] min-w-[16px] h-4 flex items-center justify-center animate-pulse"
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop Active User Sidebar Footer and logout */}
          <div className="p-4 border-t border-[#E0E0E0] shrink-0 bg-white" id="sidebar-footer">
            <div
              className="flex items-center justify-between p-2 rounded-xl bg-[#F5F5F5] mb-2.5"
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
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-mono font-bold text-[#1A1A1A] truncate">
                      {state.currentUser.name}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate lowercase">
                    {state.currentUser.role === "gestor"
                      ? "Gestor/Administrador"
                      : state.currentUser.role === "promotor"
                      ? "Promotor"
                      : "Vendedor / Campo"}
                  </p>
                </div>
              </div>
            </div>

            <button
              id="sidebar-logout-btn"
              onClick={handleRequestLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-[#D40511] border border-red-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs group"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Sair da Conta</span>
            </button>
          </div>
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
              aquilas.tech
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
            onClick={handleRequestLogout}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-[#D40511] border border-red-200 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            title="Sair da Conta"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* 3. DYNAMIC WORKING AREA / WRAPPER ZONE */}
      <main
        className="flex-1 p-4 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full font-sans relative"
        id="app-main-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-Refresh Gestures Panel Indicator wrapper */}
        <AnimatePresence>
          {(pullY > 0 || isRefreshing) && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ 
                opacity: 1, 
                height: isRefreshing ? 52 : Math.max(0, pullY),
                marginBottom: isRefreshing ? 14 : Math.min(14, pullY / 3.5)
              }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="w-full flex items-center justify-center overflow-hidden border border-dashed border-[#D40511]/15 bg-[#D40511]/5 rounded-2xl select-none pointer-events-none"
              id="pull-to-refresh-visual-indicator"
            >
              <div className="flex items-center gap-2.5 py-2">
                <Loader2 
                  className={`w-5 h-5 text-[#D40511] ${isRefreshing ? "animate-spin" : ""}`}
                  style={{
                    transform: isRefreshing ? undefined : `rotate(${pullY * 6}deg)`,
                  }}
                />
                <span className="text-[11px] text-[#D40511] font-bold font-sans tracking-wider uppercase">
                  {isRefreshing ? "Atualizando dados..." : pullY >= 50 ? "Solte para atualizar" : "Puxe para atualizar"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            onDeleteRecord={handleDeletePriceRecord}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            pageParams={productPageParams}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === "registrar" && (
          <RegisterPrice
            products={state.products}
            chains={state.chains}
            records={state.records}
            onSaveRecord={handleSavePriceRecord}
            onUpdateRecord={handleUpdatePriceRecord}
            onDeleteRecord={handleDeletePriceRecord}
            currentUser={state.currentUser}
            onNavigate={handleNavigate}
            pageParams={registerPageParams}
            onLogout={handleRequestLogout}
          />
        )}

        {activeTab === "auditoria" && isGestor && (
          <Audit
            records={state.records}
            products={state.products}
            chains={state.chains}
            initialSelectedRecordId={selectedAuditRecordId}
            onDeleteRecord={handleDeletePriceRecord}
            onUpdateRecord={handleUpdatePriceRecord}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === "settings" && isGestor && (
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
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onEditProduct={handleEditProduct}
            onNavigate={handleNavigate}
            onLogout={handleRequestLogout}
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
                setRegisterPageParams(null); // ensure prefill params are reset
              }}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 text-center cursor-pointer"
            >
              <div className="relative">
                <IconComp
                  className={`w-[20px] h-[20px] transition-colors ${isSelected ? "text-[#D40511]" : "text-gray-400"}`}
                />
                {item.id === "auditoria" && pendingCount > 0 && (
                  <span 
                    id="mobile-pending-badge"
                    className="absolute -top-1.5 -right-1.5 bg-red-600 border border-white text-white font-extrabold text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center animate-pulse"
                  >
                    {pendingCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] mt-1 font-sans truncate font-medium max-w-[65px] ${isSelected ? "text-[#D40511] font-bold" : "text-gray-400"}`}
              >
                {item.id === "registrar" ? "Registrar" : item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {renderLogoutConfirmModal()}
    </div>
  );
}
