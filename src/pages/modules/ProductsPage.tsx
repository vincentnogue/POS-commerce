import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Download } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Product, Category } from '../../lib/types';

const EMPTY = { name: '', sku: '', barcode: '', description: '', cost_price: 0, sale_price: 0, tax_rate: 0, unit: 'unité', low_stock_threshold: 5, category_id: '' };

export function ProductsPage() {
  const { tenant, can } = useAuth();
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
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      const { data } = await supabase.from('products').insert(payload).select().single();
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
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
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
        title="Produits"
        subtitle={`${products.length} produit(s) au catalogue`}
        action={
          <div className="flex gap-2">
            {canSeeCost && <button onClick={() => exportCSV('produits.csv', filtered.map((p) => ({ name: p.name, sku: p.sku, prix_achat: p.cost_price, prix_vente: p.sale_price, categorie: catName(p.category_id) })))} className="btn-ghost">
              <Download size={16} /> Export
            </button>}
            {canCreate && <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nouveau produit</button>}
          </div>
        }
      />

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input max-w-xs">
            <option value="">Toutes catégories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Package} title="Aucun produit" description="Ajoutez votre premier produit au catalogue." action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> Ajouter</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'name', label: 'Nom', render: (p: Product) => (
                <div>
                  <p className="font-semibold text-ink-900 dark:text-ink-50">{p.name}</p>
                  {p.sku && <p className="text-xs text-ink-500 dark:text-ink-400">SKU: {p.sku}</p>}
                </div>
              )},
              { key: 'category', label: 'Catégorie', render: (p: Product) => <span className="text-ink-600 dark:text-ink-300">{catName(p.category_id)}</span> },
              { key: 'cost', label: 'Prix achat', className: 'text-right', render: (p: Product) => canSeeCost ? <span className="text-ink-600 dark:text-ink-300">{formatMoney(p.cost_price, currency)}</span> : <span className="text-ink-300">—</span> },
              { key: 'sale', label: 'Prix vente', className: 'text-right', render: (p: Product) => <span className="font-semibold text-ink-900 dark:text-ink-50">{formatMoney(p.sale_price, currency)}</span> },
              { key: 'stock', label: 'Stock min', className: 'text-right', render: (p: Product) => <span className="text-ink-600 dark:text-ink-300">{p.low_stock_threshold}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (p: Product) => (
                <div className="flex justify-end gap-2">
                  {canUpdate && <button onClick={() => openEdit(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 hover:text-brand-600"><Pencil size={15} /></button>}
                  {canDelete && <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>}
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le produit' : 'Nouveau produit'} maxWidth="max-w-xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nom du produit"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field></div>
          <Field label="SKU"><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input" /></Field>
          <Field label="Code-barres"><input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input" /></Field>
          <Field label="Catégorie">
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="input">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Unité"><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="input" /></Field>
          <Field label="Prix d'achat">{canSeeCost ? <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} className="input" /> : <p className="text-xs text-ink-400 dark:text-ink-500">Non disponible pour votre rôle.</p>}</Field>
          <Field label="Prix de vente"><input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} className="input" /></Field>
          <Field label="TVA (%)"><input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="input" /></Field>
          <Field label="Seuil stock bas"><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="input" /></Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[70px]" /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </Modal>
    </div>
  );
}
