import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Download } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Product, Category } from '../../lib/types';

const EMPTY = { name: '', sku: '', barcode: '', description: '', cost_price: 0, sale_price: 0, tax_rate: 0, unit: 'unité', low_stock_threshold: 5, category_id: '' };

export function ProductsPage() {
  const { tenant, can } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const currency = tenant?.currency ?? 'XOF';
  const isNew = params.get('new') === '1';

  const canSeeCost = can('products', 'update');
  const canCreate = can('products', 'create');
  const canUpdate = can('products', 'update');
  const canDelete = can('products', 'delete');

  useEffect(() => {
    if (!tenant) return;
    (async () => {
      // If the user can't see cost_price, query the public view (cost_price stripped)
      const tableName = canSeeCost ? 'products' : 'products_public';
      const [p, c] = await Promise.all([
        supabase.from(tableName).select('*').eq('tenant_id', tenant.id).order('name'),
        supabase.from('categories').select('*').eq('tenant_id', tenant.id).order('name'),
      ]);
      setProducts((p.data as Product[]) ?? []);
      setCategories((c.data as Category[]) ?? []);
      setLoading(false);
    })();
    if (isNew) { setModalOpen(true); setParams({}, { replace: true }); }
  }, [tenant, canSeeCost]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)) &&
      (!catFilter || p.category_id === catFilter)
    );
  }, [products, search, catFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku ?? '', barcode: p.barcode ?? '', description: p.description ?? '', cost_price: Number(p.cost_price), sale_price: Number(p.sale_price), tax_rate: Number(p.tax_rate), unit: p.unit, low_stock_threshold: p.low_stock_threshold, category_id: p.category_id ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const payload = {
      tenant_id: tenant.id,
      category_id: form.category_id || null,
      name: form.name.trim(),
      sku: form.sku || null,
      barcode: form.barcode || null,
      description: form.description || null,
      cost_price: Number(form.cost_price),
      sale_price: Number(form.sale_price),
      tax_rate: Number(form.tax_rate),
      unit: form.unit,
      low_stock_threshold: Number(form.low_stock_threshold),
      is_active: true,
    };
    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) { toast('error', error.message); return; }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select().single();
      if (error) { toast('error', error.message.replace('PLAN_LIMIT_REACHED: ', '')); return; }
      // Init inventory row for each store
      if (data) {
        const { data: stores } = await supabase.from('stores').select('id').eq('tenant_id', tenant.id);
        if (stores && stores.length > 0) {
          await supabase.from('inventory').insert(stores.map((s) => ({ tenant_id: tenant.id, product_id: data.id, store_id: s.id, quantity: 0 })));
        }
      }
    }
    setModalOpen(false);
    await reload();
  };

  const remove = async (p: Product) => {
    if (!confirm(t('products.confirmDelete', { name: p.name }))) return;
    await supabase.from('products').delete().eq('id', p.id);
    await reload();
  };

  const reload = async () => {
    if (!tenant) return;
    const tableName = canSeeCost ? 'products' : 'products_public';
    const { data } = await supabase.from(tableName).select('*').eq('tenant_id', tenant.id).order('name');
    setProducts((data as Product[]) ?? []);
  };

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <div>
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle', { count: products.length })}
        action={
          <div className="flex gap-2">
            {canSeeCost && <button onClick={() => exportCSV('produits.csv', filtered.map((p) => ({ name: p.name, sku: p.sku, prix_achat: p.cost_price, prix_vente: p.sale_price, categorie: catName(p.category_id) })))} className="btn-ghost">
              <Download size={16} /> {t('common.export')}
            </button>}
            {canCreate && <button onClick={openNew} className="btn-primary"><Plus size={16} /> {t('products.new')}</button>}
          </div>
        }
      />

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input max-w-xs">
            <option value="">{t('products.allCategories')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Package} title={t('products.empty.title')} description={t('products.empty.desc')} action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> {t('common.add')}</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'name', label: t('products.col.name'), render: (p: Product) => (
                <div>
                  <p className="font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
                  {p.sku && <p className="text-xs text-ink-500 dark:text-ink-400">SKU: {p.sku}</p>}
                </div>
              )},
              { key: 'category', label: t('products.col.category'), render: (p: Product) => <span className="text-ink-600 dark:text-ink-300">{catName(p.category_id)}</span> },
              { key: 'cost', label: t('products.col.cost'), className: 'text-right', render: (p: Product) => canSeeCost ? <span className="text-ink-600 dark:text-ink-300">{formatMoney(p.cost_price, currency)}</span> : <span className="text-ink-300">—</span> },
              { key: 'sale', label: t('products.col.sale'), className: 'text-right', render: (p: Product) => <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(p.sale_price, currency)}</span> },
              { key: 'stock', label: t('products.col.minStock'), className: 'text-right', render: (p: Product) => <span className="text-ink-600 dark:text-ink-300">{p.low_stock_threshold}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (p: Product) => (
                <div className="flex justify-end gap-2">
                  {canUpdate && <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={15} /></button>}
                  {canDelete && <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>}
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('products.editTitle') : t('products.newTitle')} maxWidth="max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label={t('products.field.name')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field></div>
          <Field label="SKU"><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" /></Field>
          <Field label={t('products.field.barcode')}><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input" /></Field>
          <Field label={t('products.col.category')}>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label={t('products.field.unit')}><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" /></Field>
          <Field label={t('products.field.cost')}>{canSeeCost ? <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="input" /> : <p className="text-xs text-ink-400 dark:text-ink-500">{t('products.costUnavailable')}</p>}</Field>
          <Field label={t('products.field.sale')}><input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input" /></Field>
          <Field label={t('products.field.tax')}><input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="input" /></Field>
          <Field label={t('products.field.lowStock')}><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="input" /></Field>
          <div className="sm:col-span-2"><Field label={t('products.field.description')}><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[70px]" /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{editing ? t('common.save') : t('common.create')}</button>
        </div>
      </Modal>
    </div>
  );
}
