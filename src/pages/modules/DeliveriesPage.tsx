import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Truck } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Delivery } from '../../lib/types';

const STATUS_LABELS: Record<string, { label: string; tone: any }> = {
  pending: { label: 'En attente', tone: 'warning' },
  shipped: { label: 'Expédiée', tone: 'brand' },
  delivered: { label: 'Livrée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'error' },
};

export function DeliveriesPage() {
  const { tenant } = useAuth();
  const [params] = useSearchParams();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('today') === '1' ? 'pending' : '');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ customer_name: '', address: '', city: '', phone: '', carrier: '', scheduled_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => { (async () => {
    if (!tenant) return;
    const { data } = await supabase.from('deliveries').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setDeliveries((data as Delivery[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => deliveries.filter((d) => {
    const q = search.toLowerCase().trim();
    const today = new Date();
    const isToday = d.scheduled_date && new Date(d.scheduled_date).toDateString() === today.toDateString();
    if (params.get('today') === '1' && !isToday) return false;
    return (!q || d.customer_name.toLowerCase().includes(q) || d.tracking_number?.toLowerCase().includes(q)) && (!statusFilter || d.status === statusFilter);
  }), [deliveries, search, statusFilter, params]);

  const save = async () => {
    if (!tenant || !form.customer_name.trim()) return;
    await supabase.from('deliveries').insert({
      tenant_id: tenant.id,
      customer_name: form.customer_name.trim(),
      address: form.address || null,
      city: form.city || null,
      phone: form.phone || null,
      carrier: form.carrier || null,
      scheduled_date: form.scheduled_date || null,
      status: 'pending',
    });
    setModalOpen(false);
    setForm({ customer_name: '', address: '', city: '', phone: '', carrier: '', scheduled_date: new Date().toISOString().slice(0, 10) });
    const { data } = await supabase.from('deliveries').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setDeliveries((data as Delivery[]) ?? []);
  };

  const updateStatus = async (d: Delivery, status: string) => {
    const patch: any = { status };
    if (status === 'delivered') patch.delivered_at = new Date().toISOString();
    await supabase.from('deliveries').update(patch).eq('id', d.id);
    setDeliveries((list) => list.map((x) => x.id === d.id ? { ...x, ...patch } : x));
  };

  return (
    <div>
      <PageHeader
        title="Livraisons"
        subtitle={`${deliveries.length} livraison(s)`}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('livraisons.csv', filtered.map((d) => ({ client: d.customer_name, ville: d.city, statut: d.status, date: d.scheduled_date, transporteur: d.carrier })))} className="btn-ghost"><Download size={16} /> Export</button>
            <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> Nouvelle livraison</button>
          </div>
        }
      />

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Tous statuts" options={Object.entries(STATUS_LABELS).map(([v, s]) => ({ value: v, label: s.label }))} />
        </div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Truck} title="Aucune livraison" description="Planifiez votre première livraison." action={<button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={15} /> Créer</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'customer', label: 'Client', render: (d) => <div><span className="font-semibold text-ink-900">{d.customer_name}</span>{d.sale_id && <p className="text-[10px] text-brand-600">Vente liée</p>}</div> },
              { key: 'city', label: 'Ville', render: (d) => <span className="text-ink-600">{d.city ?? '—'}</span> },
              { key: 'date', label: 'Date prévue', render: (d) => <span className="text-ink-500">{d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString('fr-FR') : '—'}</span> },
              { key: 'carrier', label: 'Transporteur', render: (d) => <span className="text-ink-600">{d.carrier ?? '—'}</span> },
              { key: 'status', label: 'Statut', render: (d) => <Badge tone={STATUS_LABELS[d.status]?.tone}>{STATUS_LABELS[d.status]?.label ?? d.status}</Badge> },
              { key: 'actions', label: '', className: 'text-right', render: (d) => (
                <select value={d.status} onChange={(e) => updateStatus(d, e.target.value)} className="input max-w-[140px]">
                  {Object.entries(STATUS_LABELS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                </select>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle livraison">
        <div className="space-y-4">
          <Field label="Client"><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input" /></Field>
          <Field label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
            <Field label="Téléphone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Transporteur"><input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="input" placeholder="Ex: DHL, GSP…" /></Field>
            <Field label="Date prévue"><input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="input" /></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">Créer</button>
        </div>
      </Modal>
    </div>
  );
}
