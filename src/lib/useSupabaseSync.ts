import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Product, Chain, PriceRecord, User } from '../types';

export function useSupabaseSync() {
  const [isConfigured, setIsConfigured] = useState(
    !!import.meta.env.VITE_SUPABASE_URL && (!!import.meta.env.VITE_SUPABASE_ANON_KEY || !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  );

  async function fetchAll() {
    if (!isConfigured) return null;
    
    const [productsRes, chainsRes, recordsRes, usersRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('chains').select('*'),
      supabase.from('price_records').select('*'),
      supabase.from('app_users').select('*'),
    ]);

    // Map snake_case to camelCase
    const products = (productsRes.data || []).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory,
      weight: p.weight,
      imageUrl: p.image_url,
      active: p.active,
      basePrice: Number(p.base_price),
      isCompetitor: p.is_competitor,
      brand: p.brand,
      internalCode: p.internal_code || undefined
    })) as Product[];

    const chains = (chainsRes.data || []).map(c => {
      let statesList: string[] = [];
      
      // Check comma-separated string in "state"
      if (typeof c.state === 'string' && c.state.trim()) {
        statesList = c.state.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      
      // Check array in "states"
      if (Array.isArray(c.states) && c.states.length > 0) {
        const arrayStates = c.states.map((s: any) => String(s).trim()).filter(Boolean);
        if (arrayStates.length > statesList.length) {
          statesList = arrayStates;
        } else if (statesList.length === 0) {
          statesList = arrayStates;
        }
      }

      if (statesList.length === 0) {
        statesList = ['Minas Gerais'];
      }

      return {
        id: c.id,
        name: c.name,
        logoColor: c.logo_color,
        logoUrl: c.logo_url,
        active: c.active,
        state: statesList.join(', '),
        states: statesList
      };
    }) as Chain[];

    const records = (recordsRes.data || []).map(r => ({
      id: r.id,
      productId: r.product_id || '',
      chainId: r.chain_id,
      price: Number(r.price),
      date: r.date,
      imageUrl: r.image_url,
      notes: r.notes,
      userName: r.user_name,
      userEmail: r.user_email,
      state: r.state || 'Minas Gerais',
    })) as PriceRecord[];

    const users = (usersRes.data || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      avatarUrl: u.avatar_url,
      password: u.password,
    })) as User[];

    return { products, chains, records, users };
  }

  return { isConfigured, fetchAll };
}
