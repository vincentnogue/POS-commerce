import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Download, Image as ImageIcon, X, Tags } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Product, Category } from '../../lib/types';

const EMPTY = { name: '', sku: '', barcode: '', description: '', cost_price: 0, sale_price: 0, tax_rate: 0, unit: 'unité', low_stock_threshold: 5, category_id: '', image_url: '', sizes: '' };

// products.variants is stored as a JSON array (e.g. [{ type: 'size', value: 'M' }]).
// The form only needs a simple comma-separated size list for now, so we
// convert both ways without touching how other parts of the app read variants.
const variantsToSizesText = (variants: any[] | null | undefined) =>
  (variants ?? []).filter((v) => v?.type === 'size').map((v) => v.value).join(', ');

const sizesTextToVariants = (text: string) =>
  text.split(',').map((s) => s.trim()).filter(Boolean).map((value) => ({ type: 'size', value }));

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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [bulkCategoryText, setBulkCategoryText] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

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
  }, [tenant, canSeeCost]);

  useEffect(() => {
    if (isNew) { setModalOpen(true); setParams({}, { replace: true }); }
  }, [isNew, setParams]);

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
    setForm({ name: p.name, sku: p.sku ?? '', barcode: p.barcode ?? '', description: p.description ?? '', cost_price: Number(p.cost_price), sale_price: Number(p.sale_price), tax_rate: Number(p.tax_rate), unit: p.unit, low_stock_threshold: p.low_stock_threshold, category_id: p.category_id ?? '', image_url: p.image_url ?? '', sizes: variantsToSizesText(p.variants) });
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
      image_url: form.image_url || null,
      variants: sizesTextToVariants(form.sizes),
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

  const uploadProductImage = async (file: File) => {
    if (!tenant) return;
    setUploadingImage(true);
    const ext = file.name.split('.').pop();
    const path = `${tenant.id}/${editing?.id ?? 'new'}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true });
    if (error) { toast('error', error.message); setUploadingImage(false); return; }
    const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    setForm((f: any) => ({ ...f, image_url: url }));
    setUploadingImage(false);
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

  const reloadCategories = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('categories').select('*').eq('tenant_id', tenant.id).order('name');
    setCategories((data as Category[]) ?? []);
  };

  const randomColor = () => ['#2E8C66', '#14B594', '#F96F22', '#4FA480', '#7CBBA0', '#F5A623', '#E5484D', '#6366F1'][Math.floor(Math.random() * 8)];

  // Manual: one category. Bulk: one category per line, so a manager can
  // paste a whole list at once ("créer des catégories en masse").
  const addCategory = async () => {
    if (!tenant || !newCategoryName.trim()) return;
    setSavingCategory(true);
    const { error } = await supabase.from('categories').insert({ tenant_id: tenant.id, name: newCategoryName.trim(), color: randomColor() });
    setSavingCategory(false);
    if (error) { toast('error', error.message); return; }
    setNewCategoryName('');
    await reloadCategories();
  };

  const addCategoriesBulk = async () => {
    if (!tenant) return;
    const names = bulkCategoryText.split('\n').map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setSavingCategory(true);
    const { error } = await supabase.from('categories').insert(names.map((name) => ({ tenant_id: tenant.id, name, color: randomColor() })));
    setSavingCategory(false);
    if (error) { toast('error', error.message); return; }
    setBulkCategoryText('');
    await reloadCategories();
    toast('success', t('products.categories.toast.bulkAdded', { count: names.length }));
  };

  const renameCategory = async (id: string) => {
    if (!editingCategoryName.trim()) return;
    const { error } = await supabase.from('categories').update({ name: editingCategoryName.trim() }).eq('id', id);
    if (error) { toast('error', error.message); return; }
    setEditingCategoryId(null);
    setEditingCategoryName('');
    await reloadCategories();
  };

  const deleteCategory = async (c: Category) => {
    if (!confirm(t('products.categories.confirmDelete', { name: c.name }))) return;
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) { toast('error', error.message); return; }
    await reloadCategories();
    await reload();
  };

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
            {/* BUG FIX: this button used to be omitted entirely (`{canCreate && <button>}`)
                whenever the permission check was false, which is indistinguishable from
                a rendering bug to the person looking at the screen — it just isn't there.
                Always render it; disable it (with an explanatory tooltip) instead, so
                "the button is missing" never happens regardless of role/plan state. */}
            <button
              onClick={canCreate ? openNew : undefined}
              disabled={!canCreate}
              title={!canCreate ? t('common.noPermission') : undefined}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> {t('products.new')}
            </button>
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
          <button
            onClick={canCreate ? () => setCategoryModalOpen(true) : undefined}
            disabled={!canCreate}
            title={!canCreate ? t('common.noPermission') : undefined}
            className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Tags size={16} /> {t('products.categories.manageBtn')}
          </button>
        </div>

        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Package} title={t('products.empty.title')} description={t('products.empty.desc')} action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> {t('common.add')}</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'photo', label: '', render: (p: Product) => (
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-brand-50 dark:bg-brand-900/25 text-brand-400">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <ImageIcon size={16} />}
                </div>
              )},
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
          <div className="sm:col-span-2">
            <Field label={t('products.field.photo')}>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700 bg-brand-50 dark:bg-brand-900/25 text-brand-400">
                  {form.image_url ? <img src={form.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={20} />}
                </div>
                <label className="btn-ghost cursor-pointer text-sm">
                  {uploadingImage ? t('products.photo.uploading') : t('products.photo.choose')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProductImage(f); }} />
                </label>
                {form.image_url && (
                  <button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="rounded-lg p-1.5 text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600" title={t('common.remove')}>
                    <X size={15} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">{t('products.photo.hint')}</p>
            </Field>
          </div>
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
          <div className="sm:col-span-2">
            <Field label={t('products.field.sizes')}>
              <input value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className="input" placeholder={t('products.field.sizesPlaceholder')} />
            </Field>
          </div>
          <div className="sm:col-span-2"><Field label={t('products.field.description')}><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[70px]" /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{editing ? t('common.save') : t('common.create')}</button>
        </div>
      </Modal>

      {/* Category management — manual (one at a time) or bulk (one per line) */}
      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={t('products.categories.title')} maxWidth="max-w-lg">
        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('products.categories.addOne')}</label>
            <div className="flex gap-2">
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} className="input flex-1" placeholder={t('products.categories.namePlaceholder')} />
              <button onClick={addCategory} disabled={savingCategory || !newCategoryName.trim()} className="btn-primary shrink-0"><Plus size={15} /> {t('common.add')}</button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('products.categories.addBulk')}</label>
            <textarea value={bulkCategoryText} onChange={(e) => setBulkCategoryText(e.target.value)} className="input min-h-[80px]" placeholder={t('products.categories.bulkPlaceholder')} />
            <div className="mt-2 flex justify-end">
              <button onClick={addCategoriesBulk} disabled={savingCategory || !bulkCategoryText.trim()} className="btn-ghost">{t('products.categories.addBulkBtn')}</button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-300">{t('products.categories.existing')}</label>
            {categories.length === 0 ? (
              <p className="text-sm text-ink-400 dark:text-ink-500">{t('common.empty')}</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700 p-2">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800">
                    {editingCategoryId === c.id ? (
                      <input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameCategory(c.id); if (e.key === 'Escape') setEditingCategoryId(null); }}
                        onBlur={() => renameCategory(c.id)}
                        autoFocus
                        className="input py-1 text-sm"
                      />
                    ) : (
                      <span className="flex items-center gap-2 text-sm text-ink-900 dark:text-ink-50">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    )}
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { setEditingCategoryId(c.id); setEditingCategoryName(c.name); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={13} /></button>
                      <button onClick={() => deleteCategory(c)} className="rounded-lg p-1.5 text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button onClick={() => setCategoryModalOpen(false)} className="btn-ghost">{t('common.close')}</button>
        </div>
      </Modal>
    </div>
  );
}
