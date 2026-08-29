import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote, Check, Receipt, Truck, Package, MessageCircle, Printer, History, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { printSaleReceipt } from '../../lib/receipt';
import { SaleHistoryTab } from './SaleHistoryTab';
import type { Product, Customer } from '../../lib/types';

type CartItem = {
  product: Product;
  quantity: number;
  unit_price: number;
};

const PAYMENT_METHODS = [
  { id: 'cash', labelKey: 'pos.pay.cash', icon: Banknote },
  { id: 'card', labelKey: 'pos.pay.card', icon: CreditCard },
  { id: 'mobile_money', labelKey: 'pos.pay.mobileMoney', icon: Smartphone },
];

export function POSPage() {
  const { tenant, user } = useAuth();
  const { t, lang, locale } = useI18n();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitTenders, setSplitTenders] = useState<{ method: string; amount: string; reference: string }[]>([
    { method: 'cash', amount: '', reference: '' },
  ]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ items: CartItem[]; total: number; paymentMethod: string; paymentReference: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryChoice, setDeliveryChoice] = useState<'delivered' | 'pending'>('delivered');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [pageTab, setPageTab] = useState<'sale' | 'history'>('sale');
  const [daySession, setDaySession] = useState<any | null>(null);
  const [daySessionLoading, setDaySessionLoading] = useState(true);
  const [members, setMembers] = useState<{ id: string; display_name: string | null; staff_code: string | null }[]>([]);
  const [openDayModal, setOpenDayModal] = useState(false);
  const [closeDayModal, setCloseDayModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [presentStaffIds, setPresentStaffIds] = useState<Set<string>>(new Set());
  const [dayNotes, setDayNotes] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [daySubmitting, setDaySubmitting] = useState(false);

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
      const { data: m } = await supabase.from('tenant_members').select('id, display_name, staff_code').eq('tenant_id', tenant.id);
      setMembers((m as any[]) ?? []);
      setLoading(false);
    })();
  }, [tenant]);

  const loadDaySession = async () => {
    if (!tenant) return;
    setDaySessionLoading(true);
    let query = supabase.from('day_sessions').select('*').eq('tenant_id', tenant.id).eq('status', 'open');
    query = storeId ? query.eq('store_id', storeId) : query.is('store_id', null);
    const { data } = await query.maybeSingle();
    setDaySession(data ?? null);
    setDaySessionLoading(false);
  };

  useEffect(() => { loadDaySession(); }, [tenant, storeId]);

  const openDay = async () => {
    if (!tenant || !user) return;
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
    if (!tenant || !user || !daySession) return;
    const cashValue = Number(closingCash);
    if (Number.isNaN(cashValue) || cashValue < 0) { toast('error', t('pos.day.err.invalidCash')); return; }
    setDaySubmitting(true);
    const { error } = await supabase.rpc('close_day_session', {
      p_session_id: daySession.id,
      p_closing_cash: cashValue,
      p_notes: dayNotes || null,
      p_user_id: user.id,
    });
    setDaySubmitting(false);
    if (error) { toast('error', error.message); return; }
    setCloseDayModal(false);
    setClosingCash(''); setDayNotes('');
    await loadDaySession();
    toast('success', t('pos.day.toast.closed'));
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
  const total = subtotal + taxTotal;

  const splitTotal = splitTenders.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const splitRemaining = total - splitTotal;

  const checkout = async () => {
    if (!tenant || cart.length === 0) return;
    if (!daySession) {
      toast('error', t('pos.day.err.mustOpenFirst'));
      return;
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
      paid = paymentMethod === 'cash' ? (Number(paidAmount) || total) : total;
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
        discount_total: 0,
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
    const { error: itemsErr } = await supabase.from('sale_items').insert(
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
    );
    if (itemsErr) {
      toast('error', t('pos.err.itemsFailed', { ref, msg: itemsErr.message }));
      return;
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
        scheduled_date: new Date().toISOString().slice(0, 10),
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
    setLastReceipt({ items: cart, total, paymentMethod, paymentReference: paymentReference.trim() });
    setCart([]);
    setPaymentReference('');
    setPaidAmount('');
    setSplitPayment(false);
    setSplitTenders([{ method: 'cash', amount: '', reference: '' }]);
    setCheckoutOpen(false);
    setCustomer(null);
    setCustomerSearch('');
    setDeliveryChoice('delivered');
  };

  const paymentLabel = (m: string) => m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : t('pos.pay.mobileMoney');

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
    const msg = `*${t('pos.whatsapp.saleReceipt')} ${success}*%0a%0a${lines}%0a%0a*${t('pos.receipt.total')}: ${formatMoney(lastReceipt.total, currency)}*${paymentLine}%0a%0a${t('pos.receipt.thanks')}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div>
      <PageHeader
        title={t('pos.title')}
        subtitle={t('pos.subtitle')}
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
            <button onClick={() => setCloseDayModal(true)} className="text-xs font-semibold text-success-700 dark:text-success-300 underline">
              {t('pos.day.closeBtn')}
            </button>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-200 bg-warning-50 dark:border-warning-900/40 dark:bg-warning-900/20 px-4 py-2.5">
            <span className="text-sm font-medium text-warning-700 dark:text-warning-300">{t('pos.day.closedWarning')}</span>
            <button onClick={() => setOpenDayModal(true)} className="btn-primary py-1.5 text-xs">{t('pos.day.openBtn')}</button>
          </div>
        )
      )}

      <div className="mb-4 inline-flex rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
        <button onClick={() => setPageTab('sale')} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${pageTab === 'sale' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>
          <ShoppingCart size={14} /> {t('pos.tab.sale')}
        </button>
        <button onClick={() => setPageTab('history')} className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${pageTab === 'history' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>
          <History size={14} /> {t('pos.tab.history')}
        </button>
      </div>

      {pageTab === 'history' ? (
        <SaleHistoryTab />
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
          <h3 className="mb-3 flex items-center gap-2 font-medium text-ink-900 dark:text-ink-50">
            <Receipt size={18} /> {t('pos.cart')} ({cart.length})
          </h3>
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
                        <button onClick={() => updateQty(i.product.id, -1)} className="rounded-md border border-ink-200 dark:border-ink-700 p-1 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-900">
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={i.quantity}
                          onChange={(e) => setQty(i.product.id, Number(e.target.value))}
                          className="w-12 rounded-md border border-ink-200 dark:border-ink-700 px-2 py-1 text-center text-sm"
                        />
                        <button onClick={() => updateQty(i.product.id, 1)} className="rounded-md border border-ink-200 dark:border-ink-700 p-1 text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-900">
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

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={t('pos.checkoutTitle')}>
        <div className="space-y-4">
          <div>
            <p className="label">{t('pos.customerOptional')}</p>
            <input
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                const match = customers.find((c) => c.name.toLowerCase().includes(e.target.value.toLowerCase()));
                setCustomer(match ?? null);
              }}
              className="input"
              placeholder={t('pos.searchCustomer')}
            />
            {customer && <p className="mt-1 text-xs text-success-700">{t('pos.customerPrefix')}: {customer.name}</p>}
          </div>
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
                    {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{t(m.labelKey)}</option>)}
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
