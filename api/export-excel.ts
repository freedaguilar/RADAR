import { IncomingMessage, ServerResponse } from "http";
import ExcelJS from "exceljs";

// Helper to check if a brand type is proprietary
const isPropria = (tipo: string) => {
  if (!tipo) return false;
  const t = tipo.toLowerCase();
  return t.includes("própria") || t.includes("propria") || t.includes("oetker") || t.includes("mavalerio") || t.includes("mavalério");
};

// Helper to style cells cleanly
function styleCell(cell: ExcelJS.Cell, options: {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  alignment?: Partial<ExcelJS.Alignment>;
  border?: Partial<ExcelJS.Borders>;
  numFmt?: string;
}) {
  if (options.font) cell.font = options.font as any;
  if (options.fill) cell.fill = options.fill;
  if (options.alignment) cell.alignment = options.alignment as any;
  if (options.border) cell.border = options.border as any;
  if (options.numFmt) cell.numFmt = options.numFmt;
}

// Solid pattern fill creator helper
const solidFill = (colorHex: string) => ({
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF" + colorHex.replace("#", "") }
});

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD0D0D0" } },
  left: { style: "thin", color: { argb: "FFD0D0D0" } },
  bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
  right: { style: "thin", color: { argb: "FFD0D0D0" } }
};

export default async function handler(req: any, res: any) {
  // CORS configuration
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
    const { rows_audit = [], rows_pivot = [], meta = {} } = req.body;

    // Calculate Summary Stats for Tab 1
    const totalRegistros = rows_audit.length;

    let countPropria = 0;
    let countConcorrente = 0;
    let sumPricePropria = 0;
    let countPricePropria = 0;
    let sumPriceConcorrente = 0;
    let countPriceConcorrente = 0;

    rows_audit.forEach((row: any) => {
      const tipo = row["Tipo de Registro"] || "";
      const priceVal = row["Preço Unitário (R$)"];
      const price = (priceVal !== null && priceVal !== undefined && priceVal !== "") ? Number(priceVal) : null;

      if (isPropria(tipo)) {
        countPropria++;
        if (price !== null && !isNaN(price)) {
          sumPricePropria += price;
          countPricePropria++;
        }
      } else {
        countConcorrente++;
        if (price !== null && !isNaN(price)) {
          sumPriceConcorrente += price;
          countPriceConcorrente++;
        }
      }
    });

    const ticketMedioPropria = countPricePropria > 0 ? sumPricePropria / countPricePropria : 0;
    const ticketMedioConcorrente = countPriceConcorrente > 0 ? sumPriceConcorrente / countPriceConcorrente : 0;

    let itensComPrecoPainel = 0;
    rows_pivot.forEach((row: any) => {
      const avg = row["Preço Médio (R$)"];
      if (avg !== "N/A" && avg !== "-" && avg !== undefined && avg !== null && avg !== "") {
        itensComPrecoPainel++;
      }
    });

    // Sort rows_audit so that records are grouped contiguously by Estado, Categoria, and Produto
    const sortedRowsAudit = [...rows_audit].sort((a: any, b: any) => {
      const stateA = a["Estado"] || "";
      const stateB = b["Estado"] || "";
      const stateCmp = stateA.localeCompare(stateB, "pt-BR");
      if (stateCmp !== 0) return stateCmp;

      const catA = a["Categoria"] || "";
      const catB = b["Categoria"] || "";
      const catCmp = catA.localeCompare(catB, "pt-BR");
      if (catCmp !== 0) return catCmp;

      const brandA = a["Marca"] || "";
      const brandB = b["Marca"] || "";
      const brandCmp = brandA.localeCompare(brandB, "pt-BR");
      if (brandCmp !== 0) return brandCmp;

      const prodA = a["Produto"] || "";
      const prodB = b["Produto"] || "";
      return prodA.localeCompare(prodB, "pt-BR");
    });

    // Group sortedRowsAudit by Category
    const catMap = new Map<string, {
      countPropria: number;
      countConcorrente: number;
      sumPricePropria: number;
      countPricePropria: number;
      sumPriceConcorrente: number;
      countPriceConcorrente: number;
      firstRow: number;
      lastRow: number;
    }>();

    // Group sortedRowsAudit by State
    const stateMap = new Map<string, {
      count: number;
      countPropria: number;
      countConcorrente: number;
      sumPrice: number;
      countPrice: number;
      firstRow: number;
      lastRow: number;
    }>();

    // Group sortedRowsAudit by Chain
    const chainMap = new Map<string, {
      count: number;
      countPropria: number;
      countConcorrente: number;
      sumPrice: number;
      countPrice: number;
      firstRow: number;
      lastRow: number;
    }>();

    // Group sortedRowsAudit by Brand
    const brandMap = new Map<string, {
      count: number;
      isPropria: boolean;
      sumPrice: number;
      countPrice: number;
      firstRow: number;
      lastRow: number;
    }>();

    sortedRowsAudit.forEach((row: any, index: number) => {
      const rowNum = 5 + index;
      const cat = row["Categoria"] || "N/A";
      const state = row["Estado"] || "Minas Gerais";
      const chain = row["Rede (PDV)"] || "N/A";
      const brand = row["Marca"] || "N/A";
      const priceVal = row["Preço Unitário (R$)"];
      const price = (priceVal !== null && priceVal !== undefined && priceVal !== "") ? Number(priceVal) : null;
      const tipo = row["Tipo de Registro"] || "";
      const isProp = isPropria(tipo);

      // Category map
      if (!catMap.has(cat)) {
        catMap.set(cat, {
          countPropria: 0,
          countConcorrente: 0,
          sumPricePropria: 0,
          countPricePropria: 0,
          sumPriceConcorrente: 0,
          countPriceConcorrente: 0,
          firstRow: rowNum,
          lastRow: rowNum,
        });
      }
      const catStats = catMap.get(cat)!;
      catStats.lastRow = rowNum;
      if (isProp) {
        catStats.countPropria++;
        if (price !== null && !isNaN(price)) {
          catStats.sumPricePropria += price;
          catStats.countPricePropria++;
        }
      } else {
        catStats.countConcorrente++;
        if (price !== null && !isNaN(price)) {
          catStats.sumPriceConcorrente += price;
          catStats.countPriceConcorrente++;
        }
      }

      // State map
      if (!stateMap.has(state)) {
        stateMap.set(state, {
          count: 0,
          countPropria: 0,
          countConcorrente: 0,
          sumPrice: 0,
          countPrice: 0,
          firstRow: rowNum,
          lastRow: rowNum,
        });
      }
      const stateStats = stateMap.get(state)!;
      stateStats.count++;
      stateStats.lastRow = rowNum;
      if (isProp) {
        stateStats.countPropria++;
      } else {
        stateStats.countConcorrente++;
      }
      if (price !== null && !isNaN(price)) {
        stateStats.sumPrice += price;
        stateStats.countPrice++;
      }

      // Chain map
      if (!chainMap.has(chain)) {
        chainMap.set(chain, {
          count: 0,
          countPropria: 0,
          countConcorrente: 0,
          sumPrice: 0,
          countPrice: 0,
          firstRow: rowNum,
          lastRow: rowNum,
        });
      }
      const chainStats = chainMap.get(chain)!;
      chainStats.count++;
      chainStats.lastRow = rowNum;
      if (isProp) {
        chainStats.countPropria++;
      } else {
        chainStats.countConcorrente++;
      }
      if (price !== null && !isNaN(price)) {
        chainStats.sumPrice += price;
        chainStats.countPrice++;
      }

      // Brand map
      if (!brandMap.has(brand)) {
        brandMap.set(brand, {
          count: 0,
          isPropria: isProp,
          sumPrice: 0,
          countPrice: 0,
          firstRow: rowNum,
          lastRow: rowNum,
        });
      }
      const brandStats = brandMap.get(brand)!;
      brandStats.count++;
      brandStats.lastRow = rowNum;
      if (price !== null && !isNaN(price)) {
        brandStats.sumPrice += price;
        brandStats.countPrice++;
      }
    });

    const sortedCategories = Array.from(catMap.entries()).map(([cat, stats]) => {
      const avgPropria = stats.countPricePropria > 0 ? stats.sumPricePropria / stats.countPricePropria : null;
      const avgConcorrente = stats.countPriceConcorrente > 0 ? stats.sumPriceConcorrente / stats.countPriceConcorrente : null;
      return {
        category: cat,
        countPropria: stats.countPropria,
        countConcorrente: stats.countConcorrente,
        avgPropria,
        avgConcorrente,
        firstRow: stats.firstRow,
        lastRow: stats.lastRow,
      };
    }).sort((a, b) => a.category.localeCompare(b.category));

    const sortedStates = Array.from(stateMap.entries()).map(([stateName, stats]) => {
      const avgPrice = stats.countPrice > 0 ? stats.sumPrice / stats.countPrice : null;
      return {
        name: stateName,
        count: stats.count,
        countPropria: stats.countPropria,
        countConcorrente: stats.countConcorrente,
        avgPrice,
        firstRow: stats.firstRow,
        lastRow: stats.lastRow,
      };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const sortedChains = Array.from(chainMap.entries()).map(([chainName, stats]) => {
      const avgPrice = stats.countPrice > 0 ? stats.sumPrice / stats.countPrice : null;
      return {
        name: chainName,
        count: stats.count,
        countPropria: stats.countPropria,
        countConcorrente: stats.countConcorrente,
        avgPrice,
        firstRow: stats.firstRow,
        lastRow: stats.lastRow,
      };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const sortedBrands = Array.from(brandMap.entries()).map(([brandName, stats]) => {
      const avgPrice = stats.countPrice > 0 ? stats.sumPrice / stats.countPrice : null;
      return {
        name: brandName,
        isPropria: stats.isPropria,
        count: stats.count,
        avgPrice,
        firstRow: stats.firstRow,
        lastRow: stats.lastRow,
      };
    }).sort((a, b) => (b.isPropria ? 1 : 0) - (a.isPropria ? 1 : 0) || b.count - a.count || a.name.localeCompare(b.name));

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PriceHub";

    // ---------------------------------------------------------
    // ABA 1 — "📊 Dashboard" (Dashboard Executivo e Interativo)
    // ---------------------------------------------------------
    const wsDashboard = workbook.addWorksheet("📊 Dashboard", {
      views: [{ state: "frozen", ySplit: 3 }],
      properties: { tabColor: { argb: "FF1C2B4A" } }
    });

    wsDashboard.columns = [
      { width: 28 }, // A: Nome
      { width: 16 }, // B: Total / Qtd Própria
      { width: 16 }, // C: Concorrente
      { width: 20 }, // D: Preço Médio Própria / Médio
      { width: 22 }, // E: Preço Médio Concorrente
      { width: 32 }, // F: Link de Navegação / Ação
      { width: 5 }   // G: Margem
    ];

    // Row 1: Título principal do Dashboard
    wsDashboard.mergeCells("A1:F1");
    const r1 = wsDashboard.getCell("A1");
    r1.value = "DASHBOARD EXECUTIVO DE PREÇOS — DR. OETKER / MAVALÉRIO";
    wsDashboard.getRow(1).height = 32;
    styleCell(r1, {
      font: { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 2: Subtítulo de metadados
    wsDashboard.mergeCells("A2:F2");
    const r2 = wsDashboard.getCell("A2");
    const estadosTextResumo = meta.estados_selecionados && meta.estados_selecionados !== "Todos" ? `Estados: ${meta.estados_selecionados}` : "Estados: Todos";
    r2.value = `Gerado em: ${meta.data_geracao || ""}  •  ${estadosTextResumo}  •  Redes: ${meta.redes_selecionadas || ""}  •  Categorias: ${meta.categorias_selecionadas || ""}`;
    wsDashboard.getRow(2).height = 18;
    styleCell(r2, {
      font: { name: "Arial", size: 9, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#D40511"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 3: Barra de Acesso Rápido às Tabelas
    wsDashboard.getRow(3).height = 24;
    wsDashboard.mergeCells("A3:C3");
    const navBtn1 = wsDashboard.getCell("A3");
    navBtn1.value = {
      text: "📋 IR PARA TABELA COMPLETA DE REGISTROS ➜",
      hyperlink: "#'📋 Registros'!A4",
      tooltip: "Clique para visualizar todos os registros detalhados"
    };
    for (let c = 1; c <= 3; c++) {
      const cell = wsDashboard.getCell(3, c);
      cell.fill = solidFill("#EBF0FA");
      cell.border = thinBorder;
    }
    styleCell(navBtn1, {
      font: { name: "Arial", size: 9, bold: true, color: { argb: "FF004085" }, underline: true },
      alignment: { vertical: "middle", horizontal: "center" }
    });

    wsDashboard.mergeCells("D3:F3");
    const navBtn2 = wsDashboard.getCell("D3");
    navBtn2.value = {
      text: "🔍 IR PARA PAINEL COMPARATIVO DE PREÇOS ➜",
      hyperlink: "#'🔍 Painel Comparativo'!A4",
      tooltip: "Clique para visualizar a matriz comparativa lado a lado"
    };
    for (let c = 4; c <= 6; c++) {
      const cell = wsDashboard.getCell(3, c);
      cell.fill = solidFill("#D6F0E0");
      cell.border = thinBorder;
    }
    styleCell(navBtn2, {
      font: { name: "Arial", size: 9, bold: true, color: { argb: "FF1E6B3C" }, underline: true },
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 4: Espaço vazio
    wsDashboard.getRow(4).height = 6;

    // Row 5-8: Bloco de KPIs (6 cards nas colunas A-F)
    const kpis = [
      { label: "Total de Registros", value: totalRegistros, isCurrency: false, link: "#'📋 Registros'!A4" },
      { label: "Marca Própria", value: countPropria, isCurrency: false },
      { label: "Concorrentes", value: countConcorrente, isCurrency: false },
      { label: "Itens no Painel", value: itensComPrecoPainel, isCurrency: false, link: "#'🔍 Painel Comparativo'!A4" },
      { label: "Ticket Médio Própria", value: ticketMedioPropria, isCurrency: true },
      { label: "Ticket Médio Concorrente", value: ticketMedioConcorrente, isCurrency: true }
    ];

    wsDashboard.getRow(5).height = 14;
    wsDashboard.getRow(6).height = 14;
    wsDashboard.getRow(7).height = 18;
    wsDashboard.getRow(8).height = 18;

    kpis.forEach((kpi, index) => {
      const colLetter = String.fromCharCode(65 + index); // A, B, C, D, E, F

      // Merge rows 5 & 6 for label
      wsDashboard.mergeCells(`${colLetter}5:${colLetter}6`);
      const cellLabel = wsDashboard.getCell(`${colLetter}5`);
      cellLabel.value = kpi.label;

      // Merge rows 7 & 8 for value
      wsDashboard.mergeCells(`${colLetter}7:${colLetter}8`);
      const cellValue = wsDashboard.getCell(`${colLetter}7`);
      
      if (kpi.link) {
        cellValue.value = {
          text: String(kpi.value),
          hyperlink: kpi.link,
          tooltip: "Clique para visualizar e selecionar todos os registros"
        };
      } else {
        cellValue.value = kpi.value;
      }

      // Background and borders
      for (let r = 5; r <= 8; r++) {
        const c = wsDashboard.getCell(`${colLetter}${r}`);
        c.fill = solidFill("#F2F2F2");
        c.border = thinBorder;
      }

      styleCell(cellLabel, {
        font: { name: "Arial", size: 9, color: { argb: "FF737373" } },
        alignment: { vertical: "middle", horizontal: "center", wrapText: true }
      });

      styleCell(cellValue, {
        font: { name: "Arial", size: 14, bold: true, color: { argb: kpi.link ? "FF004085" : "FF1C2B4A" }, underline: !!kpi.link },
        alignment: { vertical: "middle", horizontal: "center" },
        numFmt: kpi.isCurrency ? '"R$ " #,##0.00' : undefined
      });
    });

    let currentRow = 9;

    // ---------------------------------------------------------
    // SEÇÃO 1: PANORAMA E NAVEGAÇÃO POR ESTADO
    // ---------------------------------------------------------
    currentRow++; // 10
    wsDashboard.getRow(currentRow).height = 8; // Blank gap

    currentRow++; // 11
    wsDashboard.mergeCells(`A${currentRow}:F${currentRow}`);
    const rStateTitle = wsDashboard.getCell(`A${currentRow}`);
    rStateTitle.value = "📍 PANORAMA POR ESTADO";
    wsDashboard.getRow(currentRow).height = 20;
    styleCell(rStateTitle, {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });
    for (let c = 1; c <= 6; c++) {
      const cell = wsDashboard.getCell(currentRow, c);
      cell.fill = solidFill("#1C2B4A");
      cell.border = thinBorder;
    }

    currentRow++; // 12
    const headersState = ["Estado / Região", "Total Registros", "Marca Própria", "Concorrentes", "Preço Médio (R$)", "Acesso Rápido"];
    wsDashboard.getRow(currentRow).height = 16;
    headersState.forEach((h, idx) => {
      const cell = wsDashboard.getCell(currentRow, idx + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    sortedStates.forEach((st, idx) => {
      currentRow++;
      const r = wsDashboard.getRow(currentRow);
      r.height = 16;
      const isPar = idx % 2 === 1;
      const bgHex = isPar ? "#EBF0FA" : "#FFFFFF";

      r.getCell(1).value = st.name;
      r.getCell(2).value = st.count;
      r.getCell(3).value = st.countPropria;
      r.getCell(4).value = st.countConcorrente;
      r.getCell(5).value = st.avgPrice !== null ? st.avgPrice : "-";
      
      const linkCell = r.getCell(6);
      const targetRange = `#'📋 Registros'!C${st.firstRow}`;
      linkCell.value = {
        text: `🔗 Ver ${st.name} (${st.count}) ➜`,
        hyperlink: targetRange,
        tooltip: `Ir para a coluna Estado (linha ${st.firstRow}) na aba Registros`
      };

      for (let c = 1; c <= 6; c++) {
        const cell = r.getCell(c);
        const isLink = c === 6;
        styleCell(cell, {
          font: {
            name: "Arial",
            size: 9,
            bold: isLink || c === 1,
            color: { argb: isLink ? "FF004085" : "FF000000" },
            underline: isLink
          },
          fill: solidFill(isLink ? "#EBF0FA" : bgHex),
          border: thinBorder,
          alignment: {
            vertical: "middle",
            horizontal: c === 1 ? "left" : "center"
          },
          numFmt: c === 5 && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
        });
      }
    });

    // ---------------------------------------------------------
    // SEÇÃO 2: RESUMO E NAVEGAÇÃO POR CATEGORIA
    // ---------------------------------------------------------
    currentRow++;
    wsDashboard.getRow(currentRow).height = 10; // Blank gap

    currentRow++;
    wsDashboard.mergeCells(`A${currentRow}:F${currentRow}`);
    const rCatTitle = wsDashboard.getCell(`A${currentRow}`);
    rCatTitle.value = "📂 RESUMO POR CATEGORIA";
    wsDashboard.getRow(currentRow).height = 20;
    styleCell(rCatTitle, {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });
    for (let c = 1; c <= 6; c++) {
      const cell = wsDashboard.getCell(currentRow, c);
      cell.fill = solidFill("#1C2B4A");
      cell.border = thinBorder;
    }

    currentRow++;
    const headersCat = ["Categoria", "Qtd Própria", "Qtd Concorrente", "Preço Médio Própria", "Preço Médio Concorrente", "Acesso Rápido"];
    wsDashboard.getRow(currentRow).height = 16;
    headersCat.forEach((h, idx) => {
      const cell = wsDashboard.getCell(currentRow, idx + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    sortedCategories.forEach((catInfo, idx) => {
      currentRow++;
      const r = wsDashboard.getRow(currentRow);
      r.height = 16;
      const isPar = idx % 2 === 1;
      const bgHex = isPar ? "#EBF0FA" : "#FFFFFF";
      const totalCat = catInfo.countPropria + catInfo.countConcorrente;

      r.getCell(1).value = catInfo.category;
      r.getCell(2).value = catInfo.countPropria;
      r.getCell(3).value = catInfo.countConcorrente;
      r.getCell(4).value = catInfo.avgPropria !== null ? catInfo.avgPropria : "-";
      r.getCell(5).value = catInfo.avgConcorrente !== null ? catInfo.avgConcorrente : "-";

      const linkCell = r.getCell(6);
      const targetRange = `#'📋 Registros'!H${catInfo.firstRow}`;
      linkCell.value = {
        text: `🔗 Ir para ${catInfo.category} (${totalCat}) ➜`,
        hyperlink: targetRange,
        tooltip: `Ir para a coluna Categoria (linha ${catInfo.firstRow}) na aba Registros`
      };

      for (let c = 1; c <= 6; c++) {
        const cell = r.getCell(c);
        const isLink = c === 6;
        styleCell(cell, {
          font: {
            name: "Arial",
            size: 9,
            bold: isLink || c === 1,
            color: { argb: isLink ? "FF004085" : "FF000000" },
            underline: isLink
          },
          fill: solidFill(isLink ? "#EBF0FA" : bgHex),
          border: thinBorder,
          alignment: {
            vertical: "middle",
            horizontal: c === 1 ? "left" : "center"
          },
          numFmt: (c === 4 || c === 5) && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
        });
      }
    });

    // ---------------------------------------------------------
    // SEÇÃO 3: PANORAMA POR REDE (PDV)
    // ---------------------------------------------------------
    currentRow++;
    wsDashboard.getRow(currentRow).height = 10; // Blank gap

    currentRow++;
    wsDashboard.mergeCells(`A${currentRow}:F${currentRow}`);
    const rChainTitle = wsDashboard.getCell(`A${currentRow}`);
    rChainTitle.value = "🏪 PANORAMA POR REDE / PDV";
    wsDashboard.getRow(currentRow).height = 20;
    styleCell(rChainTitle, {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });
    for (let c = 1; c <= 6; c++) {
      const cell = wsDashboard.getCell(currentRow, c);
      cell.fill = solidFill("#1C2B4A");
      cell.border = thinBorder;
    }

    currentRow++;
    const headersChain = ["Rede (PDV)", "Total Registros", "Marca Própria", "Concorrentes", "Preço Médio Coletado", "Acesso Rápido"];
    wsDashboard.getRow(currentRow).height = 16;
    headersChain.forEach((h, idx) => {
      const cell = wsDashboard.getCell(currentRow, idx + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    sortedChains.forEach((ch, idx) => {
      currentRow++;
      const r = wsDashboard.getRow(currentRow);
      r.height = 16;
      const isPar = idx % 2 === 1;
      const bgHex = isPar ? "#EBF0FA" : "#FFFFFF";

      r.getCell(1).value = ch.name;
      r.getCell(2).value = ch.count;
      r.getCell(3).value = ch.countPropria;
      r.getCell(4).value = ch.countConcorrente;
      r.getCell(5).value = ch.avgPrice !== null ? ch.avgPrice : "-";

      const linkCell = r.getCell(6);
      const targetRange = `#'📋 Registros'!D${ch.firstRow}`;
      linkCell.value = {
        text: `🔗 Ir para ${ch.name} (${ch.count}) ➜`,
        hyperlink: targetRange,
        tooltip: `Ir para a coluna Rede (PDV) (linha ${ch.firstRow}) na aba Registros`
      };

      for (let c = 1; c <= 6; c++) {
        const cell = r.getCell(c);
        const isLink = c === 6;
        styleCell(cell, {
          font: {
            name: "Arial",
            size: 9,
            bold: isLink || c === 1,
            color: { argb: isLink ? "FF004085" : "FF000000" },
            underline: isLink
          },
          fill: solidFill(isLink ? "#EBF0FA" : bgHex),
          border: thinBorder,
          alignment: {
            vertical: "middle",
            horizontal: c === 1 ? "left" : "center"
          },
          numFmt: c === 5 && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
        });
      }
    });

    // ---------------------------------------------------------
    // SEÇÃO 4: DISTRIBUIÇÃO POR MARCA
    // ---------------------------------------------------------
    currentRow++;
    wsDashboard.getRow(currentRow).height = 10; // Blank gap

    currentRow++;
    wsDashboard.mergeCells(`A${currentRow}:F${currentRow}`);
    const rBrandTitle = wsDashboard.getCell(`A${currentRow}`);
    rBrandTitle.value = "🏷️ DISTRIBUIÇÃO POR MARCA";
    wsDashboard.getRow(currentRow).height = 20;
    styleCell(rBrandTitle, {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });
    for (let c = 1; c <= 6; c++) {
      const cell = wsDashboard.getCell(currentRow, c);
      cell.fill = solidFill("#1C2B4A");
      cell.border = thinBorder;
    }

    currentRow++;
    const headersBrand = ["Marca", "Tipo", "Total Registros", "Preço Médio Coletado", "Representatividade", "Acesso Rápido"];
    wsDashboard.getRow(currentRow).height = 16;
    headersBrand.forEach((h, idx) => {
      const cell = wsDashboard.getCell(currentRow, idx + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    sortedBrands.forEach((br, idx) => {
      currentRow++;
      const r = wsDashboard.getRow(currentRow);
      r.height = 16;
      const isPar = idx % 2 === 1;
      const bgHex = isPar ? "#EBF0FA" : "#FFFFFF";
      const share = totalRegistros > 0 ? (br.count / totalRegistros) * 100 : 0;

      r.getCell(1).value = br.name;
      r.getCell(2).value = br.isPropria ? "Marca Própria" : "Concorrente";
      r.getCell(3).value = br.count;
      r.getCell(4).value = br.avgPrice !== null ? br.avgPrice : "-";
      r.getCell(5).value = `${share.toFixed(1)}%`;

      const linkCell = r.getCell(6);
      const targetRange = `#'📋 Registros'!G${br.firstRow}`;
      linkCell.value = {
        text: `🔗 Ir para ${br.name} (${br.count}) ➜`,
        hyperlink: targetRange,
        tooltip: `Ir para a coluna Marca (linha ${br.firstRow}) na aba Registros`
      };

      for (let c = 1; c <= 6; c++) {
        const cell = r.getCell(c);
        const isLink = c === 6;
        styleCell(cell, {
          font: {
            name: "Arial",
            size: 9,
            bold: isLink || c === 1 || (c === 2 && br.isPropria),
            color: { argb: isLink ? "FF004085" : (c === 2 && br.isPropria ? "FF1E6B3C" : "FF000000") },
            underline: isLink
          },
          fill: solidFill(isLink ? "#EBF0FA" : bgHex),
          border: thinBorder,
          alignment: {
            vertical: "middle",
            horizontal: c === 1 ? "left" : "center"
          },
          numFmt: c === 4 && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
        });
      }
    });


    // ---------------------------------------------------------
    // ABA 2 — "📋 Registros"
    // ---------------------------------------------------------
    const wsRegistros = workbook.addWorksheet("📋 Registros", {
      views: [{ state: "frozen", ySplit: 4 }],
      properties: { tabColor: { argb: "FFD40511" } }
    });

    wsRegistros.columns = [
      { width: 5 },   // Nº
      { width: 12 },  // Data
      { width: 16 },  // Estado
      { width: 16 },  // Rede
      { width: 14 },  // Código
      { width: 50 },  // Produto
      { width: 14 },  // Marca
      { width: 14 },  // Categoria
      { width: 16 },  // Subcategoria
      { width: 11 },  // Gramatura
      { width: 13 },  // Preço (R$)
      { width: 14 }   // Tipo
    ];

    // Row 1: Título
    wsRegistros.mergeCells("A1:L1");
    const rReg1 = wsRegistros.getCell("A1");
    const redeTextReg = meta.redes_selecionadas && meta.redes_selecionadas !== "Todas" ? meta.redes_selecionadas : "Todas as Redes";
    const estadoTextReg = meta.estados_selecionados && meta.estados_selecionados !== "Todos" ? ` (${meta.estados_selecionados})` : "";
    rReg1.value = `REGISTROS DE PREÇOS — ${redeTextReg}${estadoTextReg} (último registro por item)`;
    wsRegistros.getRow(1).height = 28;
    styleCell(rReg1, {
      font: { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 2: Subtítulo e Botão de Retorno ao Dashboard
    wsRegistros.mergeCells("A2:J2");
    const rReg2 = wsRegistros.getCell("A2");
    const estadosTxtReg = meta.estados_selecionados && meta.estados_selecionados !== "Todos" ? `  •  Estados: ${meta.estados_selecionados}` : "  •  Estados: Todos";
    rReg2.value = `Gerado em: ${meta.data_geracao || ""}${estadosTxtReg}`;
    wsRegistros.getRow(2).height = 18;
    styleCell(rReg2, {
      font: { name: "Arial", size: 9, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#D40511"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    wsRegistros.mergeCells("K2:L2");
    const backBtnReg = wsRegistros.getCell("K2");
    backBtnReg.value = {
      text: "⬅ VOLTAR AO DASHBOARD",
      hyperlink: "#'📊 Dashboard'!A1",
      tooltip: "Voltar para o Dashboard Executivo"
    };
    for (let c = 11; c <= 12; c++) {
      const cell = wsRegistros.getCell(2, c);
      cell.fill = solidFill("#1C2B4A");
      cell.border = thinBorder;
    }
    styleCell(backBtnReg, {
      font: { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" }, underline: true },
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 3: Espaço (6pt)
    wsRegistros.getRow(3).height = 6;

    // Row 4: Cabeçalhos
    const headersRegistros = ["Nº", "Data", "Estado", "Rede", "Código", "Produto", "Marca", "Categoria", "Subcategoria", "Gramatura", "Preço (R$)", "Tipo"];
    wsRegistros.getRow(4).height = 16;
    headersRegistros.forEach((h, index) => {
      const cell = wsRegistros.getCell(4, index + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    // Rows 5+: Dados
    let proprietaryCount = 0;
    let competitorCount = 0;

    sortedRowsAudit.forEach((row: any, index: number) => {
      const rowNum = 5 + index;
      const r = wsRegistros.getRow(rowNum);
      r.height = 14;

      const tipoRaw = row["Tipo de Registro"] || "";
      const isProp = isPropria(tipoRaw);

      let bgHex = "#FFFFFF";
      let tipoFontColor = "FFB35900";
      let tipoFontBold = false;
      let tipoTextValue = "Concorrente";

      if (isProp) {
        const isPar = proprietaryCount % 2 === 1;
        bgHex = isPar ? "#D6F0E0" : "#E8F5EE";
        tipoFontColor = "FF1E6B3C";
        tipoFontBold = true;
        tipoTextValue = "Marca Própria";
        proprietaryCount++;
      } else {
        const isPar = competitorCount % 2 === 1;
        bgHex = isPar ? "#EBF0FA" : "#FFFFFF";
        tipoFontColor = "FFB35900";
        tipoFontBold = false;
        tipoTextValue = "Concorrente";
        competitorCount++;
      }

      r.getCell(1).value = row["Nº"] || (index + 1);
      r.getCell(2).value = row["Data do Registro"] || "";
      r.getCell(3).value = row["Estado"] || "Minas Gerais";
      r.getCell(4).value = row["Rede (PDV)"] || "";
      
      const codeVal = row["Código Interno"] ?? row["Código"] ?? "";
      r.getCell(5).value = codeVal && String(codeVal).trim() !== "" ? String(codeVal).trim() : "-";
      
      r.getCell(6).value = row["Produto"] || "";
      r.getCell(7).value = row["Marca"] || "";
      r.getCell(8).value = row["Categoria"] || "";
      r.getCell(9).value = row["Subcategoria"] || "";
      r.getCell(10).value = row["Gramatura"] || "";

      const priceVal = row["Preço Unitário (R$)"];
      if (priceVal !== null && priceVal !== undefined && priceVal !== "" && !isNaN(Number(priceVal))) {
        r.getCell(11).value = Number(priceVal);
      } else {
        r.getCell(11).value = "-";
      }

      r.getCell(12).value = tipoTextValue;

      for (let col = 1; col <= 12; col++) {
        const cell = r.getCell(col);
        const alignment: Partial<ExcelJS.Alignment> = {
          vertical: "middle",
          horizontal: col === 6 ? "left" : "center"
        };

        let cellFont = { name: "Arial", size: 9 };
        if (col === 12) {
          cellFont = { name: "Arial", size: 9, bold: tipoFontBold, color: { argb: tipoFontColor } } as any;
        }

        styleCell(cell, {
          font: cellFont,
          fill: solidFill(bgHex),
          border: thinBorder,
          alignment,
          numFmt: col === 11 && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
        });
      }
    });

    if (sortedRowsAudit.length > 0) {
      wsRegistros.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4 + sortedRowsAudit.length, column: 12 }
      };
    }


    // ---------------------------------------------------------
    // ABA 3 — "🔍 Painel Comparativo"
    // ---------------------------------------------------------
    const fixedStart = ["Código", "Produto", "Marca", "Categoria", "Subcategoria", "Gramatura", "Tipo"];
    const fixedEnd = ["Preço Médio (R$)", "Preço Mínimo (R$)", "Preço Máximo (R$)", "Dispersão Máx/Mín (%)"];

    const networkKeys = new Set<string>();
    rows_pivot.forEach((row: any) => {
      Object.keys(row).forEach(key => {
        if (!fixedStart.includes(key) && !fixedEnd.includes(key)) {
          networkKeys.add(key);
        }
      });
    });
    const networks = Array.from(networkKeys).sort();

    const headersPivot = [...fixedStart, ...networks, ...fixedEnd];
    const totalColsPivot = headersPivot.length;

    const wsPivot = workbook.addWorksheet("🔍 Painel Comparativo", {
      views: [{ state: "frozen", ySplit: 4 }],
      properties: { tabColor: { argb: "FF1E6B3C" } }
    });

    const widthsPivot: Record<string, number> = {
      "Código": 14,
      "Produto": 50,
      "Marca": 14,
      "Categoria": 14,
      "Subcategoria": 16,
      "Gramatura": 11,
      "Tipo": 12,
      "Preço Médio (R$)": 13,
      "Preço Mínimo (R$)": 13,
      "Preço Máximo (R$)": 13,
      "Dispersão Máx/Mín (%)": 12
    };

    wsPivot.columns = headersPivot.map(h => {
      const width = widthsPivot[h] !== undefined ? widthsPivot[h] : 13;
      return { width };
    });

    // Row 1: Título
    wsPivot.mergeCells(1, 1, 1, totalColsPivot);
    const rPiv1 = wsPivot.getCell(1, 1);
    const redeTextPiv = meta.redes_selecionadas && meta.redes_selecionadas !== "Todas" ? meta.redes_selecionadas : "Todas as Redes";
    const estadoTextPiv = meta.estados_selecionados && meta.estados_selecionados !== "Todos" ? ` (${meta.estados_selecionados})` : "";
    rPiv1.value = `PAINEL COMPARATIVO DE PREÇOS — ${redeTextPiv}${estadoTextPiv}`;
    wsPivot.getRow(1).height = 28;
    styleCell(rPiv1, {
      font: { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 2: Subtítulo e Botão de Retorno ao Dashboard
    const leftColPivot = Math.max(1, totalColsPivot - 2);
    wsPivot.mergeCells(2, 1, 2, leftColPivot);
    const rPiv2 = wsPivot.getCell(2, 1);
    const estadosTxtPiv = meta.estados_selecionados && meta.estados_selecionados !== "Todos" ? `  •  Estados: ${meta.estados_selecionados}` : "  •  Estados: Todos";
    rPiv2.value = `Gerado em: ${meta.data_geracao || ""}${estadosTxtPiv}`;
    wsPivot.getRow(2).height = 18;
    styleCell(rPiv2, {
      font: { name: "Arial", size: 9, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#D40511"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    if (totalColsPivot > 2) {
      wsPivot.mergeCells(2, totalColsPivot - 1, 2, totalColsPivot);
      const backBtnPiv = wsPivot.getCell(2, totalColsPivot - 1);
      backBtnPiv.value = {
        text: "⬅ VOLTAR AO DASHBOARD",
        hyperlink: "#'📊 Dashboard'!A1",
        tooltip: "Voltar para o Dashboard Executivo"
      };
      for (let c = totalColsPivot - 1; c <= totalColsPivot; c++) {
        const cell = wsPivot.getCell(2, c);
        cell.fill = solidFill("#1C2B4A");
        cell.border = thinBorder;
      }
      styleCell(backBtnPiv, {
        font: { name: "Arial", size: 8.5, bold: true, color: { argb: "FFFFFFFF" }, underline: true },
        alignment: { vertical: "middle", horizontal: "center" }
      });
    }

    // Row 3: Espaço (6pt)
    wsPivot.getRow(3).height = 6;

    // Row 4: Cabeçalhos
    wsPivot.getRow(4).height = 16;
    headersPivot.forEach((h, index) => {
      const cell = wsPivot.getCell(4, index + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    // Rows 5+: Dados
    let proprietaryCountPiv = 0;
    let competitorCountPiv = 0;

    rows_pivot.forEach((row: any, index: number) => {
      const rowNum = 5 + index;
      const r = wsPivot.getRow(rowNum);
      r.height = 14;

      const tipoRaw = row["Tipo"] || "";
      const isProp = isPropria(tipoRaw);

      let bgHex = "#FFFFFF";
      let tipoFontColor = "FFB35900";
      let tipoFontBold = false;
      let tipoTextValue = "Concorrente";

      if (isProp) {
        const isPar = proprietaryCountPiv % 2 === 1;
        bgHex = isPar ? "#D6F0E0" : "#E8F5EE";
        tipoFontColor = "FF1E6B3C";
        tipoFontBold = true;
        tipoTextValue = "Própria";
        proprietaryCountPiv++;
      } else {
        const isPar = competitorCountPiv % 2 === 1;
        bgHex = isPar ? "#EBF0FA" : "#FFFFFF";
        tipoFontColor = "FFB35900";
        tipoFontBold = false;
        tipoTextValue = "Concorrente";
        competitorCountPiv++;
      }

      headersPivot.forEach((header, colIndex) => {
        const cell = r.getCell(colIndex + 1);
        let val = row[header];

        const isProductCol = (header === "Produto");
        const isPriceCol = (networks.includes(header) || ["Preço Médio (R$)", "Preço Mínimo (R$)", "Preço Máximo (R$)"].includes(header));

        const alignment: Partial<ExcelJS.Alignment> = {
          vertical: "middle",
          horizontal: isProductCol ? "left" : "center"
        };

        let numberFormatted = false;
        if (isPriceCol) {
          if (val !== undefined && val !== null && val !== "" && val !== "-" && val !== "N/A" && !isNaN(Number(val))) {
            val = Number(val);
            numberFormatted = true;
          } else {
            val = "-";
          }
        } else if (header === "Tipo") {
          val = tipoTextValue;
        } else if (header === "Código") {
          val = val && String(val).trim() !== "" ? String(val).trim() : "-";
        }

        cell.value = val;

        let cellFont = { name: "Arial", size: 9 };
        if (header === "Tipo") {
          cellFont = { name: "Arial", size: 9, bold: tipoFontBold, color: { argb: tipoFontColor } } as any;
        }

        styleCell(cell, {
          font: cellFont,
          fill: solidFill(bgHex),
          border: thinBorder,
          alignment,
          numFmt: numberFormatted ? '"R$ " #,##0.00' : undefined
        });
      });
    });

    if (rows_pivot.length > 0) {
      wsPivot.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4 + rows_pivot.length, column: totalColsPivot }
      };
    }

    // Write to Buffer and return!
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="pesquisa_precos_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    
    return res.status(200).send(Buffer.from(buffer));

  } catch (err: any) {
    console.error("Erro na geração da planilha:", err);
    return res.status(500).json({ error: "Falha na geração do arquivo Excel.", details: err.message });
  }
}
