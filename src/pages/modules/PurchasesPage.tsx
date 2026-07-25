import { useEffect, useState, useMemo } from 'react';
import { Plus, Receipt, Download, Trash2, Eye, Check, Package } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Purchase, Supplier, Product, PurchaseItem } from '../../lib/types';

const STATUS_LABELS: Record<string, { label: string; tone: any }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  ordered: { label: 'Commandé', tone: 'brand' },
  partially_received: { label: 'Partiellement reçu', tone: 'warning' },
  received: { label: 'Reçu', tone: 'success' },
  cancelled: { label: 'Annulé', tone: 'error' },
};

export function PurchasesPage() {
  const { tenant, can } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<Record<string, string[]>>({});
  const [inventory, setInventory] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState<Purchase | null>(null);
  const [viewItems, setViewItems] = useState<PurchaseItem[]>([]);
  const [receiveOpen, setReceiveOpen] = useState<Purchase | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, number>>({});
  const [form, setForm] = useState<any>({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), store_id: '', items: [] });
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);

  const currency = tenant?.currency ?? 'XOF';
  const canSeeCost = can('products', 'update');

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [p, sup, prod, sp, inv, st] = await Promise.all([
      supabase.from('purchases').select('*, supplier:suppliers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('supplier_products').select('supplier_id, product_id').eq('tenant_id', tenant.id),
      supabase.from('inventory').select('*').eq('tenant_id', tenant.id),
      supabase.from('stores').select('id, name').eq('tenant_id', tenant.id),
    ]);
    setPurchases((p.data as any[]) ?? []);
    setSuppliers((sup.data as Supplier[]) ?? []);
    setProducts((prod.data as Product[]) ?? []);
    setInventory(inv.data ?? []);
    setStores((st.data as any[]) ?? []);
    const map: Record<string, string[]> = {};
    (sp.data ?? []).forEach((r: any) => { (map[r.supplier_id] ??= []).push(r.product_id); });
    setSupplierProducts(map);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => purchases.filter((p) => {
    const q = search.toLowerCase().trim();
    return (!q || p.reference.toLowerCase().includes(q) || (p as any).supplier?.name?.toLowerCase().includes(q)) && (!statusFilter || p.status === statusFilter) && (!supplierFilter || p.supplier_id === supplierFilter);
  }), [purchases, search, statusFilter, supplierFilter]);

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

  // Suggest suppliers for the selected products
  const suggestedSupplierIds = useMemo(() => {
    const productIds = form.items.map((it: any) => it.product_id).filter(Boolean);
    if (productIds.length === 0) return null;
    const matches = new Set<string>();
    productIds.forEach((pid: string) => {
      Object.entries(supplierProducts).forEach(([sid, pids]) => { if (pids.includes(pid)) matches.add(sid); });
    });
    return matches.size > 0 ? Array.from(matches) : null;
  }, [form.items, supplierProducts]);

  const save = async () => {
    if (!tenant || form.items.length === 0) return;
    const ref = `ACH-${Date.now().toString().slice(-8)}`;
    const { data: p } = await supabase.from('purchases').insert({
      tenant_id: tenant.id, supplier_id: form.supplier_id || null, store_id: form.store_id || null,
      reference: ref, status: 'ordered', subtotal: total, tax_total: 0, total, paid_amount: 0, purchase_date: form.purchase_date,
    }).select().single();
    if (p) {
      await supabase.from('purchase_items').insert(form.items.map((it: any) => ({ purchase_id: p.id, product_id: it.product_id || null, name: it.name, quantity: it.quantity, unit_cost: it.unit_cost, total: it.total })));
    }
    setModalOpen(false);
    setForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), store_id: '', items: [] });
    const { data } = await supabase.from('purchases').select('*, supplier:suppliers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setPurchases((data as any[]) ?? []);
  };

  const view = async (p: Purchase) => { setViewOpen(p); const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', p.id); setViewItems((data as PurchaseItem[]) ?? []); };
  const remove = async (p: Purchase) => { if (!confirm(`Supprimer l'achat ${p.reference} ?`)) return; await supabase.from('purchases').delete().eq('id', p.id); setPurchases((list) => list.filter((x) => x.id !== p.id)); };

  const openReceive = async (p: Purchase) => {
    setReceiveOpen(p);
    const { data } = await supabase.from('purchase_items').select('*').eq('purchase_id', p.id);
    const qtys: Record<string, number> = {};
    (data ?? []).forEach((it: any) => { qtys[it.id] = Number(it.quantity); });
    setReceiveQtys(qtys);
  };

  const confirmReceive = async () => {
    if (!receiveOpen || !tenant) return;
    const items = await supabase.from('purchase_items').select('*').eq('purchase_id', receiveOpen.id);
    const allItems = (items.data as PurchaseItem[]) ?? [];
    let allReceived = true;
    // Update stock for each received item
    for (const it of allItems) {
      const receiveQty = receiveQtys[it.id] ?? 0;
      if (receiveQty <= 0) { allReceived = false; continue; }
      if (it.product_id) {
        const existing = inventory.find((inv) => inv.product_id === it.product_id && (inv.store_id === (receiveOpen as any).store_id || (!inv.store_id && !(receiveOpen as any).store_id)));
        if (existing) {
          await supabase.from('inventory').update({ quantity: Number(existing.quantity) + receiveQty, updated_at: new Date().toISOString() }).eq('id', existing.id);
        } else {
          await supabase.from('inventory').insert({ tenant_id: tenant.id, product_id: it.product_id, store_id: (receiveOpen as any).store_id ?? null, quantity: receiveQty });
        }
        await supabase.from('stock_movements').insert({ tenant_id: tenant.id, product_id: it.product_id, store_id: (receiveOpen as any).store_id ?? null, movement_type: 'purchase', quantity: receiveQty, reason: `Réception achat ${receiveOpen.reference}` });
        // Update product cost_price if different
        if (Number(it.unit_cost) > 0) {
          await supabase.from('products').update({ cost_price: Number(it.unit_cost), updated_at: new Date().toISOString() }).eq('id', it.product_id);
        }
      }
      if (receiveQty < Number(it.quantity)) allReceived = false;
    }
    const newStatus = allReceived ? 'received' : 'partially_received';
    await supabase.from('purchases').update({ status: newStatus }).eq('id', receiveOpen.id);
    setReceiveOpen(null);
    const { data } = await supabase.from('purchases').select('*, supplier:suppliers(name)').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setPurchases((data as any[]) ?? []);
    const { data: inv } = await supabase.from('inventory').select('*').eq('tenant_id', tenant.id);
    setInventory(inv ?? []);
  };

  return (
    <div>
      <PageHeader title="Achats" subtitle={`${purchases.length} achat(s)`} action={
        <div className="flex gap-2">
          <button onClick={() => exportCSV('achats.csv', filtered.map((p) => ({ reference: p.reference, fournisseur: (p as any).supplier?.name, statut: p.status, total: p.total, date: p.purchase_date })))} className="btn-ghost"><Download size={16} /> Export</button>
          <button onClick={() => { setForm({ supplier_id: '', purchase_date: new Date().toISOString().slice(0, 10), store_id: '', items: [] }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nouvel achat</button>
        </div>
      } />
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <Select value={supplierFilter} onChange={setSupplierFilter} placeholder="Tous fournisseurs" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Tous statuts" options={Object.entries(STATUS_LABELS).map(([v, s]) => ({ value: v, label: s.label }))} />
        </div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Receipt} title="Aucun achat" description="Enregistrez vos commandes fournisseurs." action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> Créer</button>} />
        ) : (
          <DataTable loading={loading} columns={[
            { key: 'reference', label: 'Référence', render: (p) => <span className="font-semibold text-ink-900 dark:text-ink-50">{p.reference}</span> },
            { key: 'supplier', label: 'Fournisseur', render: (p) => <span className="text-ink-600 dark:text-ink-300">{(p as any).supplier?.name ?? '—'}</span> },
            { key: 'date', label: 'Date', render: (p) => <span className="text-ink-500 dark:text-ink-400">{new Date(p.purchase_date).toLocaleDateString('fr-FR')}</span> },
            { key: 'status', label: 'Statut', render: (p) => <Badge tone={STATUS_LABELS[p.status]?.tone}>{STATUS_LABELS[p.status]?.label}</Badge> },
            { key: 'total', label: 'Total', className: 'text-right', render: (p) => <span className="font-semibold text-ink-900 dark:text-ink-50">{canSeeCost ? formatMoney(p.total, currency) : '—'}</span> },
            { key: 'actions', label: '', className: 'text-right', render: (p) => (
              <div className="flex justify-end gap-2">
                <button onClick={() => view(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Eye size={15} /></button>
                {(p.status === 'ordered' || p.status === 'partially_received') && <button onClick={() => openReceive(p)} className="rounded-lg p-1.5 text-success-600 hover:bg-success-50" title="Réceptionner"><Package size={15} /></button>}
                <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>
              </div>
            )},
          ]} rows={filtered} />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvel achat" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="Fournisseur">
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input">
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}{suggestedSupplierIds?.includes(s.id) ? ' (recommandé)' : ''}</option>)}
              </select>
            </Field></div>
            <Field label="Magasin">
              <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
                <option value="">Principal</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          {suggestedSupplierIds && form.supplier_id && !suggestedSupplierIds.includes(form.supplier_id) && (
            <p className="text-xs text-brand-600">Ce fournisseur ne livre habituellement aucun des produits sélectionnés.</p>
          )}
          {suggestedSupplierIds && !form.supplier_id && (
            <p className="text-xs text-brand-600">Fournisseurs recommandés pour ces produits : {suggestedSupplierIds.map((id) => suppliers.find((s) => s.id === id)?.name).filter(Boolean).join(', ')}</p>
          )}
          <Field label="Date"><input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="input" /></Field>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="label mb-0">Lignes</p><button onClick={addItem} className="text-xs font-semibold text-brand-600 hover:underline">+ Ajouter</button></div>
            <div className="space-y-2">
              {form.items.map((it: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-ink-200 dark:border-ink-700 p-2">
                  <select value={it.product_id} onChange={(e) => updateItem(i, 'product_id', e.target.value)} className="input col-span-5">
                    <option value="">Produit libre</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} placeholder="Désignation" className="input col-span-3" />
                  <input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="input col-span-1" />
                  {canSeeCost ? <input type="number" value={it.unit_cost} onChange={(e) => updateItem(i, 'unit_cost', Number(e.target.value))} className="input col-span-2" /> : <span className="col-span-2 self-center text-center text-xs text-ink-400 dark:text-ink-500">Coût masqué</span>}
                  <button onClick={() => removeItem(i)} className="col-span-1 rounded-lg text-ink-400 dark:text-ink-500 hover:text-error-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {form.items.length === 0 && <p className="py-4 text-center text-xs text-ink-400 dark:text-ink-500">Ajoutez au moins une ligne.</p>}
            </div>
          </div>
          {canSeeCost && <div className="rounded-xl bg-brand-50 p-3 text-right text-base font-bold text-ink-900 dark:text-ink-50">Total : {formatMoney(total, currency)}</div>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">Créer la commande</button>
        </div>
      </Modal>
      <Modal open={!!viewOpen} onClose={() => setViewOpen(null)} title={`Achat ${viewOpen?.reference ?? ''}`}>
        {viewOpen && (
          <div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400"><th className="pb-2">Désignation</th><th className="pb-2 text-right">Qté</th><th className="pb-2 text-right">Coût</th><th className="pb-2 text-right">Total</th></tr></thead>
              <tbody>
                {viewItems.map((it) => <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.quantity}</td><td className="py-2 text-right">{canSeeCost ? formatMoney(it.unit_cost, currency) : '—'}</td><td className="py-2 text-right font-semibold">{canSeeCost ? formatMoney(it.total, currency) : '—'}</td></tr>)}
              </tbody>
            </table>
            {canSeeCost && <div className="mt-4 flex justify-between border-t border-ink-100 dark:border-ink-800 pt-3 font-bold"><span>Total</span><span>{formatMoney(viewOpen.total, currency)}</span></div>}
          </div>
        )}
      </Modal>
      {/* Receive modal */}
      <Modal open={!!receiveOpen} onClose={() => setReceiveOpen(null)} title={`Réceptionner — ${receiveOpen?.reference ?? ''}`}>
        {receiveOpen && (
          <div>
            <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">Indiquez la quantité reçue pour chaque ligne. Le stock sera mis à jour automatiquement.</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400"><th className="pb-2">Produit</th><th className="pb-2 text-right">Commandé</th><th className="pb-2 text-right">Reçu</th></tr></thead>
              <tbody>
                {(Object.entries(receiveQtys)).map(([itemId, qty]) => {
                  const it = viewItems.find((x) => x.id === itemId);
                  if (!it) return null;
                  return (
                    <tr key={itemId} className="border-b border-ink-50 dark:border-ink-800">
                      <td className="py-2">{it.name}</td>
                      <td className="py-2 text-right text-ink-600 dark:text-ink-300">{it.quantity}</td>
                      <td className="py-2 text-right"><input type="number" min={0} max={Number(it.quantity)} value={qty} onChange={(e) => setReceiveQtys({ ...receiveQtys, [itemId]: Number(e.target.value) })} className="input w-20 py-1 text-right" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setReceiveOpen(null)} className="btn-ghost">Annuler</button>
              <button onClick={confirmReceive} className="btn-primary"><Check size={15} /> Confirmer la réception</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
