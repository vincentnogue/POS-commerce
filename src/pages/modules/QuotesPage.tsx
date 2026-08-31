import { useEffect, useState, useMemo } from 'react';
import { Plus, ClipboardList, Download, Trash2, Eye, Send, FileText, Printer, MessageCircle, FileDown, Check } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney, localDateStr } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Quote, Customer, Product, QuoteItem } from '../../lib/types';

const STATUS_LABELS: Record<string, { key: string; tone: any }> = {
  draft: { key: 'quotes.status.draft', tone: 'neutral' },
  sent: { key: 'quotes.status.sent', tone: 'brand' },
  accepted: { key: 'quotes.status.accepted', tone: 'success' },
  refused: { key: 'quotes.status.refused', tone: 'error' },
  expired: { key: 'quotes.status.expired', tone: 'warning' },
};

export function QuotesPage() {
  const { tenant } = useAuth();
  const { t, formatDate } = useI18n();
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
  const [form, setForm] = useState<any>({ customer_id: '', issue_date: localDateStr(), expiry_date: '', items: [] });

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
  // BUG FIX: this used to save subtotal=total and tax_total=0/discount_total=0
  // regardless of each line's actual discount and tax_rate — since
  // item.total already has both baked in (qty*price*(1-discount%)*(1+tax%)),
  // that silently zeroed out the tax/discount breakdown on both the quote
  // and any invoice later generated from it via convertToInvoice(), which
  // reuses these same header fields — so the printed invoice PDF showed
  // "Sous-total" equal to the tax-inclusive total and hid the real TVA line.
  const subtotal = form.items.reduce((s: number, it: any) => s + it.quantity * it.unit_price, 0);
  const discountTotal = form.items.reduce((s: number, it: any) => s + it.quantity * it.unit_price * (it.discount / 100), 0);
  const taxTotal = form.items.reduce((s: number, it: any) => s + it.quantity * it.unit_price * (1 - it.discount / 100) * (it.tax_rate / 100), 0);

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
      subtotal, tax_total: taxTotal, discount_total: discountTotal, total,
    }).select().single();
    if (error) { toast('error', error.message); return; }
    if (q) {
      const { error: itemsErr } = await supabase.from('quote_items').insert(form.items.map((it: any) => ({
        quote_id: q.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_price: it.unit_price, discount: it.discount, tax_rate: it.tax_rate, total: it.total,
      })));
      if (itemsErr) { toast('error', itemsErr.message); return; }
    }
    setModalOpen(false);
    setForm({ customer_id: '', issue_date: localDateStr(), expiry_date: '', items: [] });
    const { data } = await supabase.from('quotes').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setQuotes((data as any[]) ?? []);
    toast('success', t('quotes.toast.created'));
  };

  const view = async (q: Quote) => {
    setViewOpen(q);
    const { data } = await supabase.from('quote_items').select('*').eq('quote_id', q.id);
    setViewItems((data as QuoteItem[]) ?? []);
  };

  const remove = async (q: Quote) => {
    if (!confirm(t('quotes.confirmDelete', { number: q.number }))) return;
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
    // BUG FIX: this used to number the new invoice from `quotes.length + 1` —
    // the count of quotes, not invoices — so a converted invoice's number
    // routinely collided with (or diverged wildly from) numbers generated by
    // InvoicesPage's own counter. Count actual invoices for this tenant instead.
    const { count: invoiceCount } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);
    const num = `FAC-${new Date().getFullYear()}-${String((invoiceCount ?? 0) + 1).padStart(4, '0')}`;
    const { data: inv, error } = await supabase.from('invoices').insert({
      tenant_id: tenant.id,
      customer_id: q.customer_id,
      number: num,
      status: 'sent',
      issue_date: localDateStr(),
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
      toast('success', t('quotes.toast.converted', { number: num }));
    }
  };

  const printQuote = (q: Quote) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const items = viewItems.length > 0 ? viewItems : [];
    const rows = items.map((it) => `<tr><td>${it.name}</td><td style="text-align:right">${it.quantity}</td><td style="text-align:right">${formatMoney(it.unit_price, currency)}</td><td style="text-align:right;font-weight:bold">${formatMoney(it.total, currency)}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>${t('quotes.docTitle')} ${q.number}</title><style>body{font-family:sans-serif;padding:40px;max-width:700px;margin:auto}h1{color:#1a365d}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}th{text-transform:uppercase;font-size:11px;color:#888}.total{margin-top:20px;text-align:right;font-size:18px;font-weight:bold}</style></head><body><h1>${t('quotes.docTitle')} ${q.number}</h1><p>${t('quotes.docDate')}: ${q.issue_date}</p><p>${t('quotes.docValidity')}: ${q.expiry_date ?? '—'}</p><table><thead><tr><th>${t('quotes.col.designation')}</th><th style="text-align:right">${t('quotes.col.qty')}</th><th style="text-align:right">${t('quotes.col.price')}</th><th style="text-align:right">${t('quotes.col.total')}</th></tr></thead><tbody>${rows}</tbody></table><div class="total">${t('quotes.col.total')}: ${formatMoney(q.total, currency)}</div><p style="margin-top:30px;color:#888;font-size:12px">${tenant?.name ?? ''}</p></body></html>`);
    w.document.close();
    w.print();
  };

  const sendWhatsApp = (q: Quote) => {
    const items = viewItems.length > 0 ? viewItems : [];
    const lines = items.map((it) => `${it.name} x${it.quantity} = ${formatMoney(it.total, currency)}`).join('%0a');
    const msg = `*${t('quotes.docTitle')} ${q.number}*%0a%0a${lines}%0a%0a*${t('quotes.col.total')}: ${formatMoney(q.total, currency)}*%0a${t('quotes.docValidity')}: ${q.expiry_date ?? '—'}`;
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const downloadPDF = (q: Quote) => {
    const content = `${t('quotes.docTitle')} ${q.number}\n${t('quotes.docDate')}: ${q.issue_date}\n${t('quotes.docValidity')}: ${q.expiry_date ?? '—'}\n\n${viewItems.map((it) => `${it.name} x${it.quantity} = ${formatMoney(it.total, currency)}`).join('\n')}\n\n${t('quotes.col.total')}: ${formatMoney(q.total, currency)}`;
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
        title={t('quotes.title')}
        subtitle={t('quotes.subtitle', { count: quotes.length })}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('devis.csv', filtered.map((q) => ({ numero: q.number, client: (q as any).customer?.name, statut: q.status, total: q.total, date: q.issue_date })))} className="btn-ghost"><Download size={16} /> {t('common.export')}</button>
            <button onClick={() => { setForm({ customer_id: '', issue_date: localDateStr(), expiry_date: '', items: [] }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> {t('quotes.new')}</button>
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[160px]">
            <option value="">{t('quotes.allStatuses')}</option>
            {Object.entries(STATUS_LABELS).map(([v, s]) => <option key={v} value={v}>{t(s.key)}</option>)}
          </select>
        </div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={ClipboardList} title={t('quotes.empty.title')} description={t('quotes.empty.desc')} action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> {t('common.create')}</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'number', label: t('quotes.col.number'), render: (q) => <span className="font-medium text-ink-900 dark:text-ink-50">{q.number}</span> },
              { key: 'customer', label: t('quotes.col.customer'), render: (q) => <span className="text-ink-600 dark:text-ink-300">{(q as any).customer?.name ?? '—'}</span> },
              { key: 'date', label: t('common.date'), render: (q) => <span className="text-ink-500 dark:text-ink-400">{formatDate(q.issue_date)}</span> },
              { key: 'status', label: t('common.status'), render: (q) => <Badge tone={STATUS_LABELS[q.status]?.tone}>{t(STATUS_LABELS[q.status]?.key ?? 'quotes.status.draft')}</Badge> },
              { key: 'total', label: t('quotes.col.total'), className: 'text-right', render: (q) => <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(q.total, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (q) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => view(q)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Eye size={15} /></button>
                  {q.status === 'draft' && <button onClick={() => send(q)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600" title={t('quotes.send')}><Send size={15} /></button>}
                  {q.status === 'sent' && <button onClick={() => acceptQuote(q)} className="rounded-full p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25" title={t('quotes.accept')}><Check size={15} /></button>}
                  {q.status === 'sent' && <button onClick={() => refuseQuote(q)} className="rounded-full p-1.5 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25" title={t('quotes.refuse')}><Trash2 size={15} /></button>}
                  {q.status !== 'accepted' && <button onClick={() => remove(q)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>}
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('quotes.newTitle')} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('quotes.col.customer')}>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="input">
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={t('quotes.col.expiry')}><input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="input" /></Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="label mb-0">{t('quotes.col.lines')}</p><button onClick={addItem} className="text-xs font-medium text-brand-600 hover:underline">+ {t('quotes.add')}</button></div>
            <div className="space-y-2">
              {form.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-200 dark:border-ink-700 p-2">
                  <select value={it.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} className="input col-span-5">
                    <option value="">{t('quotes.freeProduct')}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder={t('quotes.col.designation')} className="input col-span-3" />
                  <input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="input col-span-1" />
                  <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', Number(e.target.value))} className="input col-span-2" />
                  <button onClick={() => removeItem(i)} className="col-span-1 rounded-full text-ink-400 dark:text-ink-500 hover:text-error-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {form.items.length === 0 && <p className="py-4 text-center text-xs text-ink-400 dark:text-ink-500">{t('quotes.addAtLeastOneLine')}</p>}
            </div>
          </div>
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-right text-base font-medium text-ink-900 dark:text-ink-50">{t('quotes.col.total')} : {formatMoney(total, currency)}</div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('common.create')}</button>
        </div>
      </Modal>
      <Modal open={!!viewOpen} onClose={() => setViewOpen(null)} title={t('quotes.quoteTitle', { number: viewOpen?.number ?? '' })} maxWidth="max-w-2xl">
        {viewOpen && (
          <div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400"><th className="pb-2">{t('quotes.col.designation')}</th><th className="pb-2 text-right">{t('quotes.col.qty')}</th><th className="pb-2 text-right">{t('quotes.col.price')}</th><th className="pb-2 text-right">{t('quotes.col.total')}</th></tr></thead>
              <tbody>
                {viewItems.map((it) => (
                  <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{formatMoney(it.unit_price, currency)}</td><td className="py-2 text-right font-medium">{formatMoney(it.total, currency)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between border-t border-ink-100 dark:border-ink-800 pt-3 font-medium"><span>{t('quotes.col.total')}</span><span>{formatMoney(viewOpen.total, currency)}</span></div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 dark:border-ink-800 pt-4">
              <button onClick={() => printQuote(viewOpen)} className="btn-ghost text-sm"><Printer size={15} /> {t('quotes.print')}</button>
              <button onClick={() => downloadPDF(viewOpen)} className="btn-ghost text-sm"><FileDown size={15} /> {t('quotes.pdf')}</button>
              <button onClick={() => sendWhatsApp(viewOpen)} className="btn-ghost text-sm border-success-200 text-success-700"><MessageCircle size={15} /> {t('quotes.whatsapp')}</button>
              {viewOpen.status === 'sent' && <button onClick={() => acceptQuote(viewOpen)} className="btn-ghost text-sm border-success-200 text-success-700"><Check size={15} /> {t('quotes.accept')}</button>}
              {viewOpen.status === 'sent' && <button onClick={() => refuseQuote(viewOpen)} className="btn-ghost text-sm border-error-200 text-error-600">{t('quotes.refuse')}</button>}
              {viewOpen.status !== 'accepted' && viewOpen.status !== 'refused' && (
                <button onClick={() => convertToInvoice(viewOpen)} className="btn-primary text-sm"><FileText size={15} /> {t('quotes.convertToInvoice')}</button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
