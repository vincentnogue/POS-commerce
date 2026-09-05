import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Download, Upload, Image as ImageIcon, X, Tags, Sparkles } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV, parseCSV } from '../../components/DataTable';
import type { Product, Category } from '../../lib/types';

const EMPTY = { name: '', sku: '', barcode: '', description: '', cost_price: 0, sale_price: 0, tax_rate: 0, unit: 'unité', low_stock_threshold: 5, category_id: '', image_url: '', sizes: '', tracking_mode: 'none' };

// Migration/import: target product fields a CSV column can be mapped to.
// 'name' is the only required one — everything else is optional so a
// bare-bones export (just names and prices, say) still imports cleanly.
const IMPORT_FIELDS = ['name', 'sku', 'barcode', 'category', 'costPrice', 'salePrice', 'taxRate', 'unit'] as const;
type ImportField = typeof IMPORT_FIELDS[number];

// Auto-suggests a mapping from a CSV's actual header row to our fields, by
// matching common header names used across the systems people actually
// migrate from (Square, Shopify, Odoo, Lightspeed, a plain spreadsheet —
// in both English and French). This is a starting guess the person
// reviews and corrects in the UI, never applied silently.
const HEADER_HINTS: Record<ImportField, string[]> = {
  name: ['name', 'nom', 'item name', 'product name', 'title', 'produit', 'désignation', 'designation'],
  sku: ['sku', 'ref', 'référence', 'reference', 'code produit', 'product code'],
  barcode: ['barcode', 'code-barres', 'code barre', 'ean', 'upc', 'gtin'],
  category: ['category', 'catégorie', 'categorie', 'type', 'department', 'rayon'],
  costPrice: ['cost', 'cost price', 'prix d\'achat', 'prix achat', 'purchase price', 'buy price'],
  salePrice: ['price', 'sale price', 'prix de vente', 'prix vente', 'selling price', 'variant price', 'unit price'],
  taxRate: ['tax', 'tax rate', 'taxe', 'tva', 'vat'],
  unit: ['unit', 'unité', 'unite', 'uom'],
};

function guessMapping(headers: string[]): Record<ImportField, string> {
  const mapping = {} as Record<ImportField, string>;
  for (const field of IMPORT_FIELDS) {
    const hints = HEADER_HINTS[field];
    const match = headers.find((h) => hints.includes(h.trim().toLowerCase()));
    mapping[field] = match ?? '';
  }
  return mapping;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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

  // CSV import (migration tool) state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importFilename, setImportFilename] = useState('');
  const [importMapping, setImportMapping] = useState<Record<ImportField, string>>({} as Record<ImportField, string>);
  const [importing, setImporting] = useState(false);

  // --- AI product description (real OpenAI integration, see
  // supabase/functions/ai-generate) -----------------------------------
  const [aiConnectionId, setAiConnectionId] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    (async () => {
      // Either connected AI provider works — ai-generate resolves the
      // actual provider server-side from connection_id, so this just
      // needs to find whichever one (if any) the tenant has connected.
      const { data: providers } = await supabase.from('integration_providers').select('id').in('provider_key', ['openai_chatgpt', 'anthropic_claude']);
      if (!providers || providers.length === 0) return;
      const { data: connection } = await supabase
        .from('integration_connections')
        .select('id, status')
        .eq('tenant_id', tenant.id)
        .in('provider_id', providers.map((p) => p.id))
        .eq('status', 'connected')
        .maybeSingle();
      if (!cancelled) setAiConnectionId(connection?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const generateDescription = async () => {
    if (!tenant || !aiConnectionId || !form.name.trim()) return;
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          tenant_id: tenant.id,
          connection_id: aiConnectionId,
          action: 'product_description',
          product_name: form.name.trim(),
          category: catName(form.category_id) || undefined,
        },
      });
      if (error || !data?.success) {
        toast('error', t('products.ai.err', { message: data?.message ?? error?.message ?? '' }));
        return;
      }
      setForm({ ...form, description: data.text });
    } catch (e: unknown) {
      toast('error', t('products.ai.err', { message: errMsg(e) }));
    } finally {
      setAiGenerating(false);
    }
  };

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
    setForm({ name: p.name, sku: p.sku ?? '', barcode: p.barcode ?? '', description: p.description ?? '', cost_price: Number(p.cost_price), sale_price: Number(p.sale_price), tax_rate: Number(p.tax_rate), unit: p.unit, low_stock_threshold: p.low_stock_threshold, category_id: p.category_id ?? '', image_url: p.image_url ?? '', sizes: variantsToSizesText(p.variants), tracking_mode: p.tracking_mode ?? 'none' });
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
      tracking_mode: form.tracking_mode,
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

  // --- CSV import (migration tool) -----------------------------------
  const openImport = () => {
    setImportHeaders([]);
    setImportRows([]);
    setImportFilename('');
    setImportMapping({} as Record<ImportField, string>);
    setImportModalOpen(true);
  };

  const handleImportFile = async (file: File) => {
    try {
      const { headers, rows } = await parseCSV(file);
      setImportHeaders(headers);
      setImportRows(rows);
      setImportFilename(file.name);
      setImportMapping(guessMapping(headers));
    } catch (e: unknown) {
      toast('error', t('products.import.toastError', { message: errMsg(e) }));
    }
  };

  // Cell reader honoring the current column mapping — '' means "field not
  // mapped to any column", not "column exists but is blank".
  const mappedCell = (row: Record<string, string>, field: ImportField): string => {
    const col = importMapping[field];
    if (!col) return '';
    return (row[col] ?? '').trim();
  };

  const previewMapped = useMemo(() => {
    return importRows.map((row) => ({
      name: mappedCell(row, 'name'),
      sku: mappedCell(row, 'sku'),
      barcode: mappedCell(row, 'barcode'),
      category: mappedCell(row, 'category'),
      costPrice: mappedCell(row, 'costPrice'),
      salePrice: mappedCell(row, 'salePrice'),
      taxRate: mappedCell(row, 'taxRate'),
      unit: mappedCell(row, 'unit'),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importRows, importMapping]);

  const newCategoryNames = useMemo(() => {
    const existing = new Set(categories.map((c) => c.name.trim().toLowerCase()));
    const seen = new Set<string>();
    return previewMapped
      .map((r) => r.category)
      .filter((name) => name && !existing.has(name.trim().toLowerCase()))
      .filter((name) => {
        const key = name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [previewMapped, categories]);

  const parseNum = (s: string): number => {
    const n = Number(String(s).replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const confirmImport = async () => {
    if (!tenant) return;
    setImporting(true);
    try {
      // 1) Create any categories the CSV references that don't exist yet,
      // so rows can be linked to a real category_id in one pass.
      const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));
      if (newCategoryNames.length > 0) {
        const { data: createdCats, error: catError } = await supabase
          .from('categories')
          .insert(newCategoryNames.map((name) => ({ tenant_id: tenant.id, name, color: randomColor() })))
          .select();
        if (catError) throw catError;
        for (const c of createdCats ?? []) catByName.set(c.name.trim().toLowerCase(), c.id);
      }

      // 2) Build insertable product rows, skipping any without a name
      // (the one truly required field) rather than failing the whole
      // import over a handful of bad rows.
      const skippedRows: number[] = [];
      const toInsert = previewMapped
        .map((r, idx) => ({ r, idx }))
        .filter(({ r, idx }) => {
          if (!r.name) { skippedRows.push(idx + 1); return false; }
          return true;
        })
        .map(({ r }) => ({
          tenant_id: tenant.id,
          category_id: r.category ? (catByName.get(r.category.trim().toLowerCase()) ?? null) : null,
          name: r.name,
          sku: r.sku || null,
          barcode: r.barcode || null,
          description: null,
          cost_price: r.costPrice ? parseNum(r.costPrice) : 0,
          sale_price: r.salePrice ? parseNum(r.salePrice) : 0,
          tax_rate: r.taxRate ? parseNum(r.taxRate) : 0,
          unit: r.unit || 'unité',
          low_stock_threshold: 5,
          image_url: null,
          variants: [],
          is_active: true,
          tracking_mode: 'none',
        }));

      if (toInsert.length === 0) {
        toast('error', t('products.import.toastError', { message: t('products.import.errorNoName', { row: 1 }) }));
        setImporting(false);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert(toInsert)
        .select('id');
      if (insertError) throw insertError;

      // 3) Same as manual product creation: seed a zero-quantity inventory
      // row per store for every newly imported product.
      if (inserted && inserted.length > 0) {
        const { data: stores } = await supabase.from('stores').select('id').eq('tenant_id', tenant.id);
        if (stores && stores.length > 0) {
          const invRows = inserted.flatMap((p) => stores.map((s) => ({ tenant_id: tenant.id, product_id: p.id, store_id: s.id, quantity: 0 })));
          await supabase.from('inventory').insert(invRows);
        }
      }

      if (skippedRows.length > 0) {
        toast('error', t('products.import.toastPartial', { imported: toInsert.length, skipped: skippedRows.length }));
      } else {
        toast('success', t('products.import.toastSuccess', { count: toInsert.length }));
      }
      await reloadCategories();
      await reload();
      setImportModalOpen(false);
    } catch (e: unknown) {
      toast('error', t('products.import.toastError', { message: errMsg(e) }));
    } finally {
      setImporting(false);
    }
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
            {canCreate && <button onClick={openImport} className="btn-ghost">
              <Upload size={16} /> {t('common.import')}
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
                  {canUpdate && <button onClick={() => openEdit(p)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={15} /></button>}
                  {canDelete && <button onClick={() => remove(p)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>}
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
                  <button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="rounded-full p-1.5 text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600" title={t('common.remove')}>
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
          <Field label={t('products.field.tracking')} hint={t('products.field.trackingHint')}>
            <select value={form.tracking_mode} onChange={(e) => setForm({ ...form, tracking_mode: e.target.value })} className="input">
              <option value="none">{t('products.tracking.none')}</option>
              <option value="serial">{t('products.tracking.serial')}</option>
              <option value="batch">{t('products.tracking.lot')}</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('products.field.sizes')}>
              <input value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} className="input" placeholder={t('products.field.sizesPlaceholder')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <label className="label !mb-0">{t('products.field.description')}</label>
              {aiConnectionId && (
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={aiGenerating || !form.name.trim()}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-flow-600 hover:text-flow-700 disabled:opacity-40"
                >
                  <Sparkles size={13} /> {aiGenerating ? t('products.ai.generating') : t('products.ai.generate')}
                </button>
              )}
            </div>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[70px]" />
            {!aiConnectionId && (
              <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
                {t('products.ai.notConnected')} <Link to="/marketplace" className="underline hover:text-brand-600">{t('products.ai.connectLink')}</Link>
              </p>
            )}
          </div>
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
                      <button onClick={() => { setEditingCategoryId(c.id); setEditingCategoryName(c.name); }} className="rounded-full p-1.5 text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={13} /></button>
                      <button onClick={() => deleteCategory(c)} className="rounded-full p-1.5 text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={13} /></button>
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

      {/* Migration tool: CSV import wizard — file → column mapping →
          preview → confirm. Never inserts anything before the person has
          seen and confirmed the mapped preview. */}
      <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)} title={t('products.import.title')}>
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-5">{t('products.import.intro')}</p>

        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-ink-900 dark:text-ink-50">{t('products.import.step1')}</p>
          <label className="btn-ghost inline-flex cursor-pointer w-fit">
            <Upload size={16} /> {t('products.import.chooseFile')}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }}
            />
          </label>
          {importFilename && (
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              {t('products.import.fileSelected', { filename: importFilename, count: importRows.length })}
            </p>
          )}
        </div>

        {importHeaders.length > 0 && (
          <>
            <div className="mb-6">
              <p className="mb-1 text-sm font-medium text-ink-900 dark:text-ink-50">{t('products.import.step2')}</p>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">{t('products.import.mapHint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {IMPORT_FIELDS.map((field) => (
                  <Field key={field} label={`${t(`products.import.field.${field}`)}${field === 'name' ? ` (${t('products.import.required')})` : ''}`}>
                    <select
                      value={importMapping[field] ?? ''}
                      onChange={(e) => setImportMapping((m) => ({ ...m, [field]: e.target.value }))}
                      className="input"
                    >
                      <option value="">{t('products.import.notMapped')}</option>
                      {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-sm font-medium text-ink-900 dark:text-ink-50">
                {t('products.import.step3', { count: previewMapped.length })}
              </p>
              <div className="max-h-56 overflow-auto rounded-lg border border-ink-200 dark:border-ink-700">
                <table className="w-full text-xs">
                  <thead className="bg-ink-50 dark:bg-ink-800 sticky top-0">
                    <tr>
                      {IMPORT_FIELDS.map((f) => (
                        <th key={f} className="px-2.5 py-2 text-left font-semibold text-ink-600 dark:text-ink-300 whitespace-nowrap">
                          {t(`products.import.field.${f}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewMapped.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t border-ink-100 dark:border-ink-800">
                        {IMPORT_FIELDS.map((f) => (
                          <td key={f} className="px-2.5 py-1.5 text-ink-700 dark:text-ink-200 whitespace-nowrap">
                            {r[f === 'costPrice' ? 'costPrice' : f === 'salePrice' ? 'salePrice' : f === 'taxRate' ? 'taxRate' : f] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewMapped.length > 8 && (
                <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
                  {t('products.import.previewMore', { count: previewMapped.length - 8 })}
                </p>
              )}
              {newCategoryNames.length > 0 && (
                <p className="mt-2 text-xs text-flow-600 dark:text-flow-300">
                  {t('products.import.newCategoriesNote', { count: newCategoryNames.length, names: newCategoryNames.join(', ') })}
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={() => setImportModalOpen(false)} className="btn-ghost">{t('products.import.cancel')}</button>
          <button
            onClick={confirmImport}
            disabled={importRows.length === 0 || importing || !importMapping.name}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {importing ? t('products.import.importing') : t('products.import.confirm', { count: previewMapped.filter((r) => r.name).length })}
          </button>
        </div>
      </Modal>
    </div>
  );
}
