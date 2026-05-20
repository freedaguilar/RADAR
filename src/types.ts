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
}

export interface Chain {
  id: string;
  name: string;
  logoColor: string; // Tailwinds background color code for logo accent
  active: boolean;
  logoUrl?: string;
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'gestor' | 'vendedor';
  active: boolean;
  avatarUrl?: string;
}

export interface AppState {
  products: Product[];
  chains: Chain[];
  records: PriceRecord[];
  users: User[];
  currentUser: User | null;
}
