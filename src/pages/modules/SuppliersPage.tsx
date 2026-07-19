import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Building2, Download, Mail, Phone } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Supplier } from '../../lib/types';

const EMPTY = { name: '', contact_name: '', email: '', phone: '', address: '', city: '', tax_id: '', notes: '' };

export function SuppliersPage() {
  const { tenant } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const { data } = await supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name');
    setSuppliers((data as Supplier[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return suppliers.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.phone?.includes(q));
  }, [suppliers, search]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ name: s.name, contact_name: s.contact_name ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', city: s.city ?? '', tax_id: s.tax_id ?? '', notes: s.notes ?? '' }); setModalOpen(true); };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const payload = { tenant_id: tenant.id, name: form.name.trim(), contact_name: form.contact_name || null, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, tax_id: form.tax_id || null, notes: form.notes || null };
    if (editing) await supabase.from('suppliers').update(payload).eq('id', editing.id);
    else await supabase.from('suppliers').insert(payload);
    setModalOpen(false);
    const { data } = await supabase.from('suppliers').select('*').eq('tenant_id', tenant.id).order('name');
    setSuppliers((data as Supplier[]) ?? []);
  };

  const remove = async (s: Supplier) => {
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    await supabase.from('suppliers').delete().eq('id', s.id);
    setSuppliers((list) => list.filter((x) => x.id !== s.id));
  };

  return (
    <div>
      <PageHeader
        title="Fournisseurs"
        subtitle={`${suppliers.length} fournisseur(s)`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('fournisseurs.csv', filtered.map((s) => ({ nom: s.name, contact: s.contact_name, email: s.email, telephone: s.phone, ville: s.city })))} className="btn-ghost"><Download size={16} /> Export</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nouveau fournisseur</button>
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Building2} title="Aucun fournisseur" description="Ajoutez votre premier fournisseur." action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> Ajouter</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'name', label: 'Nom', render: (s) => (
                <div>
                  <p className="font-semibold text-ink-900">{s.name}</p>
                  {s.contact_name && <p className="text-xs text-ink-500">Contact: {s.contact_name}</p>}
                </div>
              )},
              { key: 'email', label: 'Email', render: (s) => s.email ? <span className="flex items-center gap-1 text-ink-600"><Mail size={12} /> {s.email}</span> : <span className="text-ink-400">—</span> },
              { key: 'phone', label: 'Téléphone', render: (s) => s.phone ? <span className="flex items-center gap-1 text-ink-600"><Phone size={12} /> {s.phone}</span> : <span className="text-ink-400">—</span> },
              { key: 'city', label: 'Ville', render: (s) => <span className="text-ink-600">{s.city ?? '—'}</span> },
              { key: 'balance', label: 'Solde', className: 'text-right', render: (s) => <span className={Number(s.balance) > 0 ? 'font-semibold text-warning-600' : 'text-ink-900'}>{formatMoney(s.balance, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (s) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-ink-500 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>
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
          <div className="sm:col-span-2"><Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-[60px]" /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </Modal>
    </div>
  );
}
