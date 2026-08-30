import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Download, Boxes, AlertTriangle, ArrowRightLeft, Check, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Product, Store } from '../../lib/types';

export function StockPage() {
  const { tenant, user, can } = useAuth();
  const { t, formatDate } = useI18n();
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
  const [batches, setBatches] = useState<any[]>([]);
  const [batchForm, setBatchForm] = useState({ name: '', source_store_id: '', dest_store_id: '', staff_code: '', staff_pin: '', notes: '', type: 'transfer' as 'transfer' | 'rms', reason: 'broken' });
  const [batchItems, setBatchItems] = useState<{ product_id: string; name: string; quantity: number }[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [transferErr, setTransferErr] = useState<string | null>(null);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

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

  const reloadTransfers = useCallback(async () => {
    if (!tenant) return;
    // New named, multi-product transfers ("Transfer Out / Transfer In").
    const { data: batchData } = await supabase
      .from('transfer_batches')
      .select('*, source:stores!source_store_id(name), dest:stores!dest_store_id(name), lines:stock_transfers(id, quantity, product:products(name))')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    setBatches(batchData ?? []);

    // Legacy single-product transfers created before this feature existed
    // (batch_id is null for them) — kept visible and actionable so nothing
    // already in flight silently disappears from the UI.
    const { data } = await supabase
      .from('stock_transfers')
      .select('*, product:products(name), source:stores!source_store_id(name), dest:stores!dest_store_id(name)')
      .eq('tenant_id', tenant.id)
      .is('batch_id', null)
      .order('created_at', { ascending: false });
    setTransfers(data ?? []);
  }, [tenant]);

  useEffect(() => { if (tab === 'transfers') reloadTransfers(); }, [tab, reloadTransfers]);

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
      if (error) { toast('error', error.message.includes('row-level security') ? t('stock.noPermission') : error.message); return; }
    } else {
      const { error } = await supabase.from('inventory').insert({ tenant_id: tenant.id, product_id: form.product_id, store_id: form.store_id || null, quantity: effective });
      if (error) { toast('error', error.message.includes('row-level security') ? t('stock.noPermission') : error.message); return; }
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
    toast('success', t('stock.toast.movementRecorded'));
  };

  const addScannedItem = () => {
    const q = scanInput.trim();
    if (!q) return;
    const found = products.find((p) => (p.barcode && p.barcode === q) || p.sku === q) ??
      products.find((p) => p.name.toLowerCase() === q.toLowerCase());
    if (!found) {
      setTransferErr(t('stock.err.productNotFound', { code: q }));
      return;
    }
    setTransferErr(null);
    setBatchItems((items) => {
      const existing = items.find((i) => i.product_id === found.id);
      if (existing) {
        return items.map((i) => (i.product_id === found.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...items, { product_id: found.id, name: found.name, quantity: 1 }];
    });
    setScanInput('');
  };

  const openRmsModal = () => {
    setBatchForm({
      name: '',
      source_store_id: '',
      dest_store_id: tenant?.rms_destination_store_id ?? '',
      staff_code: '',
      staff_pin: '',
      notes: '',
      type: 'rms',
      reason: 'broken',
    });
    setBatchItems([]);
    setScanInput('');
    setTransferErr(null);
    setTransferOpen(true);
  };

  const openTransferModal = () => {
    setBatchForm({ name: '', source_store_id: '', dest_store_id: '', staff_code: '', staff_pin: '', notes: '', type: 'transfer', reason: 'broken' });
    setBatchItems([]);
    setScanInput('');
    setTransferErr(null);
    setTransferOpen(true);
  };

  const createTransferBatch = async () => {
    setTransferErr(null);
    if (!tenant || !user) return;
    if (!batchForm.name.trim()) { setTransferErr(t('stock.err.transferNameRequired')); return; }
    if (!batchForm.source_store_id) { setTransferErr(t('stock.err.selectProductAndStores')); return; }
    if (batchForm.type === 'transfer' && !batchForm.dest_store_id) { setTransferErr(t('stock.err.selectProductAndStores')); return; }
    if (batchForm.dest_store_id && batchForm.source_store_id === batchForm.dest_store_id) { setTransferErr(t('stock.err.storesMustDiffer')); return; }
    if (batchItems.length === 0) { setTransferErr(t('stock.err.noItemsScanned')); return; }

    setSubmittingTransfer(true);
    const { error } = await supabase.rpc('initiate_stock_transfer_batch', {
      p_tenant_id: tenant.id,
      p_name: batchForm.name.trim(),
      p_source_store_id: batchForm.source_store_id,
      p_dest_store_id: batchForm.dest_store_id || null,
      p_items: batchItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      p_notes: batchForm.notes || null,
      p_staff_code: batchForm.staff_code.trim() || null,
      p_user_id: user.id,
      p_type: batchForm.type,
      p_reason: batchForm.type === 'rms' ? batchForm.reason : null,
      p_staff_pin: batchForm.staff_code.trim() ? (batchForm.staff_pin.trim() || null) : null,
    });
    setSubmittingTransfer(false);

    if (error) { setTransferErr(error.message); return; }

    setTransferOpen(false);
    setBatchForm({ name: '', source_store_id: '', dest_store_id: '', staff_code: '', staff_pin: '', notes: '', type: 'transfer', reason: 'broken' });
    setBatchItems([]);
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', batchForm.type === 'rms' ? t('stock.toast.rmsReported') : t('stock.toast.transferInitiated'));
  };

  const receiveBatch = async (b: any) => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('receive_stock_transfer_batch', { p_batch_id: b.id, p_user_id: user.id });
    if (error) { toast('error', error.message); return; }
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', t('stock.toast.transferReceived'));
  };

  const cancelBatch = async (b: any) => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('cancel_stock_transfer_batch', { p_batch_id: b.id, p_user_id: user.id });
    if (error) { toast('error', error.message); return; }
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', t('stock.toast.transferCancelled'));
  };

  const receiveTransfer = async (row: any) => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('receive_stock_transfer', { p_transfer_id: row.id, p_user_id: user.id });
    if (error) { toast('error', error.message); return; }
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', t('stock.toast.transferReceived'));
  };

  const cancelTransfer = async (row: any) => {
    if (!tenant || !user) return;
    const { error } = await supabase.rpc('cancel_stock_transfer', { p_transfer_id: row.id, p_user_id: user.id });
    if (error) { toast('error', error.message); return; }
    const { data } = await supabase.from('inventory').select('*, product:products(name), store:stores(name)').eq('tenant_id', tenant.id);
    setInventory(data ?? []);
    await reloadTransfers();
    toast('success', t('stock.toast.transferCancelled'));
  };

  const transferableSourceStores = stores.filter((s) => isAdmin || assignments.has(s.id));
  const pendingTransferCount = batches.filter((b) => b.status === 'pending').length + transfers.filter((t) => t.status === 'pending').length;

  return (
    <div>
      <PageHeader
        title={t('stock.title')}
        subtitle={t('stock.subtitle', { products: products.length, low: lowStockCount })}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('stock.csv', stockByProduct.map((r) => ({ produit: r.product.name, quantite: r.total, seuil: r.product.low_stock_threshold, statut: r.low ? 'bas' : 'ok' })))} className="btn-ghost"><Download size={16} /> {t('common.export')}</button>
            {canCreate && <button onClick={() => setMoveOpen(true)} className="btn-primary"><Plus size={16} /> {t('stock.movement')}</button>}
            {canCreate && transferableSourceStores.length > 0 && (
              <>
                {stores.length > 1 && <button onClick={openTransferModal} className="btn-ghost border-brand-200 text-brand-700"><ArrowRightLeft size={16} /> {t('stock.transfer')}</button>}
                <button onClick={openRmsModal} className="btn-ghost border-error-200 text-error-700"><AlertTriangle size={16} /> {t('stock.rms.reportBtn')}</button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 inline-flex rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
        <button onClick={() => setTab('inventory')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'inventory' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{t('stock.tab.inventory')}</button>
        <button onClick={() => setTab('transfers')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'transfers' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}>{t('stock.tab.transfers')} {pendingTransferCount > 0 && <span className="ml-1 rounded-full bg-warning-500 px-1.5 text-[10px] text-white">{pendingTransferCount}</span>}</button>
      </div>

      {tab === 'inventory' && (
        <>
          {lowStockCount > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-warning-50 dark:bg-warning-900/25 p-3 text-sm text-warning-700">
              <AlertTriangle size={16} /> {t('stock.lowStockWarning', { count: lowStockCount })}
            </div>
          )}
          <div className="card p-5">
            <div className="mb-4 flex flex-wrap gap-3">
              <SearchInput value={search} onChange={setSearch} />
              <Select value={storeFilter} onChange={setStoreFilter} placeholder={t('stock.allStores')} options={stores.map((s) => ({ value: s.id, label: s.name }))} />
            </div>
            {stockByProduct.length === 0 && !loading ? (
              <EmptyState icon={Boxes} title={t('stock.empty.title')} description={t('stock.empty.desc')} />
            ) : (
              <DataTable
                loading={loading}
                columns={[
                  { key: 'name', label: t('stock.col.product'), render: (r) => <p className="font-medium text-ink-900 dark:text-ink-50">{r.product.name}</p> },
                  { key: 'sku', label: 'SKU', render: (r) => <span className="text-ink-500 dark:text-ink-400">{r.product.sku ?? '—'}</span> },
                  { key: 'stores', label: t('stock.col.distribution'), render: (r) => (
                    <div className="flex flex-wrap gap-1">
                      {r.stores.length === 0 ? <span className="text-ink-400 dark:text-ink-500">—</span> : r.stores.map((s: any) => (
                        <span key={s.id} className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-xs text-ink-700 dark:text-ink-200">{s.store?.name ?? t('stock.mainStore')}: {s.quantity}</span>
                      ))}
                    </div>
                  )},
                  { key: 'total', label: t('stock.col.total'), className: 'text-right', render: (r) => <span className="font-medium text-ink-900 dark:text-ink-50">{r.total}</span> },
                  { key: 'status', label: t('common.status'), className: 'text-right', render: (r) => r.low ? <Badge tone="warning">{t('stock.status.low')}</Badge> : <Badge tone="success">{t('stock.status.ok')}</Badge> },
                  ...(canCreate ? [{
                    key: 'actions', label: '', className: 'text-right', render: (r: any) => (
                      <button
                        onClick={() => { setForm({ product_id: r.product.id, store_id: storeFilter || stores[0]?.id || '', type: 'in', quantity: 1, reason: '' }); setMoveOpen(true); }}
                        className="rounded-lg border border-ink-200 dark:border-ink-700 px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:hover:bg-brand-900/25"
                      >
                        {t('stock.adjust')}
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
        <div className="space-y-6">
          {/* Named, multi-product Transfer Out / Transfer In batches */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-900 dark:text-ink-50">{t('stock.transfersBatches')}</h3>
            {batches.length === 0 && !loading ? (
              <EmptyState icon={ArrowRightLeft} title={t('stock.transfersEmpty.title')} description={t('stock.transfersEmpty.desc')} />
            ) : (
              <DataTable
                loading={loading}
                columns={[
                  { key: 'date', label: t('common.date'), render: (row) => <span className="text-ink-500 dark:text-ink-400">{formatDate(row.created_at)}</span> },
                  { key: 'name', label: t('stock.col.transferName'), render: (row) => (
                    <div>
                      <p className="font-medium text-ink-900 dark:text-ink-50 flex items-center gap-1.5">
                        {row.type === 'rms' && <AlertTriangle size={13} className="text-error-500" />}
                        {row.name}
                      </p>
                      {row.type === 'rms' && row.reason && <p className="text-xs text-error-600">{t(`stock.rms.reason.${row.reason}`)}</p>}
                      {row.initiated_staff_code && <p className="text-xs text-ink-500 dark:text-ink-400">{t('stock.col.staffId')}: {row.initiated_staff_code}</p>}
                    </div>
                  )},
                  { key: 'route', label: t('stock.col.route'), render: (row) => <span className="text-ink-600 dark:text-ink-300">{row.source?.name} → {row.dest?.name}</span> },
                  { key: 'items', label: t('stock.col.items'), render: (row) => (
                    <div className="flex flex-wrap gap-1">
                      {(row.lines ?? []).map((l: any) => (
                        <span key={l.id} className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-xs text-ink-700 dark:text-ink-200">{l.product?.name ?? '—'} × {l.quantity}</span>
                      ))}
                    </div>
                  )},
                  { key: 'status', label: t('common.status'), render: (row) => <Badge tone={row.status === 'received' ? 'success' : row.status === 'cancelled' ? 'error' : 'warning'}>{row.status === 'received' ? t('stock.transferStatus.received') : row.status === 'cancelled' ? t('stock.transferStatus.cancelled') : t('stock.transferStatus.pending')}</Badge> },
                  { key: 'actions', label: '', className: 'text-right', render: (row) => (
                    <div className="flex justify-end gap-2">
                      {row.status === 'pending' && (isAdmin || assignments.has(row.dest_store_id)) && (
                        <button onClick={() => receiveBatch(row)} className="rounded-lg p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25" title={t('stock.markReceived')}><Check size={15} /></button>
                      )}
                      {row.status === 'pending' && (isAdmin || assignments.has(row.source_store_id)) && (
                        <button onClick={() => cancelBatch(row)} className="rounded-lg p-1.5 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25" title={t('common.cancel')}><X size={15} /></button>
                      )}
                    </div>
                  )},
                ]}
                rows={batches}
              />
            )}
          </div>

          {/* Legacy single-product transfers, created before named batches existed */}
          {transfers.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink-900 dark:text-ink-50">{t('stock.transfersLegacy')}</h3>
              <DataTable
                loading={loading}
                columns={[
                  { key: 'date', label: t('common.date'), render: (row) => <span className="text-ink-500 dark:text-ink-400">{formatDate(row.created_at)}</span> },
                  { key: 'product', label: t('stock.col.product'), render: (row) => <span className="font-medium text-ink-900 dark:text-ink-50">{row.product?.name ?? '—'}</span> },
                  { key: 'route', label: t('stock.col.route'), render: (row) => <span className="text-ink-600 dark:text-ink-300">{row.source?.name} → {row.dest?.name}</span> },
                  { key: 'qty', label: t('stock.col.qty'), className: 'text-right', render: (row) => <span className="font-medium text-ink-900 dark:text-ink-50">{row.quantity}</span> },
                  { key: 'status', label: t('common.status'), render: (row) => <Badge tone={row.status === 'received' ? 'success' : row.status === 'cancelled' ? 'error' : 'warning'}>{row.status === 'received' ? t('stock.transferStatus.received') : row.status === 'cancelled' ? t('stock.transferStatus.cancelled') : t('stock.transferStatus.pending')}</Badge> },
                  { key: 'actions', label: '', className: 'text-right', render: (row) => (
                    <div className="flex justify-end gap-2">
                      {row.status === 'pending' && (isAdmin || assignments.has(row.dest_store_id)) && (
                        <button onClick={() => receiveTransfer(row)} className="rounded-lg p-1.5 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25" title={t('stock.markReceived')}><Check size={15} /></button>
                      )}
                      {row.status === 'pending' && (isAdmin || assignments.has(row.source_store_id)) && (
                        <button onClick={() => cancelTransfer(row)} className="rounded-lg p-1.5 text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25" title={t('common.cancel')}><X size={15} /></button>
                      )}
                    </div>
                  )},
                ]}
                rows={transfers}
              />
            </div>
          )}
        </div>
      )}

      {/* Movement modal */}
      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title={t('stock.movementTitle')}>
        <div className="space-y-4">
          <Field label={t('stock.col.product')}>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="input">
              <option value="">{t('stock.selectPlaceholder')}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={t('stock.col.store')}>
            <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('stock.col.type')}>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                <option value="in">{t('stock.type.in')}</option>
                <option value="out">{t('stock.type.out')}</option>
              </select>
            </Field>
            <Field label={t('stock.col.quantity')}><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="input" /></Field>
          </div>
          <Field label={t('stock.col.reason')}><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="input" placeholder={t('stock.reasonPlaceholder')} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setMoveOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={recordMovement} className="btn-primary">{t('common.save')}</button>
        </div>
      </Modal>

      {/* Transfer modal — named batch, multiple scanned products */}
      <Modal open={transferOpen} onClose={() => { setTransferOpen(false); setTransferErr(null); setBatchItems([]); setScanInput(''); }} title={batchForm.type === 'rms' ? t('stock.rms.title') : t('stock.transferTitle')}>
        <div className="space-y-4">
          {batchForm.type === 'rms' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('stock.rms.reason')}</label>
              <select value={batchForm.reason} onChange={(e) => setBatchForm({ ...batchForm, reason: e.target.value })} className="input">
                <option value="broken">{t('stock.rms.reason.broken')}</option>
                <option value="expired">{t('stock.rms.reason.expired')}</option>
                <option value="damaged">{t('stock.rms.reason.damaged')}</option>
                <option value="lost">{t('stock.rms.reason.lost')}</option>
                <option value="other">{t('stock.rms.reason.other')}</option>
              </select>
            </div>
          )}
          <Field label={t('stock.col.transferName')}>
            <input value={batchForm.name} onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })} className="input" placeholder={batchForm.type === 'rms' ? t('stock.rms.namePlaceholder') : t('stock.transferNamePlaceholder')} />
          </Field>
          <div className={batchForm.type === 'rms' && stores.length <= 1 ? '' : 'grid grid-cols-2 gap-3'}>
            <Field label={t('stock.sourceStore')}>
              <select value={batchForm.source_store_id} onChange={(e) => setBatchForm({ ...batchForm, source_store_id: e.target.value, dest_store_id: batchForm.type === 'rms' ? batchForm.dest_store_id : '' })} className="input">
                <option value="">{t('stock.selectPlaceholder')}</option>
                {transferableSourceStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            {(batchForm.type !== 'rms' || stores.length > 1) && (
              <Field label={batchForm.type === 'rms' ? t('stock.rms.destination') : t('stock.destStore')}>
                <select value={batchForm.dest_store_id} onChange={(e) => setBatchForm({ ...batchForm, dest_store_id: e.target.value })} className="input">
                  <option value="">{batchForm.type === 'rms' ? t('stock.rms.writeOffOption') : t('stock.selectPlaceholder')}</option>
                  {stores.filter((s) => s.id !== batchForm.source_store_id).map((s) => <option key={s.id} value={s.id}>{s.name}{s.id === tenant?.rms_destination_store_id ? ` (${t('stock.rms.defaultHo')})` : ''}</option>)}
                </select>
              </Field>
            )}
          </div>
          {batchForm.type === 'rms' && stores.length <= 1 && (
            <p className="text-xs text-ink-500 dark:text-ink-400">{t('stock.rms.writeOffHint')}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('stock.staffIdOptional')}>
              <input
                value={batchForm.staff_code}
                onChange={(e) => setBatchForm({ ...batchForm, staff_code: e.target.value })}
                className="input font-mono"
                placeholder="STF-001"
              />
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{t('stock.staffIdHint')}</p>
            </Field>
            <Field label={t('stock.staffPin')}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={batchForm.staff_pin}
                onChange={(e) => setBatchForm({ ...batchForm, staff_pin: e.target.value.replace(/[^0-9]/g, '') })}
                className="input tracking-widest"
                placeholder="••••"
                disabled={!batchForm.staff_code.trim()}
              />
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{t('stock.staffPinHint')}</p>
            </Field>
          </div>

          <Field label={t('stock.scanProducts')}>
            <div className="flex gap-2">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addScannedItem(); } }}
                className="input flex-1"
                placeholder={t('stock.scanPlaceholder')}
                autoFocus
              />
              <button type="button" onClick={addScannedItem} className="btn-ghost shrink-0">{t('common.add')}</button>
            </div>
          </Field>

          {batchItems.length > 0 && (
            <div className="rounded-xl border border-ink-200 dark:border-ink-700 divide-y divide-ink-100 dark:divide-ink-800">
              {batchItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm text-ink-900 dark:text-ink-50">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => setBatchItems((items) => items.map((i) => (i.product_id === item.product_id ? { ...i, quantity: Math.max(1, Number(e.target.value)) } : i)))}
                      className="input w-16 py-1 text-center text-sm"
                    />
                    <button type="button" onClick={() => setBatchItems((items) => items.filter((i) => i.product_id !== item.product_id))} className="text-error-500 hover:text-error-700">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Field label={t('stock.col.notes')}><input value={batchForm.notes} onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })} className="input" placeholder={t('stock.notesPlaceholder')} /></Field>
          {transferErr && <div className="rounded-xl bg-error-50 dark:bg-error-900/25 p-3 text-sm text-error-600">{transferErr}</div>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => { setTransferOpen(false); setTransferErr(null); setBatchItems([]); setScanInput(''); }} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={createTransferBatch} disabled={submittingTransfer} className="btn-primary"><ArrowRightLeft size={15} /> {submittingTransfer ? t('stock.transferring') : batchForm.type === 'rms' ? t('stock.rms.submitBtn') : t('stock.transferBtn')}</button>
        </div>
      </Modal>
    </div>
  );
}
