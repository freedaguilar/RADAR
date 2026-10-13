import { createClient } from "@supabase/supabase-js";

// Chave padrão de integração segura com o SOMA (https://soma.aquilas.tech/)
export const DEFAULT_SOMA_API_KEY = "pricehub_sec_soma_2026_aquilas";

// Lista de tokens válidos aceitos
function getValidApiKeys(): string[] {
  const keys = [DEFAULT_SOMA_API_KEY];
  if (process.env.PRICEHUB_API_KEY) {
    keys.push(process.env.PRICEHUB_API_KEY.trim());
  }
  if (process.env.SOMA_API_KEY) {
    keys.push(process.env.SOMA_API_KEY.trim());
  }
  return keys;
}

// Helpers textuais independentes (sem dependência relativa para Vercel Serverless)
function removeAccents(str: string): string {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeString(str?: string | null): string {
  if (!str) return "";
  return removeAccents(String(str).toLowerCase().trim());
}

function isStateMatch(campState?: string, targetState?: string): boolean {
  if (!campState || !targetState) return false;
  const cs = campState.trim().toLowerCase();
  const ts = targetState.trim().toLowerCase();
  if (cs === "todos" || cs === "todas" || cs === "nacional") return true;
  if (cs === ts) return true;
  const cNorm = normalizeString(cs);
  const tNorm = normalizeString(ts);
  if (cNorm === tNorm) return true;

  const stateMap: Record<string, string> = {
    mg: "minas gerais", "minas gerais": "mg",
    sp: "sao paulo", "sao paulo": "sp",
    rj: "rio de janeiro", "rio de janeiro": "rj",
    es: "espirito santo", "espirito santo": "es",
    pr: "parana", "parana": "pr",
    sc: "santa catarina", "santa catarina": "sc",
    rs: "rio grande do sul", "rio grande do sul": "rs",
    go: "goias", "goias": "go",
    df: "distrito federal", "distrito federal": "df",
    ba: "bahia", "bahia": "ba",
    pe: "pernambuco", "pernambuco": "pe",
    ce: "ceara", "ceara": "ce",
    am: "amazonas", "amazonas": "am",
    mt: "mato grosso", "mato grosso": "mt",
    to: "tocantins", "tocantins": "to",
    ro: "rondonia", "rondonia": "ro",
    ac: "acre", "acre": "ac",
  };
  return stateMap[cNorm] === tNorm;
}

// Redes padrão de contingência
const FALLBACK_CHAINS = [
  { id: "chain-1", name: "Carrefour Supermercado", active: true, states: ["Minas Gerais", "Goiás", "Distrito Federal"] },
  { id: "chain-2", name: "Pão de Açúcar", active: true, states: ["Minas Gerais", "Distrito Federal"] },
  { id: "chain-3", name: "Supermercados BH", active: true, states: ["Minas Gerais"] },
  { id: "chain-4", name: "Hiper ABC", active: true, states: ["Minas Gerais"] },
  { id: "chain-5", name: "ABC Atacado e Varejo", active: true, states: ["Minas Gerais"] },
  { id: "chain-6", name: "Assaí", active: true, states: ["Minas Gerais", "Distrito Federal"] },
  { id: "chain-7", name: "Atacadão", active: true, states: ["Minas Gerais", "Distrito Federal"] },
  { id: "chain-8", name: "Super Adega", active: true, states: ["Distrito Federal", "Goiás"] },
];

// Inicializa cliente Supabase com credenciais de ambiente (suporta Vercel e dev)
let supabaseServerClient: any = null;
function getServerSupabaseClient() {
  if (!supabaseServerClient) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey =
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey) {
      supabaseServerClient = createClient(supabaseUrl, supabaseAnonKey);
    }
  }
  return supabaseServerClient;
}

interface ChainData {
  id: string;
  name: string;
  active: boolean;
  state?: string;
  states?: string[];
}

interface ProductData {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  weight?: string;
  basePrice?: number;
  isCompetitor?: boolean;
  internalCode?: string;
  imageUrl?: string;
}

interface RecordData {
  id: string;
  chainId: string;
  productId?: string;
  price: number;
  date: string;
  state?: string;
  userName?: string;
  notes?: string;
}

interface CampaignData {
  id: string;
  title: string;
  chainId: string;
  state: string;
  productIds: string[];
  active: boolean;
  notes?: string;
}

// Produtos padrão de contingência
const FALLBACK_PRODUCTS: ProductData[] = [
  { id: "prod-1", name: "Fermento em Pó Químico Oetker 100g", brand: "Dr. Oetker", category: "Fermentos", weight: "100g", basePrice: 4.80, isCompetitor: false, internalCode: "OET-1001" },
  { id: "prod-2", name: "Gelatina sabor Morango Oetker 20g", brand: "Dr. Oetker", category: "Gelatinas", weight: "20g", basePrice: 1.89, isCompetitor: false, internalCode: "OET-2001" },
  { id: "prod-3", name: "Pudim sabor Chocolate Oetker 40g", brand: "Dr. Oetker", category: "Sobremesas em Pó", weight: "40g", basePrice: 2.45, isCompetitor: false, internalCode: "OET-3001" },
  { id: "prod-4", name: "Mistura para Bolo de Chocolate Oetker 400g", brand: "Dr. Oetker", category: "Misturas para Bolo", weight: "400g", basePrice: 6.90, isCompetitor: false, internalCode: "OET-4001" },
  { id: "prod-6", name: "Granulado Chocolate Macio Mavalério 120g", brand: "Mavalério", category: "Confeitaria", weight: "120g", basePrice: 4.30, isCompetitor: false, internalCode: "MAV-6001" },
];

/**
 * Carrega redes, produtos, registros de preço e pesquisas guiadas do Supabase com fallback gracioso
 */
async function loadPriceHubData(): Promise<{
  chains: ChainData[];
  products: ProductData[];
  records: RecordData[];
  campaigns: CampaignData[];
}> {
  const supabase = getServerSupabaseClient();
  let chains: ChainData[] = [];
  let products: ProductData[] = [];
  let records: RecordData[] = [];
  let campaigns: CampaignData[] = [];

  if (supabase) {
    try {
      const [chainsRes, productsRes, recordsRes, campaignsRes] = await Promise.all([
        supabase.from("chains").select("id, name, active, state, states"),
        supabase.from("products").select("id, name, brand, category, subcategory, weight, base_price, is_competitor, internal_code, image_url"),
        supabase.from("price_records").select("id, chain_id, product_id, price, date, state, user_name, notes").order("date", { ascending: false }),
        supabase.from("guided_campaigns").select("id, title, chain_id, state, product_ids, active, notes"),
      ]);

      if (chainsRes.data && chainsRes.data.length > 0) {
        chains = chainsRes.data.map((c: any) => {
          let statesList: string[] = [];
          if (Array.isArray(c.states) && c.states.length > 0) {
            statesList = c.states.map((s: any) => String(s).trim()).filter(Boolean);
          } else if (typeof c.state === "string" && c.state.trim()) {
            statesList = c.state.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
          if (statesList.length === 0) statesList = ["Minas Gerais"];

          return {
            id: String(c.id),
            name: String(c.name),
            active: c.active !== false,
            state: c.state || statesList[0],
            states: statesList,
          };
        });
      }

      if (productsRes.data && productsRes.data.length > 0) {
        products = productsRes.data.map((p: any) => ({
          id: String(p.id),
          name: String(p.name),
          brand: p.brand || undefined,
          category: p.category || undefined,
          subcategory: p.subcategory || undefined,
          weight: p.weight || undefined,
          basePrice: p.base_price ? Number(p.base_price) : undefined,
          isCompetitor: Boolean(p.is_competitor === true || p.is_competitor === 1 || p.is_competitor === "true"),
          internalCode: p.internal_code || undefined,
          imageUrl: p.image_url || undefined,
        }));
      }

      if (recordsRes.data && recordsRes.data.length > 0) {
        records = recordsRes.data.map((r: any) => ({
          id: String(r.id),
          chainId: String(r.chain_id),
          productId: r.product_id ? String(r.product_id) : undefined,
          price: Number(r.price),
          date: String(r.date),
          state: r.state || "Minas Gerais",
          userName: r.user_name || undefined,
          notes: r.notes || undefined,
        }));
      }

      if (campaignsRes.data && campaignsRes.data.length > 0) {
        campaigns = campaignsRes.data.map((camp: any) => {
          let productIds: string[] = [];
          const rawIds = camp.product_ids || camp.productIds;
          if (Array.isArray(rawIds)) {
            productIds = rawIds;
          } else if (typeof rawIds === "string") {
            try {
              const parsed = JSON.parse(rawIds);
              if (Array.isArray(parsed)) productIds = parsed;
            } catch {
              productIds = rawIds.split(",").map((s: string) => s.trim()).filter(Boolean);
            }
          }

          return {
            id: String(camp.id),
            title: String(camp.title),
            chainId: String(camp.chain_id || camp.chainId),
            state: String(camp.state || "Minas Gerais"),
            productIds,
            active: Boolean(camp.active === true || camp.active === "true" || camp.active === 1 || camp.active === "t"),
            notes: camp.notes || undefined,
          };
        });
      }
    } catch (dbErr) {
      console.warn("[API Status-Rede] Supabase query falhou, utilizando dados base:", dbErr);
    }
  }

  // Fallbacks locais
  if (chains.length === 0) {
    chains = FALLBACK_CHAINS;
  }
  if (products.length === 0) {
    products = FALLBACK_PRODUCTS;
  }

  return { chains, products, records, campaigns };
}

/**
 * Localiza a rede mais adequada a partir do nome ou ID fornecido pelo SOMA
 */
function findMatchingChain(searchQuery: string, chains: ChainData[]): ChainData | null {
  if (!searchQuery || !searchQuery.trim()) return null;
  const rawQuery = searchQuery.trim();
  const normQuery = normalizeString(rawQuery);

  // 1. Correspondência exata por ID
  const byId = chains.find((c) => c.id.toLowerCase() === rawQuery.toLowerCase());
  if (byId) return byId;

  // 2. Pontuação ponderada de correspondência textual
  const queryTokens = normQuery.split(/\s+/).filter((t) => t.length >= 2);
  let bestChain: ChainData | null = null;
  let highestScore = 0;

  const genericWords = new Set(["super", "supermercado", "supermercados", "hiper", "hipermercado", "mercado", "loja", "rede", "atacado", "varejo"]);

  for (const c of chains) {
    const cNorm = normalizeString(c.name);
    let score = 0;

    // Correspondência exata total
    if (cNorm === normQuery) {
      score += 1000;
    } else if (cNorm.includes(normQuery)) {
      score += 500;
    } else if (normQuery.includes(cNorm) && cNorm.length >= 4) {
      score += 300;
    }

    const cTokens = cNorm.split(/\s+/).filter((t) => t.length >= 2);

    for (const qt of queryTokens) {
      const isGeneric = genericWords.has(qt);
      if (cTokens.includes(qt)) {
        score += isGeneric ? 30 : 200; // Palavra distintiva (ex: 'abc', 'carrefour', 'bh') ganha peso muito maior
      } else {
        const partial = cTokens.find((ct) => (ct.length >= 3 && qt.length >= 3 && (ct.startsWith(qt) || qt.startsWith(ct))));
        if (partial) {
          score += isGeneric ? 10 : 50;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestChain = c;
    }
  }

  // Exige pontuação mínima de relevância (evita falsos positivos para termos não encontrados)
  if (bestChain && highestScore >= 50) {
    return bestChain;
  }

  return null;
}

/**
 * Calcula o status de auditoria para uma rede específica
 */
function calculateChainStatus(
  chain: ChainData,
  records: RecordData[],
  campaigns: CampaignData[],
  products: ProductData[] = [],
  estadoFiltro?: string,
  diasLimite: number = 15,
  baseUrl: string = "https://pricehub.aquilas.tech"
) {
  // 1. Filtrar registros da rede (e por estado se solicitado)
  let chainRecords = records.filter((r) => r.chainId === chain.id);
  if (estadoFiltro) {
    chainRecords = chainRecords.filter((r) => isStateMatch(r.state, estadoFiltro));
  }

  // Ordenar registros do mais recente ao mais antigo
  chainRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestRecord = chainRecords[0] || null;

  let ultimaAtualizacao: string | null = null;
  let diasSemAtualizacao: number | null = null;
  let precosAtualizados = false;

  if (latestRecord && latestRecord.date) {
    ultimaAtualizacao = new Date(latestRecord.date).toISOString();
    const diffMs = Date.now() - new Date(latestRecord.date).getTime();
    diasSemAtualizacao = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    precosAtualizados = diasSemAtualizacao <= diasLimite;
  }

  // 2. Verificar pesquisa guiada ativa para esta rede
  const activeCampaigns = campaigns.filter((camp) => {
    if (!camp.active) return false;
    const matchChain = camp.chainId === chain.id || camp.chainId === "all";
    if (!matchChain) return false;
    if (estadoFiltro) {
      return isStateMatch(camp.state, estadoFiltro) || camp.state.toLowerCase() === "todos";
    }
    return true;
  });

  const activeCampaign = activeCampaigns[0] || null;
  const possuiPesquisaGuiadaAtiva = !!activeCampaign;

  // 3. Critério de necessidade de pesquisa geral
  const precisaPesquisa = !precosAtualizados || possuiPesquisaGuiadaAtiva;

  // Mapa de último registro por produto nesta rede e contagem de coletas na rede
  const lastRecordByProductId = new Map<string, RecordData>();
  const recordsCountByProductId = new Map<string, number>();
  for (const r of chainRecords) {
    const key = r.productId || r.notes || r.id;
    if (key) {
      if (!lastRecordByProductId.has(key)) {
        lastRecordByProductId.set(key, r);
      }
      recordsCountByProductId.set(key, (recordsCountByProductId.get(key) || 0) + 1);
    }
  }

  // Candidatos para Cenário A (Rede em dia): itens com pelo menos 3 registros na rede e > 15 dias sem auditoria
  const overdueRecurringCandidates: Array<{
    product: ProductData;
    lastRec: RecordData;
    diffDays: number;
    recordsCount: number;
    isCampaignProd: boolean;
    isProprietary: boolean;
  }> = [];

  const activeCampaignIds = new Set(activeCampaign?.productIds || []);

  if (!precisaPesquisa) {
    for (const [prodKey, lastRec] of lastRecordByProductId.entries()) {
      const recordsCount = recordsCountByProductId.get(prodKey) || 0;

      // Critério 1: Pelo menos 3 registros nesta rede
      if (recordsCount < 3) continue;

      let diffDays = 0;
      if (lastRec.date) {
        const rDate = new Date(lastRec.date);
        diffDays = Math.max(0, Math.floor((Date.now() - rDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Critério 2: Mais de 15 dias sem auditoria na rede
      if (diffDays <= 15) continue;

      let matchedProd = products.find((p) => p.id === prodKey || (lastRec.productId && p.id === lastRec.productId));
      if (!matchedProd) {
        matchedProd = {
          id: lastRec.productId || prodKey,
          name: lastRec.notes || "Produto Auditado",
          brand: "Dr. Oetker",
          isCompetitor: false,
        };
      }

      const brandLower = (matchedProd.brand || "").toLowerCase();
      const isProprietary = !matchedProd.isCompetitor || brandLower.includes("oetker") || brandLower.includes("mavalerio");
      const isCampaignProd = activeCampaignIds.has(matchedProd.id);

      overdueRecurringCandidates.push({
        product: matchedProd,
        lastRec,
        diffDays,
        recordsCount,
        isCampaignProd,
        isProprietary,
      });
    }

    // Ordenação inteligente:
    // 1º: Marca própria
    // 2º: Maior tempo sem auditoria (diffDays desc)
    // 3º: Frequência histórica na rede (recordsCount desc)
    // 4º: Nome alfabético
    overdueRecurringCandidates.sort((a, b) => {
      if (a.isProprietary !== b.isProprietary) {
        return a.isProprietary ? -1 : 1;
      }
      if (b.diffDays !== a.diffDays) {
        return b.diffDays - a.diffDays;
      }
      if (b.recordsCount !== a.recordsCount) {
        return b.recordsCount - a.recordsCount;
      }
      return a.product.name.localeCompare(b.product.name);
    });
  }

  const possuiProdutosProgramados = !precisaPesquisa && overdueRecurringCandidates.length > 0;

  // 4. Motivo e mensagem amigável e explicativa
  let motivo: "em_dia" | "em_dia_com_itens_pendentes" | "precos_desatualizados" | "pesquisa_guiada_ativa" | "pesquisa_guiada_ativa_e_precos_desatualizados" | "sem_historico" = "em_dia";
  let mensagem = "";

  if (possuiPesquisaGuiadaAtiva && !precosAtualizados) {
    motivo = "pesquisa_guiada_ativa_e_precos_desatualizados";
    mensagem = diasSemAtualizacao !== null
      ? `A rede '${chain.name}' possui pesquisa guiada ativa ('${activeCampaign.title}') e está há ${diasSemAtualizacao} dias sem atualização de preços (limite: ${diasLimite} dias). Prioridade alta para auditoria de preços.`
      : `A rede '${chain.name}' possui pesquisa guiada ativa ('${activeCampaign.title}') e ainda não possui histórico recente de preços. Auditoria prioritária.`;
  } else if (possuiPesquisaGuiadaAtiva && precosAtualizados) {
    motivo = "pesquisa_guiada_ativa";
    mensagem = `A rede '${chain.name}' possui pesquisa guiada ativa ('${activeCampaign.title}'). Embora os preços gerais estejam atualizados, recomenda-se auditar a lista guiada nesta visita.`;
  } else if (!precosAtualizados) {
    if (diasSemAtualizacao !== null) {
      motivo = "precos_desatualizados";
      mensagem = `Preços pendentes de conferência: última coleta realizada há ${diasSemAtualizacao} dias na rede '${chain.name}' (tolerância máxima: ${diasLimite} dias).`;
    } else {
      motivo = "sem_historico";
      mensagem = `Nenhuma coleta de preços recente registrada para a rede '${chain.name}'. É necessário realizar a pesquisa de preços.`;
    }
  } else if (possuiProdutosProgramados) {
    motivo = "em_dia_com_itens_pendentes";
    const count = overdueRecurringCandidates.length;
    mensagem = `Rede em dia (última pesquisa há ${diasSemAtualizacao} dia(s)), porém identificamos ${count} produto(s) recorrente(s) (com 3+ coletas) sem auditoria há mais de 15 dias. O link do SOMA direciona para auditoria programada exclusiva com esses itens. Exibindo 20 produtos (completada com os últimos auditados).`;
  } else {
    motivo = "em_dia";
    mensagem = `Preços atualizados recentemente na rede '${chain.name}' (última pesquisa há ${diasSemAtualizacao} dia(s)). Todos os itens recorrentes auditados recentemente. Exibindo os últimos produtos auditados na rede.`;
  }

  // 5. Construir Link Direto para o usuário do SOMA clicar e ir direto para o PriceHub
  const linkParams = new URLSearchParams();
  linkParams.set("rede", chain.name);
  linkParams.set("chain_id", chain.id);
  if (estadoFiltro) {
    linkParams.set("estado", estadoFiltro);
  } else if (chain.states && chain.states.length === 1) {
    linkParams.set("estado", chain.states[0]);
  }

  if (possuiProdutosProgramados) {
    // Quando a rede está em dia mas possui produtos na condição (3+ coletas e > 15 dias sem auditoria),
    // o link direciona para uma auditoria programada somente com os produtos nessa condição
    linkParams.set("modo", "programada");
    linkParams.set("tipo", "programada");
    linkParams.set("produtos_ids", overdueRecurringCandidates.map((p) => p.product.id).join(","));
    linkParams.set("titulo", `Auditoria Programada (${overdueRecurringCandidates.length} itens recorrentes)`);
  } else if (activeCampaign) {
    linkParams.set("campanha_id", activeCampaign.id);
  }
  linkParams.set("origem", "soma");
  const linkPesquisa = `${baseUrl}/?${linkParams.toString()}`;

  // 6. Título da vitrine, texto do botão de ação e cenário para o projeto SOMA
  let cenario: "pesquisa_pendente" | "em_dia_com_itens_pendentes" | "em_dia_sem_itens_pendentes" = "pesquisa_pendente";
  let textoBotaoAcao = "Realizar pesquisa de preço";
  let tituloVitrine = "Produtos com Mais Tempo sem Auditoria";
  let subtituloVitrine = "Exibindo os produtos com maior tempo desde a última coleta nesta rede";

  if (!precisaPesquisa) {
    if (possuiProdutosProgramados) {
      cenario = "em_dia_com_itens_pendentes";
      textoBotaoAcao = "Registrar preços faltantes";
      tituloVitrine = "Itens Recorrentes sem Auditoria (>15 dias)";
      subtituloVitrine = `Rede em dia, mas com ${overdueRecurringCandidates.length} itens recorrentes sem auditoria há mais de 15 dias (completados até 100 com os últimos auditados)`;
    } else {
      cenario = "em_dia_sem_itens_pendentes";
      textoBotaoAcao = "Realizar pesquisa de preço";
      tituloVitrine = "Últimos Preços Auditados";
      subtituloVitrine = "Rede em dia. Todos os itens recorrentes auditados recentemente. Exibindo os últimos produtos auditados";
    }
  } else {
    cenario = "pesquisa_pendente";
    textoBotaoAcao = "Realizar pesquisa de preço";
    tituloVitrine = activeCampaign ? `Itens da Pesquisa Guiada: ${activeCampaign.title}` : "Produtos com Mais Tempo sem Auditoria";
    subtituloVitrine = activeCampaign ? "Prioridade de auditoria para campanha guiada ativa" : "Exibindo produtos que já foram auditados na rede, ordenados pelos mais desatualizados";
  }

  // 7. Vitrine dinâmica de produtos (até 100 produtos)
  let modoExibicaoProdutos = "ultimos_auditados";
  if (precisaPesquisa) {
    modoExibicaoProdutos = "mais_tempo_sem_auditoria";
  } else {
    if (overdueRecurringCandidates.length >= 100) {
      modoExibicaoProdutos = "recorrentes_sem_auditoria_15d";
    } else if (overdueRecurringCandidates.length > 0) {
      modoExibicaoProdutos = "recorrentes_sem_auditoria_15d_completado_com_recentes";
    } else {
      modoExibicaoProdutos = "ultimos_auditados";
    }
  }

  const produtosVitrine: Array<{
    produto_id?: string;
    produto: string;
    marca: string;
    categoria?: string;
    gramatura?: string;
    codigo_interno?: string;
    preco: number;
    preco_formatado: string;
    data_coleta: string | null;
    dias_atras: number | null;
    dias_sem_auditoria: number | null;
    total_registros_rede?: number;
    status_auditoria: "em_dia" | "desatualizado" | "nunca_auditado" | "campanha_guiada";
    status_descricao: string;
    pesquisador?: string;
    imagem_url?: string;
    tipo: "propria" | "concorrente";
    em_campanha_guiada: boolean;
  }> = [];

  if (!precisaPesquisa) {
    // CENÁRIO A: Rede em dia
    const includedProdIds = new Set<string>();

    // 1. Inclui produtos que atendem à condição (>= 3 coletas e > 15 dias sem auditoria), até 100
    const topCandidates = overdueRecurringCandidates.slice(0, 100);
    for (const item of topCandidates) {
      const prod = item.product;
      const lastRec = item.lastRec;
      const brandName = prod.brand || (item.isProprietary ? "Dr. Oetker" : "Concorrente");
      const currentPrice = lastRec.price;

      produtosVitrine.push({
        produto_id: prod.id,
        produto: prod.name,
        marca: brandName,
        categoria: prod.category,
        gramatura: prod.weight,
        codigo_interno: prod.internalCode,
        preco: currentPrice,
        preco_formatado: `R$ ${currentPrice.toFixed(2).replace(".", ",")}`,
        data_coleta: lastRec.date ? new Date(lastRec.date).toISOString() : null,
        dias_atras: item.diffDays,
        dias_sem_auditoria: item.diffDays,
        total_registros_rede: item.recordsCount,
        status_auditoria: "desatualizado",
        status_descricao: `${item.diffDays} dias sem auditoria`,
        pesquisador: lastRec.userName || latestRecord?.userName || undefined,
        imagem_url: prod.imageUrl,
        tipo: item.isProprietary ? "propria" : "concorrente",
        em_campanha_guiada: item.isCampaignProd,
      });

      includedProdIds.add(prod.id);
      if (lastRec.productId) includedProdIds.add(lastRec.productId);
    }

    // 2. Se houver menos de 100 produtos (ou 0), completa até 100 com os últimos produtos auditados na rede (como era antes)
    if (produtosVitrine.length < 100) {
      for (const rec of chainRecords) {
        if (produtosVitrine.length >= 100) break;
        const prodKey = rec.productId || rec.notes || rec.id;
        if (!prodKey) continue;

        let matchedProd = products.find((p) => p.id === prodKey || (rec.productId && p.id === rec.productId));
        if (!matchedProd) {
          matchedProd = {
            id: rec.productId || prodKey,
            name: rec.notes || "Produto Auditado",
            brand: "Dr. Oetker",
            isCompetitor: false,
          };
        }

        if (includedProdIds.has(matchedProd.id) || (rec.productId && includedProdIds.has(rec.productId))) {
          continue;
        }

        includedProdIds.add(matchedProd.id);
        if (rec.productId) includedProdIds.add(rec.productId);

        let diffDays = 0;
        if (rec.date) {
          const rDate = new Date(rec.date);
          diffDays = Math.max(0, Math.floor((Date.now() - rDate.getTime()) / (1000 * 60 * 60 * 24)));
        }

        const brandLower = (matchedProd.brand || "").toLowerCase();
        const isProprietary = !matchedProd.isCompetitor || brandLower.includes("oetker") || brandLower.includes("mavalerio");
        const countInChain = recordsCountByProductId.get(prodKey) || (rec.productId ? recordsCountByProductId.get(rec.productId) : 1) || 1;
        const currentPrice = rec.price;

        const statusDesc = diffDays === 0
          ? `Auditado hoje`
          : diffDays === 1
          ? `Auditado ontem`
          : `Auditado há ${diffDays} dias`;

        produtosVitrine.push({
          produto_id: matchedProd.id,
          produto: matchedProd.name,
          marca: matchedProd.brand || (isProprietary ? "Dr. Oetker" : "Concorrente"),
          categoria: matchedProd.category,
          gramatura: matchedProd.weight,
          codigo_interno: matchedProd.internalCode,
          preco: currentPrice,
          preco_formatado: `R$ ${currentPrice.toFixed(2).replace(".", ",")}`,
          data_coleta: rec.date ? new Date(rec.date).toISOString() : null,
          dias_atras: diffDays,
          dias_sem_auditoria: diffDays,
          total_registros_rede: countInChain,
          status_auditoria: "em_dia",
          status_descricao: statusDesc,
          pesquisador: rec.userName || latestRecord?.userName || undefined,
          imagem_url: matchedProd.imageUrl,
          tipo: isProprietary ? "propria" : "concorrente",
          em_campanha_guiada: activeCampaignIds.has(matchedProd.id),
        });
      }
    }
  } else {
    // CENÁRIO B: Pesquisa atrasada, pendente ou campanha ativa -> Mostra produtos com pelo menos um registro de auditoria na rede, ordenados por maior tempo sem auditoria
    const candidateProducts: Array<{
      product: ProductData;
      lastRec: RecordData;
      diffDays: number;
      isCampaignProd: boolean;
      isProprietary: boolean;
    }> = [];

    // Itera apenas sobre produtos que possuem pelo menos um registro de auditoria nesta rede
    for (const [productId, lastRec] of lastRecordByProductId.entries()) {
      let matchedProd = products.find((p) => p.id === productId);
      if (!matchedProd) {
        matchedProd = {
          id: productId,
          name: lastRec.notes || "Produto Auditado",
          brand: "Dr. Oetker",
          isCompetitor: false,
        };
      }

      let diffDays = 0;
      if (lastRec.date) {
        const rDate = new Date(lastRec.date);
        diffDays = Math.max(0, Math.floor((Date.now() - rDate.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const brandLower = (matchedProd.brand || "").toLowerCase();
      const isProprietary = !matchedProd.isCompetitor || brandLower.includes("oetker") || brandLower.includes("mavalerio");
      const isCampaignProd = activeCampaignIds.has(productId);

      candidateProducts.push({
        product: matchedProd,
        lastRec,
        diffDays,
        isCampaignProd,
        isProprietary,
      });
    }

    // Ordenação inteligente:
    // 1º: Produtos da campanha guiada ativa (se houver campanha ativa nesta rede)
    // 2º: Maior tempo sem auditoria (dias decorridos em ordem decrescente: do mais tempo sem auditoria para o mais recente)
    // 3º: Produtos de marca própria (Dr. Oetker / Mavalério) em caso de empate nos dias
    // 4º: Nome alfabético
    candidateProducts.sort((a, b) => {
      if (a.isCampaignProd !== b.isCampaignProd) {
        return a.isCampaignProd ? -1 : 1;
      }
      if (b.diffDays !== a.diffDays) {
        return b.diffDays - a.diffDays;
      }
      if (a.isProprietary !== b.isProprietary) {
        return a.isProprietary ? -1 : 1;
      }
      return a.product.name.localeCompare(b.product.name);
    });

    const topCandidates = candidateProducts.slice(0, 100);

    for (const item of topCandidates) {
      const prod = item.product;
      const lastRec = item.lastRec;
      const brandName = prod.brand || (item.isProprietary ? "Dr. Oetker" : "Concorrente");
      const currentPrice = lastRec.price;

      let statusAuditoria: "campanha_guiada" | "desatualizado" = item.isCampaignProd ? "campanha_guiada" : "desatualizado";
      let statusDesc = item.isCampaignProd
        ? `Item na Campanha Guiada (última coleta há ${item.diffDays} dias)`
        : `${item.diffDays} dias sem auditoria`;

      produtosVitrine.push({
        produto_id: prod.id,
        produto: prod.name,
        marca: brandName,
        categoria: prod.category,
        gramatura: prod.weight,
        codigo_interno: prod.internalCode,
        preco: currentPrice,
        preco_formatado: `R$ ${currentPrice.toFixed(2).replace(".", ",")}`,
        data_coleta: lastRec.date ? new Date(lastRec.date).toISOString() : null,
        dias_atras: item.diffDays,
        dias_sem_auditoria: item.diffDays,
        status_auditoria: statusAuditoria,
        status_descricao: statusDesc,
        pesquisador: lastRec.userName || latestRecord?.userName || undefined,
        imagem_url: prod.imageUrl,
        tipo: item.isProprietary ? "propria" : "concorrente",
        em_campanha_guiada: item.isCampaignProd,
      });
    }
  }

  const isCardAleatorio = cenario === "em_dia_sem_itens_pendentes";

  return {
    rede: chain.name,
    rede_id: chain.id,
    estados: chain.states || (chain.state ? [chain.state] : ["Minas Gerais"]),
    precos_atualizados: precosAtualizados,
    ultima_atualizacao: ultimaAtualizacao,
    dias_sem_atualizacao: diasSemAtualizacao,
    dias_limite: diasLimite,
    possui_pesquisa_guiada_ativa: possuiPesquisaGuiadaAtiva,
    pesquisa_guiada_ativa: activeCampaign
      ? {
          id: activeCampaign.id,
          titulo: activeCampaign.title,
          estado: activeCampaign.state,
          qtd_produtos: activeCampaign.productIds?.length || 0,
          notas: activeCampaign.notes || null,
        }
      : null,
    modo_exibicao_produtos: modoExibicaoProdutos,
    cenario: cenario,
    texto_botao_acao: textoBotaoAcao,
    titulo_vitrine_produtos: tituloVitrine,
    subtitulo_vitrine_produtos: subtituloVitrine,
    modo_exibicao_card: isCardAleatorio ? "aleatorio" : "ordenado_tempo_sem_auditoria",
    exibir_aleatorio_no_card: isCardAleatorio,
    card_exibicao: {
      modo: isCardAleatorio ? "aleatorio" : "ordenado",
      ordem: isCardAleatorio ? "aleatorio" : "do_mais_tempo_sem_auditoria_ao_mais_recente",
      quantidade_itens_card: 4,
      total_itens_retornados: produtosVitrine.length,
      tem_mais_itens: produtosVitrine.length > 4,
      quantidade_itens_modal: Math.max(0, produtosVitrine.length - 4),
      texto_botao_modal: "Ver todos os produtos pendentes",
      instrucao: isCardAleatorio
        ? "Sortear 4 produtos aleatórios entre os produtos retornados na API (até 100 itens)"
        : "Pegar os primeiros 4 produtos da lista (produtos_vitrine.slice(0, 4)) sem aleatorizar. O botão de abrir modal (acima da ação principal) exibe todos os itens",
    },
    botao_acao: {
      texto: textoBotaoAcao,
      link: linkPesquisa,
      tipo: possuiProdutosProgramados ? "programada" : (activeCampaign ? "guiada" : "padrao"),
    },
    ultimos_precos_coletados: produtosVitrine,
    produtos_vitrine: produtosVitrine,
    total_produtos_vitrine: produtosVitrine.length,
    precisa_pesquisa: precisaPesquisa,
    tipo_auditoria: possuiProdutosProgramados ? "programada" : (activeCampaign ? "guiada" : "padrao"),
    auditoria_programada: possuiProdutosProgramados
      ? {
          ativa: true,
          titulo: `Auditoria Programada (${overdueRecurringCandidates.length} itens recorrentes)`,
          motivo: "itens_recorrentes_sem_auditoria_15d",
          total_produtos: overdueRecurringCandidates.length,
          produtos_ids: overdueRecurringCandidates.map((p) => p.product.id),
        }
      : null,
    link_pesquisa: linkPesquisa,
    url_pesquisa_direta: linkPesquisa,
    motivo,
    mensagem,
    detalhes: {
      total_registros_rede: chainRecords.length,
      ultimo_pesquisador: latestRecord?.userName || null,
      estado_filtrado: estadoFiltro || "Todos",
      consulta_em: new Date().toISOString(),
    },
  };
}

/**
 * Handler principal do endpoint GET /api/v1/status-rede
 */
export default async function statusRedeHandler(req: any, res: any) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key, api-key, X-Requested-With, Accept");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      sucesso: false,
      erro: "Método não permitido",
      mensagem: "Este endpoint aceita apenas requisições HTTP GET.",
    });
  }

  try {
    // 1. Extração de parâmetros e token de autenticação (compatível com Express e Vercel Serverless)
    const authHeader = (req.headers["authorization"] || req.headers["Authorization"] || "") as string;
    const xApiKey = (req.headers["x-api-key"] || req.headers["X-Api-Key"] || req.headers["api-key"] || "") as string;
    
    // Suporte a URL parsing em qualquer runtime
    let queryObj = req.query || {};
    if (Object.keys(queryObj).length === 0 && req.url && req.url.includes("?")) {
      try {
        const parsedUrl = new URL(req.url, "http://localhost");
        const fromSearch: Record<string, string> = {};
        parsedUrl.searchParams.forEach((val, key) => {
          fromSearch[key] = val;
        });
        queryObj = fromSearch;
      } catch (e) {}
    }

    const queryKey = (queryObj.api_key || queryObj.apiKey || queryObj.token || "") as string;

    let providedToken = "";
    if (authHeader.startsWith("Bearer ") || authHeader.startsWith("bearer ")) {
      providedToken = authHeader.substring(7).trim();
    } else if (authHeader) {
      providedToken = authHeader.trim();
    } else if (xApiKey) {
      providedToken = xApiKey.trim();
    } else if (queryKey) {
      providedToken = String(queryKey).trim();
    }

    const validKeys = getValidApiKeys();
    
    // Aceita se corresponder aos tokens configurados, se iniciar com prefixo pricehub_sec_, ou se nenhuma chave foi enviada (modo público de consulta)
    const isTokenProvided = Boolean(providedToken);
    const isTokenValid = !isTokenProvided || validKeys.includes(providedToken) || providedToken.startsWith("pricehub_sec_");

    if (isTokenProvided && !isTokenValid) {
      return res.status(401).json({
        sucesso: false,
        erro: "Acesso não autorizado",
        mensagem:
          "Token de autenticação inválido. Utilize a chave gerada no painel do PriceHub (ex: pricehub_sec_soma_2026_aquilas) ou acesse publicamente sem cabeçalho.",
        instrucoes: {
          origem_permitida: "https://soma.aquilas.tech/",
          cabecalho_exemplo: `Authorization: Bearer ${DEFAULT_SOMA_API_KEY}`,
          documentacao: "Consulte a aba 'Integração SOMA' nas Configurações do PriceHub.",
        },
      });
    }

    // 2. Extração dos parâmetros da requisição
    const redeQuery = (queryObj.rede || queryObj.nome || queryObj.name || queryObj.chainId || "") as string;
    const estadoQuery = (queryObj.estado || queryObj.state || queryObj.uf || "") as string;
    const diasLimite = Math.max(1, parseInt(String(queryObj.dias_limite || queryObj.dias || 15), 10) || 15);

    // Determina o domínio base para o link de redirecionamento direto
    const hostHeader = (req.headers["x-forwarded-host"] || req.headers["host"] || "") as string;
    const protoHeader = (req.headers["x-forwarded-proto"] || "https") as string;
    let baseUrl = "https://pricehub.aquilas.tech";
    if (hostHeader) {
      if (hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1") || hostHeader.includes("run.app")) {
        baseUrl = `${protoHeader}://${hostHeader}`;
      } else if (hostHeader.includes("pricehub.aquilas.tech")) {
        baseUrl = "https://pricehub.aquilas.tech";
      }
    }

    // 3. Carregar dados do PriceHub
    const { chains, products, records, campaigns } = await loadPriceHubData();

    // 4. Caso a requisição não especifique a rede, retorna o status de todas as redes ativas
    if (!redeQuery || !redeQuery.trim()) {
      const activeChains = chains.filter((c) => c.active !== false);
      const results = activeChains.map((c) =>
        calculateChainStatus(c, records, campaigns, products, estadoQuery || undefined, diasLimite, baseUrl)
      );

      const totalComPesquisaPendente = results.filter((r) => r.precisa_pesquisa).length;
      const totalComPesquisaGuiada = results.filter((r) => r.possui_pesquisa_guiada_ativa).length;

      return res.status(200).json({
        sucesso: true,
        total_redes: results.length,
        dias_limite: diasLimite,
        resumo: {
          redes_precisando_pesquisa: totalComPesquisaPendente,
          redes_com_pesquisa_guiada_ativa: totalComPesquisaGuiada,
          redes_em_dia: results.length - totalComPesquisaPendente,
        },
        consulta_em: new Date().toISOString(),
        redes: results,
      });
    }

    // 5. Caso especifique a rede, localiza a melhor correspondência
    const matchedChain = findMatchingChain(redeQuery, chains);

    if (!matchedChain) {
      return res.status(404).json({
        sucesso: false,
        erro: "Rede não encontrada",
        mensagem: `Nenhuma rede correspondente ao termo '${redeQuery}' foi localizada no PriceHub.`,
        termo_pesquisado: redeQuery,
        redes_disponiveis: chains
          .filter((c) => c.active !== false)
          .map((c) => ({
            id: c.id,
            nome: c.name,
            estados: c.states || [c.state || "Minas Gerais"],
          })),
      });
    }

    // 6. Calcula o status detalhado da rede
    const statusResult = calculateChainStatus(
      matchedChain,
      records,
      campaigns,
      products,
      estadoQuery || undefined,
      diasLimite,
      baseUrl
    );

    return res.status(200).json({
      sucesso: true,
      ...statusResult,
    });
  } catch (error: any) {
    console.error("[API Status-Rede] Erro inesperado ao processar consulta:", error);
    return res.status(500).json({
      sucesso: false,
      erro: "Erro interno no servidor",
      mensagem: error.message || "Falha ao processar a consulta de status da rede.",
    });
  }
}
