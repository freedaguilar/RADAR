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

interface RecordData {
  id: string;
  chainId: string;
  price: number;
  date: string;
  state?: string;
  userName?: string;
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

/**
 * Carrega redes, registros de preço e pesquisas guiadas do Supabase com fallback gracioso
 */
async function loadPriceHubData(): Promise<{
  chains: ChainData[];
  records: RecordData[];
  campaigns: CampaignData[];
}> {
  const supabase = getServerSupabaseClient();
  let chains: ChainData[] = [];
  let records: RecordData[] = [];
  let campaigns: CampaignData[] = [];

  if (supabase) {
    try {
      const [chainsRes, recordsRes, campaignsRes] = await Promise.all([
        supabase.from("chains").select("id, name, active, state, states"),
        supabase.from("price_records").select("id, chain_id, price, date, state, user_name").order("date", { ascending: false }),
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

      if (recordsRes.data && recordsRes.data.length > 0) {
        records = recordsRes.data.map((r: any) => ({
          id: String(r.id),
          chainId: String(r.chain_id),
          price: Number(r.price),
          date: String(r.date),
          state: r.state || "Minas Gerais",
          userName: r.user_name || undefined,
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

  // Fallback para dados base locais caso o banco esteja vazio ou inacessível
  if (chains.length === 0) {
    chains = FALLBACK_CHAINS;
  }

  return { chains, records, campaigns };
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

  // 3. Critério de necessidade de pesquisa
  const precisaPesquisa = !precosAtualizados || possuiPesquisaGuiadaAtiva;

  // 4. Motivo e mensagem amigável e explicativa
  let motivo: "em_dia" | "precos_desatualizados" | "pesquisa_guiada_ativa" | "pesquisa_guiada_ativa_e_precos_desatualizados" | "sem_historico" = "em_dia";
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
  } else {
    motivo = "em_dia";
    mensagem = `Preços atualizados recentemente na rede '${chain.name}' (última pesquisa há ${diasSemAtualizacao} dia(s)). Fila tradicional regular e sem pesquisa guiada pendente.`;
  }

  // 5. Construir Link Direto para o usuário do SOMA clicar e ir direto para a pesquisa
  const linkParams = new URLSearchParams();
  linkParams.set("rede", chain.name);
  linkParams.set("chain_id", chain.id);
  if (estadoFiltro) {
    linkParams.set("estado", estadoFiltro);
  } else if (chain.states && chain.states.length === 1) {
    linkParams.set("estado", chain.states[0]);
  }
  if (activeCampaign) {
    linkParams.set("campanha_id", activeCampaign.id);
  }
  linkParams.set("origem", "soma");
  const linkPesquisa = `${baseUrl}/?${linkParams.toString()}`;

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
    precisa_pesquisa: precisaPesquisa,
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
    const { chains, records, campaigns } = await loadPriceHubData();

    // 4. Caso a requisição não especifique a rede, retorna o status de todas as redes ativas
    if (!redeQuery || !redeQuery.trim()) {
      const activeChains = chains.filter((c) => c.active !== false);
      const results = activeChains.map((c) =>
        calculateChainStatus(c, records, campaigns, estadoQuery || undefined, diasLimite, baseUrl)
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
