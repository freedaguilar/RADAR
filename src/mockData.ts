import { Product, Chain, PriceRecord, User } from './types';

// Let's create localized products, inspired by Dr. Oetker & retail
export const INITIAL_PRODUCTS: Product[] = [
  // --- OWN PRODUCT PORTFOLIO ("Dr. Oetker") ---
  {
    id: 'prod-1',
    name: 'Fermento em Pó Químico Oetker 100g',
    category: 'Fermentos',
    subcategory: 'Fermento Químico',
    weight: '100g',
    imageUrl: 'https://images.unsplash.com/photo-1581447101795-7714d5960d3c?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 4.80,
    isCompetitor: false,
    brand: 'Dr. Oetker'
  },
  {
    id: 'prod-2',
    name: 'Gelatina sabor Morango Oetker 20g',
    category: 'Gelatinas',
    subcategory: 'Regular',
    weight: '20g',
    imageUrl: 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 1.89,
    isCompetitor: false,
    brand: 'Dr. Oetker'
  },
  {
    id: 'prod-3',
    name: 'Pudim sabor Chocolate Oetker 40g',
    category: 'Sobremesas em Pó',
    subcategory: 'Regular',
    weight: '40g',
    imageUrl: 'https://images.unsplash.com/photo-1541795795328-f073b763494e?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 2.45,
    isCompetitor: false,
    brand: 'Dr. Oetker'
  },
  {
    id: 'prod-4',
    name: 'Amido de Milho Oetker 200g',
    category: 'Ingredientes de Confeitaria',
    subcategory: 'Regular',
    weight: '200g',
    imageUrl: 'https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 3.99,
    isCompetitor: false,
    brand: 'Dr. Oetker'
  },
  {
    id: 'prod-5',
    name: 'Chá Vermelho Hibisco e Amora Oetker 15s',
    category: 'Chás e Infusões',
    subcategory: 'Regular',
    weight: '15 Sachês',
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 6.20,
    isCompetitor: false,
    brand: 'Dr. Oetker'
  },
  {
    id: 'prod-6',
    name: 'Pizza Ristorante Mozzarella 355g',
    category: 'Congelados',
    subcategory: 'Premium',
    weight: '355g',
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 22.90,
    isCompetitor: false,
    brand: 'Dr. Oetker'
  },
  // --- OWN PRODUCT PORTFOLIO ("Mavalério") ---
  {
    id: 'prod-7',
    name: 'Granulado Macio de Chocolate Mavalério 120g',
    category: 'Ingredientes de Confeitaria',
    subcategory: 'Confeiteiro',
    weight: '120g',
    imageUrl: 'https://images.unsplash.com/photo-1516685018646-549198525c1b?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 4.25,
    isCompetitor: false,
    brand: 'Mavalério'
  },
  {
    id: 'prod-8',
    name: 'Chocolate em Pó Solúvel 50% Cacau Mavalério 200g',
    category: 'Ingredientes de Confeitaria',
    subcategory: 'Premium',
    weight: '200g',
    imageUrl: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 11.40,
    isCompetitor: false,
    brand: 'Mavalério'
  },
  {
    id: 'prod-9',
    name: 'Cobertura Fracionada Meio Amargo em Gotas Mavalério Premium 1kg',
    category: 'Coberturas',
    subcategory: 'Premium',
    weight: '1kg',
    imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92ca8a8a7a?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 27.90,
    isCompetitor: false,
    brand: 'Mavalério'
  },

  // --- COMPETITOR PORTFOLIO ---
  {
    id: 'comp-1',
    name: 'Fermento em Pó Químico Royal 100g',
    category: 'Fermentos',
    subcategory: 'Fermento em Pó',
    weight: '100g',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 5.10,
    isCompetitor: true,
    brand: 'Royal'
  },
  {
    id: 'comp-2',
    name: 'Fermento Químico em Pó Fleischmann 100g',
    category: 'Fermentos',
    subcategory: 'Fermento Químico',
    weight: '100g',
    imageUrl: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 4.65,
    isCompetitor: true,
    brand: 'Fleischmann'
  },
  {
    id: 'comp-3',
    name: 'Gelatina sabor Morango Royal 20g',
    category: 'Gelatinas',
    subcategory: 'Regular',
    weight: '20g',
    imageUrl: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 1.99,
    isCompetitor: true,
    brand: 'Royal'
  },
  {
    id: 'comp-4',
    name: 'Pudim sabor Chocolate Royal 40g',
    category: 'Sobremesas em Pó',
    subcategory: 'Regular',
    weight: '40g',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 2.75,
    isCompetitor: true,
    brand: 'Royal'
  },
  {
    id: 'comp-5',
    name: 'Chá de Mate com Limão Leão Fuze 15s',
    category: 'Chás e Infusões',
    subcategory: 'Regular',
    weight: '15 Sachês',
    imageUrl: 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 6.90,
    isCompetitor: true,
    brand: 'Leão Fuze'
  },
  {
    id: 'comp-6',
    name: 'Pizza Sadia Mussarela Congelada 460g',
    category: 'Congelados',
    subcategory: 'Regular',
    weight: '460g',
    imageUrl: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 18.90,
    isCompetitor: true,
    brand: 'Sadia'
  },
  {
    id: 'comp-7',
    name: 'Granulado de Chocolate Harald Melken 120g',
    category: 'Ingredientes de Confeitaria',
    subcategory: 'Premium',
    weight: '120g',
    imageUrl: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 4.49,
    isCompetitor: true,
    brand: 'Harald'
  },
  {
    id: 'comp-8',
    name: 'Chocolate em Pó Solúvel 50% Dois Frades Nestlé 200g',
    category: 'Ingredientes de Confeitaria',
    subcategory: 'Confeiteiro',
    weight: '200g',
    imageUrl: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 12.30,
    isCompetitor: true,
    brand: 'Nestlé'
  },
  {
    id: 'comp-9',
    name: 'Cobertura Fracionada Meio Amargo Sicao Mais Gotas 1kg',
    category: 'Coberturas',
    subcategory: 'Confeiteiro',
    weight: '1kg',
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=80',
    active: true,
    basePrice: 26.50,
    isCompetitor: true,
    brand: 'Sicao'
  }
];

export const INITIAL_CHAINS: Chain[] = [
  { id: 'chain-1', name: 'Carrefour Supermercado', logoColor: 'bg-blue-600', active: true },
  { id: 'chain-2', name: 'Pão de Açúcar', logoColor: 'bg-emerald-700', active: true },
  { id: 'chain-3', name: 'Sonda Supermercados', logoColor: 'bg-red-500', active: true },
  { id: 'chain-4', name: 'Mambo Supermercados', logoColor: 'bg-amber-600', active: true },
  { id: 'chain-5', name: 'Grupo Hirota', logoColor: 'bg-orange-700', active: true }
];

export const INITIAL_USERS: User[] = [
  { id: 'user-1', name: 'Jesse Aguilar', email: 'aguilar.jesse@gmail.com', role: 'gestor', active: true, avatarUrl: 'JA' },
  { id: 'user-2', name: 'Carla Souza', email: 'carla.audit@radar.com', role: 'vendedor', active: true, avatarUrl: 'CS' },
  { id: 'user-3', name: 'Rodrigo Lima', email: 'rodrigo.lima@radar.com', role: 'vendedor', active: true, avatarUrl: 'RL' }
];

// Generates interesting historic records for testing that varies based on date
export const generateMockHistory = (): PriceRecord[] => {
  const records: PriceRecord[] = [];
  const startDay = new Date();
  startDay.setDate(startDay.getDate() - 40); // 40 days ago

  const auditingUsers = [
    { name: 'Carla Souza', email: 'carla.audit@radar.com' },
    { name: 'Rodrigo Lima', email: 'rodrigo.lima@radar.com' }
  ];

  // For each product, chain, generate price checkpoints every 10 days
  INITIAL_PRODUCTS.forEach((product) => {
    INITIAL_CHAINS.forEach((chain, chainIdx) => {
      // Variance based on chain index to create interesting comparisons
      const chainFactor = 0.95 + (chainIdx * 0.03); // +/- some % differences Between chains
      const basePriceInChain = Number((product.basePrice * chainFactor).toFixed(2));

      // Create 4 data points over last 40 days
      for (let i = 0; i < 4; i++) {
        const recordDate = new Date(startDay);
        recordDate.setDate(recordDate.getDate() + (i * 10) + (chainIdx * 2)); // slight jitter in date

        // Price changes slightly
        const trend = i === 0 ? -0.05 : i === 1 ? 0.02 : i === 2 ? -0.01 : 0.04;
        const currentPrice = Number((basePriceInChain * (1 + trend)).toFixed(2));

        const user = auditingUsers[(chainIdx + i) % auditingUsers.length];

        // Custom clean SVG graphics as mock receipt/shelf camera photos
        const svgColor = product.id === 'prod-1' ? '%23D40511' : '%234B5563';
        const photoSvg = `data:image/svg+xml;utf8,<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="%23f3f4f6"/><path d="M 0,220 L 400,220 L 400,300 L 0,300 Z" fill="%23e5e7eb"/><circle cx="200" cy="110" r="40" fill="${svgColor}"/><rect x="180" y="80" width="40" height="60" rx="3" fill="%23ffffff" opacity="0.9"/><text x="200" y="165" font-family="sans-serif" font-weight="bold" font-size="12" fill="%23374151" text-anchor="middle">${product.name.substring(0, 20)}...</text><rect x="120" y="190" width="160" height="40" rx="6" fill="%231a1a1a"/><text x="200" y="215" font-family="monospace" font-weight="bold" font-size="15" fill="%2310b981" text-anchor="middle">R$ ${currentPrice.toFixed(2)}</text><text x="200" y="270" font-family="sans-serif" font-size="10" fill="%236b7280" text-anchor="middle">Auditoria ${chain.name}</text></svg>`;

        records.push({
          id: `rec-${product.id}-${chain.id}-${i}`,
          productId: product.id,
          chainId: chain.id,
          price: currentPrice,
          date: recordDate.toISOString().split('T')[0],
          imageUrl: photoSvg,
          notes: i === 3 ? 'Preço promocional destacado na gôndola.' : undefined,
          userName: user.name,
          userEmail: user.email,
        });
      }
    });
  });

  return records;
};

export const getInitialState = (): {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  users: User[];
  currentUser: User | null;
} => {
  // Try loading from localStorage
  try {
    const localStore = localStorage.getItem('radar_price_state');
    if (localStore) {
      const parsed = JSON.parse(localStore);
      if (parsed.products && parsed.chains && parsed.records && parsed.users) {
        // Check if current user is valid of type User
        const hasValidUserObj = parsed.currentUser && 
                                typeof parsed.currentUser === 'object' && 
                                typeof parsed.currentUser.id === 'string' && 
                                typeof parsed.currentUser.name === 'string';
        
        return {
          products: parsed.products,
          chains: parsed.chains,
          records: parsed.records,
          users: parsed.users,
          currentUser: hasValidUserObj ? parsed.currentUser : null
        };
      }
    }
  } catch (e) {
    console.error('Falha ao restaurar do local storage', e);
  }

  // Fallback to initial
  return {
    products: INITIAL_PRODUCTS,
    chains: INITIAL_CHAINS,
    records: generateMockHistory(),
    users: INITIAL_USERS,
    currentUser: INITIAL_USERS[0]
  };
};

export const saveStateToLocalStorage = (state: {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  users: User[];
  currentUser: User | null;
}) => {
  try {
    localStorage.setItem('radar_price_state', JSON.stringify(state));
  } catch (e) {
    console.error('Falha ao salvar no local storage', e);
  }
};
