import { useEffect, useState, useMemo } from 'react';
import { Plus, Receipt, Download, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Purchase, Supplier, Product, PurchaseItem } from '../../lib/types';

const STATUS_LABELS: Record<string, { label: string; tone: any }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  ordered: { label: 'Commandé', tone: 'brand' },
  received: { label: 'Reçu', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'error' },
};

export function PurchasesPage() {
  const { tenant } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState<Purchase | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseItem[]>([]);
  const [form, setForm] = useState<any>({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), items: [] });

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [p, sup, prod] = await Promise.all([
      supabase.from('purchases').select('*, supplier:suppliers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
    ]);
    setPurchases((p.data as any[]) ?? []);
    setSuppliers((sup.data as Supplier[]) ?? []);
    setProducts((prod.data as Product[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return purchases.filter((p) => !q || p.reference.toLowerCase().includes(q) || (p as any).supplier?.name?.toLowerCase().includes(q));
  }, [purchases, search]);

  const addItem = () => setForm((f: any) => ({ ...f, items: [...f.items, { product_id: '', name: '', quantity: 1, unit_cost: 0, total: 0 }] }));
  const updateItem = (i: number, key: string, value: any) => setForm((f: any) => {
    const items = [...f.items];
    items[i] = { ...items[i], [key]: value };
    if (key === 'product_id') {
      const p = products.find((x) => x.id === value);
      if (p) items[i] = { ...items[i], name: p.name, unit_cost: Number(p.cost_price) };
    }
    items[i].total = items[i].quantity * items[i].unit_cost;
    return { ...f, items };
  });
  const removeItem = (i: number) => setForm((f: any) => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }));

  const total = form.items.reduce((s: number, it: any) => s + it.total, 0);

  const save = async () => {
    if (!tenant || form.items.length === 0) return;
    const ref = `ACH-${Date.now().toString().slice(-8)}`;
    const { data: p } = await supabase.from('purchases').insert({
      tenant_id: tenant.id,
      supplier_id: form.supplier_id || null,
      reference: ref,
      status: 'ordered',
      subtotal: total, tax_total: 0, total, paid_amount: 0,
      purchase_date: form.purchase_date,
    }).select().single();
    if (p) {
      await supabase.from('purchase_items').insert(form.items.map((it: any) => ({
        purchase_id: p.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_cost: it.unit_cost, total: it.total,
      })));
    }
    setModalOpen(false);
    setForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), items: [] });
    const { data } = await supabase.from('purchases').select('*, supplier:suppliers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setPurchases((data as any[]) ?? []);
  };

  const view = async (p: Purchase) => {
    setViewOpen(p);
    const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', p.id);
    setViewItems((data as PurchaseItem[]) ?? []);
  };

  const remove = async (p: Purchase) => {
    if (!confirm(`Supprimer l'achat ${p.reference} ?`)) return;
    await supabase.from('purchases').delete().eq('id', p.id);
    setPurchases((list) => list.filter((x) => x.id !== p.id));
  };

  return (
    <div>
      <PageHeader
        title="Achats"
        subtitle={`${purchases.length} achat(s)`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('achats.csv', filtered.map((p) => ({ reference: p.reference, fournisseur: (p as any).supplier?.name, statut: p.status, total: p.total, date: p.purchase_date })))} className="btn-ghost"><Download size={16} /> Export</button>
            <button onClick={() => { setForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), items: [] }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nouvel achat</button>
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Receipt} title="Aucun achat" description="Enregistrez vos commandes fournisseurs." action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> Créer</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'reference', label: 'Référence', render: (p) => <span className="font-semibold text-ink-900">{p.reference}</span> },
              { key: 'supplier', label: 'Fournisseur', render: (p) => <span className="text-ink-600">{(p as any).supplier?.name ?? '—'}</span> },
              { key: 'date', label: 'Date', render: (p) => <span className="text-ink-500">{new Date(p.purchase_date).toLocaleDateString('fr-FR')}</span> },
              { key: 'status', label: 'Statut', render: (p) => <Badge tone={STATUS_LABELS[p.status]?.tone}>{STATUS_LABELS[p.status]?.label}</Badge> },
              { key: 'total', label: 'Total', className: 'text-right', render: (p) => <span className="font-semibold text-ink-900">{formatMoney(p.total, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (p) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => view(p)} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600"><Eye size={15} /></button>
                  <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink-500 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel achat" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fournisseur">
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input">
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="input" /></Field>
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
                  <input type="number" value={it.unit_cost} onChange={(e) => updateItem(i, 'unit_cost', Number(e.target.value))} className="input col-span-2" />
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
      <Modal open={!!viewOpen} onClose={() => setViewOpen(null)} title={`Achat ${viewOpen?.reference ?? ''}`}>
        {viewOpen && (
          <div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-500"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Coût</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {viewItems.map((it) => (
                  <tr key={it.id} className="border-b border-ink-50"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{formatMoney(it.unit_cost, currency)}</td><td className="py-2 text-right font-semibold">{formatMoney(it.total, currency)}</td></tr>
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
