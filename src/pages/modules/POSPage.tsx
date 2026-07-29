import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Smartphone, Banknote, Check, Receipt, Truck, Package, MessageCircle, Printer } from 'lucide-react';
import { useAuth } from '../../lib/auth';
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
  { id: 'cash', label: 'Espèces', icon: Banknote },
  { id: 'card', label: 'Carte', icon: CreditCard },
  { id: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
];

export function POSPage() {
  const { tenant, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<{ items: CartItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveryChoice, setDeliveryChoice] = useState<'delivered' | 'pending'>('delivered');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const toast = useToast();

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
        payment_status: paymentStatus,
        sale_status: 'completed',
        notes: deliveryChoice === 'pending' ? 'Livraison à organiser' : 'Livré',
        user_id: user?.id,
      })
      .select()
      .single();

    if (error || !sale) {
      toast('error', error?.message ?? "Échec de l'enregistrement de la vente. Rien n'a été débité.");
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
      toast('error', `Vente ${ref} créée mais articles non enregistrés : ${itemsErr.message}. Contactez le support.`);
      return;
    }

    // If "Non livré", create a pending delivery with per-product line items
    if (deliveryChoice === 'pending') {
      const { data: delivery, error: delErr } = await supabase.from('deliveries').insert({
        tenant_id: tenant.id,
        sale_id: sale.id,
        customer_name: customer?.name ?? 'Client comptant',
        address: customer?.address ?? null,
        city: customer?.city ?? null,
        phone: customer?.phone ?? null,
        status: 'pending',
        scheduled_date: new Date().toISOString().slice(0, 10),
      }).select().single();

      if (delErr) {
        toast('error', `Vente enregistrée, mais la livraison n'a pas pu être créée : ${delErr.message}`);
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
        if (diErr) toast('error', `Livraison créée mais détails non enregistrés : ${diErr.message}`);
      }
    }

    setSuccess(ref);
    setLastReceipt({ items: cart, total });
    setCart([]);
    setPaidAmount('');
    setCheckoutOpen(false);
    setCustomer(null);
    setCustomerSearch('');
    setDeliveryChoice('delivered');
  };

  const printReceipt = () => {
    if (!success || !lastReceipt) return;
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = lastReceipt.items.map((i) => `<tr><td>${i.product.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${formatMoney(i.unit_price, currency)}</td><td style="text-align:right;font-weight:bold">${formatMoney(i.quantity * i.unit_price, currency)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Reçu ${success}</title><style>body{font-family:monospace;padding:30px;max-width:400px;margin:auto;font-size:12px}h2{color:#1a365d;text-align:center}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{padding:4px 6px;border-bottom:1px dashed #ccc;text-align:left}th{text-transform:uppercase;font-size:10px;color:#888}.total{margin-top:15px;text-align:right;font-size:16px;font-weight:bold}.info{text-align:center;color:#666;margin-top:10px}</style></head><body><h2>POS Flow</h2><p style="text-align:center">Reçu de vente ${success}</p><p style="text-align:center">${new Date().toLocaleString('fr-FR')}</p><table><thead><tr><th>Désignation</th><th style="text-align:right">Qté</th><th style="text-align:right">Prix</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${formatMoney(lastReceipt.total, currency)}</div><div class="info">Merci de votre confiance !<br/>${tenant?.name ?? ''}</div></body></html>`);
    w.document.close();
    w.print();
  };

  const sendWhatsApp = () => {
    if (!success || !lastReceipt) return;
    const lines = lastReceipt.items.map((i) => `${i.product.name} x${i.quantity} = ${formatMoney(i.quantity * i.unit_price, currency)}`).join('%0a');
    const msg = `*Reçu de vente ${success}*%0a%0a${lines}%0a%0a*Total: ${formatMoney(lastReceipt.total, currency)}*%0a%0aMerci de votre confiance !`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div>
      <PageHeader
        title="Point de Vente"
        subtitle="Encaissez vos ventes en quelques secondes."
      />

      {stores.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium text-ink-600 dark:text-ink-300">Magasin :</label>
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
                placeholder="Rechercher par nom, SKU ou code-barres…"
                className="input pl-10"
              />
            </div>
            {loading ? (
              <p className="py-10 text-center text-sm text-ink-400 dark:text-ink-500">Chargement…</p>
            ) : filtered.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="Aucun produit" description="Ajoutez des produits depuis le catalogue pour commencer à vendre." />
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
                    <p className="line-clamp-2 text-sm font-semibold text-ink-900 dark:text-ink-50">{p.name}</p>
                    <p className="mt-1 text-sm font-bold text-brand-700">{formatMoney(p.sale_price, currency)}</p>
                    {p.sku && <p className="text-xs text-ink-400 dark:text-ink-500">SKU: {p.sku}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="card flex flex-col p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-ink-900 dark:text-ink-50">
            <Receipt size={18} /> Panier ({cart.length})
          </h3>
          {cart.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <ShoppingCart size={28} className="mb-2 text-ink-300" />
              <p className="text-sm text-ink-400 dark:text-ink-500">Panier vide</p>
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
                      <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{i.product.name}</p>
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
                      <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">{formatMoney(i.quantity * i.unit_price, currency)}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {cart.length > 0 && (
            <div className="mt-4 border-t border-ink-100 dark:border-ink-800 pt-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Sous-total</span><span>{formatMoney(subtotal, currency)}</span></div>
                <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Taxes</span><span>{formatMoney(taxTotal, currency)}</span></div>
                <div className="flex justify-between text-base font-bold text-ink-900 dark:text-ink-50"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
              </div>
              <button onClick={() => setCheckoutOpen(true)} className="btn-primary mt-4 w-full justify-center py-3">
                Encaisser · {formatMoney(total, currency)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout modal */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Encaisser la vente">
        <div className="space-y-4">
          <div>
            <p className="label">Client (optionnel)</p>
            <input
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                const match = customers.find((c) => c.name.toLowerCase().includes(e.target.value.toLowerCase()));
                setCustomer(match ?? null);
              }}
              className="input"
              placeholder="Rechercher un client…"
            />
            {customer && <p className="mt-1 text-xs text-success-700">Client: {customer.name}</p>}
          </div>
          <div>
            <p className="label">Moyen de paiement</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition ${
                    paymentMethod === m.id ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/25 text-brand-700' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-brand-200'
                  }`}
                >
                  <m.icon size={18} /> {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Livraison</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeliveryChoice('delivered')}
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                  deliveryChoice === 'delivered' ? 'border-success-400 bg-success-50 dark:bg-success-900/25 text-success-700' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-success-200'
                }`}
              >
                <Package size={16} /> Livré
              </button>
              <button
                onClick={() => setDeliveryChoice('pending')}
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${
                    deliveryChoice === 'pending' ? 'border-warning-400 bg-warning-50 dark:bg-warning-900/25 text-warning-700' : 'border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-warning-200'
                }`}
              >
                <Truck size={16} /> Non livré
              </button>
            </div>
            {deliveryChoice === 'pending' && <p className="mt-1 text-xs text-warning-700">Une livraison "en attente" sera créée automatiquement dans le module Livraisons.</p>}
          </div>
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-4 text-center">
            <p className="text-xs uppercase text-ink-500 dark:text-ink-400">Total à payer</p>
            <p className="text-2xl font-bold text-brand-700">{formatMoney(total, currency)}</p>
          </div>
          {paymentMethod === 'cash' && (
            <div>
              <label className="label">Montant reçu</label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="input"
                placeholder={String(total)}
              />
              {paidAmount && Number(paidAmount) > total && (
                <p className="mt-1 text-xs font-semibold text-success-700">Rendu : {formatMoney(Number(paidAmount) - total, currency)}</p>
              )}
            </div>
          )}
          <button onClick={checkout} className="btn-primary w-full justify-center py-3">
            <Check size={16} /> Confirmer l'encaissement
          </button>
        </div>
      </Modal>

      {/* Success modal */}
      <Modal open={!!success} onClose={() => setSuccess(null)} title="Vente enregistrée" maxWidth="max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/35 text-success-700">
            <Check size={28} />
          </div>
          <p className="text-sm text-ink-600 dark:text-ink-300">Vente <strong>{success}</strong> enregistrée avec succès.</p>
          {deliveryChoice === 'pending' && (
            <p className="mt-1 text-xs text-warning-700">Livraison "en attente" créée.</p>
          )}
          <div className="mt-4 flex w-full gap-2">
            <button onClick={printReceipt} className="btn-ghost flex-1 justify-center text-sm"><Printer size={15} /> Imprimer</button>
            <button onClick={sendWhatsApp} className="btn-ghost flex-1 justify-center text-sm border-success-200 text-success-700"><MessageCircle size={15} /> WhatsApp</button>
          </div>
          <button onClick={() => setSuccess(null)} className="btn-primary mt-3 w-full justify-center">Nouvelle vente</button>
        </div>
      </Modal>
    </div>
  );
}
