import { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { Product, Chain, PriceRecord, User, GuidedCampaign, CustomTraditionalQueue } from '../types';

export function useSupabaseSync(
  onCampaignsRealtimeUpdate?: (campaigns: GuidedCampaign[]) => void,
  onCustomQueuesRealtimeUpdate?: (queues: CustomTraditionalQueue[]) => void
) {
  const [isConfigured, setIsConfigured] = useState(
    !!import.meta.env.VITE_SUPABASE_URL && (!!import.meta.env.VITE_SUPABASE_ANON_KEY || !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  );

  const callbackRef = useRef(onCampaignsRealtimeUpdate);
  callbackRef.current = onCampaignsRealtimeUpdate;

  const customQueuesCallbackRef = useRef(onCustomQueuesRealtimeUpdate);
  customQueuesCallbackRef.current = onCustomQueuesRealtimeUpdate;

  async function fetchCampaigns(): Promise<GuidedCampaign[]> {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('guided_campaigns').select('*').order('created_at', { ascending: false });
      if (error) {
        console.warn('Aviso ao consultar guided_campaigns no Supabase:', error.message);
        return [];
      }
      return (data || []).map((camp: any) => {
        let productIds: string[] = [];
        const rawIds = camp.product_ids || camp.productIds;
        if (Array.isArray(rawIds)) {
          productIds = rawIds;
        } else if (typeof rawIds === 'string') {
          try {
            const parsed = JSON.parse(rawIds);
            if (Array.isArray(parsed)) productIds = parsed;
          } catch {
            productIds = rawIds.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }

        return {
          id: String(camp.id),
          title: camp.title,
          chainId: camp.chain_id || camp.chainId,
          state: camp.state || 'Minas Gerais',
          productIds,
          active: Boolean(camp.active === true || camp.active === 'true' || camp.active === 1 || camp.active === 't'),
          notes: camp.notes || undefined,
          createdBy: camp.created_by || camp.createdBy || undefined,
          createdAt: camp.created_at || camp.createdAt || new Date().toISOString(),
          updatedAt: camp.updated_at || camp.updatedAt || undefined,
        } as GuidedCampaign;
      });
    } catch (err) {
      console.warn('Exceção ao buscar pesquisas guiadas do Supabase:', err);
      return [];
    }
  }

  async function fetchCustomQueues(): Promise<CustomTraditionalQueue[]> {
    if (!isConfigured) return [];
    try {
      const { data, error } = await supabase.from('custom_traditional_queues').select('*');
      if (error) {
        return [];
      }
      return (data || []).map((q: any) => {
        let productIds: string[] = [];
        const rawIds = q.product_ids || q.productIds;
        if (Array.isArray(rawIds)) {
          productIds = rawIds;
        } else if (typeof rawIds === 'string') {
          try {
            const parsed = JSON.parse(rawIds);
            if (Array.isArray(parsed)) productIds = parsed;
          } catch {
            productIds = rawIds.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
        return {
          id: String(q.id),
          chainId: q.chain_id || q.chainId,
          state: q.state || 'Minas Gerais',
          productIds,
          updatedAt: q.updated_at || q.updatedAt || new Date().toISOString(),
          updatedBy: q.updated_by || q.updatedBy || undefined,
        } as CustomTraditionalQueue;
      });
    } catch {
      return [];
    }
  }

  // Realtime subscription para guided_campaigns e custom_traditional_queues
  useEffect(() => {
    if (!isConfigured) return;

    try {
      const channel = supabase
        .channel('realtime-guided-campaigns')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'guided_campaigns' },
          async () => {
            const updated = await fetchCampaigns();
            if (callbackRef.current) {
              callbackRef.current(updated);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'custom_traditional_queues' },
          async () => {
            const updated = await fetchCustomQueues();
            if (customQueuesCallbackRef.current) {
              customQueuesCallbackRef.current(updated);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.debug('Supabase realtime channel subscription caught exception:', e);
    }
  }, [isConfigured]);

  async function fetchAll() {
    if (!isConfigured) return null;
    
    const [campaignsList, customQueuesList, productsRes, chainsRes, recordsRes, usersRes] = await Promise.all([
      fetchCampaigns(),
      fetchCustomQueues(),
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

    return { products, chains, records, users, guidedCampaigns: campaignsList, customTraditionalQueues: customQueuesList };
  }

  return { isConfigured, fetchAll, fetchCampaigns, fetchCustomQueues };
}
