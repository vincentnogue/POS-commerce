import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote, Check, Receipt, Truck, Package, MessageCircle, Printer, History, X, RotateCcw, FileBarChart, Mail, Lock as LockIcon, Percent, Gift, PauseCircle, Tag, WifiOff, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney, localDateStr } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { printSaleReceipt } from '../../lib/receipt';
import { printDayReport } from '../../lib/dayReport';
import { SaleHistoryTab } from './SaleHistoryTab';
import { ReturnsTab } from './ReturnsTab';
import type { Product, Customer, Promotion, TenantCurrency } from '../../lib/types';
import { issueGiftCard as apiIssueGiftCard, redeemGiftCard as apiRedeemGiftCard, getGiftCardStatus as apiGetGiftCardStatus } from '../../lib/giftCards';
import { useOnlineStatus } from '../../lib/useOnlineStatus';
import { queueOfflineSale, getQueuedSales, removeQueuedSale, type OfflineSalePayload } from '../../lib/offlineQueue';

type CartItem = {
  product: Product;
  quantity: number;
  unit_price: number;
};

const PAYMENT_METHODS = [
  { id: 'cash', labelKey: 'pos.pay.cash', icon: Banknote },
  { id: 'card', labelKey: 'pos.pay.card', icon: CreditCard },
  { id: 'mobile_money', labelKey: 'pos.pay.mobileMoney', icon: Smartphone },
  { id: 'gift_card', labelKey: 'pos.pay.giftCard', icon: Gift },
];
// Split-payment tenders exclude gift_card: a gift card is verified/redeemed
// as a single atomic tender covering the whole total (see checkout()), not
// wired to support being one of several partial tenders in a split sale.
const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.id !== 'gift_card');

export function POSPage() {
  const { tenant, user, member } = useAuth();
  const { t, lang, locale } = useI18n();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // --- Staff session lock (D365-style: a staff member can lock their own
  // register session on a shared terminal; unlocking requires their own
  // Staff ID + PIN, verified server-side against the hash set by an admin
  // via set_staff_pin. While locked, no sale/checkout/day-session action
  // can go through — this is enforced both by the overlay blocking all
  // interaction AND inside checkout()/openDay()/closeDay() themselves, so
  // it can't be bypassed by a stray click landing before the overlay
  // paints. This is purely a local terminal state (not persisted server
  // side): each shared terminal locks independently. */
  const [locked, setLocked] = useState(false);
  const [pendingLockConfirm, setPendingLockConfirm] = useState(false);
  const [unlockStaffCode, setUnlockStaffCode] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockErr, setUnlockErr] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const lockSession = () => {
    setLocked(true);
    setPendingLockConfirm(true);
    setUnlockStaffCode(member?.staff_code ?? '');
    setUnlockPin('');
    setUnlockErr(null);
  };

  // FIX: locking used to be purely a local screen overlay -- the account
  // itself was never actually locked server-side, so the same Staff ID +
  // PIN kept working everywhere else (another till, a transfer, RMS) while
  // "locked" here. Locking now requires entering the Staff ID + PIN too
  // (same as unlocking), and calls the real lock_staff_account RPC, so the
  // lock is a genuine per-staff state (see tenant_members.is_locked), not
  // just this one screen.
  const confirmLockAccount = async () => {
    if (!tenant) return;
    if (!unlockStaffCode.trim() || !unlockPin.trim()) {
      setUnlockErr(t('pos.lock.err.required'));
      return;
    }
    setUnlocking(true);
    setUnlockErr(null);
    const { error } = await supabase.rpc('lock_staff_account', {
      p_tenant_id: tenant.id,
      p_staff_code: unlockStaffCode.trim(),
      p_pin: unlockPin.trim(),
    });
    setUnlocking(false);
    if (error) { setUnlockErr(error.message); return; }
    setPendingLockConfirm(false);
    setUnlockPin('');
  };

  const unlockSession = async () => {
    if (!tenant) return;
    if (!unlockStaffCode.trim() || !unlockPin.trim()) {
      setUnlockErr(t('pos.lock.err.required'));
      return;
    }
    setUnlocking(true);
    setUnlockErr(null);
    // FIX: this used to call verify_staff_pin, which (now that locking is
    // real) correctly REFUSES a locked account -- so unlocking must call
    // unlock_staff_account instead, which authenticates the PIN the same
    // way but doesn't require the account to already be unlocked.
    const { error } = await supabase.rpc('unlock_staff_account', {
      p_tenant_id: tenant.id,
      p_staff_code: unlockStaffCode.trim(),
      p_pin: unlockPin.trim(),
    });
    setUnlocking(false);
    if (error) {
      setUnlockErr(error.message);
      return;
    }
    setLocked(false);
    setUnlockPin('');
  };
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardCheck, setGiftCardCheck] = useState<{ id: string; balance: number } | null>(null);
  const [giftCardErr, setGiftCardErr] = useState<string | null>(null);
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitTenders, setSplitTenders] = useState<{ method: string; amount: string; reference: string }[]>([
    { method: 'cash', amount: '', reference: '' },
  ]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ items: CartItem[]; total: number; paymentMethod: string; paymentReference: string; customerName: string | null; customerPhone: string | null; customerEmail: string | null; discountTotal: number; pointsEarned: number | null; foreignCurrency: string | null; foreignAmount: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryChoice, setDeliveryChoice] = useState<'delivered' | 'pending'>('delivered');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  // D365-style checkout discount: manual discount w/ manager approval
  // and/or loyalty points redemption, per tenant.discount_mode (0067).
  const [manualDiscountAmount, setManualDiscountAmount] = useState('');
  const [discountApproverCode, setDiscountApproverCode] = useState('');
  const [discountApproverPin, setDiscountApproverPin] = useState('');
  const [discountApproval, setDiscountApproval] = useState<{ approver_name: string | null } | null>(null);
  const [discountErr, setDiscountErr] = useState<string | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [redeemPointsInput, setRedeemPointsInput] = useState('');
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<'sale' | 'history' | 'returns'>('sale');
  const [daySession, setDaySession] = useState<any | null>(null);
  const [daySessionLoading, setDaySessionLoading] = useState(true);
  const [members, setMembers] = useState<{ id: string; user_id?: string; display_name: string | null; staff_code: string | null; is_locked?: boolean }[]>([]);
  const [openDayModal, setOpenDayModal] = useState(false);
  const [closeDayModal, setCloseDayModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [presentStaffIds, setPresentStaffIds] = useState<Set<string>>(new Set());
  const [dayNotes, setDayNotes] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [daySubmitting, setDaySubmitting] = useState(false);
  const [xReportSubmitting, setXReportSubmitting] = useState(false);
  // Held/parked sales (D365-style "park sale"): put an in-progress cart
  // aside to serve another customer, resume it later.
  const [heldSales, setHeldSales] = useState<{ id: string; label: string | null; cart: CartItem[]; customer_id: string | null; created_at: string }[]>([]);
  const [heldSalesModalOpen, setHeldSalesModalOpen] = useState(false);
  const [holdingSale, setHoldingSale] = useState(false);
  // Issue/sell a new gift card from the POS toolbar.
  const [issueGiftCardModalOpen, setIssueGiftCardModalOpen] = useState(false);
  const [issueAmount, setIssueAmount] = useState('');
  const [issueCustomCode, setIssueCustomCode] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issuedCard, setIssuedCard] = useState<{ code: string; balance: number } | null>(null);
  const [issueErr, setIssueErr] = useState<string | null>(null);
  // Promotions (see migration 0070): active ones are loaded once and
  // matched client-side — the best automatic one applies silently, a
  // coupon code (if entered) takes its place.
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Promotion | null>(null);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  // Multi-currency (see migration 0074): the tenant's own currency stays
  // what all internal totals/reports are computed in — a foreign
  // currency selected here only tags the sale (currency + the rate that
  // applied at the time) and shows the cashier the equivalent amount to
  // collect. It never changes how total/paid_amount/payment_status are
  // computed, so single-currency tenants are entirely unaffected.
  const [tenantCurrencies, setTenantCurrencies] = useState<TenantCurrency[]>([]);
  const [saleCurrency, setSaleCurrency] = useState<string>('');

  // --- Offline sales queue (see src/lib/offlineQueue.ts for the full
  // rationale/scope: only plain cash sales with no split/gift-card/
  // loyalty-redeem/tracked-items can be queued offline; anything riskier
  // is blocked with an explanation instead, both handled in checkout()
  // below). isOnline drives both the banner and whether checkout() takes
  // the offline branch at all.
  const isOnline = useOnlineStatus();
  const [pendingOfflineSales, setPendingOfflineSales] = useState<OfflineSalePayload[]>([]);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const refreshOfflineQueue = useCallback(async () => {
    try {
      setPendingOfflineSales(await getQueuedSales());
    } catch (e) {
      console.error('Failed to read offline sales queue:', e);
    }
  }, []);

  useEffect(() => { refreshOfflineQueue(); }, [refreshOfflineQueue]);

  // Replays each queued offline sale through the same three inserts a
  // normal cash sale uses online (sales, sale_payments, sale_items — stock
  // decrements via the same DB trigger as any other sale_items insert, see
  // migration 0018). Runs in queued order, one at a time, so two offline
  // sales of the same last unit are resolved in the order they actually
  // happened rather than racing each other. A failure (e.g. the day
  // session was closed elsewhere, or stock genuinely ran out in the
  // meantime) leaves that sale in the queue and stops the run — it is
  // never silently dropped or retried in a loop.
  const syncPendingOfflineSales = useCallback(async () => {
    if (syncingOffline) return;
    const queued = await getQueuedSales();
    if (queued.length === 0) return;
    setSyncingOffline(true);
    let syncedCount = 0;
    for (const sale of queued) {
      const { data: insertedSale, error: saleErr } = await supabase
        .from('sales')
        .insert({
          tenant_id: sale.tenant_id,
          store_id: sale.store_id,
          customer_id: sale.customer_id,
          reference: sale.reference,
          subtotal: sale.subtotal,
          tax_total: sale.tax_total,
          discount_total: sale.discount_total,
          currency: sale.currency,
          exchange_rate: 1,
          total: sale.total,
          paid_amount: sale.total,
          payment_method: 'cash',
          payment_reference: null,
          payment_status: 'paid',
          sale_status: 'completed',
          notes: sale.notes,
          user_id: sale.user_id,
          day_session_id: sale.day_session_id,
        })
        .select()
        .single();
      if (saleErr || !insertedSale) {
        console.error('Offline sale sync failed (kept in queue):', saleErr?.message, sale.reference);
        toast('error', t('pos.offline.syncFailed', { ref: sale.reference, msg: saleErr?.message ?? '' }));
        break;
      }
      const { error: paymentsErr } = await supabase.from('sale_payments').insert({
        tenant_id: sale.tenant_id, sale_id: insertedSale.id, method: 'cash', amount: sale.total, reference: null,
      });
      if (paymentsErr) console.error('sale_payments insert failed during offline sync (non-blocking):', paymentsErr.message);
      const { error: itemsErr } = await supabase.from('sale_items').insert(
        sale.items.map((i) => ({
          sale_id: insertedSale.id,
          product_id: i.product_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount: 0,
          tax_rate: i.tax_rate,
          total: i.total,
        }))
      );
      if (itemsErr) {
        console.error('sale_items insert failed during offline sync:', itemsErr.message, sale.reference);
        toast('error', t('pos.offline.syncFailed', { ref: sale.reference, msg: itemsErr.message }));
        break;
      }
      await removeQueuedSale(sale.id);
      syncedCount++;
    }
    setSyncingOffline(false);
    await refreshOfflineQueue();
    if (syncedCount > 0) toast('success', t('pos.offline.syncedCount', { count: syncedCount }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncingOffline, refreshOfflineQueue, toast, t]);

  // Auto-sync the moment connectivity actually comes back — the cashier
  // shouldn't have to remember to press a button, though one is still
  // offered in the banner for a manual retry.
  useEffect(() => {
    if (isOnline) syncPendingOfflineSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      const [p, c, s] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
        supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('stores').select('id, name').eq('tenant_id', tenant.id).order('name'),
      ]);
      setProducts((p.data as Product[]) ?? []);
      setCustomers((c.data as Customer[]) ?? []);
      setStores((s.data as any[]) ?? []);
      setStoreId((s.data as any[])?.[0]?.id ?? null);
      const { data: m } = await supabase.from('tenant_members').select('id, user_id, display_name, staff_code, is_locked').eq('tenant_id', tenant.id);
      setMembers((m as any[]) ?? []);
      setLoading(false);
    })();
  }, [tenant]);

  const loadDaySession = useCallback(async () => {
    if (!tenant) return;
    setDaySessionLoading(true);
    let query = supabase.from('day_sessions').select('*').eq('tenant_id', tenant.id).eq('status', 'open');
    query = storeId ? query.eq('store_id', storeId) : query.is('store_id', null);
    const { data } = await query.maybeSingle();
    setDaySession(data ?? null);
    setDaySessionLoading(false);
  }, [tenant, storeId]);

  useEffect(() => { loadDaySession(); }, [loadDaySession]);

  const loadHeldSales = useCallback(async () => {
    if (!tenant) return;
    let query = supabase.from('held_sales').select('id, label, cart, customer_id, created_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    query = storeId ? query.eq('store_id', storeId) : query;
    const { data } = await query;
    setHeldSales((data as { id: string; label: string | null; cart: CartItem[]; customer_id: string | null; created_at: string }[]) ?? []);
  }, [tenant, storeId]);

  useEffect(() => { loadHeldSales(); }, [loadHeldSales]);

  useEffect(() => {
    if (!tenant) return;
    supabase.from('promotions').select('*').eq('tenant_id', tenant.id).eq('is_active', true)
      .then(({ data }) => setPromotions((data as Promotion[]) ?? []));
    supabase.from('tenant_currencies').select('*').eq('tenant_id', tenant.id).eq('is_active', true)
      .then(({ data }) => setTenantCurrencies((data as TenantCurrency[]) ?? []));
  }, [tenant]);

  const holdSale = async () => {
    if (!tenant || cart.length === 0) return;
    setHoldingSale(true);
    const { error } = await supabase.from('held_sales').insert({
      tenant_id: tenant.id,
      store_id: storeId,
      user_id: user?.id ?? null,
      customer_id: customer?.id ?? null,
      label: customer?.name ?? null,
      cart,
    });
    setHoldingSale(false);
    if (error) { toast('error', error.message); return; }
    setCart([]);
    setCustomer(null);
    setCustomerSearch('');
    resetDiscountState();
    toast('success', t('pos.hold.saved'));
    loadHeldSales();
  };

  const resumeHeldSale = async (held: { id: string; cart: CartItem[]; customer_id: string | null }) => {
    if (cart.length > 0 && !window.confirm(t('pos.hold.confirmReplace'))) return;
    setCart(held.cart);
    const matchedCustomer = held.customer_id ? customers.find((c) => c.id === held.customer_id) ?? null : null;
    setCustomer(matchedCustomer);
    await supabase.from('held_sales').delete().eq('id', held.id);
    setHeldSalesModalOpen(false);
    loadHeldSales();
  };

  const deleteHeldSale = async (id: string) => {
    await supabase.from('held_sales').delete().eq('id', id);
    loadHeldSales();
  };

  const issueGiftCard = async () => {
    if (!tenant) return;
    const amt = Number(issueAmount);
    if (!amt || amt <= 0) { setIssueErr(t('pos.giftCard.err.amountInvalid')); return; }
    setIssuing(true);
    setIssueErr(null);
    const { data, error } = await apiIssueGiftCard({
      tenantId: tenant.id,
      amount: amt,
      customerId: customer?.id ?? null,
      storeId: storeId ?? null,
      code: issueCustomCode.trim() || null,
    });
    setIssuing(false);
    if (error) { setIssueErr(error); return; }
    if (data) setIssuedCard({ code: data.code, balance: data.balance });
  };

  const resetIssueGiftCard = () => {
    setIssueAmount('');
    setIssueCustomCode('');
    setIssuedCard(null);
    setIssueErr(null);
    setIssueGiftCardModalOpen(false);
  };

  const openDay = async () => {
    if (!tenant || !user || locked) return;
    const cashValue = Number(openingCash);
    if (Number.isNaN(cashValue) || cashValue < 0) { toast('error', t('pos.day.err.invalidCash')); return; }
    setDaySubmitting(true);
    const { error } = await supabase.rpc('open_day_session', {
      p_tenant_id: tenant.id,
      p_store_id: storeId,
      p_opening_cash: cashValue,
      p_staff_member_ids: Array.from(presentStaffIds),
      p_notes: dayNotes || null,
      p_user_id: user.id,
    });
    setDaySubmitting(false);
    if (error) { toast('error', error.message); return; }
    setOpenDayModal(false);
    setOpeningCash(''); setPresentStaffIds(new Set()); setDayNotes('');
    await loadDaySession();
    toast('success', t('pos.day.toast.opened'));
  };

  const closeDay = async () => {
    if (!tenant || !user || !daySession || locked) return;
    const cashValue = Number(closingCash);
    if (Number.isNaN(cashValue) || cashValue < 0) { toast('error', t('pos.day.err.invalidCash')); return; }
    setDaySubmitting(true);
    const sessionId = daySession.id;
    const { error } = await supabase.rpc('close_day_session', {
      p_session_id: sessionId,
      p_closing_cash: cashValue,
      p_notes: dayNotes || null,
      p_user_id: user.id,
    });
    setDaySubmitting(false);
    if (error) { toast('error', error.message); return; }
    setCloseDayModal(false);
    setClosingCash(''); setDayNotes('');

    // Z-Report: printed once, at the moment the day is closed — this is
    // the day-closing document, with the final expected-vs-counted cash
    // reconciliation computed server-side by close_day_session().
    const { data: closedSession } = await supabase.from('day_sessions').select('*').eq('id', sessionId).single();
    if (closedSession) {
      const snap = await buildDayReportSnapshot(sessionId);
      printDayReport(
        {
          sessionReference: sessionId.slice(0, 8).toUpperCase(),
          kind: 'z',
          openedAt: new Date(closedSession.opened_at),
          closedAt: closedSession.closed_at ? new Date(closedSession.closed_at) : new Date(),
          storeName: stores.find((s) => s.id === storeId)?.name ?? tenant.name,
          openingCash: Number(closedSession.opening_cash),
          closingCash: Number(closedSession.closing_cash ?? 0),
          expectedCash: Number(closedSession.expected_cash ?? 0),
          cashVariance: Number(closedSession.cash_variance ?? 0),
          staffNames: snap.staffNames,
          salesCount: snap.salesCount,
          paymentBreakdown: snap.paymentBreakdown,
          returnsTotal: snap.returnsTotal,
          grossTotal: snap.grossTotal,
        },
        dayReportLabels(),
        { businessName: tenant.name, currency, lang, locale, formatMoney },
      );
    }

    await loadDaySession();
    toast('success', t('pos.day.toast.closed'));
  };

  // Aggregates the current day session's sales and returns into the
  // payment breakdown / totals shown on the X-Report and Z-Report.
  const buildDayReportSnapshot = async (sessionId: string) => {
    const { data: srows } = await supabase.from('sales').select('payment_method, total, sale_status').eq('day_session_id', sessionId);
    const validSales = (srows ?? []).filter((r: any) => r.sale_status !== 'cancelled');
    const byMethod: Record<string, { amount: number; count: number }> = {};
    validSales.forEach((r: any) => {
      const m = r.payment_method || 'cash';
      byMethod[m] = byMethod[m] ?? { amount: 0, count: 0 };
      byMethod[m].amount += Number(r.total);
      byMethod[m].count += 1;
    });
    const { data: returnsRows } = await supabase.from('sale_returns').select('refund_amount').eq('day_session_id', sessionId);
    const { data: staffRows } = await supabase
      .from('day_session_staff')
      .select('staff_code, member:tenant_members(display_name)')
      .eq('day_session_id', sessionId);

    return {
      salesCount: validSales.length,
      grossTotal: validSales.reduce((s: number, r: any) => s + Number(r.total), 0),
      paymentBreakdown: Object.entries(byMethod).map(([method, v]) => ({ method, amount: v.amount, count: v.count })),
      returnsTotal: (returnsRows ?? []).reduce((s: number, r: any) => s + Number(r.refund_amount), 0),
      staffNames: (staffRows ?? []).map((r: any) => r.member?.display_name || r.staff_code || t('pos.history.unnamedStaff')),
    };
  };

  const dayReportLabels = () => ({
    xTitle: t('pos.day.xReport.title'),
    zTitle: t('pos.day.zReport.title'),
    store: t('stock.col.store'),
    openedAt: t('pos.day.openedAtLabel'),
    closedAt: t('pos.day.closedAtLabel'),
    staffPresent: t('pos.day.staffPresent'),
    salesCount: t('pos.day.report.salesCount'),
    grossTotal: t('pos.day.report.grossTotal'),
    returnsTotal: t('pos.day.report.returnsTotal'),
    paymentBreakdown: t('pos.day.report.paymentBreakdown'),
    openingCash: t('pos.day.openingCash'),
    closingCash: t('pos.day.countedCash'),
    expectedCash: t('pos.day.report.expectedCash'),
    cashVariance: t('pos.day.report.cashVariance'),
    printNumber: t('pos.day.report.printNumber'),
    notClosed: t('pos.day.report.notClosed'),
    paymentMethodLabel: paymentLabel,
  });

  // X-Report: a snapshot printed as many times as needed while the day
  // stays open (capped by the admin via tenants.max_x_reports_per_day,
  // enforced server-side in record_x_report_print). Unlike the Z-Report,
  // it never closes the day.
  const printXReport = async () => {
    if (!tenant || !user || !daySession) return;
    setXReportSubmitting(true);
    const { data: printNumber, error } = await supabase.rpc('record_x_report_print', { p_session_id: daySession.id, p_user_id: user.id });
    setXReportSubmitting(false);
    if (error) { toast('error', error.message); return; }
    const snap = await buildDayReportSnapshot(daySession.id);
    printDayReport(
      {
        sessionReference: daySession.id.slice(0, 8).toUpperCase(),
        kind: 'x',
        openedAt: new Date(daySession.opened_at),
        closedAt: null,
        storeName: stores.find((s) => s.id === storeId)?.name ?? tenant.name,
        openingCash: Number(daySession.opening_cash),
        staffNames: snap.staffNames,
        salesCount: snap.salesCount,
        paymentBreakdown: snap.paymentBreakdown,
        returnsTotal: snap.returnsTotal,
        grossTotal: snap.grossTotal,
        printNumber: printNumber as number,
      },
      dayReportLabels(),
      { businessName: tenant.name, currency, lang, locale, formatMoney },
    );
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    );
  }, [products, search]);

  // A barcode scanner behaves like a keyboard typing fast, then "Enter".
  // Before this, a scan just narrowed the product grid and still required
  // a manual click — slow, and risky if the filter matched more than one
  // product. On Enter, if the typed text is an exact barcode match, add
  // it straight to the cart and clear the field for the next scan.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const q = search.trim();
    if (!q) return;
    const exact = products.find((p) => p.barcode && p.barcode === q);
    if (exact) {
      addToCart(exact);
      setSearch('');
    }
  };

  const addToCart = (p: Product) => {
    setCart((c) => {
      const existing = c.find((i) => i.product.id === p.id);
      if (existing) return c.map((i) => i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...c, { product: p, quantity: 1, unit_price: Number(p.sale_price) }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((c) => c.map((i) => i.product.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const setQty = (id: string, qty: number) => {
    setCart((c) => c.map((i) => i.product.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.product.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxTotal = cart.reduce((s, i) => s + i.quantity * i.unit_price * (Number(i.product.tax_rate) / 100), 0);

  // Discount config for this tenant (see migration 0067): which
  // mechanism(s) are on, and the rules for each.
  const discountMode = tenant?.discount_mode ?? 'manual_approval';
  const manualDiscountEnabled = discountMode === 'manual_approval' || discountMode === 'both';
  const loyaltyDiscountEnabled = discountMode === 'loyalty_points' || discountMode === 'both';
  const discountThreshold = Number(tenant?.manual_discount_requires_approval_above ?? 0);
  const requiresManagerApproval = Number(manualDiscountAmount || 0) > discountThreshold;
  // Manual discount only actually reduces the total once verified via
  // check_manual_discount (below) — until then it's just a draft input.
  const manualDiscountValue = discountApproval ? Math.max(0, Number(manualDiscountAmount) || 0) : 0;
  const loyaltyRedeemPoints = customer ? Math.max(0, Math.min(Math.floor(Number(redeemPointsInput) || 0), customer.loyalty_points ?? 0)) : 0;
  const loyaltyDiscountValue = loyaltyRedeemPoints * Number(tenant?.loyalty_point_value ?? 0.01);

  // Promotions: match active ones against the current subtotal. Only one
  // promotion applies per sale — a valid coupon takes priority over the
  // best automatic match — stacking on top of manual discount/loyalty,
  // which are separate, tenant-configured mechanisms.
  const now = Date.now();
  const activePromotions = promotions.filter((p) => {
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
    if (p.ends_at && new Date(p.ends_at).getTime() < now) return false;
    return true;
  });
  const promoValueFor = (p: Promotion, base: number) => (p.type === 'percent' ? base * (p.value / 100) : Math.min(p.value, base));
  const bestAutoPromotion = activePromotions
    .filter((p) => !p.requires_code && (p.min_purchase == null || subtotal >= p.min_purchase))
    .reduce<Promotion | null>((best, p) => (!best || promoValueFor(p, subtotal) > promoValueFor(best, subtotal) ? p : best), null);
  const appliedPromotion = appliedCoupon ?? bestAutoPromotion;
  const promotionValue = appliedPromotion ? promoValueFor(appliedPromotion, subtotal) : 0;

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    const match = activePromotions.find((p) => p.requires_code && p.code?.toUpperCase() === code);
    if (!match) { setCouponErr(t('pos.promo.err.invalid')); setAppliedCoupon(null); return; }
    if (match.min_purchase != null && subtotal < match.min_purchase) {
      setCouponErr(t('pos.promo.err.minPurchase', { amount: formatMoney(match.min_purchase, currency) }));
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(match);
    setCouponErr(null);
  };
  const clearCoupon = () => { setAppliedCoupon(null); setCouponCode(''); setCouponErr(null); };

  const discountTotal = manualDiscountValue + (loyaltyDiscountEnabled ? loyaltyDiscountValue : 0) + promotionValue;
  const total = Math.max(0, subtotal + taxTotal - discountTotal);

  // Foreign currencies this tenant accepts (excludes its own home
  // currency, which is always the implicit default and isn't a
  // selectable "foreign" option here).
  const foreignCurrencies = tenantCurrencies.filter((c) => c.currency_code !== tenant?.currency);
  const activeSaleCurrency = saleCurrency || tenant?.currency || currency;
  const saleCurrencyRate = activeSaleCurrency === tenant?.currency ? 1 : (foreignCurrencies.find((c) => c.currency_code === activeSaleCurrency)?.rate_to_tenant_currency ?? 1);
  const totalInSaleCurrency = total / saleCurrencyRate;

  // Verifies (and, if above the tenant's threshold, requires manager
  // Staff ID + PIN for) a manual discount via check_manual_discount — no
  // side effects server-side, so safe to call ahead of the actual sale;
  // the approved amount is only applied to the sale total at checkout.
  const applyManualDiscount = async () => {
    if (!tenant) return;
    const amt = Number(manualDiscountAmount);
    if (!amt || amt <= 0) { setDiscountErr(t('pos.discount.err.invalidAmount')); return; }
    setApplyingDiscount(true);
    setDiscountErr(null);
    const { data, error } = await supabase.rpc('check_manual_discount', {
      p_tenant_id: tenant.id,
      p_amount: amt,
      p_approver_staff_code: discountApproverCode.trim() || null,
      p_approver_pin: discountApproverPin.trim() || null,
    });
    setApplyingDiscount(false);
    if (error) { setDiscountErr(error.message); return; }
    setDiscountApproval({ approver_name: (data as { approver_name?: string | null } | null)?.approver_name ?? null });
  };

  const clearManualDiscount = () => {
    setManualDiscountAmount('');
    setDiscountApproverCode('');
    setDiscountApproverPin('');
    setDiscountApproval(null);
    setDiscountErr(null);
  };

  const resetDiscountState = () => {
    clearManualDiscount();
    setRedeemPointsInput('');
    clearCoupon();
  };

  const splitTotal = splitTenders.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const splitRemaining = total - splitTotal;

  const checkout = async () => {
    if (!tenant || cart.length === 0 || locked) return;
    if (!daySession) {
      toast('error', t('pos.day.err.mustOpenFirst'));
      return;
    }

    // --- Offline branch --------------------------------------------
    // Only the plain-cash, nothing-fancy case is safe to queue locally
    // (see src/lib/offlineQueue.ts for the full reasoning) — anything
    // that needs a live check against server state (a non-cash tender,
    // split payment, gift card, loyalty-point redemption, or a serial/
    // batch tracked item) is blocked here with a specific reason instead
    // of silently attempted or silently dropped.
    if (!isOnline) {
      const blockedReasons: string[] = [];
      if (paymentMethod !== 'cash') blockedReasons.push(t('pos.offline.reason.nonCash'));
      if (splitPayment) blockedReasons.push(t('pos.offline.reason.split'));
      if (loyaltyDiscountEnabled && Number(redeemPointsInput) > 0) blockedReasons.push(t('pos.offline.reason.loyalty'));
      if (cart.some((i) => i.product.tracking_mode === 'serial' || i.product.tracking_mode === 'batch')) {
        blockedReasons.push(t('pos.offline.reason.tracked'));
      }
      if (blockedReasons.length > 0) {
        toast('error', t('pos.offline.err.blocked', { reasons: blockedReasons.join(', ') }));
        return;
      }

      const ref = `VTE-${Date.now().toString().slice(-8)}`;
      const payload: OfflineSalePayload = {
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        store_id: storeId,
        day_session_id: daySession.id,
        user_id: user?.id ?? null,
        customer_id: customer?.id ?? null,
        reference: ref,
        currency: tenant.currency ?? 'XOF',
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        total,
        notes: t('pos.offline.saleNote'),
        queued_at: new Date().toISOString(),
        items: cart.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          tax_rate: Number(i.product.tax_rate),
          total: i.quantity * i.unit_price * (1 + Number(i.product.tax_rate) / 100),
        })),
      };
      try {
        await queueOfflineSale(payload);
      } catch (e) {
        toast('error', t('pos.offline.err.queueFailed'));
        console.error('Failed to queue offline sale:', e);
        return;
      }
      await refreshOfflineQueue();
      toast('success', t('pos.offline.queued', { ref }));
      setSuccess(ref);
      setLastReceipt({
        items: cart,
        total,
        paymentMethod: 'cash',
        paymentReference: '',
        customerName: customer?.name ?? null,
        customerPhone: customer?.phone ?? null,
        customerEmail: customer?.email ?? null,
        discountTotal,
        pointsEarned: null,
        foreignCurrency: null,
        foreignAmount: null,
      });
      setCart([]);
      setPaymentReference('');
      setPaidAmount('');
      setCheckoutOpen(false);
      setCustomer(null);
      setCustomerSearch('');
      resetDiscountState();
      return;
    }

    // A pending manual discount that was typed but never verified (e.g.
    // the manager PIN step was skipped) must not silently make it into
    // the sale — either it's approved (discountApproval set) or it's
    // dropped from the total already via manualDiscountValue above, but
    // block checkout instead of silently ignoring the cashier's intent.
    if (manualDiscountEnabled && Number(manualDiscountAmount) > 0 && !discountApproval) {
      toast('error', t('pos.discount.err.invalidAmount'));
      return;
    }
    if (loyaltyDiscountEnabled && Number(redeemPointsInput) > 0) {
      if (!customer) { toast('error', t('pos.discount.err.needCustomerForPoints')); return; }
      if (Math.floor(Number(redeemPointsInput)) > (customer.loyalty_points ?? 0)) {
        toast('error', t('pos.discount.err.insufficientPoints'));
        return;
      }
    }

    // Serial/batch tracked products (see migrations 0073/0076): a real
    // feasibility check before the sale is created — not enough serials
    // in stock, or not enough total remaining_quantity across batches,
    // must block checkout rather than let the sale claim success and
    // silently fail to actually consume stock afterward.
    const trackedItems = cart.filter((i) => i.product.tracking_mode === 'serial' || i.product.tracking_mode === 'batch');
    if (trackedItems.length > 0) {
      for (const item of trackedItems) {
        if (item.product.tracking_mode === 'serial') {
          let q = supabase.from('product_serials').select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id).eq('product_id', item.product.id).eq('status', 'in_stock');
          q = storeId ? q.eq('store_id', storeId) : q.is('store_id', null);
          const { count } = await q;
          if ((count ?? 0) < item.quantity) {
            toast('error', t('pos.tracking.err.notEnoughSerials', { name: item.product.name, available: count ?? 0 }));
            return;
          }
        } else {
          let q = supabase.from('product_batches').select('remaining_quantity')
            .eq('tenant_id', tenant.id).eq('product_id', item.product.id);
          q = storeId ? q.eq('store_id', storeId) : q.is('store_id', null);
          const { data: batchRows } = await q;
          const available = (batchRows ?? []).reduce((s, r) => s + Number(r.remaining_quantity), 0);
          if (available < item.quantity) {
            toast('error', t('pos.tracking.err.notEnoughBatch', { name: item.product.name, available }));
            return;
          }
        }
      }
    }

    let finalPaymentMethod = paymentMethod;
    let finalPaymentReference: string | null = paymentMethod === 'cash' ? null : paymentReference.trim();
    let paid: number;
    let tendersToRecord: { method: string; amount: number; reference: string | null }[];

    if (splitPayment) {
      const validTenders = splitTenders.filter((t) => Number(t.amount) > 0);
      if (validTenders.length < 2) {
        toast('error', t('pos.split.err.needTwoTenders'));
        return;
      }
      if (Math.abs(splitRemaining) > 0.01) {
        toast('error', t('pos.split.err.mustMatchTotal'));
        return;
      }
      const missingRef = validTenders.find((t) => t.method !== 'cash' && !t.reference.trim());
      if (missingRef) {
        toast('error', t('pos.err.paymentRefRequired'));
        return;
      }
      paid = splitTotal;
      finalPaymentMethod = 'split';
      finalPaymentReference = null;
      tendersToRecord = validTenders.map((t) => ({ method: t.method, amount: Number(t.amount), reference: t.method === 'cash' ? null : t.reference.trim() }));
    } else {
      if ((paymentMethod === 'card' || paymentMethod === 'mobile_money') && !paymentReference.trim()) {
        toast('error', t('pos.err.paymentRefRequired'));
        return;
      }
      if (paymentMethod === 'gift_card') {
        if (!giftCardCode.trim()) { toast('error', t('pos.giftCard.err.codeRequired')); return; }
        // Always re-verify against the current total right before the
        // sale, even if it was already checked once — the cart/discount
        // may have changed since, and this lookup has no side effects.
        // get_gift_card_status doesn't take an amount, so the balance vs
        // total comparison happens here; redeem_gift_card below is still
        // the hard backstop against overdraw server-side.
        const { data: gc, error: gcErr } = await apiGetGiftCardStatus({ tenantId: tenant.id, code: giftCardCode.trim() });
        if (gcErr) { toast('error', gcErr); return; }
        if (!gc?.found) { toast('error', t('pos.giftCard.err.notFound')); return; }
        if (gc.status !== 'active') { toast('error', t('pos.giftCard.err.notActive')); return; }
        if ((gc.balance ?? 0) < total) { toast('error', t('pos.giftCard.err.insufficientBalance')); return; }
        setGiftCardCheck({ id: gc.id ?? '', balance: gc.balance ?? 0 });
        finalPaymentReference = giftCardCode.trim().toUpperCase();
      }
      // BUG FIX: `Number(paidAmount) || total` treated an explicit "0" the
      // same as an empty field, silently forcing a full payment even when
      // the cashier typed 0 to record a credit/unpaid cash sale. Only an
      // empty field should default to the full total; "0" must stay 0 so
      // payment_status below correctly comes out 'unpaid'.
      paid = paymentMethod === 'cash' ? (paidAmount.trim() === '' ? total : Number(paidAmount)) : total;
      tendersToRecord = [{ method: paymentMethod, amount: paid, reference: finalPaymentReference }];
    }

    const paymentStatus = paid >= total ? 'paid' : 'unpaid';
    const ref = `VTE-${Date.now().toString().slice(-8)}`;

    const { data: sale, error } = await supabase
      .from('sales')
      .insert({
        tenant_id: tenant.id,
        store_id: storeId,
        customer_id: customer?.id ?? null,
        reference: ref,
        subtotal,
        tax_total: taxTotal,
        discount_total: discountTotal,
        currency: activeSaleCurrency,
        exchange_rate: saleCurrencyRate,
        total,
        paid_amount: paid,
        payment_method: finalPaymentMethod,
        payment_reference: finalPaymentReference,
        payment_status: paymentStatus,
        sale_status: 'completed',
        notes: deliveryChoice === 'pending' ? t('pos.notes.deliveryPending') : t('pos.notes.delivered'),
        user_id: user?.id,
        day_session_id: daySession.id,
      })
      .select()
      .single();

    if (error || !sale) {
      toast('error', error?.message ?? t('pos.err.saleFailed'));
      return;
    }

    // Record the tender breakdown (one row for a normal sale, several for a
    // split payment). Best-effort: sales.payment_method/paid_amount above
    // already fully describe a normal sale on their own, so a failure here
    // must not roll back or block a completed, paid sale — it only means
    // the itemized breakdown is missing for reporting.
    const { error: paymentsErr } = await supabase.from('sale_payments').insert(
      tendersToRecord.map((tRow) => ({ tenant_id: tenant.id, sale_id: sale.id, method: tRow.method, amount: tRow.amount, reference: tRow.reference }))
    );
    if (paymentsErr) {
      console.error('sale_payments insert failed (non-blocking):', paymentsErr.message);
    }

    // This writes the actual line items — and triggers automatic stock
    // decrement server-side (see migration 0018). If this fails, the sale
    // header exists but is empty, which is worse than not selling at all,
    // so we must surface the error clearly rather than silently continuing.
    const { data: insertedItems, error: itemsErr } = await supabase.from('sale_items').insert(
      cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: 0,
        tax_rate: Number(i.product.tax_rate),
        total: i.quantity * i.unit_price * (1 + Number(i.product.tax_rate) / 100),
      }))
    ).select('id');
    if (itemsErr) {
      toast('error', t('pos.err.itemsFailed', { ref, msg: itemsErr.message }));
      return;
    }

    // Actually consume the serials/batches now that each sale_items row
    // has a real id to link them to — the availability was already
    // checked above, but these calls are still the hard, race-proof
    // backstop (row-locked) server-side. A failure here means stock was
    // sold without the corresponding serial/batch record being
    // consumed — surfaced loudly since it's an inventory-accuracy gap,
    // not a best-effort ledger update.
    if (insertedItems && trackedItems.length > 0) {
      for (let idx = 0; idx < cart.length; idx++) {
        const item = cart[idx];
        const saleItemId = insertedItems[idx]?.id;
        if (!saleItemId) continue;
        if (item.product.tracking_mode === 'serial') {
          let sq = supabase.from('product_serials').select('id')
            .eq('tenant_id', tenant.id).eq('product_id', item.product.id).eq('status', 'in_stock')
            .order('created_at', { ascending: true }).limit(item.quantity);
          sq = storeId ? sq.eq('store_id', storeId) : sq.is('store_id', null);
          const { data: pickedSerials } = await sq;
          for (const s of pickedSerials ?? []) {
            const { error: serialErr } = await supabase.rpc('sell_product_serial', {
              p_tenant_id: tenant.id, p_serial_id: s.id, p_sale_id: sale.id, p_sale_item_id: saleItemId,
            });
            if (serialErr) {
              console.error('sell_product_serial failed:', serialErr.message);
              toast('error', t('pos.tracking.err.consumeFailedAfterSale', { ref }));
            }
          }
        } else if (item.product.tracking_mode === 'batch') {
          const { error: batchErr } = await supabase.rpc('consume_product_batches_fefo', {
            p_tenant_id: tenant.id, p_product_id: item.product.id, p_store_id: storeId || null,
            p_quantity: item.quantity, p_sale_item_id: saleItemId,
          });
          if (batchErr) {
            console.error('consume_product_batches_fefo failed:', batchErr.message);
            toast('error', t('pos.tracking.err.consumeFailedAfterSale', { ref }));
          }
        }
      }
    }

    // Gift card: actually spend it now that the sale exists — sale_id is
    // passed so redeem_gift_card auto-inserts the matching sale_payments
    // row (see migration 0068_gift_cards.sql), same reconciliation trail
    // as every other tender. Was already validated moments ago via
    // get_gift_card_status, but redeem_gift_card is still the hard,
    // overdraw-proof backstop server-side. Unlike the loyalty/discount
    // best-effort calls above, a failure here means the sale is marked
    // paid without an actual gift-card payment record — surfaced loudly
    // (not just logged) so staff know to reconcile it manually.
    if (paymentMethod === 'gift_card' && giftCardCode.trim()) {
      const { error: gcRedeemErr } = await apiRedeemGiftCard({
        tenantId: tenant.id,
        code: giftCardCode.trim(),
        amount: total,
        saleId: sale.id,
      });
      if (gcRedeemErr) {
        console.error('redeem_gift_card failed:', gcRedeemErr);
        toast('error', t('pos.giftCard.err.redeemFailedAfterSale', { ref }));
      }
    }

    // Loyalty points: redeem what was selected (deducts the customer's
    // balance now, after the sale is safely recorded) and award new
    // points earned on this sale. Both are best-effort/non-blocking —
    // the sale itself is already completed and paid at this point, so a
    // failure here must not roll back or block it; it only means the
    // loyalty ledger is out of sync and should be reconciled manually.
    let pointsEarnedForReceipt: number | null = null;
    if (customer && tenant) {
      if (loyaltyDiscountEnabled && loyaltyRedeemPoints > 0) {
        const { error: redeemErr } = await supabase.rpc('redeem_loyalty_points', {
          p_tenant_id: tenant.id,
          p_customer_id: customer.id,
          p_points: loyaltyRedeemPoints,
        });
        if (redeemErr) console.error('redeem_loyalty_points failed (non-blocking):', redeemErr.message);
      }
      const { data: earnedPoints, error: earnErr } = await supabase.rpc('earn_loyalty_points', {
        p_tenant_id: tenant.id,
        p_customer_id: customer.id,
        p_sale_id: sale.id,
        p_sale_total: total,
      });
      if (earnErr) {
        console.error('earn_loyalty_points failed (non-blocking):', earnErr.message);
      } else if (typeof earnedPoints === 'number' && earnedPoints > 0) {
        pointsEarnedForReceipt = earnedPoints;
        toast('success', t('pos.discount.pointsEarned', { points: earnedPoints }));
      }
      // Refresh the customer's balance locally so the next sale (and the
      // customer list) reflects the redemption/earn that just happened.
      const { data: refreshedCustomer } = await supabase.from('customers').select('*').eq('id', customer.id).maybeSingle();
      if (refreshedCustomer) {
        setCustomers((cs) => cs.map((c) => (c.id === refreshedCustomer.id ? (refreshedCustomer as Customer) : c)));
      }
    }

    // If "Non livré", create a pending delivery with per-product line items
    if (deliveryChoice === 'pending') {
      const { data: delivery, error: delErr } = await supabase.from('deliveries').insert({
        tenant_id: tenant.id,
        sale_id: sale.id,
        customer_name: customer?.name ?? t('pos.walkInCustomer'),
        address: customer?.address ?? null,
        city: customer?.city ?? null,
        phone: customer?.phone ?? null,
        status: 'pending',
        scheduled_date: localDateStr(),
      }).select().single();

      if (delErr) {
        toast('error', t('pos.err.deliveryFailed', { msg: delErr.message }));
      } else if (delivery) {
        const { error: diErr } = await supabase.from('delivery_items').insert(
          cart.map((i) => ({
            delivery_id: delivery.id,
            product_id: i.product.id,
            product_name: i.product.name,
            quantity_ordered: i.quantity,
            quantity_delivered: 0,
          }))
        );
        if (diErr) toast('error', t('pos.err.deliveryItemsFailed', { msg: diErr.message }));
      }
    }

    setSuccess(ref);
    setLastReceipt({
      items: cart,
      total,
      paymentMethod,
      paymentReference: paymentReference.trim(),
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      customerEmail: customer?.email ?? null,
      discountTotal,
      pointsEarned: pointsEarnedForReceipt,
      foreignCurrency: activeSaleCurrency !== tenant?.currency ? activeSaleCurrency : null,
      foreignAmount: activeSaleCurrency !== tenant?.currency ? totalInSaleCurrency : null,
    });
    setCart([]);
    setPaymentReference('');
    setPaidAmount('');
    setSplitPayment(false);
    setSplitTenders([{ method: 'cash', amount: '', reference: '' }]);
    setCheckoutOpen(false);
    setCustomer(null);
    setCustomerSearch('');
    setDeliveryChoice('delivered');
    resetDiscountState();
    setGiftCardCode('');
    setGiftCardCheck(null);
    setGiftCardErr(null);
    setSaleCurrency('');
  };

  const paymentLabel = (m: string) => m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : m === 'mobile_money' ? t('pos.pay.mobileMoney') : m === 'gift_card' ? t('pos.pay.giftCard') : m === 'split' ? t('pos.split.label') : m;

  const printReceipt = () => {
    if (!success || !lastReceipt) return;
    printSaleReceipt(
      {
        reference: success,
        date: new Date(),
        items: lastReceipt.items.map((i) => ({ name: i.product.name, quantity: i.quantity, unit_price: i.unit_price })),
        total: lastReceipt.total,
        paymentMethod: lastReceipt.paymentMethod,
        paymentReference: lastReceipt.paymentReference || null,
        discountTotal: lastReceipt.discountTotal,
        pointsEarned: lastReceipt.pointsEarned,
        foreignCurrency: lastReceipt.foreignCurrency,
        foreignAmount: lastReceipt.foreignAmount,
      },
      {
        title: t('pos.receipt.title'),
        receipt: t('pos.receipt.receipt'),
        date: t('pos.receipt.date'),
        designation: t('pos.receipt.designation'),
        qty: t('pos.receipt.qty'),
        price: t('pos.receipt.price'),
        total: t('pos.receipt.total'),
        paymentMode: t('pos.receipt.paymentMode'),
        refLabel: t('pos.receipt.refLabel'),
        status: t('pos.receipt.status'),
        statusPaid: t('pos.receipt.statusPaid'),
        thanks: t('pos.receipt.thanks'),
        keepProof: t('pos.receipt.keepProof'),
        discountLabel: t('pos.discount.total'),
        pointsEarnedLabel: (points) => t('pos.discount.pointsEarned', { points }),
        foreignAmountLabel: t('pos.currency.toCollectLabel'),
        paymentMethodLabel: paymentLabel,
      },
      { businessName: tenant?.name ?? '', currency, lang, locale, formatMoney },
    );
  };

  const sendWhatsApp = () => {
    if (!success || !lastReceipt) return;
    const lines = lastReceipt.items.map((i) => `${i.product.name} x${i.quantity} = ${formatMoney(i.quantity * i.unit_price, currency)}`).join('%0a');
    const paymentLine = lastReceipt.paymentReference
      ? `%0a${t('pos.whatsapp.payment')} : ${paymentLabel(lastReceipt.paymentMethod)} (${t('pos.whatsapp.ref')}: ${lastReceipt.paymentReference})`
      : `%0a${t('pos.whatsapp.payment')} : ${paymentLabel(lastReceipt.paymentMethod)}`;
    const discountLine = lastReceipt.discountTotal > 0 ? `%0a${t('pos.discount.total')}: -${formatMoney(lastReceipt.discountTotal, currency)}` : '';
    const pointsLine = lastReceipt.pointsEarned && lastReceipt.pointsEarned > 0 ? `%0a${t('pos.discount.pointsEarned', { points: lastReceipt.pointsEarned })}` : '';
    const foreignLine = lastReceipt.foreignCurrency && lastReceipt.foreignAmount != null
      ? `%0a${t('pos.currency.toCollectLabel')}: ${lastReceipt.foreignAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${lastReceipt.foreignCurrency}`
      : '';
    const msg = `*${t('pos.whatsapp.saleReceipt')} ${success}*%0a%0a${lines}${discountLine}%0a%0a*${t('pos.receipt.total')}: ${formatMoney(lastReceipt.total, currency)}*${foreignLine}${paymentLine}${pointsLine}%0a%0a${t('pos.receipt.thanks')}`;
    // FIX: this used to always open wa.me/?text=... with no recipient, even
    // when a real customer (with a real phone on file) was picked at
    // checkout -- the cashier had to manually pick the contact every time.
    // Now it targets the actual customer's number when we have one.
    const digitsOnly = (lastReceipt.customerPhone ?? '').replace(/[^0-9]/g, '');
    const target = digitsOnly.length >= 8 ? digitsOnly : '';
    window.open(`https://wa.me/${target}?text=${msg}`, '_blank');
  };

  // FIX: there was no way to email a receipt to a customer at all, even
  // when the selected customer has a real email on file (Customer.email).
  // mailto: can't attach a PDF, but it opens the cashier's own mail client
  // with the customer's real address and a real text summary of the sale
  // pre-filled -- a genuine send, not a placeholder. Only shown when an
  // email is actually on file (see the button below), so this never
  // pretends to work when there's nothing to send to.
  const sendEmail = () => {
    if (!success || !lastReceipt || !lastReceipt.customerEmail) return;
    const lines = lastReceipt.items.map((i) => `${i.product.name} x${i.quantity} = ${formatMoney(i.quantity * i.unit_price, currency)}`).join('\n');
    const paymentLine = lastReceipt.paymentReference
      ? `${t('pos.whatsapp.payment')}: ${paymentLabel(lastReceipt.paymentMethod)} (${t('pos.whatsapp.ref')}: ${lastReceipt.paymentReference})`
      : `${t('pos.whatsapp.payment')}: ${paymentLabel(lastReceipt.paymentMethod)}`;
    const discountLine = lastReceipt.discountTotal > 0 ? `${t('pos.discount.total')}: -${formatMoney(lastReceipt.discountTotal, currency)}\n` : '';
    const pointsLine = lastReceipt.pointsEarned && lastReceipt.pointsEarned > 0 ? `\n${t('pos.discount.pointsEarned', { points: lastReceipt.pointsEarned })}` : '';
    const foreignLine = lastReceipt.foreignCurrency && lastReceipt.foreignAmount != null
      ? `${t('pos.currency.toCollectLabel')}: ${lastReceipt.foreignAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${lastReceipt.foreignCurrency}\n`
      : '';
    const subject = `${t('pos.whatsapp.saleReceipt')} ${success}`;
    const body = `${lines}\n${discountLine}\n${t('pos.receipt.total')}: ${formatMoney(lastReceipt.total, currency)}\n${foreignLine}${paymentLine}${pointsLine}\n\n${t('pos.receipt.thanks')}`;
    window.location.href = `mailto:${lastReceipt.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div>
      {locked && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-ink-950/90 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-ink-900 p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-900/25 text-brand-500">
                <LockIcon size={22} />
              </div>
              <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">{pendingLockConfirm ? t('pos.lock.confirmTitle') : t('pos.lock.title')}</h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{pendingLockConfirm ? t('pos.lock.confirmDesc') : t('pos.lock.desc')}</p>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (pendingLockConfirm) { confirmLockAccount(); } else { unlockSession(); } }}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.lock.staffId')}</label>
                <input
                  autoFocus
                  value={unlockStaffCode}
                  onChange={(e) => setUnlockStaffCode(e.target.value)}
                  className="input"
                  placeholder={t('pos.lock.staffIdPlaceholder')}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.lock.pin')}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={unlockPin}
                  onChange={(e) => setUnlockPin(e.target.value)}
                  className="input"
                  placeholder="••••"
                />
              </div>
              {unlockErr && <p className="text-sm text-red-600 dark:text-red-400">{unlockErr}</p>}
              <button type="submit" disabled={unlocking} className="btn-primary w-full">
                {unlocking ? t('pos.lock.working') : pendingLockConfirm ? t('pos.lock.confirmBtn') : t('pos.lock.unlockBtn')}
              </button>
              {pendingLockConfirm && (
                <button
                  type="button"
                  onClick={() => { setLocked(false); setPendingLockConfirm(false); setUnlockErr(null); }}
                  className="btn-ghost w-full justify-center"
                >
                  {t('common.cancel')}
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Offline / pending-sync banner. Only shows when there's something
          to say — offline right now, or sales still waiting to sync. */}
      {(!isOnline || pendingOfflineSales.length > 0) && (
        <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
          !isOnline
            ? 'border-warning-300 bg-warning-50 text-warning-800 dark:border-warning-500/30 dark:bg-warning-900/20 dark:text-warning-200'
            : 'border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-500/30 dark:bg-brand-900/20 dark:text-brand-200'
        }`}>
          {!isOnline ? <WifiOff size={16} className="shrink-0" /> : <RefreshCw size={16} className={`shrink-0 ${syncingOffline ? 'animate-spin' : ''}`} />}
          <span className="flex-1">
            {!isOnline
              ? t('pos.offline.bannerOffline')
              : syncingOffline
                ? t('pos.offline.bannerSyncing')
                : t('pos.offline.bannerPending', { count: pendingOfflineSales.length })}
          </span>
          {pendingOfflineSales.length > 0 && (
            <span className="rounded-full bg-white/60 dark:bg-ink-950/40 px-2.5 py-0.5 text-xs font-semibold">
              {t('pos.offline.pendingCount', { count: pendingOfflineSales.length })}
            </span>
          )}
          {isOnline && pendingOfflineSales.length > 0 && !syncingOffline && (
            <button onClick={syncPendingOfflineSales} className="btn-ghost !py-1 !px-3 text-xs">
              {t('pos.offline.syncNow')}
            </button>
          )}
        </div>
      )}

      <PageHeader
        title={t('pos.title')}
        subtitle={t('pos.subtitle')}
        action={
          <button onClick={lockSession} className="btn-ghost inline-flex items-center gap-2">
            <LockIcon size={16} /> {t('pos.lock.lockBtn')}
          </button>
        }
      />

      {stores.length > 1 && pageTab === 'sale' && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-ink-600 dark:text-ink-300">{t('pos.storeLabel')}</label>
          <select value={storeId ?? ''} onChange={(e) => setStoreId(e.target.value)} className="input w-auto">
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {pageTab === 'sale' && !daySessionLoading && (
        daySession ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-200 bg-success-50 dark:border-success-900/40 dark:bg-success-900/20 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300">
              <Check size={15} />
              {t('pos.day.openSince', { time: new Date(daySession.opened_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={printXReport} disabled={xReportSubmitting} className="flex items-center gap-1 text-xs font-semibold text-success-700 dark:text-success-300 underline">
                <FileBarChart size={13} /> {t('pos.day.xReportBtn')}
              </button>
              <button onClick={() => setCloseDayModal(true)} className="text-xs font-semibold text-success-700 dark:text-success-300 underline">
                {t('pos.day.closeBtn')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-900/40 dark:bg-warning-900/20 px-4 py-2.5">
            <span className="text-sm font-medium text-warning-700 dark:text-warning-300">{t('pos.day.closedWarning')}</span>
            <button onClick={() => setOpenDayModal(true)} className="btn-primary py-1.5 text-xs">{t('pos.day.openBtn')}</button>
          </div>
        )
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
          <button onClick={() => setPageTab('sale')} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${pageTab === 'sale' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>
            <ShoppingCart size={14} /> {t('pos.tab.sale')}
          </button>
          <button onClick={() => setPageTab('history')} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${pageTab === 'history' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>
            <History size={14} /> {t('pos.tab.history')}
          </button>
          <button onClick={() => setPageTab('returns')} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition ${pageTab === 'returns' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>
            <RotateCcw size={14} /> {t('pos.tab.returns')}
          </button>
        </div>
        <button type="button" onClick={() => setIssueGiftCardModalOpen(true)} className="btn-ghost py-1.5 text-xs">
          <Gift size={14} /> {t('pos.giftCard.sellAction')}
        </button>
      </div>

      {pageTab === 'history' ? (
        <SaleHistoryTab />
      ) : pageTab === 'returns' ? (
        <ReturnsTab />
      ) : (
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Products */}
        <div className="lg:col-span-2">
          <div className="card p-4">
            <div className="relative mb-4">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t('pos.searchPlaceholder')}
                className="input pl-10"
              />
            </div>
            {loading ? (
              <p className="py-10 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.loading')}</p>
            ) : filtered.length === 0 ? (
              <EmptyState icon={ShoppingCart} title={t('pos.noProducts.title')} description={t('pos.noProducts.desc')} />
            ) : (
              <div className="grid max-h-[60vh] gap-3 overflow-y-auto scroll-thin sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group flex flex-col rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-3 text-left transition hover:border-brand-300 hover:shadow-soft"
                  >
                    <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/25 text-brand-500">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full rounded-lg object-cover" /> : <ShoppingCart size={22} />}
                    </div>
                    <p className="line-clamp-2 text-sm font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
                    <p className="mt-1 text-sm font-medium text-brand-700">{formatMoney(p.sale_price, currency)}</p>
                    {p.sku && <p className="text-xs text-ink-400 dark:text-ink-500">SKU: {p.sku}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="card flex flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-medium text-ink-900 dark:text-ink-50">
              <Receipt size={18} /> {t('pos.cart')} ({cart.length})
            </h3>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <button type="button" onClick={holdSale} disabled={holdingSale} className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50">
                  <PauseCircle size={14} /> {t('pos.hold.action')}
                </button>
              )}
              {heldSales.length > 0 && (
                <button type="button" onClick={() => setHeldSalesModalOpen(true)} className="flex items-center gap-1 rounded-full bg-warning-100 dark:bg-warning-900/35 px-2 py-0.5 text-xs font-semibold text-warning-700">
                  <PauseCircle size={12} /> {t('pos.hold.list', { count: heldSales.length })}
                </button>
              )}
            </div>
          </div>
          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <ShoppingCart size={28} className="mb-2 text-ink-300" />
              <p className="text-sm text-ink-400 dark:text-ink-500">{t('pos.cartEmpty')}</p>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto scroll-thin">
              <AnimatePresence>
                {cart.map((i) => (
                  <motion.div
                    key={i.product.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="rounded-xl border border-ink-200 dark:border-ink-700 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{i.product.name}</p>
                      <button onClick={() => removeItem(i.product.id)} className="text-ink-400 dark:text-ink-500 hover:text-error-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(i.product.id, -1)} className="rounded-full border border-ink-200 dark:border-ink-700 p-1 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={i.quantity}
                          onChange={(e) => setQty(i.product.id, Number(e.target.value))}
                          className="w-12 rounded-md border border-ink-200 dark:border-ink-700 px-2 py-1 text-center text-sm"
                        />
                        <button onClick={() => updateQty(i.product.id, 1)} className="rounded-full border border-ink-200 dark:border-ink-700 p-1 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-medium text-ink-900 dark:text-ink-50">{formatMoney(i.quantity * i.unit_price, currency)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {cart.length > 0 && (
            <div className="mt-4 border-t border-ink-100 dark:border-ink-800 pt-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>{t('pos.subtotal')}</span><span>{formatMoney(subtotal, currency)}</span></div>
                <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>{t('pos.taxes')}</span><span>{formatMoney(taxTotal, currency)}</span></div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-success-700"><span>{t('pos.discount.total')}</span><span>-{formatMoney(discountTotal, currency)}</span></div>
                )}
                <div className="flex justify-between text-base font-medium text-ink-900 dark:text-ink-50"><span>{t('pos.totalLabel')}</span><span>{formatMoney(total, currency)}</span></div>
              </div>
              <button onClick={() => setCheckoutOpen(true)} className="btn-primary mt-4 w-full justify-center py-3">
                {t('pos.checkout')} · {formatMoney(total, currency)}
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Issue gift card modal */}
      <Modal open={issueGiftCardModalOpen} onClose={resetIssueGiftCard} title={t('pos.giftCard.sellAction')}>
        {issuedCard ? (
          <div className="text-center">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/35 text-success-700">
              <Gift size={28} />
            </div>
            <p className="text-sm text-ink-600 dark:text-ink-300">{t('pos.giftCard.issuedNote')}</p>
            <p className="mt-2 rounded-lg bg-ink-100 dark:bg-ink-800 px-4 py-2 font-mono text-lg tracking-widest text-ink-900 dark:text-ink-50">{issuedCard.code}</p>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{formatMoney(issuedCard.balance, currency)}</p>
            <button onClick={resetIssueGiftCard} className="btn-primary mt-4 w-full justify-center">{t('common.done')}</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">{t('pos.giftCard.amountLabel')}</label>
              <input type="number" min={0} step="0.01" value={issueAmount} onChange={(e) => setIssueAmount(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">{t('pos.giftCard.customCodeLabel')}</label>
              <input type="text" value={issueCustomCode} onChange={(e) => setIssueCustomCode(e.target.value.toUpperCase())} className="input" placeholder={t('pos.giftCard.customCodePlaceholder')} />
            </div>
            {issueErr && <p className="text-xs font-medium text-error-600">{issueErr}</p>}
            <button onClick={issueGiftCard} disabled={issuing || !issueAmount} className="btn-primary w-full justify-center disabled:opacity-50">
              {issuing ? '…' : t('pos.giftCard.issueAction')}
            </button>
          </div>
        )}
      </Modal>

      {/* Held sales modal */}
      <Modal open={heldSalesModalOpen} onClose={() => setHeldSalesModalOpen(false)} title={t('pos.hold.modalTitle')}>
        {heldSales.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-400">{t('pos.hold.empty')}</p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {heldSales.map((h) => {
              const holdTotal = h.cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
              return (
                <div key={h.id} className="flex items-center justify-between rounded-xl border border-ink-200 dark:border-ink-700 p-3">
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{h.label || t('pos.hold.untitled')}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">{h.cart.length} {t('pos.hold.items')} · {formatMoney(holdTotal, currency)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => resumeHeldSale(h)} className="btn-primary py-1.5 text-xs">{t('pos.hold.resume')}</button>
                    <button type="button" onClick={() => deleteHeldSale(h.id)} className="text-error-500 hover:text-error-700"><Trash2 size={15} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={t('pos.checkoutTitle')}>
        <div className="space-y-4">
          <div>
            <p className="label">{t('pos.customerOptional')}</p>
            <input
              value={customerSearch}
              onChange={(e) => {
                const q = e.target.value;
                setCustomerSearch(q);
                // BUG FIX: `"anything".includes("")` is always true, so once the
                // field was cleared, .find() used to return whichever customer
                // happened to be first in the list instead of clearing the
                // selection. Only auto-match on a non-empty query.
                const match = q.trim() ? customers.find((c) => c.name.toLowerCase().includes(q.toLowerCase())) : null;
                setCustomer(match ?? null);
              }}
              className="input"
              placeholder={t('pos.searchCustomer')}
            />
            {customer && <p className="mt-1 text-xs text-success-700">{t('pos.customerPrefix')}: {customer.name}</p>}
          </div>

          {manualDiscountEnabled && (
            <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3 space-y-2">
              <p className="label mb-0 flex items-center gap-1"><Percent size={14} /> {t('pos.discount.manualTitle')}</p>
              {!discountApproval ? (
                <>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualDiscountAmount}
                    onChange={(e) => { setManualDiscountAmount(e.target.value); setDiscountErr(null); }}
                    className="input"
                    placeholder={t('pos.discount.amountPlaceholder')}
                  />
                  {requiresManagerApproval && Number(manualDiscountAmount) > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={discountApproverCode}
                        onChange={(e) => setDiscountApproverCode(e.target.value)}
                        className="input py-1.5 text-sm"
                        placeholder={t('pos.discount.approverStaffId')}
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        value={discountApproverPin}
                        onChange={(e) => setDiscountApproverPin(e.target.value.replace(/[^0-9]/g, ''))}
                        className="input py-1.5 text-sm"
                        placeholder={t('pos.discount.approverPin')}
                      />
                    </div>
                  )}
                  {requiresManagerApproval && Number(manualDiscountAmount) > 0 && (
                    <p className="text-xs text-ink-400 dark:text-ink-500">
                      {t('pos.discount.approvalRequiredNote', { amount: formatMoney(discountThreshold, currency) })}
                    </p>
                  )}
                  {discountErr && <p className="text-xs font-medium text-error-600">{discountErr}</p>}
                  <button
                    type="button"
                    onClick={applyManualDiscount}
                    disabled={!manualDiscountAmount || Number(manualDiscountAmount) <= 0 || applyingDiscount}
                    className="btn-ghost w-full justify-center py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {requiresManagerApproval ? t('pos.discount.requestApproval') : t('pos.discount.apply')}
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-success-700">
                    -{formatMoney(manualDiscountValue, currency)}
                    {discountApproval.approver_name && ` (${t('pos.discount.approvedBy')} ${discountApproval.approver_name})`}
                  </span>
                  <button type="button" onClick={clearManualDiscount} className="text-error-500 hover:text-error-700">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {loyaltyDiscountEnabled && (
            <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3 space-y-2">
              <p className="label mb-0 flex items-center gap-1"><Gift size={14} /> {t('pos.discount.loyaltyTitle')}</p>
              {!customer ? (
                <p className="text-xs text-ink-400 dark:text-ink-500">{t('pos.discount.loyaltyNeedsCustomer')}</p>
              ) : (
                <>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{t('pos.discount.loyaltyBalance', { points: customer.loyalty_points ?? 0 })}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={customer.loyalty_points ?? 0}
                      value={redeemPointsInput}
                      onChange={(e) => setRedeemPointsInput(e.target.value)}
                      className="input"
                      placeholder="0"
                    />
                    <span className="shrink-0 text-xs text-ink-400 dark:text-ink-500">{t('pos.discount.pointsSuffix')}</span>
                  </div>
                  {loyaltyRedeemPoints > 0 && (
                    <p className="text-xs font-medium text-success-700">-{formatMoney(loyaltyDiscountValue, currency)}</p>
                  )}
                </>
              )}
            </div>
          )}

          {(appliedPromotion || activePromotions.some((p) => p.requires_code)) && (
            <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3 space-y-2">
              <p className="label mb-0 flex items-center gap-1"><Tag size={14} /> {t('pos.promo.title')}</p>
              {appliedCoupon ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-success-700">{appliedCoupon.name} — -{formatMoney(promotionValue, currency)}</span>
                  <button type="button" onClick={clearCoupon} className="text-error-500 hover:text-error-700"><X size={14} /></button>
                </div>
              ) : (
                <>
                  {bestAutoPromotion && (
                    <p className="text-xs font-medium text-success-700">{t('pos.promo.autoApplied', { name: bestAutoPromotion.name, amount: formatMoney(promotionValue, currency) })}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponErr(null); }}
                      className="input flex-1"
                      placeholder={t('pos.promo.codePlaceholder')}
                    />
                    <button type="button" onClick={applyCoupon} disabled={!couponCode.trim()} className="btn-ghost shrink-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      {t('pos.promo.apply')}
                    </button>
                  </div>
                  {couponErr && <p className="text-xs font-medium text-error-600">{couponErr}</p>}
                </>
              )}
            </div>
          )}

          {foreignCurrencies.length > 0 && (
            <div className="rounded-xl border border-ink-200 dark:border-ink-700 p-3 space-y-2">
              <p className="label mb-0">{t('pos.currency.title')}</p>
              <select value={activeSaleCurrency} onChange={(e) => setSaleCurrency(e.target.value)} className="input">
                <option value={tenant?.currency}>{tenant?.currency} ({t('pos.currency.home')})</option>
                {foreignCurrencies.map((c) => <option key={c.id} value={c.currency_code}>{c.currency_code}</option>)}
              </select>
              {activeSaleCurrency !== tenant?.currency && (
                <p className="text-xs font-medium text-brand-700">
                  {t('pos.currency.toCollect', { amount: totalInSaleCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 }), currency: activeSaleCurrency })}
                </p>
              )}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <p className="label mb-0">{t('pos.paymentMethod')}</p>
              <button
                type="button"
                onClick={() => setSplitPayment((v) => !v)}
                className={`text-xs font-semibold underline ${splitPayment ? 'text-brand-600' : 'text-ink-400 dark:text-ink-500'}`}
              >
                {splitPayment ? t('pos.split.disable') : t('pos.split.enable')}
              </button>
            </div>
            {!splitPayment && (
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
                      paymentMethod === m.id ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/25 text-brand-700' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-brand-200'
                    }`}
                  >
                    <m.icon size={18} /> {t(m.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {splitPayment && (
            <div className="space-y-2 rounded-xl border border-ink-200 dark:border-ink-700 p-3">
              {splitTenders.map((tender, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={tender.method}
                    onChange={(e) => setSplitTenders((rows) => rows.map((r, i) => (i === idx ? { ...r, method: e.target.value } : r)))}
                    className="input py-1.5 text-sm w-28 shrink-0"
                  >
                    {SPLIT_PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{t(m.labelKey)}</option>)}
                  </select>
                  <input
                    type="number"
                    value={tender.amount}
                    onChange={(e) => setSplitTenders((rows) => rows.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))}
                    className="input py-1.5 text-sm flex-1"
                    placeholder={t('pos.split.amountPlaceholder')}
                  />
                  {tender.method !== 'cash' && (
                    <input
                      type="text"
                      value={tender.reference}
                      onChange={(e) => setSplitTenders((rows) => rows.map((r, i) => (i === idx ? { ...r, reference: e.target.value } : r)))}
                      className="input py-1.5 text-sm w-28"
                      placeholder={t('pos.split.refPlaceholder')}
                    />
                  )}
                  {splitTenders.length > 1 && (
                    <button type="button" onClick={() => setSplitTenders((rows) => rows.filter((_, i) => i !== idx))} className="text-error-500 hover:text-error-700 shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSplitTenders((rows) => [...rows, { method: 'card', amount: '', reference: '' }])}
                className="text-xs font-semibold text-brand-600"
              >
                + {t('pos.split.addTender')}
              </button>
              <p className={`text-xs font-medium ${Math.abs(splitRemaining) < 0.01 ? 'text-success-700' : 'text-warning-700'}`}>
                {Math.abs(splitRemaining) < 0.01
                  ? t('pos.split.fullyAllocated')
                  : splitRemaining > 0
                    ? t('pos.split.remaining', { amount: formatMoney(splitRemaining, currency) })
                    : t('pos.split.overAllocated', { amount: formatMoney(-splitRemaining, currency) })}
              </p>
            </div>
          )}
          <div>
            <p className="label">{t('pos.delivery')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeliveryChoice('delivered')}
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                  deliveryChoice === 'delivered' ? 'border-success-400 bg-success-50 dark:bg-success-900/25 text-success-700' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-success-200'
                }`}
              >
                <Package size={16} /> {t('pos.delivered')}
              </button>
              <button
                onClick={() => setDeliveryChoice('pending')}
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                    deliveryChoice === 'pending' ? 'border-warning-400 bg-warning-50 dark:bg-warning-900/25 text-warning-700' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-warning-200'
                }`}
              >
                <Truck size={16} /> {t('pos.notDelivered')}
              </button>
            </div>
            {deliveryChoice === 'pending' && <p className="mt-1 text-xs text-warning-700">{t('pos.pendingDeliveryNote')}</p>}
          </div>
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-4 text-center">
            <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('pos.totalToPay')}</p>
            <p className="text-2xl font-medium text-brand-700">{formatMoney(total, currency)}</p>
          </div>
          {!splitPayment && paymentMethod === 'cash' && (
            <div>
              <label className="label">{t('pos.amountReceived')}</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="input"
                placeholder={String(total)}
              />
              {paidAmount && Number(paidAmount) > total && (
                <p className="mt-1 text-xs font-medium text-success-700">{t('pos.change')}: {formatMoney(Number(paidAmount) - total, currency)}</p>
              )}
            </div>
          )}
          {!splitPayment && (paymentMethod === 'card' || paymentMethod === 'mobile_money') && (
            <div>
              <label className="label">
                {paymentMethod === 'card' ? t('pos.cardRefLabel') : t('pos.mobileRefLabel')}
                <span className="ml-1 text-error-500">*</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="input"
                placeholder={paymentMethod === 'card' ? t('pos.cardRefPlaceholder') : t('pos.mobileRefPlaceholder')}
              />
              <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">{t('pos.refHelp')}</p>
            </div>
          )}
          {!splitPayment && paymentMethod === 'gift_card' && (
            <div className="space-y-2">
              <label className="label">{t('pos.giftCard.codeLabel')} <span className="ml-1 text-error-500">*</span></label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={giftCardCode}
                  onChange={(e) => { setGiftCardCode(e.target.value.toUpperCase()); setGiftCardCheck(null); setGiftCardErr(null); }}
                  className="input flex-1"
                  placeholder={t('pos.giftCard.codePlaceholder')}
                />
                <button
                  type="button"
                  disabled={!giftCardCode.trim() || checkingGiftCard}
                  onClick={async () => {
                    if (!tenant) return;
                    setCheckingGiftCard(true);
                    setGiftCardErr(null);
                    const { data, error } = await apiGetGiftCardStatus({ tenantId: tenant.id, code: giftCardCode.trim() });
                    setCheckingGiftCard(false);
                    if (error) { setGiftCardErr(error); setGiftCardCheck(null); return; }
                    if (!data?.found) { setGiftCardErr(t('pos.giftCard.err.notFound')); setGiftCardCheck(null); return; }
                    if (data.status !== 'active') { setGiftCardErr(t('pos.giftCard.err.notActive')); setGiftCardCheck(null); return; }
                    if ((data.balance ?? 0) < total) { setGiftCardErr(t('pos.giftCard.err.insufficientBalance')); setGiftCardCheck(null); return; }
                    setGiftCardCheck({ id: data.id ?? '', balance: data.balance ?? 0 });
                  }}
                  className="btn-ghost shrink-0 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingGiftCard ? '…' : t('pos.giftCard.verify')}
                </button>
              </div>
              {giftCardErr && <p className="text-xs font-medium text-error-600">{giftCardErr}</p>}
              {giftCardCheck && (
                <p className="text-xs font-medium text-success-700">{t('pos.giftCard.balanceOk', { balance: formatMoney(giftCardCheck.balance, currency) })}</p>
              )}
            </div>
          )}
          <button onClick={checkout} disabled={splitPayment && Math.abs(splitRemaining) > 0.01} className="btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed">
            <Check size={16} /> {t('pos.confirmCheckout')}
          </button>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal open={!!success} onClose={() => setSuccess(null)} title={t('pos.saleRecorded')} maxWidth="max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/35 text-success-700">
            <Check size={28} />
          </div>
          <p className="text-sm text-ink-600 dark:text-ink-300">{t('pos.saleSuccessPrefix')} <strong>{success}</strong> {t('pos.saleSuccessSuffix')}</p>
          {deliveryChoice === 'pending' && (
            <p className="mt-1 text-xs text-warning-700">{t('pos.pendingDeliveryCreated')}</p>
          )}
          <div className="mt-4 flex w-full gap-2">
            <button onClick={printReceipt} className="btn-ghost flex-1 justify-center text-sm"><Printer size={15} /> {t('pos.print')}</button>
            <button onClick={sendWhatsApp} className="btn-ghost flex-1 justify-center text-sm border-success-200 text-success-700"><MessageCircle size={15} /> {t('pos.whatsapp')}</button>
          </div>
          {lastReceipt?.customerEmail && (
            <button onClick={sendEmail} className="btn-ghost mt-2 w-full justify-center text-sm border-brand-200 text-brand-700">
              <Mail size={15} /> {t('pos.emailReceipt')} ({lastReceipt.customerEmail})
            </button>
          )}
          <button onClick={() => setSuccess(null)} className="btn-primary mt-3 w-full justify-center">{t('pos.newSale')}</button>
        </div>
      </Modal>

      {/* Day-open modal: opening petty cash + staff present */}
      <Modal open={openDayModal} onClose={() => setOpenDayModal(false)} title={t('pos.day.openTitle')}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.day.openingCash')}</label>
            <input type="number" min={0} value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} className="input" placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.day.staffPresent')}</label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700 p-2">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50 dark:hover:bg-ink-800">
                  <input
                    type="checkbox"
                    checked={presentStaffIds.has(m.id)}
                    onChange={(e) => setPresentStaffIds((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(m.id); else next.delete(m.id);
                      return next;
                    })}
                    className="rounded border-ink-300"
                  />
                  <span className="text-ink-900 dark:text-ink-50">{m.display_name ?? '—'}</span>
                  {m.staff_code && <span className="font-mono text-xs text-ink-500">{m.staff_code}</span>}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.day.notesOptional')}</label>
            <input value={dayNotes} onChange={(e) => setDayNotes(e.target.value)} className="input" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setOpenDayModal(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={openDay} disabled={daySubmitting} className="btn-primary">{t('pos.day.openBtn')}</button>
        </div>
      </Modal>

      {/* Day-close modal: counted cash, expected vs actual computed server-side */}
      <Modal open={closeDayModal} onClose={() => setCloseDayModal(false)} title={t('pos.day.closeTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-300">{t('pos.day.closeDesc')}</p>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.day.countedCash')}</label>
            <input type="number" min={0} value={closingCash} onChange={(e) => setClosingCash(e.target.value)} className="input" placeholder="0" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('pos.day.notesOptional')}</label>
            <input value={dayNotes} onChange={(e) => setDayNotes(e.target.value)} className="input" />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setCloseDayModal(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={closeDay} disabled={daySubmitting} className="btn-primary">{t('pos.day.closeBtn')}</button>
        </div>
      </Modal>
    </div>
  );
}
