import { useEffect, useState, useMemo } from 'react';
import { Plus, Download, FileText, Trash2, Eye, Printer, MessageCircle, Mail, FileDown } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Invoice, Customer, InvoiceItem, Product } from '../../lib/types';
import { useI18n } from '../../lib/i18n';
import { downloadInvoicePdf, printInvoicePdf, type BrandSettings } from '../../lib/invoicePdf';

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyée' },
  { value: 'paid', label: 'Payée' },
  { value: 'overdue', label: 'En retard' },
];

const STATUS_LABELS: Record<string, { label: string; tone: any }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  sent: { label: 'Envoyée', tone: 'brand' },
  paid: { label: 'Payée', tone: 'success' },
  overdue: { label: 'En retard', tone: 'error' },
  cancelled: { label: 'Annulée', tone: 'neutral' },
};

export function InvoicesPage() {
  const { tenant } = useAuth();
  const { t, formatDate } = useI18n();
  const toast = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState<Invoice | null>(null);
  const [viewItems, setViewItems] = useState<InvoiceItem[]>([]);
  const [form, setForm] = useState<any>({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), due_date: '', items: [] });
  const [brand, setBrand] = useState<BrandSettings>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [inv, cust, prod, brandRes] = await Promise.all([
      supabase.from('invoices').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('products').select('*').eq('tenant_id', tenant.id).eq('is_active', true).order('name'),
      supabase.from('brand_settings').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    ]);
    setInvoices((inv.data as any[]) ?? []);
    setBrand((brandRes.data as BrandSettings) ?? null);
    setCustomers((cust.data as Customer[]) ?? []);
    setProducts((prod.data as Product[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => invoices.filter((i) => {
    const q = search.toLowerCase().trim();
    const effectiveStatus = i.status === 'sent' && i.due_date && new Date(i.due_date) < new Date() ? 'overdue' : i.status;
    return (!q || i.number.toLowerCase().includes(q) || (i as any).customer?.name?.toLowerCase().includes(q)) && (!statusFilter || effectiveStatus === statusFilter || (statusFilter === 'sent' && i.status === 'sent' && !(i.due_date && new Date(i.due_date) < new Date())));
  }), [invoices, search, statusFilter]);

  const getStatusDisplay = (i: Invoice) => {
    if (i.status === 'sent' && i.due_date && new Date(i.due_date) < new Date()) {
      return STATUS_LABELS['overdue'];
    }
    return STATUS_LABELS[i.status] ?? { label: i.status, tone: 'neutral' };
  };

  const addItem = () => setForm((f: any) => ({ ...f, items: [...f.items, { product_id: '', name: '', quantity: 1, unit_price: 0, tax_rate: 0, total: 0 }] }));
  const updateItem = (i: number, key: string, value: any) => setForm((f: any) => {
    const items = [...f.items];
    items[i] = { ...items[i], [key]: value };
    if (key === 'product_id') {
      const p = products.find((x) => x.id === value);
      if (p) items[i] = { ...items[i], name: p.name, unit_price: Number(p.sale_price), tax_rate: Number(p.tax_rate) };
    }
    items[i].total = items[i].quantity * items[i].unit_price * (1 + items[i].tax_rate / 100);
    return { ...f, items };
  });
  const removeItem = (i: number) => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }));

  const total = form.items.reduce((s: number, it: any) => s + it.total, 0);
  const subtotal = form.items.reduce((s: number, it: any) => s + it.quantity * it.unit_price, 0);
  const taxTotal = total - subtotal;

  const save = async () => {
    if (!tenant || form.items.length === 0) return;
    const num = `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`;
    const { data: inv, error } = await supabase.from('invoices').insert({
      tenant_id: tenant.id,
      customer_id: form.customer_id || null,
      number: num,
      status: 'sent',
      issue_date: form.issue_date,
      due_date: form.due_date || null,
      subtotal, tax_total: taxTotal, discount_total: 0, total, paid_amount: 0,
    }).select().single();
    if (error) { toast('error', error.message); return; }
    if (inv) {
      const { error: itemsErr } = await supabase.from('invoice_items').insert(form.items.map((it: any) => ({
        invoice_id: inv.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_price: it.unit_price, discount: 0, tax_rate: it.tax_rate, total: it.total,
      })));
      if (itemsErr) { toast('error', itemsErr.message); return; }
    }
    setModalOpen(false);
    setForm({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), due_date: '', items: [] });
    const { data } = await supabase.from('invoices').select('*, customer:customers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setInvoices((data as any[]) ?? []);
    toast('success', 'Facture créée.');
  };

  const view = async (inv: Invoice) => {
    setViewOpen(inv);
    const { data } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id);
    setViewItems((data as InvoiceItem[]) ?? []);
  };

  const remove = async (inv: Invoice) => {
    if (!confirm(`Supprimer la facture ${inv.number} ?`)) return;
    const { error } = await supabase.from('invoices').delete().eq('id', inv.id);
    if (error) { toast('error', error.message); return; }
    setInvoices((list) => list.filter((x) => x.id !== inv.id));
  };

  const markPaid = async (inv: Invoice) => {
    const { error } = await supabase.from('invoices').update({ status: 'paid', paid_amount: inv.total }).eq('id', inv.id);
    if (error) { toast('error', error.message); return; }
    setInvoices((list) => list.map((x) => x.id === inv.id ? { ...x, status: 'paid', paid_amount: x.total } : x));
  };

  const pdfInput = (inv: Invoice) => ({
    invoice: inv,
    items: viewItems,
    tenant,
    brand,
    customer: customers.find((c) => c.id === inv.customer_id) ?? null,
    currency,
  });

  const handlePrint = async (inv: Invoice) => {
    setPdfBusy(true);
    try { await printInvoicePdf(pdfInput(inv)); } finally { setPdfBusy(false); }
  };

  const handleDownload = async (inv: Invoice) => {
    setPdfBusy(true);
    try { await downloadInvoicePdf(pdfInput(inv)); } finally { setPdfBusy(false); }
  };

  // WhatsApp can't attach a file automatically via a wa.me link (platform
  // limitation, not something we can code around client-side). Best
  // available UX: generate + download the real PDF, then open a WhatsApp
  // chat with a ready-to-send message so the person only has to attach the
  // file that was just downloaded.
  const handleWhatsapp = async (inv: Invoice) => {
    setPdfBusy(true);
    try {
      await downloadInvoicePdf(pdfInput(inv));
      const customer = customers.find((c) => c.id === inv.customer_id);
      const phone = customer?.phone || '';
      const msg = encodeURIComponent(
        `Bonjour${customer?.name ? ' ' + customer.name : ''}, voici votre facture ${inv.number} d'un montant de ${formatMoney(inv.total, currency)}. Le PDF vient d'être téléchargé sur votre appareil — merci de le joindre à ce message. 🙏`
      );
      window.open(phone ? `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Factures"
        subtitle={`${invoices.length} facture(s)`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('factures.csv', filtered.map((i) => ({ numero: i.number, client: (i as any).customer?.name, statut: i.status, total: i.total, date: i.issue_date })))} className="btn-ghost"><Download size={16} /> Export</button>
            <button onClick={() => { setForm({ customer_id: '', issue_date: new Date().toISOString().slice(0, 10), due_date: '', items: [] }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nouvelle facture</button>
          </div>
        }
      />

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={t('invoices.search')} />
          <Select value={statusFilter} onChange={setStatusFilter} placeholder={t('invoices.all')} options={STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label }))} />
        </div>

        {filtered.length === 0 && !loading ? (
          <EmptyState icon={FileText} title="Aucune facture" description="Créez votre première facture." action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> Créer</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'number', label: 'Numéro', render: (i) => <span className="font-medium text-ink-900 dark:text-ink-50">{i.number}</span> },
              { key: 'customer', label: 'Client', render: (i) => <span className="text-ink-600 dark:text-ink-300">{(i as any).customer?.name ?? '—'}</span> },
              { key: 'date', label: 'Date', render: (i) => <span className="text-ink-500 dark:text-ink-400">{formatDate(i.issue_date)}</span> },
              { key: 'status', label: 'Statut', render: (i) => { const sd = getStatusDisplay(i); return <Badge tone={sd.tone}>{sd.label}</Badge>; } },
              { key: 'total', label: 'Total', className: 'text-right', render: (i) => <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(i.total, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (i) => (
                <div className="flex justify-end gap-1.5">
                  <button onClick={() => view(i)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Eye size={15} /></button>
                  {i.status !== 'paid' && <button onClick={() => markPaid(i)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-success-50 dark:hover:bg-success-900/25 hover:text-success-600"><Plus size={15} /></button>}
                  <button onClick={() => remove(i)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle facture" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} className="input">
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Échéance"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" /></Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label mb-0">Lignes</p>
              <button onClick={addItem} className="text-xs font-medium text-brand-600 hover:underline">+ Ajouter une ligne</button>
            </div>
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
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-4 text-sm">
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Sous-total</span><span>{formatMoney(subtotal, currency)}</span></div>
            <div className="flex justify-between text-ink-600 dark:text-ink-300"><span>Taxes</span><span>{formatMoney(taxTotal, currency)}</span></div>
            <div className="mt-1 flex justify-between font-medium text-ink-900 dark:text-ink-50"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">Créer la facture</button>
        </div>
      </Modal>

      <Modal open={!!viewOpen} onClose={() => setViewOpen(null)} title={`Facture ${viewOpen?.number ?? ''}`} maxWidth="max-w-lg">
        {viewOpen && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-500 dark:text-ink-400">Client</p>
                <p className="font-medium text-ink-900 dark:text-ink-50">{(viewOpen as any).customer?.name ?? '—'}</p>
              </div>
              {(() => { const sd = getStatusDisplay(viewOpen); return <Badge tone={sd.tone}>{sd.label}</Badge>; })()}
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Prix</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {viewItems.map((it) => (
                  <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{formatMoney(it.unit_price, currency)}</td><td className="py-2 text-right font-medium">{formatMoney(it.total, currency)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-between border-t border-ink-100 dark:border-ink-800 pt-3 text-base font-medium"><span>Total</span><span>{formatMoney(viewOpen.total, currency)}</span></div>

            {/* Action buttons */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 dark:border-ink-800 pt-4">
              <button disabled={pdfBusy} onClick={() => handlePrint(viewOpen)} className="btn-ghost text-sm disabled:opacity-50"><Printer size={15} /> {t('invoices.print')}</button>
              <button disabled={pdfBusy} onClick={() => handleDownload(viewOpen)} className="btn-ghost text-sm disabled:opacity-50"><FileDown size={15} /> {t('invoices.downloadPdf')}</button>
              <button
                disabled={pdfBusy}
                onClick={() => handleWhatsapp(viewOpen)}
                className="btn-ghost text-sm disabled:opacity-50"
              ><MessageCircle size={15} /> {t('invoices.sendWhatsapp')}</button>
              <button
                onClick={() => {
                  const email = customers.find((c) => c.id === viewOpen.customer_id)?.email || '';
                  if (email) window.location.href = `mailto:${email}?subject=${encodeURIComponent('Facture ' + viewOpen.number)}&body=${encodeURIComponent(`Veuillez trouver ci-joint la facture ${viewOpen.number} d'un montant de ${formatMoney(viewOpen.total, currency)}.`)}`;
                }}
                className="btn-ghost text-sm"
              ><Mail size={15} /> {t('invoices.sendEmail')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
