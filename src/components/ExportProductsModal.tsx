import React, { useState, useMemo } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  Check,
  Loader2,
  Image as ImageIcon,
  Link2,
  Package,
  Layers,
  Tag,
  Scale,
  RotateCcw,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import ExcelJS from "exceljs";
import { Product } from "../types";

interface ExportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

function getProductBrandGroup(p: Product): "oetker" | "mavalerio" | "concorrente" {
  const bLower = (p.brand || "").toLowerCase().trim();
  const isOetker = bLower.includes("oetker");
  const isMav = bLower.includes("mavalerio") || bLower.includes("mavalério");
  if (!p.isCompetitor && isOetker) return "oetker";
  if (!p.isCompetitor && isMav) return "mavalerio";
  if (p.isCompetitor) return "concorrente";
  if (isOetker) return "oetker";
  if (isMav) return "mavalerio";
  return "concorrente";
}

function isOwnProduct(p: Product): boolean {
  const g = getProductBrandGroup(p);
  return g === "oetker" || g === "mavalerio";
}

// Rasteriza imagem (URL, SVG, WebP, PNG, JPG) em miniatura PNG 96x96 com fundo branco para o Excel
function renderThumbnailBase64(imageUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!imageUrl || typeof imageUrl !== "string") {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";

    const timer = setTimeout(() => {
      resolve(null);
    }, 3500);

    img.onload = () => {
      clearTimeout(timer);
      try {
        const size = 96;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        // Fundo branco limpo
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, size, size);

        // Centralizar mantendo proporção (object-contain) com margem interna de 6px
        const pad = 6;
        const availW = size - pad * 2;
        const availH = size - pad * 2;
        const iw = img.naturalWidth || img.width || size;
        const ih = img.naturalHeight || img.height || size;
        const ratio = Math.min(availW / iw, availH / ih);
        const drawW = iw * ratio;
        const drawH = ih * ratio;
        const dx = (size - drawW) / 2;
        const dy = (size - drawH) / 2;

        ctx.drawImage(img, dx, dy, drawW, drawH);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch {
        // Caso o canvas seja bloqueado por CORS, o backend buscará a URL diretamente via Node fetch
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.src = imageUrl;
  });
}

export function ExportProductsModal({
  isOpen,
  onClose,
  products,
}: ExportProductsModalProps) {
  // 1. Filtro de Origem / Grupo de Marca
  const [selectedBrandGroups, setSelectedBrandGroups] = useState<string[]>([
    "oetker",
    "mavalerio",
    "concorrente",
  ]);

  // 2. Filtro de Marcas Específicas ("Todas" ou lista de marcas)
  const [selectedBrands, setSelectedBrands] = useState<string[]>(["Todas"]);

  // 3. Filtro de Categorias ("Todas" ou lista de categorias)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["Todas"]);

  // 4. Filtro de Subcategorias ("Todas" ou lista de subcategorias)
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(["Todas"]);

  // 5. Filtro de Gramaturas ("Todas" ou lista de gramaturas)
  const [selectedWeights, setSelectedWeights] = useState<string[]>(["Todas"]);

  // 6. Filtro de Status
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");

  // 7. Opção de miniatura da imagem na célula
  const [includeThumbnails, setIncludeThumbnails] = useState<boolean>(true);

  // Estado de geração
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Produtos filtrados por Status + Grupo de Marca
  const productsByGroupAndStatus = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      const g = getProductBrandGroup(p);
      return selectedBrandGroups.includes(g);
    });
  }, [products, statusFilter, selectedBrandGroups]);

  // Marcas disponíveis inteligentemente a partir do Grupo + Status
  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    productsByGroupAndStatus.forEach((p) => {
      const b = (p.brand || "Sem Marca").trim();
      counts.set(b, (counts.get(b) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([name, count]) => ({ name, count }));
  }, [productsByGroupAndStatus]);

  // Produtos filtrados por Marca específica
  const productsAfterBrand = useMemo(() => {
    if (selectedBrands.includes("Todas")) return productsByGroupAndStatus;
    return productsByGroupAndStatus.filter((p) =>
      selectedBrands.includes((p.brand || "Sem Marca").trim())
    );
  }, [productsByGroupAndStatus, selectedBrands]);

  // Categorias disponíveis inteligentemente a partir das Marcas selecionadas
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    productsAfterBrand.forEach((p) => {
      const c = (p.category || "Sem Categoria").trim();
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([name, count]) => ({ name, count }));
  }, [productsAfterBrand]);

  // Produtos filtrados por Categoria
  const productsAfterCategory = useMemo(() => {
    if (selectedCategories.includes("Todas")) return productsAfterBrand;
    return productsAfterBrand.filter((p) =>
      selectedCategories.includes((p.category || "Sem Categoria").trim())
    );
  }, [productsAfterBrand, selectedCategories]);

  // Subcategorias disponíveis inteligentemente a partir das Categorias selecionadas
  const availableSubcategories = useMemo(() => {
    const counts = new Map<string, number>();
    productsAfterCategory.forEach((p) => {
      const s = (p.subcategory || "Regular").trim();
      counts.set(s, (counts.get(s) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([name, count]) => ({ name, count }));
  }, [productsAfterCategory]);

  // Produtos filtrados por Subcategoria
  const productsAfterSubcategory = useMemo(() => {
    if (selectedSubcategories.includes("Todas")) return productsAfterCategory;
    return productsAfterCategory.filter((p) =>
      selectedSubcategories.includes((p.subcategory || "Regular").trim())
    );
  }, [productsAfterCategory, selectedSubcategories]);

  // Gramaturas disponíveis inteligentemente a partir das Subcategorias selecionadas
  const availableWeights = useMemo(() => {
    const counts = new Map<string, number>();
    productsAfterSubcategory.forEach((p) => {
      const w = (p.weight || "N/A").trim();
      counts.set(w, (counts.get(w) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR", { numeric: true }))
      .map(([name, count]) => ({ name, count }));
  }, [productsAfterSubcategory]);

  // Lista final de produtos que serão exportados
  const finalFilteredProducts = useMemo(() => {
    const list = selectedWeights.includes("Todas")
      ? productsAfterSubcategory
      : productsAfterSubcategory.filter((p) =>
          selectedWeights.includes((p.weight || "N/A").trim())
        );

    return [...list].sort((a, b) => {
      const ownA = isOwnProduct(a) ? 0 : 1;
      const ownB = isOwnProduct(b) ? 0 : 1;
      if (ownA !== ownB) return ownA - ownB;
      const catCmp = (a.category || "").localeCompare(b.category || "", "pt-BR");
      if (catCmp !== 0) return catCmp;
      const brandCmp = (a.brand || "").localeCompare(b.brand || "", "pt-BR");
      if (brandCmp !== 0) return brandCmp;
      return (a.name || "").localeCompare(b.name || "", "pt-BR");
    });
  }, [productsAfterSubcategory, selectedWeights]);

  if (!isOpen) return null;

  const toggleMultiOption = (
    value: string,
    currentList: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (value === "Todas") {
      setter(["Todas"]);
      return;
    }
    const withoutAll = currentList.filter((i) => i !== "Todas");
    if (withoutAll.includes(value)) {
      const next = withoutAll.filter((i) => i !== value);
      setter(next.length === 0 ? ["Todas"] : next);
    } else {
      setter([...withoutAll, value]);
    }
  };

  const toggleBrandGroup = (group: string) => {
    if (selectedBrandGroups.includes(group)) {
      if (selectedBrandGroups.length > 1) {
        setSelectedBrandGroups(selectedBrandGroups.filter((g) => g !== group));
      }
    } else {
      setSelectedBrandGroups([...selectedBrandGroups, group]);
    }
  };

  const handleResetFilters = () => {
    setSelectedBrandGroups(["oetker", "mavalerio", "concorrente"]);
    setSelectedBrands(["Todas"]);
    setSelectedCategories(["Todas"]);
    setSelectedSubcategories(["Todas"]);
    setSelectedWeights(["Todas"]);
    setStatusFilter("active");
    setErrorMsg("");
  };

  // Fallback client-side ExcelJS builder caso a API não esteja disponível
  const buildClientSideExcelBuffer = async (
    exportItems: Array<{
      id: string;
      internalCode: string;
      name: string;
      brand: string;
      brandType: string;
      category: string;
      subcategory: string;
      weight: string;
      basePrice: number;
      active: boolean;
      imageUrl: string;
      thumbnailBase64?: string;
    }>
  ) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PriceHub";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Portfólio de Produtos", {
      views: [{ state: "frozen", ySplit: 5 }],
    });

    const columns = [
      { header: "Nº", key: "num", width: 7 },
      { header: "Imagem", key: "image", width: 11 },
      { header: "Cód. Interno", key: "internalCode", width: 15 },
      { header: "Nome do Produto", key: "name", width: 42 },
      { header: "Marca", key: "brand", width: 18 },
      { header: "Origem / Tipo", key: "brandType", width: 17 },
      { header: "Categoria", key: "category", width: 24 },
      { header: "Subcategoria", key: "subcategory", width: 20 },
      { header: "Gramatura", key: "weight", width: 14 },
      { header: "Preço Base (R$)", key: "basePrice", width: 16 },
      { header: "Status", key: "status", width: 12 },
      { header: "Link da Imagem", key: "imageUrl", width: 48 },
    ];

    ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));
    const totalCols = columns.length;

    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = "PORTFÓLIO DE PRODUTOS — PRICEHUB";
    titleCell.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F379A" } };
    titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(1).height = 28;

    ws.mergeCells(2, 1, 2, totalCols);
    const subCell = ws.getCell(2, 1);
    subCell.value = `Gerado em: ${new Date().toLocaleString("pt-BR")}   |   Total Exportado: ${exportItems.length} produto(s)`;
    subCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF334155" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    ws.getRow(2).height = 20;

    const headerRow = ws.getRow(5);
    headerRow.height = 24;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    exportItems.forEach((item, idx) => {
      const rowNumber = 6 + idx;
      const row = ws.getRow(rowNumber);
      row.height = includeThumbnails ? 44 : 22;

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = item.thumbnailBase64 ? "" : "Ver link";
      row.getCell(3).value = item.internalCode || "-";
      row.getCell(4).value = item.name;
      row.getCell(5).value = item.brand;
      row.getCell(6).value = item.brandType;
      row.getCell(7).value = item.category;
      row.getCell(8).value = item.subcategory;
      row.getCell(9).value = item.weight;
      row.getCell(10).value = item.basePrice;
      row.getCell(10).numFmt = '"R$ " #,##0.00';
      row.getCell(11).value = item.active ? "Ativo" : "Inativo";

      if (item.imageUrl && (item.imageUrl.startsWith("http://") || item.imageUrl.startsWith("https://"))) {
        row.getCell(12).value = {
          text: item.imageUrl,
          hyperlink: item.imageUrl,
        };
        row.getCell(12).font = { name: "Arial", size: 8.5, underline: true, color: { argb: "FF2563EB" } };
      } else {
        row.getCell(12).value = item.imageUrl ? "Imagem embutida" : "-";
      }

      if (includeThumbnails && item.thumbnailBase64) {
        const match = item.thumbnailBase64.match(/^data:image\/png;base64,(.+)$/);
        if (match) {
          try {
            const imgId = workbook.addImage({
              base64: match[1],
              extension: "png",
            });
            ws.addImage(imgId, {
              tl: { col: 1.15, row: rowNumber - 1 + 0.1 },
              ext: { width: 48, height: 48 },
              editAs: "oneCell",
            });
          } catch {}
        }
      }
    });

    return await workbook.xlsx.writeBuffer();
  };

  const handleExport = async () => {
    if (finalFilteredProducts.length === 0) {
      setErrorMsg("Nenhum produto corresponde aos filtros selecionados.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg("");
    setProgressText(
      includeThumbnails
        ? `Processando miniaturas (${finalFilteredProducts.length} produtos)...`
        : "Gerando planilha Excel..."
    );

    try {
      // 1. Preparar itens com miniaturas pré-renderizadas no navegador quando possível
      const exportItems = [];
      const batchSize = 8;

      for (let i = 0; i < finalFilteredProducts.length; i += batchSize) {
        const slice = finalFilteredProducts.slice(i, i + batchSize);
        if (includeThumbnails) {
          setProgressText(
            `Preparando fotos dos produtos (${Math.min(i + batchSize, finalFilteredProducts.length)}/${finalFilteredProducts.length})...`
          );
        }

        const thumbs = includeThumbnails
          ? await Promise.all(slice.map((p) => renderThumbnailBase64(p.imageUrl)))
          : new Array(slice.length).fill(null);

        slice.forEach((p, idx) => {
          exportItems.push({
            id: p.id,
            internalCode: p.internalCode && p.internalCode.trim() ? p.internalCode.trim() : "-",
            name: p.name,
            brand: p.brand || (p.isCompetitor ? "Concorrente" : "Dr. Oetker"),
            brandType: isOwnProduct(p) ? "Marca Própria" : "Concorrente",
            category: p.category || "Sem Categoria",
            subcategory: p.subcategory || "Regular",
            weight: p.weight || "-",
            basePrice: Number(p.basePrice) || 0,
            active: p.active,
            imageUrl: p.imageUrl || "",
            thumbnailBase64: thumbs[idx] || undefined,
          });
        });
      }

      setProgressText("Montando tabela formatada no Excel...");

      const payload = {
        products: exportItems,
        includeThumbnails,
        meta: {
          data_geracao: new Date().toLocaleString("pt-BR"),
          marcas: selectedBrands.includes("Todas") ? "Todas" : selectedBrands.join(", "),
          categorias: selectedCategories.includes("Todas") ? "Todas" : selectedCategories.join(", "),
          subcategorias: selectedSubcategories.includes("Todas") ? "Todas" : selectedSubcategories.join(", "),
          gramaturas: selectedWeights.includes("Todas") ? "Todas" : selectedWeights.join(", "),
        },
      };

      let blob: Blob;
      try {
        const res = await fetch("/api/export-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error("Fallback para geração local");
        }
        blob = await res.blob();
      } catch {
        // Fallback client-side direto via ExcelJS caso o servidor não esteja acessível
        const buffer = await buildClientSideExcelBuffer(exportItems);
        blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err: any) {
      console.error("Erro ao exportar produtos:", err);
      setErrorMsg(err?.message || "Não foi possível gerar o arquivo Excel.");
    } finally {
      setIsGenerating(false);
      setProgressText("");
    }
  };

  const countOwnSelected = finalFilteredProducts.filter((p) => isOwnProduct(p)).length;
  const countCompSelected = finalFilteredProducts.length - countOwnSelected;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      id="export-products-modal-backdrop"
      onClick={() => !isGenerating && onClose()}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        id="export-products-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0F379A] to-[#1e40af] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
                Exportar Portfólio de Produtos (Excel)
              </h3>
              <p className="text-[11px] text-blue-100 truncate">
                Selecione os filtros desejados • Planilha organizada com miniatura da foto e link da imagem
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isGenerating}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Bar: Live Preview Summary & Reset */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-mono text-sm font-black flex items-center justify-center shrink-0 border border-emerald-200">
                {finalFilteredProducts.length}
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-800 flex items-center gap-2 flex-wrap">
                  <span>
                    {finalFilteredProducts.length === 1
                      ? "1 produto selecionado para exportação"
                      : `${finalFilteredProducts.length} produtos selecionados para exportação`}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium flex-wrap">
                  <span className="text-emerald-700 font-bold">
                    {countOwnSelected} Marca Própria
                  </span>
                  <span>•</span>
                  <span className="text-amber-700 font-bold">
                    {countCompSelected} Concorrentes
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          </div>

          {/* 1. Origem / Grupo de Marca + Status */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8 space-y-2">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#0F379A]" />
                <span>1. Origem / Tipo de Marca</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "oetker", label: "Dr. Oetker", sub: "Marca Própria" },
                  { id: "mavalerio", label: "Mavalério", sub: "Marca Própria" },
                  { id: "concorrente", label: "Concorrentes", sub: "Adversários" },
                ].map((grp) => {
                  const active = selectedBrandGroups.includes(grp.id);
                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => toggleBrandGroup(grp.id)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                        active
                          ? "bg-blue-50/90 border-[#0F379A] text-[#0F379A] shadow-2xs"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold truncate">{grp.label}</p>
                        <p className="text-[10px] opacity-75 truncate">{grp.sub}</p>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                          active
                            ? "bg-[#0F379A] border-[#0F379A] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-4 space-y-2">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Status do Produto</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {[
                  { id: "active", label: "Ativos" },
                  { id: "all", label: "Todos" },
                  { id: "inactive", label: "Inativos" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id as any)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === st.id
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Filtro de Marcas Específicas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#D40511]" />
                <span>2. Marcas ({availableBrands.length} disponíveis)</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {selectedBrands.includes("Todas")
                  ? "Todas as marcas selecionadas"
                  : `${selectedBrands.length} marca(s) selecionada(s)`}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-slate-50/70 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setSelectedBrands(["Todas"])}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  selectedBrands.includes("Todas")
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Todas</span>
              </button>

              {availableBrands.map((b) => {
                const isSelected =
                  !selectedBrands.includes("Todas") && selectedBrands.includes(b.name);
                return (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => toggleMultiOption(b.name, selectedBrands, setSelectedBrands)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-[#0F379A] text-white border-[#0F379A] shadow-2xs"
                        : selectedBrands.includes("Todas")
                        ? "bg-blue-50/60 text-slate-700 border-blue-200/80 hover:bg-blue-100/60"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>{b.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/70 text-slate-600"
                      }`}
                    >
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Filtro de Categorias */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                <span>3. Categorias ({availableCategories.length} disponíveis)</span>
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                {selectedCategories.includes("Todas")
                  ? "Todas as categorias selecionadas"
                  : `${selectedCategories.length} categoria(s) selecionada(s)`}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-slate-50/70 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setSelectedCategories(["Todas"])}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  selectedCategories.includes("Todas")
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                <span>Todas</span>
              </button>

              {availableCategories.map((cat) => {
                const isSelected =
                  !selectedCategories.includes("Todas") && selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() =>
                      toggleMultiOption(cat.name, selectedCategories, setSelectedCategories)
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-[#0F379A] text-white border-[#0F379A] shadow-2xs"
                        : selectedCategories.includes("Todas")
                        ? "bg-blue-50/60 text-slate-700 border-blue-200/80 hover:bg-blue-100/60"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200/70 text-slate-600"
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Subcategorias & 5. Gramaturas (lado a lado) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subcategorias */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span>4. Subcategorias ({availableSubcategories.length})</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">
                  {selectedSubcategories.includes("Todas")
                    ? "Todas"
                    : `${selectedSubcategories.length} selecionada(s)`}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setSelectedSubcategories(["Todas"])}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedSubcategories.includes("Todas")
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Todas
                </button>
                {availableSubcategories.map((sub) => {
                  const isSelected =
                    !selectedSubcategories.includes("Todas") &&
                    selectedSubcategories.includes(sub.name);
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() =>
                        toggleMultiOption(
                          sub.name,
                          selectedSubcategories,
                          setSelectedSubcategories
                        )
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
                        isSelected
                          ? "bg-[#0F379A] text-white border-[#0F379A]"
                          : selectedSubcategories.includes("Todas")
                          ? "bg-blue-50/60 text-slate-700 border-blue-200/80"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>{sub.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({sub.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gramaturas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-amber-600" />
                  <span>5. Gramatura / Peso ({availableWeights.length})</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">
                  {selectedWeights.includes("Todas")
                    ? "Todas"
                    : `${selectedWeights.length} selecionada(s)`}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-slate-50/70 rounded-2xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setSelectedWeights(["Todas"])}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedWeights.includes("Todas")
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Todas
                </button>
                {availableWeights.map((w) => {
                  const isSelected =
                    !selectedWeights.includes("Todas") && selectedWeights.includes(w.name);
                  return (
                    <button
                      key={w.name}
                      type="button"
                      onClick={() =>
                        toggleMultiOption(w.name, selectedWeights, setSelectedWeights)
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 border ${
                        isSelected
                          ? "bg-[#0F379A] text-white border-[#0F379A]"
                          : selectedWeights.includes("Todas")
                          ? "bg-blue-50/60 text-slate-700 border-blue-200/80"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span>{w.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">({w.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6. Configuração de Imagem e Link no Excel */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-emerald-950 flex items-center gap-2">
                  <span>Miniatura do Produto + Link da Imagem no Excel</span>
                </h4>
                <p className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                  A planilha inclui uma coluna <strong>"Imagem"</strong> com a foto em miniatura dentro da célula e uma coluna <strong>"Link da Imagem"</strong> com a URL direta clicável.
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 rounded-xl border border-emerald-200 shrink-0 self-start sm:self-center">
              <input
                type="checkbox"
                checked={includeThumbnails}
                onChange={(e) => setIncludeThumbnails(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                Embutir miniatura na célula
              </span>
            </label>
          </div>

          {/* Mini Preview Strip */}
          {finalFilteredProducts.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Prévia dos produtos a exportar:</span>
                <span className="flex items-center gap-1 text-blue-600">
                  <Link2 className="w-3 h-3" />
                  Colunas: Nº, Imagem, Cód. Interno, Produto, Marca, Tipo, Categoria, Subcategoria, Gramatura, Preço Base, Status, Link da Imagem
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-2 bg-slate-50 rounded-xl border border-slate-200/70">
                {finalFilteredProducts.slice(0, 12).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0 max-w-[200px]"
                    title={`${p.name} (${p.brand || ""})`}
                  >
                    <img
                      src={p.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 object-contain rounded shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[9px] text-slate-400 truncate">
                        {p.brand} • {p.category}
                      </p>
                    </div>
                  </div>
                ))}
                {finalFilteredProducts.length > 12 && (
                  <span className="text-[11px] font-bold text-slate-500 px-2 shrink-0">
                    +{finalFilteredProducts.length - 12} mais...
                  </span>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium truncate">
            {isGenerating ? (
              <span className="text-[#0F379A] font-bold flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>{progressText || "Gerando arquivo Excel..."}</span>
              </span>
            ) : (
              <span>
                Formato <strong>.xlsx</strong> (2 abas: <em>Portfólio de Produtos</em> + <em>Resumo do Portfólio</em>)
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isGenerating}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              id="confirm-export-products-excel-btn"
              disabled={isGenerating || finalFilteredProducts.length === 0}
              onClick={handleExport}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Exportando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Baixar Excel ({finalFilteredProducts.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
