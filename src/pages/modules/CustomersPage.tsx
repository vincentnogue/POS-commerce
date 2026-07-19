import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Users, Download, Mail, Phone } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Customer } from '../../lib/types';

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', tax_id: '', notes: '' };

export function CustomersPage() {
  const { tenant } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    setCustomers((data as Customer[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [customers, search]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', city: c.city ?? '', tax_id: c.tax_id ?? '', notes: c.notes ?? '' }); setModalOpen(true); };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const payload = { tenant_id: tenant.id, name: form.name.trim(), email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, tax_id: form.tax_id || null, notes: form.notes || null };
    if (editing) await supabase.from('customers').update(payload).eq('id', editing.id);
    else await supabase.from('customers').insert(payload);
    setModalOpen(false);
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    setCustomers((data as Customer[]) ?? []);
  };

  const remove = async (c: Customer) => {
    if (!confirm(`Supprimer "${c.name}" ?`)) return;
    await supabase.from('customers').delete().eq('id', c.id);
    setCustomers((list) => list.filter((x) => x.id !== c.id));
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${customers.length} client(s)`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('clients.csv', filtered.map((c) => ({ nom: c.name, email: c.email, telephone: c.phone, ville: c.city, solde: c.balance })))} className="btn-ghost"><Download size={16} /> Export</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nouveau client</button>
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client." action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> Ajouter</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'name', label: 'Nom', render: (c) => (
                <div>
                  <p className="font-semibold text-ink-900">{c.name}</p>
                  {c.email && <p className="flex items-center gap-1 text-xs text-ink-500"><Mail size={11} /> {c.email}</p>}
                </div>
              )},
              { key: 'phone', label: 'Téléphone', render: (c) => c.phone ? <span className="flex items-center gap-1 text-ink-600"><Phone size={12} /> {c.phone}</span> : <span className="text-ink-400">—</span> },
              { key: 'city', label: 'Ville', render: (c) => <span className="text-ink-600">{c.city ?? '—'}</span> },
              { key: 'balance', label: 'Solde', className: 'text-right', render: (c) => <span className={Number(c.balance) < 0 ? 'font-semibold text-error-600' : 'text-ink-900'}>{formatMoney(c.balance, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (c) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-ink-500 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le client' : 'Nouveau client'} maxWidth="max-w-lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nom"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field></div>
          <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
          <Field label="Téléphone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
          <Field label="N° fiscal"><input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} className="input" /></Field>
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
