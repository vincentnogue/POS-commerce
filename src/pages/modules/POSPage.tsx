import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote, Check, Receipt, Truck, Package, MessageCircle, Printer } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
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
      setLoading(false);
    })();
  }, [tenant]);

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

  const checkout = async () => {
    if (!tenant || cart.length === 0) return;
    if ((paymentMethod === 'card' || paymentMethod === 'mobile_money') && !paymentReference.trim()) {
      toast('error', t('pos.err.paymentRefRequired'));
      return;
    }
    const ref = `VTE-${Date.now().toString().slice(-8)}`;
    const paid = paymentMethod === 'cash' ? (Number(paidAmount) || total) : total;
    const paymentStatus = paid >= total ? 'paid' : 'unpaid';

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
        payment_method: paymentMethod,
        payment_reference: paymentMethod === 'cash' ? null : paymentReference.trim(),
        payment_status: paymentStatus,
        sale_status: 'completed',
        notes: deliveryChoice === 'pending' ? t('pos.notes.deliveryPending') : t('pos.notes.delivered'),
        user_id: user?.id,
      })
      .select()
      .single();

    if (error || !sale) {
      toast('error', error?.message ?? t('pos.err.saleFailed'));
      return;
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
    setCheckoutOpen(false);
    setCustomer(null);
    setCustomerSearch('');
    setDeliveryChoice('delivered');
  };

  const paymentLabel = (m: string) => m === 'cash' ? t('pos.pay.cash') : m === 'card' ? t('pos.pay.cardLabel') : t('pos.pay.mobileMoney');

  const printReceipt = () => {
    if (!success || !lastReceipt) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = lastReceipt.items.map((i) => `<tr><td>${i.product.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${formatMoney(i.unit_price, currency)}</td><td style="text-align:right;font-weight:600">${formatMoney(i.quantity * i.unit_price, currency)}</td></tr>`).join('');
    const now = new Date();
    w.document.write(`<!DOCTYPE html><html lang="${lang}"><head><title>${t('pos.receipt.title')} ${success}</title><meta charset="utf-8"/><style>
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; padding: 24px; max-width: 380px; margin: auto; font-size: 12px; color: #1a1a1a; }
      .brand { text-align: center; font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
      .tagline { text-align: center; font-size: 10px; color: #888; margin-bottom: 12px; }
      .divider { border-top: 1px dashed #999; margin: 10px 0; }
      .divider.solid { border-top: 1.5px solid #333; }
      .meta { display: flex; justify-content: space-between; font-size: 11px; color: #444; margin: 2px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 5px 4px; text-align: left; }
      th { text-transform: uppercase; font-size: 9px; color: #888; border-bottom: 1px solid #ccc; }
      td { border-bottom: 1px dotted #ddd; }
      .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-top: 10px; padding-top: 8px; border-top: 1.5px solid #333; }
      .payment-block { margin-top: 14px; padding: 10px; background: #f7f7f7; border-radius: 6px; }
      .payment-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
      .payment-row .label { color: #666; }
      .payment-row .value { font-weight: 700; letter-spacing: 0.5px; }
      .footer { text-align: center; margin-top: 18px; font-size: 10px; color: #777; }
      .footer .thanks { font-size: 12px; font-weight: 600; color: #1a1a1a; margin-bottom: 3px; }
    </style></head><body>
      <div class="brand">POS Flow</div>
      <div class="tagline">${tenant?.name ?? ''}</div>
      <div class="divider solid"></div>
      <div class="meta"><span>${t('pos.receipt.receipt')}</span><strong>${success}</strong></div>
      <div class="meta"><span>${t('pos.receipt.date')}</span><span>${now.toLocaleDateString(locale)} ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="divider"></div>
      <table><thead><tr><th>${t('pos.receipt.designation')}</th><th style="text-align:right">${t('pos.receipt.qty')}</th><th style="text-align:right">${t('pos.receipt.price')}</th><th style="text-align:right">${t('pos.receipt.total')}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total-row"><span>${t('pos.receipt.total')}</span><span>${formatMoney(lastReceipt.total, currency)}</span></div>
      <div class="payment-block">
        <div class="payment-row"><span class="label">${t('pos.receipt.paymentMode')}</span><span class="value">${paymentLabel(lastReceipt.paymentMethod)}</span></div>
        ${lastReceipt.paymentReference ? `<div class="payment-row"><span class="label">${t('pos.receipt.refLabel')}</span><span class="value">${lastReceipt.paymentReference}</span></div>` : ''}
        <div class="payment-row"><span class="label">${t('pos.receipt.status')}</span><span class="value">${t('pos.receipt.statusPaid')}</span></div>
      </div>
      <div class="footer">
        <div class="thanks">${t('pos.receipt.thanks')}</div>
        ${t('pos.receipt.keepProof')}
      </div>
    </body></html>`);
    w.document.close();
    w.print();
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

      {stores.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-ink-600 dark:text-ink-300">{t('pos.storeLabel')}</label>
          <select value={storeId ?? ''} onChange={(e) => setStoreId(e.target.value)} className="input w-auto">
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

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
            <p className="label">{t('pos.paymentMethod')}</p>
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
          </div>
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
          {paymentMethod === 'cash' && (
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
          {(paymentMethod === 'card' || paymentMethod === 'mobile_money') && (
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
          <button onClick={checkout} className="btn-primary w-full justify-center py-3">
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
    </div>
  );
}
