// Thin typed wrappers around the gift_cards RPC functions (migration 0068).
// Mirrors the existing convention in this codebase of calling
// supabase.rpc(...) directly (see POSPage.tsx open_day_session,
// record_x_report_print, etc.) — this just adds typing + a single place to
// read/update if the RPC signatures ever change.

import { supabase } from './supabase';
import type { GiftCard, GiftCardStatus } from './types';

export type GiftCardLookup = {
  found: boolean;
  id?: string;
  code?: string;
  balance?: number;
  currency?: string | null;
  status?: GiftCardStatus;
  expires_at?: string | null;
};

export type GiftCardOpResult = {
  id: string;
  code: string;
  balance: number;
  currency: string | null;
};

async function callRpc<T>(fn: string, params: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) return { data: null, error: error.message };
  return { data: data as T, error: null };
}

export function issueGiftCard(params: {
  tenantId: string;
  amount: number;
  customerId?: string | null;
  storeId?: string | null;
  expiresAt?: string | null;
  code?: string | null;
}) {
  return callRpc<GiftCardOpResult>('issue_gift_card', {
    p_tenant_id: params.tenantId,
    p_amount: params.amount,
    p_customer_id: params.customerId ?? null,
    p_store_id: params.storeId ?? null,
    p_expires_at: params.expiresAt ?? null,
    p_code: params.code ?? null,
  });
}

export function rechargeGiftCard(params: { tenantId: string; code: string; amount: number }) {
  return callRpc<GiftCardOpResult>('recharge_gift_card', {
    p_tenant_id: params.tenantId,
    p_code: params.code,
    p_amount: params.amount,
  });
}

export function redeemGiftCard(params: { tenantId: string; code: string; amount: number; saleId?: string | null }) {
  return callRpc<GiftCardOpResult>('redeem_gift_card', {
    p_tenant_id: params.tenantId,
    p_code: params.code,
    p_amount: params.amount,
    p_sale_id: params.saleId ?? null,
  });
}

export function refundToGiftCard(params: { tenantId: string; code: string; amount: number; saleId?: string | null }) {
  return callRpc<GiftCardOpResult>('refund_to_gift_card', {
    p_tenant_id: params.tenantId,
    p_code: params.code,
    p_amount: params.amount,
    p_sale_id: params.saleId ?? null,
  });
}

export function cancelGiftCard(params: { tenantId: string; code: string; reason?: string | null }) {
  return callRpc<{ id: string; code: string; status: string }>('cancel_gift_card', {
    p_tenant_id: params.tenantId,
    p_code: params.code,
    p_reason: params.reason ?? null,
  });
}

export function getGiftCardStatus(params: { tenantId: string; code: string }) {
  return callRpc<GiftCardLookup>('get_gift_card_status', {
    p_tenant_id: params.tenantId,
    p_code: params.code,
  });
}

export async function listGiftCards(tenantId: string): Promise<{ data: GiftCard[]; error: string | null }> {
  const { data, error } = await supabase
    .from('gift_cards')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as GiftCard[], error: null };
}
