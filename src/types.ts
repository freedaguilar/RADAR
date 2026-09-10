export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string; // e.g. "Premium", "Confeiteiro", "Regular", "Zero", "Fermento Químico"
  weight?: string; // e.g. "100g", "250g", "1kg"
  imageUrl: string;
  active: boolean;
  basePrice: number; // For initial mock histories
  isCompetitor?: boolean; // True for adversary products
  brand?: string; // Brand name, eg. "Dr. Oetker", "Royal", "Dona Benta"
  internalCode?: string; // Código interno para produtos de marca própria (Dr. Oetker e Mavalério)
}

export const RESEARCH_STATES = [
  { name: 'Amazonas', uf: 'AM', region: 'Norte' },
  { name: 'Acre', uf: 'AC', region: 'Norte' },
  { name: 'Rondônia', uf: 'RO', region: 'Norte' },
  { name: 'Mato Grosso', uf: 'MT', region: 'Centro-Oeste' },
  { name: 'Tocantins', uf: 'TO', region: 'Norte' },
  { name: 'Goiás', uf: 'GO', region: 'Centro-Oeste' },
  { name: 'Distrito Federal', uf: 'DF', region: 'Centro-Oeste' },
  { name: 'Minas Gerais', uf: 'MG', region: 'Sudeste' },
] as const;

export type ResearchStateName = typeof RESEARCH_STATES[number]['name'];

export interface Chain {
  id: string;
  name: string;
  logoColor: string; // Tailwinds background color code for logo accent
  active: boolean;
  logoUrl?: string;
  state?: string; // Estado legado/principal (default: 'Minas Gerais')
  states?: string[]; // Lista de estados onde a rede atua (ex: ['Minas Gerais', 'Goiás', 'Distrito Federal'])
}

export function getChainStates(chain: Chain): string[] {
  if (!chain) return ['Minas Gerais'];
  if (Array.isArray(chain.states) && chain.states.length > 0) {
    const valid = chain.states.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    if (valid.length > 0) return valid;
  }
  if (typeof chain.state === 'string' && chain.state.trim()) {
    return chain.state.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return ['Minas Gerais'];
}

export function isChainInState(chain: Chain, stateName: string): boolean {
  if (!chain || !stateName) return false;
  const states = getChainStates(chain);
  return states.includes(stateName);
}

export interface PriceRecord {
  id: string;
  productId: string;
  chainId: string;
  price: number;
  date: string; // ISO String or YYYY-MM-DD
  imageUrl: string; // URL or base64 data url
  notes?: string;
  userName: string;
  userEmail: string;
  state?: string; // Estado onde o preço foi coletado / pesquisado
}

export function getPriceRecordState(record: PriceRecord, chains?: Chain[]): string {
  if (!record) return 'Minas Gerais';
  if (typeof record.state === 'string' && record.state.trim()) {
    return record.state.trim();
  }
  if (typeof record.notes === 'string' && record.notes) {
    const match = record.notes.match(/\[Estado:\s*([^\]]+)\]/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  if (chains && record.chainId) {
    const chain = chains.find(c => c.id === record.chainId);
    if (chain) {
      const cStates = getChainStates(chain);
      if (cStates.length > 0) return cStates[0];
    }
  }
  return 'Minas Gerais';
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'gestor' | 'vendedor' | 'promotor';
  active: boolean;
  avatarUrl?: string;
  password?: string;
  isGuest?: boolean;
}

export interface AppState {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  users: User[];
  currentUser: User | null;
}
