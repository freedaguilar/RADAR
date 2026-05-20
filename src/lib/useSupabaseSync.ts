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
      brand: p.brand
    })) as Product[];

    const chains = (chainsRes.data || []).map(c => ({
      id: c.id,
      name: c.name,
      logoColor: c.logo_color,
      active: c.active
    })) as Chain[];

    const records = (recordsRes.data || []).map(r => ({
      id: r.id,
      productId: r.product_id,
      chainId: r.chain_id,
      price: Number(r.price),
      date: r.date,
      imageUrl: r.image_url,
      notes: r.notes,
      userName: r.user_name,
      userEmail: r.user_email
    })) as PriceRecord[];

    const users = (usersRes.data || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      avatarUrl: u.avatar_url
    })) as User[];

    return { products, chains, records, users };
  }

  return { isConfigured, fetchAll };
}
