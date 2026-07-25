import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Building2, Download, Mail, Phone, Package, X } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Supplier, Product } from '../../lib/types';

const EMPTY = { name: '', contact_name: '', email: '', phone: '', address: '', city: '', tax_id: '', notes: '' };

export function SuppliersPage() {
  const { tenant, can } = useAuth();
  const [suppliers, setSuppliers] = useState<(Supplier & { product_count?: number })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierProducts, setSupplierProducts] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [linkedProductIds, setLinkedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const canCreate = can('suppliers', 'create');
  const canUpdate = can('suppliers', 'update');
  const canDelete = can('suppliers', 'delete');

  const currency = tenant?.currency ?? 'XOF';

  const reload = async () => {
    if (!tenant) return;
    const [s, p, sp] = await Promise.all([
      supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('products_public').select('id, name').eq('tenant_id', tenant.id).order('name'),
      supabase.from('supplier_products').select('supplier_id, product_id').eq('tenant_id', tenant.id),
    ]);
    setSuppliers((s.data as Supplier[]) ?? []);
    setProducts((p.data as Product[]) ?? []);
    const map: Record<string, string[]> = {};
    (sp.data ?? []).forEach((r: any) => {
      if (!map[r.supplier_id]) map[r.supplier_id] = [];
      map[r.supplier_id].push(r.product_id);
    });
    setSupplierProducts(map);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [tenant]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return suppliers.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q));
  }, [suppliers, search]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setLinkedProductIds([]); setProductSearch(''); setModalOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, contact_name: s.contact_name ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', city: s.city ?? '', tax_id: s.tax_id ?? '', notes: s.notes ?? '' });
    setLinkedProductIds(supplierProducts[s.id] ?? []);
    setProductSearch('');
    setModalOpen(true);
  };

  const toggleProduct = (pid: string) => {
    setLinkedProductIds((ids) => ids.includes(pid) ? ids.filter((x) => x !== pid) : [...ids, pid]);
  };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const payload = { tenant_id: tenant.id, name: form.name.trim(), contact_name: form.contact_name || null, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, tax_id: form.tax_id || null, notes: form.notes || null };
    let supplierId: string;
    if (editing) {
      if (canUpdate) await supabase.from('suppliers').update(payload).eq('id', editing.id);
      supplierId = editing.id;
    } else {
      if (canCreate) {
        const { data } = await supabase.from('suppliers').insert(payload).select().single();
        supplierId = data?.id;
      } else {
        return;
      }
    }
    if (supplierId) {
      // Sync supplier_products: remove all, re-insert selected
      await supabase.from('supplier_products').delete().eq('supplier_id', supplierId);
      if (linkedProductIds.length > 0) {
        await supabase.from('supplier_products').insert(linkedProductIds.map((pid) => ({ tenant_id: tenant.id, supplier_id: supplierId, product_id: pid })));
      }
    }
    setModalOpen(false);
    await reload();
  };

  const remove = async (s: Supplier) => {
    if (!canDelete) return;
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    await supabase.from('suppliers').delete().eq('id', s.id);
    setSuppliers((list) => list.filter((x) => x.id !== s.id));
  };

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase().trim();
    return !q || p.name.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        subtitle={`${suppliers.length} fournisseur(s)`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('fournisseurs.csv', filtered.map((s) => ({ nom: s.name, contact: s.contact_name, email: s.email, telephone: s.phone, ville: s.city, produits: (supplierProducts[s.id] ?? []).length })))} className="btn-ghost"><Download size={16} /> Export</button>
            {canCreate && <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nouveau fournisseur</button>}
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Building2} title="Aucun fournisseur" description="Ajoutez votre premier fournisseur." action={canCreate ? <button onClick={openNew} className="btn-primary"><Plus size={15} /> Ajouter</button> : undefined} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'name', label: 'Nom', render: (s) => (
                <div>
                  <p className="font-semibold text-ink-900 dark:text-ink-50">{s.name}</p>
                  {s.contact_name && <p className="text-xs text-ink-500 dark:text-ink-400">Contact: {s.contact_name}</p>}
                  {(supplierProducts[s.id] ?? []).length > 0 && <p className="text-[10px] text-brand-600">{(supplierProducts[s.id] ?? []).length} produit(s) associé(s)</p>}
                </div>
              )},
              { key: 'email', label: 'Email', render: (s) => s.email ? <span className="flex items-center gap-1 text-ink-600 dark:text-ink-300"><Mail size={12} /> {s.email}</span> : <span className="text-ink-400 dark:text-ink-500">—</span> },
              { key: 'phone', label: 'Téléphone', render: (s) => s.phone ? <span className="flex items-center gap-1 text-ink-600 dark:text-ink-300"><Phone size={12} /> {s.phone}</span> : <span className="text-ink-400 dark:text-ink-500">—</span> },
              { key: 'city', label: 'Ville', render: (s) => <span className="text-ink-600 dark:text-ink-300">{s.city ?? '—'}</span> },
              { key: 'balance', label: 'Solde', className: 'text-right', render: (s) => <span className={Number(s.balance) > 0 ? 'font-semibold text-warning-600' : 'text-ink-900 dark:text-ink-50'}>{formatMoney(s.balance, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (s) => (
                <div className="flex justify-end gap-2">
                  {canUpdate && <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={15} /></button>}
                  {canDelete && <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>}
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'} maxWidth="max-w-lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nom"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field></div>
          <Field label="Contact"><input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="input" /></Field>
          <Field label="Téléphone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
          <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
          <div className="sm:col-span-2"><Field label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></Field></div>
        </div>
        {/* Product association */}
        <div className="mt-5 border-t border-ink-100 dark:border-ink-800 pt-4">
          <div className="mb-2 flex items-center gap-2">
            <Package size={15} className="text-brand-600" />
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">Produits livrés habituellement</p>
          </div>
          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="input mb-2" placeholder="Rechercher un produit…" />
          <div className="max-h-40 overflow-y-auto scroll-thin rounded-xl border border-ink-100 dark:border-ink-800">
            {filteredProducts.length === 0 ? (
              <p className="py-3 text-center text-xs text-ink-400 dark:text-ink-500">Aucun produit.</p>
            ) : filteredProducts.map((p) => {
              const selected = linkedProductIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggleProduct(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm transition ${selected ? 'bg-brand-50 dark:bg-brand-900/25 text-brand-700' : 'text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:bg-ink-900'}`}
                >
                  <span>{p.name}</span>
                  {selected && <X size={14} className="text-brand-400" />}
                </button>
              );
            })}
          </div>
          {linkedProductIds.length > 0 && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{linkedProductIds.length} produit(s) sélectionné(s)</p>}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </Modal>
    </div>
  );
}
