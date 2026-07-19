import { useEffect, useState, useMemo } from 'react';
import { Plus, ClipboardList, Download, Trash2, Eye, Send } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Quote, Customer, Product, QuoteItem } from '../../lib/types';

const STATUS_LABELS: Record<string, { label: string; tone: any }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  sent: { label: 'Envoyé', tone: 'brand' },
  accepted: { label: 'Accepté', tone: 'success' },
  refused: { label: 'Refusé', tone: 'error' },
  expired: { label: 'Expiré', tone: 'warning' },
};

export function QuotesPage() {
  const { tenant } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState<Quote | null>(null);
  const [viewItems, setViewItems] = useState<QuoteItem[]>([]);
  const [form, setForm] = useState<any>({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), expiry_date: '', items: [] });

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [q, c, p] = await Promise.all([
      supabase.from('quotes').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('products').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
    ]);
    setQuotes((q.data as any[]) ?? []);
    setCustomers((c.data as Customer[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return quotes.filter((x) => !q || x.number.toLowerCase().includes(q) || (x as any).customer?.name?.toLowerCase().includes(q));
  }, [quotes, search]);

  const addItem = () => setForm((f: any) => ({ ...f, items: [...f.items, { product_id: '', name: '', quantity: 1, unit_price: 0, discount: 0, tax_rate: 0, total: 0 }] }));
  const updateItem = (i: number, key: string, value: any) => setForm((f: any) => {
    const items = [...f.items];
    items[i] = { ...items[i], [key]: value };
    if (key === 'product_id') {
      const p = products.find((x) => x.id === value);
      if (p) items[i] = { ...items[i], name: p.name, unit_price: Number(p.sale_price), tax_rate: Number(p.tax_rate) };
    }
    items[i].total = items[i].quantity * items[i].unit_price * (1 - items[i].discount / 100) * (1 + items[i].tax_rate / 100);
    return { ...f, items };
  });
  const removeItem = (i: number) => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }));
  const total = form.items.reduce((s: number, it: any) => s + it.total, 0);

  const save = async () => {
    if (!tenant || form.items.length === 0) return;
    const num = `DEV-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, '0')}`;
    const { data: q } = await supabase.from('quotes').insert({
      tenant_id: tenant.id,
      customer_id: form.customer_id || null,
      number: num,
      status: 'draft',
      issue_date: form.issue_date,
      expiry_date: form.expiry_date || null,
      subtotal: total, tax_total: 0, discount_total: 0, total,
    }).select().single();
    if (q) {
      await supabase.from('quote_items').insert(form.items.map((it: any) => ({
        quote_id: q.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_price: it.unit_price, discount: it.discount, tax_rate: it.tax_rate, total: it.total,
      })));
    }
    setModalOpen(false);
    setForm({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), expiry_date: '', items: [] });
    const { data } = await supabase.from('quotes').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setQuotes((data as any[]) ?? []);
  };

  const view = async (q: Quote) => {
    setViewOpen(q);
    const { data } = await supabase.from('quote_items').select('*').eq('quote_id', q.id);
    setViewItems((data as QuoteItem[]) ?? []);
  };

  const remove = async (q: Quote) => {
    if (!confirm(`Supprimer le devis ${q.number} ?`)) return;
    await supabase.from('quotes').delete().eq('id', q.id);
    setQuotes((list) => list.filter((x) => x.id !== q.id));
  };

  const send = async (q: Quote) => {
    await supabase.from('quotes').update({ status: 'sent' }).eq('id', q.id);
    setQuotes((list) => list.map((x) => x.id === q.id ? { ...x, status: 'sent' } : x));
  };

  return (
    <div>
      <PageHeader
        title="Devis"
        subtitle={`${quotes.length} devis`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('devis.csv', filtered.map((q) => ({ numero: q.number, client: (q as any).customer?.name, statut: q.status, total: q.total, date: q.issue_date })))} className="btn-ghost"><Download size={16} /> Export</button>
            <button onClick={() => { setForm({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), expiry_date: '', items: [] }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nouveau devis</button>
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={ClipboardList} title="Aucun devis" description="Créez vos devis et proformas." action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> Créer</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'number', label: 'Numéro', render: (q) => <span className="font-semibold text-ink-900">{q.number}</span> },
              { key: 'customer', label: 'Client', render: (q) => <span className="text-ink-600">{(q as any).customer?.name ?? '—'}</span> },
              { key: 'date', label: 'Date', render: (q) => <span className="text-ink-500">{new Date(q.issue_date).toLocaleDateString('fr-FR')}</span> },
              { key: 'status', label: 'Statut', render: (q) => <Badge tone={STATUS_LABELS[q.status]?.tone}>{STATUS_LABELS[q.status]?.label}</Badge> },
              { key: 'total', label: 'Total', className: 'text-right', render: (q) => <span className="font-semibold text-ink-900">{formatMoney(q.total, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (q) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => view(q)} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600"><Eye size={15} /></button>
                  {q.status === 'draft' && <button onClick={() => send(q)} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600"><Send size={15} /></button>}
                  <button onClick={() => remove(q)} className="rounded-lg p-1.5 text-ink-500 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau devis" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="input">
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Expiration"><input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="input" /></Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="label mb-0">Lignes</p><button onClick={addItem} className="text-xs font-semibold text-brand-600 hover:underline">+ Ajouter</button></div>
            <div className="space-y-2">
              {form.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-200 p-2">
                  <select value={it.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} className="input col-span-5">
                    <option value="">Produit libre</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder="Désignation" className="input col-span-3" />
                  <input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="input col-span-1" />
                  <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))} className="input col-span-2" />
                  <button onClick={() => removeItem(i)} className="col-span-1 rounded-lg text-ink-400 hover:text-error-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {form.items.length === 0 && <p className="py-4 text-center text-xs text-ink-400">Ajoutez au moins une ligne.</p>}
            </div>
          </div>
          <div className="rounded-xl bg-brand-50 p-3 text-right text-base font-bold text-ink-900">Total : {formatMoney(total, currency)}</div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">Créer</button>
        </div>
      </Modal>
      <Modal open={!!viewOpen} onClose={() => setViewOpen(null)} title={`Devis ${viewOpen?.number ?? ''}`}>
        {viewOpen && (
          <div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-500"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Prix</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {viewItems.map((it) => (
                  <tr key={it.id} className="border-b border-ink-50"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{formatMoney(it.unit_price, currency)}</td><td className="py-2 text-right font-semibold">{formatMoney(it.total, currency)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between border-t border-ink-100 pt-3 font-bold"><span>Total</span><span>{formatMoney(viewOpen.total, currency)}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
