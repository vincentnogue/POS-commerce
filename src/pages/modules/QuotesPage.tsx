import { useEffect, useState, useMemo } from 'react';
import { Plus, ClipboardList, Download, Trash2, Eye, Send, FileText, Printer, MessageCircle, FileDown, Check } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
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
  const toast = useToast();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
    return quotes.filter((x) => {
      if (!q && !statusFilter) return true;
      const matchQ = !q || x.number.toLowerCase().includes(q) || (x as any).customer?.name?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || x.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [quotes, search, statusFilter]);

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
    const { data: q, error } = await supabase.from('quotes').insert({
      tenant_id: tenant.id,
      customer_id: form.customer_id || null,
      number: num,
      status: 'draft',
      issue_date: form.issue_date,
      expiry_date: form.expiry_date || null,
      subtotal: total, tax_total: 0, discount_total: 0, total,
    }).select().single();
    if (error) { toast('error', error.message); return; }
    if (q) {
      const { error: itemsErr } = await supabase.from('quote_items').insert(form.items.map((it: any) => ({
        quote_id: q.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_price: it.unit_price, discount: it.discount, tax_rate: it.tax_rate, total: it.total,
      })));
      if (itemsErr) { toast('error', itemsErr.message); return; }
    }
    setModalOpen(false);
    setForm({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), expiry_date: '', items: [] });
    const { data } = await supabase.from('quotes').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setQuotes((data as any[]) ?? []);
    toast('success', 'Devis créé.');
  };

  const view = async (q: Quote) => {
    setViewOpen(q);
    const { data } = await supabase.from('quote_items').select('*').eq('quote_id', q.id);
    setViewItems((data as QuoteItem[]) ?? []);
  };

  const remove = async (q: Quote) => {
    if (!confirm(`Supprimer le devis ${q.number} ?`)) return;
    const { error } = await supabase.from('quotes').delete().eq('id', q.id);
    if (error) { toast('error', error.message); return; }
    setQuotes((list) => list.filter((x) => x.id !== q.id));
  };

  const send = async (q: Quote) => {
    const { error } = await supabase.from('quotes').update({ status: 'sent' }).eq('id', q.id);
    if (error) { toast('error', error.message); return; }
    setQuotes((list) => list.map((x) => x.id === q.id ? { ...x, status: 'sent' } : x));
  };

  const acceptQuote = async (q: Quote) => {
    const { error } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', q.id);
    if (error) { toast('error', error.message); return; }
    setQuotes((list) => list.map((x) => x.id === q.id ? { ...x, status: 'accepted' } : x));
  };

  const refuseQuote = async (q: Quote) => {
    const { error } = await supabase.from('quotes').update({ status: 'refused' }).eq('id', q.id);
    if (error) { toast('error', error.message); return; }
    setQuotes((list) => list.map((x) => x.id === q.id ? { ...x, status: 'refused' } : x));
  };

  const convertToInvoice = async (q: Quote) => {
    if (!tenant) return;
    const items = viewItems.length > 0 ? viewItems : (await supabase.from('quote_items').select('*').eq('quote_id', q.id)).data ?? [];
    const num = `FAC-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, '0')}`;
    const { data: inv, error } = await supabase.from('invoices').insert({
      tenant_id: tenant.id,
      customer_id: q.customer_id,
      number: num,
      status: 'sent',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      subtotal: q.subtotal, tax_total: q.tax_total, discount_total: q.discount_total, total: q.total, paid_amount: 0,
    }).select().single();
    if (error) { toast('error', error.message); return; }
    if (inv) {
      const { error: itemsErr } = await supabase.from('invoice_items').insert(items.map((it: any) => ({
        invoice_id: inv.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_price: it.unit_price, discount: it.discount, tax_rate: it.tax_rate, total: it.total,
      })));
      if (itemsErr) { toast('error', itemsErr.message); return; }
      const { error: statusErr } = await supabase.from('quotes').update({ status: 'accepted' }).eq('id', q.id);
      if (statusErr) { toast('error', statusErr.message); return; }
      setQuotes((list) => list.map((x) => x.id === q.id ? { ...x, status: 'accepted' } : x));
      toast('success', `Devis converti en facture ${num}.`);
    }
  };

  const printQuote = (q: Quote) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const items = viewItems.length > 0 ? viewItems : [];
    const rows = items.map((it) => `<tr><td>${it.name}</td><td style="text-align:right">${it.quantity}</td><td style="text-align:right">${formatMoney(it.unit_price, currency)}</td><td style="text-align:right;font-weight:bold">${formatMoney(it.total, currency)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Devis ${q.number}</title><style>body{font-family:sans-serif;padding:40px;max-width:700px;margin:auto}h1{color:#1a365d}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}th{text-transform:uppercase;font-size:11px;color:#888}.total{margin-top:20px;text-align:right;font-size:18px;font-weight:bold}</style></head><body><h1>Devis ${q.number}</h1><p>Date: ${q.issue_date}</p><p>Validité: ${q.expiry_date ?? '—'}</p><table><thead><tr><th>Désignation</th><th style="text-align:right">Qté</th><th style="text-align:right">Prix</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total">Total: ${formatMoney(q.total, currency)}</div><p style="margin-top:30px;color:#888;font-size:12px">${tenant?.name ?? ''}</p></body></html>`);
    w.document.close();
    w.print();
  };

  const sendWhatsApp = (q: Quote) => {
    const items = viewItems.length > 0 ? viewItems : [];
    const lines = items.map((it) => `${it.name} x${it.quantity} = ${formatMoney(it.total, currency)}`).join('%0a');
    const msg = `*Devis ${q.number}*%0a%0a${lines}%0a%0a*Total: ${formatMoney(q.total, currency)}*%0aValidité: ${q.expiry_date ?? '—'}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const downloadPDF = (q: Quote) => {
    const content = `Devis ${q.number}\nDate: ${q.issue_date}\nValidité: ${q.expiry_date ?? '—'}\n\n${viewItems.map((it) => `${it.name} x${it.quantity} = ${formatMoney(it.total, currency)}`).join('\n')}\n\nTotal: ${formatMoney(q.total, currency)}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devis-${q.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[160px]">
            <option value="">Tous statuts</option>
            {Object.entries(STATUS_LABELS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
        </div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={ClipboardList} title="Aucun devis" description="Créez vos devis et proformas." action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> Créer</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'number', label: 'Numéro', render: (q) => <span className="font-medium text-ink-900 dark:text-ink-50">{q.number}</span> },
              { key: 'customer', label: 'Client', render: (q) => <span className="text-ink-600 dark:text-ink-300">{(q as any).customer?.name ?? '—'}</span> },
              { key: 'date', label: 'Date', render: (q) => <span className="text-ink-500 dark:text-ink-400">{new Date(q.issue_date).toLocaleDateString('fr-FR')}</span> },
              { key: 'status', label: 'Statut', render: (q) => <Badge tone={STATUS_LABELS[q.status]?.tone}>{STATUS_LABELS[q.status]?.label}</Badge> },
              { key: 'total', label: 'Total', className: 'text-right', render: (q) => <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(q.total, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (q) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => view(q)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Eye size={15} /></button>
                  {q.status === 'draft' && <button onClick={() => send(q)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600" title="Envoyer"><Send size={15} /></button>}
                  {q.status === 'sent' && <button onClick={() => acceptQuote(q)} className="rounded-lg p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25" title="Accepter"><Check size={15} /></button>}
                  {q.status === 'sent' && <button onClick={() => refuseQuote(q)} className="rounded-lg p-1.5 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25" title="Refuser"><Trash2 size={15} /></button>}
                  {q.status !== 'accepted' && <button onClick={() => remove(q)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>}
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
            <div className="mb-2 flex items-center justify-between"><p className="label mb-0">Lignes</p><button onClick={addItem} className="text-xs font-medium text-brand-600 hover:underline">+ Ajouter</button></div>
            <div className="space-y-2">
              {form.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-200 dark:border-ink-700 p-2">
                  <select value={it.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} className="input col-span-5">
                    <option value="">Produit libre</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder="Désignation" className="input col-span-3" />
                  <input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="input col-span-1" />
                  <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))} className="input col-span-2" />
                  <button onClick={() => removeItem(i)} className="col-span-1 rounded-lg text-ink-400 dark:text-ink-500 hover:text-error-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {form.items.length === 0 && <p className="py-4 text-center text-xs text-ink-400 dark:text-ink-500">Ajoutez au moins une ligne.</p>}
            </div>
          </div>
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-right text-base font-medium text-ink-900 dark:text-ink-50">Total : {formatMoney(total, currency)}</div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">Créer</button>
        </div>
      </Modal>
      <Modal open={!!viewOpen} onClose={() => setViewOpen(null)} title={`Devis ${viewOpen?.number ?? ''}`} maxWidth="max-w-2xl">
        {viewOpen && (
          <div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Prix</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {viewItems.map((it) => (
                  <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{formatMoney(it.unit_price, currency)}</td><td className="py-2 text-right font-medium">{formatMoney(it.total, currency)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between border-t border-ink-100 dark:border-ink-800 pt-3 font-medium"><span>Total</span><span>{formatMoney(viewOpen.total, currency)}</span></div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 dark:border-ink-800 pt-4">
              <button onClick={() => printQuote(viewOpen)} className="btn-ghost text-sm"><Printer size={15} /> Imprimer</button>
              <button onClick={() => downloadPDF(viewOpen)} className="btn-ghost text-sm"><FileDown size={15} /> PDF</button>
              <button onClick={() => sendWhatsApp(viewOpen)} className="btn-ghost text-sm border-success-200 text-success-700"><MessageCircle size={15} /> WhatsApp</button>
              {viewOpen.status === 'sent' && <button onClick={() => acceptQuote(viewOpen)} className="btn-ghost text-sm border-success-200 text-success-700"><Check size={15} /> Accepter</button>}
              {viewOpen.status === 'sent' && <button onClick={() => refuseQuote(viewOpen)} className="btn-ghost text-sm border-error-200 text-error-600">Refuser</button>}
              {viewOpen.status !== 'accepted' && viewOpen.status !== 'refused' && (
                <button onClick={() => convertToInvoice(viewOpen)} className="btn-primary text-sm"><FileText size={15} /> Convertir en facture</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
