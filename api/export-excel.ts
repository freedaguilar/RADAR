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

    // Group rows_audit by Category
    const catMap = new Map<string, {
      countPropria: number;
      countConcorrente: number;
      sumPricePropria: number;
      countPricePropria: number;
      sumPriceConcorrente: number;
      countPriceConcorrente: number;
    }>();

    rows_audit.forEach((row: any) => {
      const cat = row["Categoria"] || "N/A";
      const priceVal = row["Preço Unitário (R$)"];
      const price = (priceVal !== null && priceVal !== undefined && priceVal !== "") ? Number(priceVal) : null;
      const tipo = row["Tipo de Registro"] || "";

      if (!catMap.has(cat)) {
        catMap.set(cat, {
          countPropria: 0,
          countConcorrente: 0,
          sumPricePropria: 0,
          countPricePropria: 0,
          sumPriceConcorrente: 0,
          countPriceConcorrente: 0,
        });
      }

      const stats = catMap.get(cat)!;
      if (isPropria(tipo)) {
        stats.countPropria++;
        if (price !== null && !isNaN(price)) {
          stats.sumPricePropria += price;
          stats.countPricePropria++;
        }
      } else {
        stats.countConcorrente++;
        if (price !== null && !isNaN(price)) {
          stats.sumPriceConcorrente += price;
          stats.countPriceConcorrente++;
        }
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
      };
    }).sort((a, b) => a.category.localeCompare(b.category));

    // Create a new Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PriceHub";

    // ---------------------------------------------------------
    // ABA 1 — "📊 Resumo"
    // ---------------------------------------------------------
    const wsResumo = workbook.addWorksheet("📊 Resumo", {
      views: [{ state: "frozen", ySplit: 3 }],
      properties: { tabColor: { argb: "FF1C2B4A" } }
    });

    wsResumo.columns = [
      { width: 22 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 5 }
    ];

    // Row 1: Título principal
    wsResumo.mergeCells("A1:G1");
    const r1 = wsResumo.getCell("A1");
    r1.value = "PESQUISA DE PREÇOS — DR. OETKER / MAVALÉRIO";
    wsResumo.getRow(1).height = 32;
    styleCell(r1, {
      font: { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 2: Subtítulo
    wsResumo.mergeCells("A2:G2");
    const r2 = wsResumo.getCell("A2");
    r2.value = `Gerado em: ${meta.data_geracao || ""}  •  Redes: ${meta.redes_selecionadas || ""}  •  Categorias: ${meta.categorias_selecionadas || ""}`;
    wsResumo.getRow(2).height = 18;
    styleCell(r2, {
      font: { name: "Arial", size: 9, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#D40511"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 3: Espaço vazio
    wsResumo.getRow(3).height = 8;

    // Row 4-7: Bloco de KPIs (6 cards nas colunas A-F)
    const kpis = [
      { label: "Total de Registros", value: totalRegistros, isCurrency: false },
      { label: "Marca Própria", value: countPropria, isCurrency: false },
      { label: "Concorrentes", value: countConcorrente, isCurrency: false },
      { label: "Itens com Preço (Painel)", value: itensComPrecoPainel, isCurrency: false },
      { label: "Ticket Médio Própria", value: ticketMedioPropria, isCurrency: true },
      { label: "Ticket Médio Concorrente", value: ticketMedioConcorrente, isCurrency: true }
    ];

    wsResumo.getRow(4).height = 14;
    wsResumo.getRow(5).height = 14;
    wsResumo.getRow(6).height = 18;
    wsResumo.getRow(7).height = 18;

    kpis.forEach((kpi, index) => {
      const colLetter = String.fromCharCode(65 + index); // A, B, C, D, E, F

      // Merge rows 4 & 5 for label
      wsResumo.mergeCells(`${colLetter}4:${colLetter}5`);
      const cellLabel = wsResumo.getCell(`${colLetter}4`);
      cellLabel.value = kpi.label;

      // Merge rows 6 & 7 for value
      wsResumo.mergeCells(`${colLetter}6:${colLetter}7`);
      const cellValue = wsResumo.getCell(`${colLetter}6`);
      cellValue.value = kpi.value;

      // Ensure background and borders are applied to each sub-cell
      for (let r = 4; r <= 7; r++) {
        const c = wsResumo.getCell(`${colLetter}${r}`);
        c.fill = solidFill("#F2F2F2");
        c.border = thinBorder;
      }

      styleCell(cellLabel, {
        font: { name: "Arial", size: 9, color: { argb: "FF8E8E8E" } },
        alignment: { vertical: "middle", horizontal: "center", wrapText: true }
      });

      styleCell(cellValue, {
        font: { name: "Arial", size: 14, bold: true, color: { argb: "FF1C2B4A" } },
        alignment: { vertical: "middle", horizontal: "center" },
        numFmt: kpi.isCurrency ? '"R$ " #,##0.00' : undefined
      });
    });

    // Row 8: Espaço vazio
    wsResumo.getRow(8).height = 8;

    // Row 9: Título de seção
    wsResumo.mergeCells("A9:E9");
    const r9 = wsResumo.getCell("A9");
    r9.value = "RESUMO POR CATEGORIA";
    wsResumo.getRow(9).height = 20;
    styleCell(r9, {
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });
    for (let col = 1; col <= 5; col++) {
      const cell = wsResumo.getCell(9, col);
      cell.fill = solidFill("#1C2B4A");
      cell.border = thinBorder;
    }

    // Row 10: Cabeçalhos da tabela de categorias
    const headersResumo = ["Categoria", "Qtd Própria", "Qtd Concorrente", "Preço Médio Própria (R$)", "Preço Médio Concorrente (R$)"];
    wsResumo.getRow(10).height = 16;
    headersResumo.forEach((h, index) => {
      const cell = wsResumo.getCell(10, index + 1);
      cell.value = h;
      styleCell(cell, {
        font: { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } },
        fill: solidFill("#D40511"),
        alignment: { vertical: "middle", horizontal: "center", wrapText: true },
        border: thinBorder
      });
    });

    // Rows 11+: Dados das categorias
    sortedCategories.forEach((catInfo, index) => {
      const rowNum = 11 + index;
      const isPar = index % 2 === 1;
      const bgHex = isPar ? "#EBF0FA" : "#FFFFFF";

      const r = wsResumo.getRow(rowNum);
      r.height = 15;

      r.getCell(1).value = catInfo.category;
      r.getCell(2).value = catInfo.countPropria;
      r.getCell(3).value = catInfo.countConcorrente;

      if (catInfo.avgPropria !== null) {
        r.getCell(4).value = catInfo.avgPropria;
      } else {
        r.getCell(4).value = "-";
      }

      if (catInfo.avgConcorrente !== null) {
        r.getCell(5).value = catInfo.avgConcorrente;
      } else {
        r.getCell(5).value = "-";
      }

      for (let col = 1; col <= 5; col++) {
        const cell = r.getCell(col);
        styleCell(cell, {
          font: { name: "Arial", size: 9 },
          fill: solidFill(bgHex),
          border: thinBorder,
          alignment: {
            vertical: "middle",
            horizontal: col === 1 ? "left" : "center"
          },
          numFmt: (col === 4 || col === 5) && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
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
      { width: 14 },  // Rede
      { width: 50 },  // Produto
      { width: 14 },  // Marca
      { width: 14 },  // Categoria
      { width: 16 },  // Subcategoria
      { width: 11 },  // Gramatura
      { width: 13 },  // Preço (R$)
      { width: 14 }   // Tipo
    ];

    // Row 1: Título
    wsRegistros.mergeCells("A1:J1");
    const rReg1 = wsRegistros.getCell("A1");
    const redeTextReg = meta.redes_selecionadas && meta.redes_selecionadas !== "Todas" ? meta.redes_selecionadas : "MART MINAS";
    rReg1.value = `REGISTROS DE PREÇOS — ${redeTextReg} (último registro por item)`;
    wsRegistros.getRow(1).height = 28;
    styleCell(rReg1, {
      font: { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 2: Subtítulo
    wsRegistros.mergeCells("A2:J2");
    const rReg2 = wsRegistros.getCell("A2");
    rReg2.value = `Gerado em: ${meta.data_geracao || ""}`;
    wsRegistros.getRow(2).height = 18;
    styleCell(rReg2, {
      font: { name: "Arial", size: 9, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#D40511"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 3: Espaço (6pt)
    wsRegistros.getRow(3).height = 6;

    // Row 4: Cabeçalhos
    const headersRegistros = ["Nº", "Data", "Rede", "Produto", "Marca", "Categoria", "Subcategoria", "Gramatura", "Preço (R$)", "Tipo"];
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

    rows_audit.forEach((row: any, index: number) => {
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
      r.getCell(3).value = row["Rede (PDV)"] || "";
      r.getCell(4).value = row["Produto"] || "";
      r.getCell(5).value = row["Marca"] || "";
      r.getCell(6).value = row["Categoria"] || "";
      r.getCell(7).value = row["Subcategoria"] || "";
      r.getCell(8).value = row["Gramatura"] || "";

      const priceVal = row["Preço Unitário (R$)"];
      if (priceVal !== null && priceVal !== undefined && priceVal !== "" && !isNaN(Number(priceVal))) {
        r.getCell(9).value = Number(priceVal);
      } else {
        r.getCell(9).value = "-";
      }

      r.getCell(10).value = tipoTextValue;

      for (let col = 1; col <= 10; col++) {
        const cell = r.getCell(col);
        const alignment: Partial<ExcelJS.Alignment> = {
          vertical: "middle",
          horizontal: col === 4 ? "left" : "center"
        };

        let cellFont = { name: "Arial", size: 9 };
        if (col === 10) {
          cellFont = { name: "Arial", size: 9, bold: tipoFontBold, color: { argb: tipoFontColor } } as any;
        }

        styleCell(cell, {
          font: cellFont,
          fill: solidFill(bgHex),
          border: thinBorder,
          alignment,
          numFmt: col === 9 && typeof cell.value === "number" ? '"R$ " #,##0.00' : undefined
        });
      }
    });


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
      "Código": 9,
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
    const redeTextPiv = meta.redes_selecionadas && meta.redes_selecionadas !== "Todas" ? meta.redes_selecionadas : "MART MINAS";
    rPiv1.value = `PAINEL COMPARATIVO DE PREÇOS — ${redeTextPiv}`;
    wsPivot.getRow(1).height = 28;
    styleCell(rPiv1, {
      font: { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#1C2B4A"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

    // Row 2: Subtítulo
    wsPivot.mergeCells(2, 1, 2, totalColsPivot);
    const rPiv2 = wsPivot.getCell(2, 1);
    rPiv2.value = `Gerado em: ${meta.data_geracao || ""}`;
    wsPivot.getRow(2).height = 18;
    styleCell(rPiv2, {
      font: { name: "Arial", size: 9, color: { argb: "FFFFFFFF" } },
      fill: solidFill("#D40511"),
      alignment: { vertical: "middle", horizontal: "center" }
    });

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
