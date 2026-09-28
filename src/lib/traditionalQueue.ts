import { Product, Chain, PriceRecord, CustomTraditionalQueue, getChainStates } from '../types';
import { normalizeString, parsePriceRecordMeta } from './textUtils';
import { supabase } from './supabase';

/**
 * SQL snippet para criar a tabela no Supabase caso o gestor deseje sincronização em nuvem
 */
export const CUSTOM_TRADITIONAL_QUEUES_SQL = `-- Criar tabela para personalização da fila tradicional pelo gestor
CREATE TABLE IF NOT EXISTS public.custom_traditional_queues (
  id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'Minas Gerais',
  product_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by TEXT
);

-- Habilitar RLS e permitir leitura/escrita
ALTER TABLE public.custom_traditional_queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on custom_traditional_queues" ON public.custom_traditional_queues;
CREATE POLICY "Allow public all on custom_traditional_queues" ON public.custom_traditional_queues FOR ALL TO public USING (true) WITH CHECK (true);
`;

export const getCategoryRank = (categoryName?: string): number => {
  if (!categoryName) return 50;
  const cat = categoryName.trim().toLowerCase();
  
  if (cat.includes('gelatina')) return 1;
  if (cat.includes('sobremesa')) return 2;
  if (cat.includes('fermento')) return 3;
  if (cat.includes('cobertura')) return 999;
  
  return 50;
};

export const getSubcategoryRank = (subcategoryName?: string): number => {
  if (!subcategoryName) return 50;
  const sub = subcategoryName.trim().toLowerCase();
  
  if (sub.includes('regular') || sub.includes('tradicional') || sub.includes('químico') || sub.includes('quimico') || sub.includes('pó') || sub.includes('po')) return 1;
  if (sub.includes('zero') || sub.includes('diet') || sub.includes('light') || sub.includes('sem açúcar') || sub.includes('sem acucar')) return 2;
  if (sub.includes('premium') || sub.includes('gourmet') || sub.includes('especial')) return 3;
  if (sub.includes('confeiteiro') || sub.includes('profissional') || sub.includes('food service')) return 4;
  
  return 10;
};

export const getBrandRank = (p: Product): number => {
  if (!p.isCompetitor) {
    const brandLower = (p.brand || '').toLowerCase();
    if (brandLower.includes('oetker')) return 1;
    if (brandLower.includes('mavalério') || brandLower.includes('mavalerio')) return 2;
    return 3;
  }
  return 10;
};

export const getBrandDisplayName = (p: Product): string => {
  if (!p.brand) {
    return p.isCompetitor ? 'Concorrente' : 'Dr. Oetker';
  }
  return p.brand.trim();
};

export const isStateMatch = (campState?: string, targetState?: string): boolean => {
  if (!campState || !targetState) return false;
  const cs = campState.trim().toLowerCase();
  const ts = targetState.trim().toLowerCase();
  if (cs === 'todos' || cs === 'todas') return true;
  if (cs === ts) return true;
  const cNorm = normalizeString(cs);
  const tNorm = normalizeString(ts);
  if (cNorm === tNorm) return true;
  const stateMap: Record<string, string> = {
    'mg': 'minas gerais', 'minas gerais': 'mg',
    'sp': 'sao paulo', 'sao paulo': 'sp',
    'rj': 'rio de janeiro', 'rio de janeiro': 'rj',
    'es': 'espirito santo', 'espirito santo': 'es',
    'pr': 'parana', 'parana': 'pr',
    'sc': 'santa catarina', 'santa catarina': 'sc',
    'rs': 'rio grande do sul', 'rio grande do sul': 'rs',
    'go': 'goias', 'goias': 'go',
    'df': 'distrito federal', 'distrito federal': 'df',
    'ba': 'bahia', 'bahia': 'ba',
    'pe': 'pernambuco', 'pernambuco': 'pe',
    'ce': 'ceara', 'ceara': 'ce',
  };
  return stateMap[cNorm] === tNorm;
};

/**
 * Calcula a fila tradicional padrão (automática baseada nos registros históricos na rede)
 */
export function computeDefaultTraditionalQueue(
  products: Product[],
  chains: Chain[],
  records: PriceRecord[] = [],
  selectedChainId: string,
  selectedState: string = 'Minas Gerais'
): Product[] {
  if (!products || products.length === 0) return [];

  // Contagem de registros consolidados
  const chainRecordCounts: Record<string, number> = {};
  const mgChainRecordCounts: Record<string, number> = {};
  const productRecordCounts: Record<string, number> = {};

  records.forEach((r) => {
    if (r.price <= 0) return;
    const { isPending } = parsePriceRecordMeta(r.notes);
    if (isPending) return;

    productRecordCounts[r.productId] = (productRecordCounts[r.productId] || 0) + 1;

    if (r.chainId === selectedChainId) {
      const recState = r.state || 'Minas Gerais';
      if (isStateMatch(recState, selectedState)) {
        chainRecordCounts[r.productId] = (chainRecordCounts[r.productId] || 0) + 1;
      }
      if (isStateMatch(recState, 'Minas Gerais')) {
        mgChainRecordCounts[r.productId] = (mgChainRecordCounts[r.productId] || 0) + 1;
      }
    }
  });

  const activeProds = products.filter((p) => p.active);
  const isMG = !selectedState || isStateMatch(selectedState, 'Minas Gerais');
  const selectedChain = chains.find((c) => c.id === selectedChainId);
  const chainStates = selectedChain ? getChainStates(selectedChain) : [];
  const chainHasMG =
    chainStates.some((s) => isStateMatch(s, 'Minas Gerais')) ||
    (selectedChainId
      ? records.some(
          (r) =>
            r.chainId === selectedChainId &&
            isStateMatch(r.state || 'Minas Gerais', 'Minas Gerais')
        )
      : false);

  let eligibleProducts: Product[] = [];

  if (isMG) {
    // 1. Em Minas Gerais: produtos ativos que possuem pelo menos 1 registro nesta rede em MG
    eligibleProducts = activeProds.filter((p) => (mgChainRecordCounts[p.id] || 0) > 0);

    if (eligibleProducts.length === 0) {
      const prodsWithAnyRecord = activeProds.filter((p) => (productRecordCounts[p.id] || 0) > 0);
      eligibleProducts = prodsWithAnyRecord.length > 0 ? prodsWithAnyRecord : activeProds;
    }
  } else if (!chainHasMG) {
    // 2. Redes que NÃO possuem em MG:
    eligibleProducts = activeProds.filter((p) => (chainRecordCounts[p.id] || 0) > 0);

    if (eligibleProducts.length === 0) {
      const prodsWithAnyRecord = activeProds.filter((p) => (productRecordCounts[p.id] || 0) > 0);
      eligibleProducts = prodsWithAnyRecord.length > 0 ? prodsWithAnyRecord : activeProds;
    }
  } else {
    // 3. Redes que possuem em MG, sendo auditadas em outros estados:
    const mgProductIds = new Set(
      activeProds.filter((p) => (mgChainRecordCounts[p.id] || 0) > 0).map((p) => p.id)
    );

    const stateProductIds = new Set(
      activeProds.filter((p) => (chainRecordCounts[p.id] || 0) > 0).map((p) => p.id)
    );

    const combinedProductIds = new Set([...mgProductIds, ...stateProductIds]);

    if (combinedProductIds.size > 0) {
      eligibleProducts = activeProds.filter((p) => combinedProductIds.has(p.id));
    } else {
      const prodsWithAnyRecord = activeProds.filter((p) => (productRecordCounts[p.id] || 0) > 0);
      eligibleProducts = prodsWithAnyRecord.length > 0 ? prodsWithAnyRecord : activeProds;
    }
  }

  // Ordenação padrão inteligente
  return [...eligibleProducts].sort((a, b) => {
    const catA = a.category || 'Outros';
    const catB = b.category || 'Outros';

    const rankCatA = getCategoryRank(catA);
    const rankCatB = getCategoryRank(catB);

    if (rankCatA !== rankCatB) {
      return rankCatA - rankCatB;
    }

    if (catA !== catB) {
      const catCompare = catA.localeCompare(catB);
      if (catCompare !== 0) return catCompare;
    }

    const subA = a.subcategory || '';
    const subB = b.subcategory || '';
    const rankSubA = getSubcategoryRank(subA);
    const rankSubB = getSubcategoryRank(subB);

    if (rankSubA !== rankSubB) {
      return rankSubA - rankSubB;
    }

    if (subA !== subB) {
      const subCompare = subA.localeCompare(subB);
      if (subCompare !== 0) return subCompare;
    }

    const rankBrandA = getBrandRank(a);
    const rankBrandB = getBrandRank(b);

    if (rankBrandA !== rankBrandB) {
      return rankBrandA - rankBrandB;
    }

    const brandA = getBrandDisplayName(a);
    const brandB = getBrandDisplayName(b);
    if (brandA !== brandB) {
      const brandCompare = brandA.localeCompare(brandB);
      if (brandCompare !== 0) return brandCompare;
    }

    const countA =
      (chainRecordCounts[a.id] || 0) > 0
        ? chainRecordCounts[a.id] || 0
        : mgChainRecordCounts[a.id] || 0;
    const countB =
      (chainRecordCounts[b.id] || 0) > 0
        ? chainRecordCounts[b.id] || 0
        : mgChainRecordCounts[b.id] || 0;
    if (countB !== countA) return countB - countA;

    return a.name.localeCompare(b.name);
  });
}

/**
 * Localiza a fila personalizada salva para esta rede e estado
 */
export function findCustomTraditionalQueue(
  selectedChainId: string,
  selectedState: string = 'Minas Gerais',
  customQueues: CustomTraditionalQueue[] = []
): CustomTraditionalQueue | null {
  if (!customQueues || customQueues.length === 0 || !selectedChainId) return null;

  // 1. Correspondência exata da rede e estado
  const exact = customQueues.find(
    (q) => q.chainId === selectedChainId && isStateMatch(q.state, selectedState)
  );
  if (exact) return exact;

  // 2. Correspondência para "Todos"
  const allStates = customQueues.find(
    (q) =>
      q.chainId === selectedChainId &&
      (q.state?.toLowerCase() === 'todos' || q.state?.toLowerCase() === 'nacional')
  );
  if (allStates) return allStates;

  return null;
}

/**
 * Retorna a fila tradicional ativa (personalizada se houver, ou automática padrão se não houver)
 */
export function getActiveTraditionalQueue(
  products: Product[],
  chains: Chain[],
  records: PriceRecord[] = [],
  selectedChainId: string,
  selectedState: string = 'Minas Gerais',
  customQueues: CustomTraditionalQueue[] = []
): {
  products: Product[];
  isCustom: boolean;
  customQueueObj: CustomTraditionalQueue | null;
} {
  const custom = findCustomTraditionalQueue(selectedChainId, selectedState, customQueues);

  if (custom && Array.isArray(custom.productIds) && custom.productIds.length > 0) {
    const prodMap = new Map<string, Product>();
    products.forEach((p) => prodMap.set(p.id, p));

    const orderedProducts: Product[] = [];
    for (const pId of custom.productIds) {
      const p = prodMap.get(pId);
      if (p && p.active) {
        orderedProducts.push(p);
      }
    }

    if (orderedProducts.length > 0) {
      return {
        products: orderedProducts,
        isCustom: true,
        customQueueObj: custom,
      };
    }
  }

  // Fallback para a fila padrão automática
  const defaultList = computeDefaultTraditionalQueue(
    products,
    chains,
    records,
    selectedChainId,
    selectedState
  );

  return {
    products: defaultList,
    isCustom: false,
    customQueueObj: null,
  };
}
