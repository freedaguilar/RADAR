import ExcelJS from "exceljs";

interface ExportProductItem {
  id: string;
  internalCode: string;
  name: string;
  brand: string;
  brandType: string; // "Marca Própria" | "Concorrente"
  category: string;
  subcategory: string;
  weight: string;
  basePrice: number;
  active: boolean;
  imageUrl: string;
  thumbnailBase64?: string; // Pre-converted data:image/png;base64,... from browser if available
}

function styleCell(
  cell: ExcelJS.Cell,
  options: {
    font?: Partial<ExcelJS.Font>;
    fill?: ExcelJS.Fill;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
    numFmt?: string;
  }
) {
  if (options.font) cell.font = options.font as any;
  if (options.fill) cell.fill = options.fill;
  if (options.alignment) cell.alignment = options.alignment as any;
  if (options.border) cell.border = options.border as any;
  if (options.numFmt) cell.numFmt = options.numFmt;
}

const solidFill = (colorHex: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF" + colorHex.replace("#", "") },
});

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD8DEE9" } },
  left: { style: "thin", color: { argb: "FFD8DEE9" } },
  bottom: { style: "thin", color: { argb: "FFD8DEE9" } },
  right: { style: "thin", color: { argb: "FFD8DEE9" } },
};

async function fetchImageAsBase64(url: string): Promise<{ base64: string; extension: "png" | "jpeg" | "gif" } | null> {
  if (!url || typeof url !== "string") return null;

  // Handle data URLs directly
  const dataMatch = url.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/i);
  if (dataMatch) {
    const rawExt = dataMatch[1].toLowerCase();
    const ext: "png" | "jpeg" | "gif" = rawExt === "jpg" ? "jpeg" : (rawExt as any);
    return { base64: dataMatch[2], extension: ext };
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PriceHubExporter/1.0)",
        Accept: "image/png,image/jpeg,image/gif,image/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    let extension: "png" | "jpeg" | "gif" = "jpeg";
    if (contentType.includes("png")) extension = "png";
    else if (contentType.includes("gif")) extension = "gif";
    else if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpeg";
    else if (url.toLowerCase().includes(".png")) extension = "png";
    else if (url.toLowerCase().includes(".gif")) extension = "gif";

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    if (!base64) return null;
    return { base64, extension };
  } catch {
    return null;
  }
}

export default async function exportProductsHandler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const {
      products = [] as ExportProductItem[],
      includeThumbnails = true,
      meta = {},
    } = req.body || {};

    const items: ExportProductItem[] = Array.isArray(products) ? products : [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PriceHub";
    workbook.created = new Date();
    workbook.modified = new Date();

    // =========================================================================
    // ABA 1: PORTFÓLIO DE PRODUTOS
    // =========================================================================
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

    // Row 1: Main Title Banner
    ws.mergeCells(1, 1, 1, totalCols);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = "PORTFÓLIO DE PRODUTOS — PRICEHUB";
    styleCell(titleCell, {
      font: { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("0F379A"),
      alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    });
    ws.getRow(1).height = 28;

    // Row 2: Subtitle & Filter Summary
    ws.mergeCells(2, 1, 2, totalCols);
    const subCell = ws.getCell(2, 1);
    const dataGeracao = meta.data_geracao || new Date().toLocaleString("pt-BR");
    const filtroMarca = meta.marcas || "Todas";
    const filtroCat = meta.categorias || "Todas";
    const filtroSub = meta.subcategorias || "Todas";
    subCell.value = `Gerado em: ${dataGeracao}   |   Total Exportado: ${items.length} produto(s)   |   Marca: ${filtroMarca}   |   Categoria: ${filtroCat}   |   Subcategoria: ${filtroSub}`;
    styleCell(subCell, {
      font: { name: "Arial", size: 9, italic: true, color: { argb: "FF334155" } },
      fill: solidFill("F1F5F9"),
      alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    });
    ws.getRow(2).height = 20;

    // Row 3: KPI Summary Bar
    const countOwn = items.filter((i) => i.brandType === "Marca Própria").length;
    const countComp = items.length - countOwn;
    const uniqueBrands = new Set(items.map((i) => i.brand).filter(Boolean)).size;
    const uniqueCats = new Set(items.map((i) => i.category).filter(Boolean)).size;

    ws.mergeCells(3, 1, 3, totalCols);
    const kpiCell = ws.getCell(3, 1);
    kpiCell.value = `RESUMO DO PORTFÓLIO:   • Marcas Próprias (Dr. Oetker / Mavalério): ${countOwn}   • Concorrentes: ${countComp}   • Marcas Distintas: ${uniqueBrands}   • Categorias: ${uniqueCats}`;
    styleCell(kpiCell, {
      font: { name: "Arial", size: 9, bold: true, color: { argb: "FF0F379A" } },
      fill: solidFill("E0E7FF"),
      alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    });
    ws.getRow(3).height = 20;

    // Row 4: Blank spacer
    ws.getRow(4).height = 8;

    // Row 5: Table Headers
    const headerRow = ws.getRow(5);
    headerRow.height = 24;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("1E293B"),
        alignment: {
          vertical: "middle",
          horizontal:
            col.key === "name" || col.key === "category" || col.key === "subcategory" || col.key === "imageUrl"
              ? "left"
              : "center",
          wrapText: true,
        },
        border: thinBorder,
      });
    });

    // Pre-fetch images in batches of 8 if thumbnails are enabled
    const resolvedImages: Array<{ base64: string; extension: "png" | "jpeg" | "gif" } | null> = new Array(items.length).fill(null);

    if (includeThumbnails) {
      const batchSize = 8;
      for (let i = 0; i < items.length; i += batchSize) {
        const slice = items.slice(i, i + batchSize);
        const results = await Promise.all(
          slice.map(async (item) => {
            if (item.thumbnailBase64) {
              const parsed = await fetchImageAsBase64(item.thumbnailBase64);
              if (parsed) return parsed;
            }
            if (item.imageUrl) {
              return await fetchImageAsBase64(item.imageUrl);
            }
            return null;
          })
        );
        results.forEach((resImg, idx) => {
          resolvedImages[i + idx] = resImg;
        });
      }
    }

    // Populate Product Rows (starting at row 6)
    items.forEach((item, idx) => {
      const rowNumber = 6 + idx;
      const row = ws.getRow(rowNumber);
      row.height = includeThumbnails ? 44 : 22;

      const isEven = idx % 2 === 1;
      const rowBg = isEven ? "F8FAFC" : "FFFFFF";
      const isOwn = item.brandType === "Marca Própria";

      row.getCell(1).value = idx + 1;
      row.getCell(2).value = resolvedImages[idx] ? "" : "Sem foto";
      row.getCell(3).value = item.internalCode || "-";
      row.getCell(4).value = item.name || "-";
      row.getCell(5).value = item.brand || "-";
      row.getCell(6).value = item.brandType || "-";
      row.getCell(7).value = item.category || "-";
      row.getCell(8).value = item.subcategory || "-";
      row.getCell(9).value = item.weight || "-";
      row.getCell(10).value = typeof item.basePrice === "number" ? item.basePrice : Number(item.basePrice) || 0;
      row.getCell(11).value = item.active ? "Ativo" : "Inativo";

      if (item.imageUrl && (item.imageUrl.startsWith("http://") || item.imageUrl.startsWith("https://"))) {
        row.getCell(12).value = {
          text: item.imageUrl,
          hyperlink: item.imageUrl,
          tooltip: "Clique para abrir a imagem do produto",
        };
      } else {
        row.getCell(12).value = item.imageUrl ? "Imagem em base64 (embutida)" : "-";
      }

      // Style each cell in the row
      for (let c = 1; c <= totalCols; c++) {
        const cell = row.getCell(c);
        const colKey = columns[c - 1].key;

        let font: Partial<ExcelJS.Font> = {
          name: "Arial",
          size: 9,
          color: { argb: "FF1E293B" },
        };
        let fill = solidFill(rowBg);
        let alignment: Partial<ExcelJS.Alignment> = {
          vertical: "middle",
          horizontal: "center",
          wrapText: colKey === "name",
        };
        let numFmt: string | undefined = undefined;

        if (colKey === "name" || colKey === "category" || colKey === "subcategory") {
          alignment.horizontal = "left";
        }
        if (colKey === "name") {
          font = { ...font, bold: true };
        }
        if (colKey === "internalCode") {
          font = { name: "Courier New", size: 9, bold: true, color: { argb: "FF334155" } };
        }
        if (colKey === "brand") {
          font = { ...font, bold: true };
        }
        if (colKey === "brandType") {
          fill = solidFill(isOwn ? "DCFCE7" : "FEF3C7");
          font = {
            name: "Arial",
            size: 8.5,
            bold: true,
            color: { argb: isOwn ? "FF166534" : "FF92400E" },
          };
        }
        if (colKey === "basePrice") {
          alignment.horizontal = "right";
          numFmt = '"R$ " #,##0.00';
        }
        if (colKey === "status") {
          fill = solidFill(item.active ? "ECFDF5" : "FEF2F2");
          font = {
            name: "Arial",
            size: 8.5,
            bold: true,
            color: { argb: item.active ? "FF047857" : "FFB91C1C" },
          };
        }
        if (colKey === "imageUrl") {
          alignment.horizontal = "left";
          if (item.imageUrl && (item.imageUrl.startsWith("http://") || item.imageUrl.startsWith("https://"))) {
            font = {
              name: "Arial",
              size: 8.5,
              underline: true,
              color: { argb: "FF2563EB" },
            };
          } else {
            font = { name: "Arial", size: 8.5, italic: true, color: { argb: "FF64748B" } };
          }
        }
        if (colKey === "image" && !resolvedImages[idx]) {
          font = { name: "Arial", size: 8, italic: true, color: { argb: "FF94A3B8" } };
        }

        styleCell(cell, {
          font,
          fill,
          alignment,
          border: thinBorder,
          numFmt,
        });
      }

      // Embed thumbnail image into Column B (col index 1 in 0-based coordinates)
      const imgData = resolvedImages[idx];
      if (imgData) {
        try {
          const imageId = workbook.addImage({
            base64: imgData.base64,
            extension: imgData.extension,
          });
          ws.addImage(imageId, {
            tl: { col: 1.15, row: rowNumber - 1 + 0.1 },
            ext: { width: 48, height: 48 },
            editAs: "oneCell",
          });
        } catch (imgErr) {
          row.getCell(2).value = "Erro foto";
        }
      }
    });

    if (items.length > 0) {
      ws.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5 + items.length, column: totalCols },
      };
    }

    // =========================================================================
    // ABA 2: RESUMO POR MARCA E CATEGORIA
    // =========================================================================
    const wsSummary = workbook.addWorksheet("Resumo do Portfólio");

    wsSummary.mergeCells("A1:F1");
    const sumTitle = wsSummary.getCell("A1");
    sumTitle.value = "RESUMO ANALÍTICO DO PORTFÓLIO EXPORTADO";
    styleCell(sumTitle, {
      font: { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("0F379A"),
      alignment: { vertical: "middle", horizontal: "left", indent: 1 },
    });
    wsSummary.getRow(1).height = 26;

    // Table 1: By Brand
    wsSummary.getCell("A3").value = "1. DISTRIBUIÇÃO POR MARCA";
    styleCell(wsSummary.getCell("A3"), {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FF0F379A" } },
    });

    const brandHeaders = ["Marca", "Origem / Tipo", "Qtd. Produtos", "% do Total", "Categorias Atendidas"];
    const brandHeaderRow = wsSummary.getRow(4);
    brandHeaderRow.height = 22;
    brandHeaders.forEach((h, i) => {
      const c = brandHeaderRow.getCell(i + 1);
      c.value = h;
      styleCell(c, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("1E293B"),
        alignment: { vertical: "middle", horizontal: i === 0 || i === 4 ? "left" : "center" },
        border: thinBorder,
      });
    });

    const brandStatsMap = new Map<
      string,
      { brandType: string; count: number; categories: Set<string> }
    >();
    items.forEach((it) => {
      const b = it.brand || "Sem Marca";
      if (!brandStatsMap.has(b)) {
        brandStatsMap.set(b, {
          brandType: it.brandType,
          count: 0,
          categories: new Set(),
        });
      }
      const st = brandStatsMap.get(b)!;
      st.count++;
      if (it.category) st.categories.add(it.category);
    });

    let currentSummaryRow = 5;
    Array.from(brandStatsMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([brandName, info], idx) => {
        const r = wsSummary.getRow(currentSummaryRow++);
        r.height = 20;
        const bg = idx % 2 === 1 ? "F8FAFC" : "FFFFFF";
        const pct = items.length > 0 ? info.count / items.length : 0;

        r.getCell(1).value = brandName;
        r.getCell(2).value = info.brandType;
        r.getCell(3).value = info.count;
        r.getCell(4).value = pct;
        r.getCell(5).value = Array.from(info.categories).join(", ");

        for (let c = 1; c <= 5; c++) {
          styleCell(r.getCell(c), {
            font: { name: "Arial", size: 9, bold: c === 1 },
            fill: solidFill(bg),
            alignment: {
              vertical: "middle",
              horizontal: c === 1 || c === 5 ? "left" : "center",
            },
            border: thinBorder,
            numFmt: c === 4 ? "0.0%" : undefined,
          });
        }
      });

    // Table 2: By Category & Subcategory
    currentSummaryRow += 2;
    wsSummary.getCell(currentSummaryRow, 1).value = "2. DISTRIBUIÇÃO POR CATEGORIA E SUBCATEGORIA";
    styleCell(wsSummary.getCell(currentSummaryRow, 1), {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FF0F379A" } },
    });
    currentSummaryRow++;

    const catHeaders = ["Categoria", "Subcategoria", "Marca Própria", "Concorrentes", "Total de Produtos"];
    const catHeaderRow = wsSummary.getRow(currentSummaryRow++);
    catHeaderRow.height = 22;
    catHeaders.forEach((h, i) => {
      const c = catHeaderRow.getCell(i + 1);
      c.value = h;
      styleCell(c, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("1E293B"),
        alignment: { vertical: "middle", horizontal: i <= 1 ? "left" : "center" },
        border: thinBorder,
      });
    });

    const catStatsMap = new Map<
      string,
      { cat: string; sub: string; own: number; comp: number; total: number }
    >();
    items.forEach((it) => {
      const key = `${it.category || "Sem Categoria"}|||${it.subcategory || "Geral"}`;
      if (!catStatsMap.has(key)) {
        catStatsMap.set(key, {
          cat: it.category || "Sem Categoria",
          sub: it.subcategory || "Geral",
          own: 0,
          comp: 0,
          total: 0,
        });
      }
      const st = catStatsMap.get(key)!;
      if (it.brandType === "Marca Própria") st.own++;
      else st.comp++;
      st.total++;
    });

    Array.from(catStatsMap.values())
      .sort((a, b) => a.cat.localeCompare(b.cat, "pt-BR") || a.sub.localeCompare(b.sub, "pt-BR"))
      .forEach((info, idx) => {
        const r = wsSummary.getRow(currentSummaryRow++);
        r.height = 20;
        const bg = idx % 2 === 1 ? "F8FAFC" : "FFFFFF";

        r.getCell(1).value = info.cat;
        r.getCell(2).value = info.sub;
        r.getCell(3).value = info.own;
        r.getCell(4).value = info.comp;
        r.getCell(5).value = info.total;

        for (let c = 1; c <= 5; c++) {
          styleCell(r.getCell(c), {
            font: { name: "Arial", size: 9, bold: c === 1 || c === 5 },
            fill: solidFill(bg),
            alignment: {
              vertical: "middle",
              horizontal: c <= 2 ? "left" : "center",
            },
            border: thinBorder,
          });
        }
      });

    wsSummary.getColumn(1).width = 28;
    wsSummary.getColumn(2).width = 24;
    wsSummary.getColumn(3).width = 18;
    wsSummary.getColumn(4).width = 18;
    wsSummary.getColumn(5).width = 45;

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="portfolio_produtos_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );

    return res.status(200).send(Buffer.from(buffer));
  } catch (err: any) {
    console.error("Erro ao exportar portfólio de produtos:", err);
    return res.status(500).json({
      error: "Falha na geração da planilha de produtos.",
      details: err?.message,
    });
  }
}
