// Held sales (Park/Hold Sale, migration 0069) are plain RLS-protected rows
// — no money moves when parking/resuming a cart, so unlike gift cards this
// doesn't need security-definer functions, just ordinary table access
// (same posture as e.g. customers/stock_transfers elsewhere in this app).

import { supabase } from './supabase';
import type { HeldSale, HeldSaleCartLine, HeldSaleContext } from './types';

export async function listHeldSales(tenantId: string, storeId: string | null): Promise<{ data: HeldSale[]; error: string | null }> {
  let query = supabase.from('held_sales').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
  query = storeId ? query.eq('store_id', storeId) : query.is('store_id', null);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as HeldSale[], error: null };
}

export async function holdSale(params: {
  tenantId: string;
  storeId: string | null;
  customerId: string | null;
  daySessionId: string | null;
  reference: string;
  cartSnapshot: HeldSaleCartLine[];
  context: HeldSaleContext;
  subtotal: number;
  discountTotal: number;
  total: number;
  heldBy: string | null;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('held_sales').insert({
    tenant_id: params.tenantId,
    store_id: params.storeId,
    customer_id: params.customerId,
    day_session_id: params.daySessionId,
    reference: params.reference,
    cart_snapshot: params.cartSnapshot,
    context: params.context,
    subtotal: params.subtotal,
    discount_total: params.discountTotal,
    total: params.total,
    held_by: params.heldBy,
  });
  return { error: error?.message ?? null };
}

export async function deleteHeldSale(id: string): Promise<{ error: string | null; deleted: boolean }> {
  // .select() on the delete lets the caller tell "deleted" apart from
  // "already gone" (e.g. resumed/cancelled from another till a moment
  // earlier) instead of both silently reporting success.
  const { data, error } = await supabase.from('held_sales').delete().eq('id', id).select('id');
  if (error) return { error: error.message, deleted: false };
  return { error: null, deleted: (data?.length ?? 0) > 0 };
}
