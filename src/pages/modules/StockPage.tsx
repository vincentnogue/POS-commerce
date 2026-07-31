import { useEffect, useState, useMemo } from 'react';
import { Plus, Download, Boxes, AlertTriangle, ArrowRightLeft, Check, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Product, Store } from '../../lib/types';

export function StockPage() {
  const { tenant, user, can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'inventory' | 'transfers'>('inventory');

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', store_id: '', type: 'in', quantity: 1, reason: '' });
  const [transferForm, setTransferForm] = useState({ product_id: '', source_store_id: '', dest_store_id: '', quantity: 1, notes: '' });
  const [transferErr, setTransferErr] = useState<string | null>(null);

  const canCreate = can('stock', 'create');
  const isAdmin = user && (can('stores', 'create'));

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [p, s, i] = await Promise.all([
      supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('stores').select('*').eq('tenant_id', tenant.id),
      supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id),
    ]);
    setProducts((p.data as Product[]) ?? []);
    setStores((s.data as Store[]) ?? []);
    setInventory(i.data ?? []);
    setForm((f) => ({ ...f, store_id: s.data?.[0]?.id ?? '' }));

    // Load store assignments for the current user (to know which stores they can transfer from)
    if (user) {
      const { data: myMember } = await supabase.from('tenant_members').select('id').eq('user_id', user.id).eq('tenant_id', tenant.id).maybeSingle();
      if (myMember) {
        const { data: assigns } = await supabase.from('store_assignments').select('store_id').eq('member_id', myMember.id).eq('can_transfer', true);
        setAssignments(new Set((assigns ?? []).map((a: any) => a.store_id)));
      }
    }
    setLoading(false);
  })(); }, [tenant, user]);

  const reloadTransfers = async () => {
    if (!tenant) return;
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, product:products(name), source:stores!source_store_id(name), dest:stores!dest_store_id(name)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    setTransfers(data ?? []);
  };

  useEffect(() => { if (tab === 'transfers') reloadTransfers(); }, [tab, tenant]);

  const stockByProduct = useMemo(() => {
    return products.map((p) => {
      const rows = inventory.filter((i) => i.product_id === p.id && (!storeFilter || i.store_id === storeFilter));
      const total = rows.reduce((s, r) => s + Number(r.quantity), 0);
      const low = total <= p.low_stock_threshold;
      return { product: p, total, low, stores: rows };
    }).filter((row) => {
      const q = search.toLowerCase().trim();
      return !q || row.product.name.toLowerCase().includes(q) || row.product.sku?.toLowerCase().includes(q);
    });
  }, [products, inventory, storeFilter, search]);

  const lowStockCount = stockByProduct.filter((r) => r.low).length;

  const recordMovement = async () => {
    if (!tenant || !form.product_id) return;
    const qty = Number(form.quantity);
    const effective = form.type === 'in' ? Math.abs(qty) : -Math.abs(qty);

    const existing = inventory.find((i) => i.product_id === form.product_id && i.store_id === form.store_id);
    if (existing) {
      const { error } = await supabase.from('inventory').update({ quantity: Number(existing.quantity) + effective, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) { toast('error', error.message.includes('row-level security') ? "Vous n'avez pas la permission de modifier le stock." : error.message); return; }
    } else {
      const { error } = await supabase.from('inventory').insert({ tenant_id: tenant.id, product_id: form.product_id, store_id: form.store_id || null, quantity: effective });
      if (error) { toast('error', error.message.includes('row-level security') ? "Vous n'avez pas la permission de modifier le stock." : error.message); return; }
    }

    const { error: movErr } = await supabase.from('stock_movements').insert({
      tenant_id: tenant.id,
      product_id: form.product_id,
      store_id: form.store_id || null,
      movement_type: form.type,
      quantity: Math.abs(qty),
      reason: form.reason || null,
      user_id: user?.id,
    });
    if (movErr) { toast('error', movErr.message); return; }

    setMoveOpen(false);
    setForm({ product_id: '', store_id: stores[0]?.id ?? '', type: 'in', quantity: 1, reason: '' });
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    toast('success', 'Mouvement de stock enregistré.');
  };

  const createTransfer = async () => {
    setTransferErr(null);
    if (!tenant || !user) return;
    if (!transferForm.product_id || !transferForm.source_store_id || !transferForm.dest_store_id) {
      setTransferErr('Veuillez sélectionner le produit et les deux magasins.');
      return;
    }
    if (transferForm.source_store_id === transferForm.dest_store_id) {
      setTransferErr('Le magasin source et destination doivent être différents.');
      return;
    }
    const qty = Number(transferForm.quantity);
    if (qty <= 0) { setTransferErr('La quantité doit être positive.'); return; }

    // Single atomic database transaction — checks stock, decrements source,
    // creates the transfer and the movement log all-or-nothing server-side,
    // instead of separate client round-trips that could race with a
    // concurrent operation on the same product/store.
    const { error } = await supabase.rpc('initiate_stock_transfer', {
      p_tenant_id: tenant.id,
      p_product_id: transferForm.product_id,
      p_source_store_id: transferForm.source_store_id,
      p_dest_store_id: transferForm.dest_store_id,
      p_quantity: qty,
      p_notes: transferForm.notes || null,
      p_user_id: user.id,
    });

    if (error) {
      setTransferErr(error.message);
      return;
    }

    setTransferOpen(false);
    setTransferForm({ product_id: '', source_store_id: '', dest_store_id: '', quantity: 1, notes: '' });
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', 'Transfert initié.');
  };

  const receiveTransfer = async (t: any) => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('receive_stock_transfer', { p_transfer_id: t.id, p_user_id: user.id });
    if (error) { toast('error', error.message); return; }
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', 'Transfert reçu, stock mis à jour.');
  };

  const cancelTransfer = async (t: any) => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('cancel_stock_transfer', { p_transfer_id: t.id, p_user_id: user.id });
    if (error) { toast('error', error.message); return; }
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', 'Transfert annulé, stock restauré.');
  };

  const transferableSourceStores = stores.filter((s) => isAdmin || assignments.has(s.id));

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle={`${products.length} produits · ${lowStockCount} en alerte stock bas`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('stock.csv', stockByProduct.map((r) => ({ produit: r.product.name, quantite: r.total, seuil: r.product.low_stock_threshold, statut: r.low ? 'bas' : 'ok' })))} className="btn-ghost"><Download size={16} /> Export</button>
            {canCreate && <button onClick={() => setMoveOpen(true)} className="btn-primary"><Plus size={16} /> Mouvement</button>}
            {canCreate && transferableSourceStores.length > 0 && stores.length > 1 && (
              <button onClick={() => setTransferOpen(true)} className="btn-ghost border-brand-200 text-brand-700"><ArrowRightLeft size={16} /> Transfert</button>
            )}
          </div>
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
        <button onClick={() => setTab('inventory')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'inventory' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>Inventaire</button>
        <button onClick={() => setTab('transfers')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'transfers' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>Transferts {transfers.filter((t) => t.status === 'pending').length > 0 && <span className="ml-1 rounded-full bg-warning-500 px-1.5 text-[10px] text-white">{transfers.filter((t) => t.status === 'pending').length}</span>}</button>
      </div>

      {tab === 'inventory' && (
        <>
          {lowStockCount > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-warning-50 dark:bg-warning-900/25 p-3 text-sm text-warning-700">
              <AlertTriangle size={16} /> {lowStockCount} produit(s) sous le seuil de stock bas.
            </div>
          )}
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap gap-3">
              <SearchInput value={search} onChange={setSearch} />
              <Select value={storeFilter} onChange={setStoreFilter} placeholder="Tous magasins" options={stores.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            {stockByProduct.length === 0 && !loading ? (
              <EmptyState icon={Boxes} title="Aucun stock" description="Ajoutez des produits puis enregistrez des mouvements." />
            ) : (
              <DataTable
                loading={loading}
                columns={[
                  { key: 'name', label: 'Produit', render: (r) => <p className="font-medium text-ink-900 dark:text-ink-50">{r.product.name}</p> },
                  { key: 'sku', label: 'SKU', render: (r) => <span className="text-ink-500 dark:text-ink-400">{r.product.sku ?? '—'}</span> },
                  { key: 'stores', label: 'Répartition', render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      {r.stores.length === 0 ? <span className="text-ink-400 dark:text-ink-500">—</span> : r.stores.map((s: any) => (
                        <span key={s.id} className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-xs text-ink-700 dark:text-ink-200">{s.store?.name ?? 'Principal'}: {s.quantity}</span>
                      ))}
                    </div>
                  )},
                  { key: 'total', label: 'Total', className: 'text-right', render: (r) => <span className="font-medium text-ink-900 dark:text-ink-50">{r.total}</span> },
                  { key: 'status', label: 'Statut', className: 'text-right', render: (r) => r.low ? <Badge tone="warning">Stock bas</Badge> : <Badge tone="success">OK</Badge> },
                  ...(canCreate ? [{
                    key: 'actions', label: '', className: 'text-right', render: (r: any) => (
                      <button
                        onClick={() => { setForm({ product_id: r.product.id, store_id: storeFilter || stores[0]?.id || '', type: 'in', quantity: 1, reason: '' }); setMoveOpen(true); }}
                        className="rounded-lg border border-ink-200 dark:border-ink-700 px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-900/25"
                      >
                        Ajuster
                      </button>
                    ),
                  }] : []),
                ]}
                rows={stockByProduct}
              />
            )}
          </div>
        </>
      )}

      {tab === 'transfers' && (
        <div className="card p-5">
          {transfers.length === 0 && !loading ? (
            <EmptyState icon={ArrowRightLeft} title="Aucun transfert" description="Initiez un transfert de stock entre deux magasins." />
          ) : (
            <DataTable
              loading={loading}
              columns={[
                { key: 'date', label: 'Date', render: (t) => <span className="text-ink-500 dark:text-ink-400">{new Date(t.created_at).toLocaleDateString('fr-FR')}</span> },
                { key: 'product', label: 'Produit', render: (t) => <span className="font-medium text-ink-900 dark:text-ink-50">{t.product?.name ?? '—'}</span> },
                { key: 'route', label: 'Itinéraire', render: (t) => <span className="text-ink-600 dark:text-ink-300">{t.source?.name} → {t.dest?.name}</span> },
                { key: 'qty', label: 'Qté', className: 'text-right', render: (t) => <span className="font-medium text-ink-900 dark:text-ink-50">{t.quantity}</span> },
                { key: 'status', label: 'Statut', render: (t) => <Badge tone={t.status === 'received' ? 'success' : t.status === 'cancelled' ? 'error' : 'warning'}>{t.status === 'received' ? 'Reçu' : t.status === 'cancelled' ? 'Annulé' : 'En cours'}</Badge> },
                { key: 'actions', label: '', className: 'text-right', render: (t) => (
                  <div className="flex justify-end gap-2">
                    {t.status === 'pending' && (isAdmin || assignments.has(t.dest_store_id)) && (
                      <button onClick={() => receiveTransfer(t)} className="rounded-lg p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25" title="Marquer reçu"><Check size={15} /></button>
                    )}
                    {t.status === 'pending' && (isAdmin || assignments.has(t.source_store_id)) && (
                      <button onClick={() => cancelTransfer(t)} className="rounded-lg p-1.5 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25" title="Annuler"><X size={15} /></button>
                    )}
                  </div>
                )},
              ]}
              rows={transfers}
            />
          )}
        </div>
      )}

      {/* Movement modal */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title="Mouvement de stock">
        <div className="space-y-4">
          <Field label="Produit">
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="input">
              <option value="">— Sélectionner —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Magasin">
            <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                <option value="in">Entrée</option>
                <option value="out">Sortie</option>
              </select>
            </Field>
            <Field label="Quantité"><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" /></Field>
          </div>
          <Field label="Raison"><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input" placeholder="Ex: réappro, casse, inventaire…" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setMoveOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={recordMovement} className="btn-primary">Enregistrer</button>
        </div>
      </Modal>

      {/* Transfer modal */}
      <Modal open={transferOpen} onClose={() => { setTransferOpen(false); setTransferErr(null); }} title="Transfert entre magasins">
        <div className="space-y-4">
          <Field label="Produit">
            <select value={transferForm.product_id} onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })} className="input">
              <option value="">— Sélectionner —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Magasin source (départ)">
            <select value={transferForm.source_store_id} onChange={(e) => setTransferForm({ ...transferForm, source_store_id: e.target.value, dest_store_id: '' })} className="input">
              <option value="">— Sélectionner —</option>
              {transferableSourceStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Magasin destination (arrivée)">
            <select value={transferForm.dest_store_id} onChange={(e) => setTransferForm({ ...transferForm, dest_store_id: e.target.value })} className="input">
              <option value="">— Sélectionner —</option>
              {stores.filter((s) => s.id !== transferForm.source_store_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Quantité"><input type="number" value={transferForm.quantity} onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })} className="input" /></Field>
          <Field label="Notes"><input value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} className="input" placeholder="Optionnel" /></Field>
          {transferErr && <div className="rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">{transferErr}</div>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => { setTransferOpen(false); setTransferErr(null); }} className="btn-ghost">Annuler</button>
          <button onClick={createTransfer} className="btn-primary"><ArrowRightLeft size={15} /> Transférer</button>
        </div>
      </Modal>
    </div>
  );
}
