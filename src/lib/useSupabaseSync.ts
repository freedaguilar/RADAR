import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Product, Chain, PriceRecord, User, GuidedCampaign } from '../types';

export function useSupabaseSync() {
  const [isConfigured, setIsConfigured] = useState(
    !!import.meta.env.VITE_SUPABASE_URL && (!!import.meta.env.VITE_SUPABASE_ANON_KEY || !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  );

  async function fetchAll() {
    if (!isConfigured) return null;
    
    let campaignsRes: any = { data: null, error: null };
    try {
      campaignsRes = await supabase.from('guided_campaigns').select('*');
    } catch {
      campaignsRes = { data: null, error: null };
    }

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

    const guidedCampaigns = (campaignsRes?.data || []).map((camp: any) => {
      let productIds: string[] = [];
      if (Array.isArray(camp.product_ids)) {
        productIds = camp.product_ids;
      } else if (typeof camp.product_ids === 'string') {
        try {
          const parsed = JSON.parse(camp.product_ids);
          if (Array.isArray(parsed)) productIds = parsed;
        } catch {
          productIds = camp.product_ids.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
      }

      return {
        id: camp.id,
        title: camp.title,
        chainId: camp.chain_id,
        state: camp.state || 'Minas Gerais',
        productIds,
        active: Boolean(camp.active),
        notes: camp.notes || undefined,
        createdBy: camp.created_by || undefined,
        createdAt: camp.created_at || new Date().toISOString(),
        updatedAt: camp.updated_at || undefined,
      } as GuidedCampaign;
    });

    return { products, chains, records, users, guidedCampaigns };
  }

  return { isConfigured, fetchAll };
}
