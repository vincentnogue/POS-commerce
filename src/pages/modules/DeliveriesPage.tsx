import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Truck, Eye, Package } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Delivery } from '../../lib/types';

const STATUS_LABELS: Record<string, { label: string; tone: any }> = {
  pending: { label: 'En attente', tone: 'warning' },
  partially_delivered: { label: 'Partielle', tone: 'brand' },
  shipped: { label: 'Expédiée', tone: 'brand' },
  delivered: { label: 'Livrée', tone: 'success' },
  cancelled: { label: 'Annulée', tone: 'error' },
};

export function DeliveriesPage() {
  const { tenant } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [deliveries, setDeliveries] = useState<(Delivery & { sale_items?: any[] })[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('today') === '1' ? 'pending' : '');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState<Delivery | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ customer_name: '', address: '', city: '', phone: '', carrier: '', scheduled_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => { reload(); }, [tenant]);

  const reload = async () => {
    if (!tenant) return;
    const { data } = await supabase.from('deliveries').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setDeliveries((data as any[]) ?? []);
    setLoading(false);
  };

  const filtered = useMemo(() => deliveries.filter((d) => {
    const q = search.toLowerCase().trim();
    const today = new Date();
    const isToday = d.scheduled_date && new Date(d.scheduled_date).toDateString() === today.toDateString();
    if (params.get('today') === '1' && !isToday) return false;
    return (!q || d.customer_name.toLowerCase().includes(q) || d.tracking_number?.toLowerCase().includes(q)) && (!statusFilter || d.status === statusFilter);
  }), [deliveries, search, statusFilter, params]);

  const save = async () => {
    if (!tenant || !form.customer_name.trim()) return;
    const { error } = await supabase.from('deliveries').insert({
      tenant_id: tenant.id,
      customer_name: form.customer_name.trim(),
      address: form.address || null,
      city: form.city || null,
      phone: form.phone || null,
      carrier: form.carrier || null,
      scheduled_date: form.scheduled_date || null,
      status: 'pending',
    });
    if (error) { toast('error', error.message); return; }
    setModalOpen(false);
    setForm({ customer_name: '', address: '', city: '', phone: '', carrier: '', scheduled_date: new Date().toISOString().slice(0, 10) });
    await reload();
    toast('success', 'Livraison créée.');
  };

  const updateStatus = async (d: Delivery, status: string) => {
    const patch: any = { status };
    if (status === 'delivered') patch.delivered_at = new Date().toISOString();
    const { error } = await supabase.from('deliveries').update(patch).eq('id', d.id);
    if (error) { toast('error', error.message); return; }
    await reload();
  };

  const openDetail = async (d: Delivery) => {
    setDetailOpen(d);
    const { data } = await supabase.from('delivery_items').select('*').eq('delivery_id', d.id);
    setDetailItems(data ?? []);
  };

  const updateItemDelivered = async (itemId: string, qty: number) => {
    const { error } = await supabase.from('delivery_items').update({ quantity_delivered: qty }).eq('id', itemId);
    if (error) { toast('error', error.message); return; }
    // Recompute delivery status
    if (detailOpen) {
      const updated = detailItems.map((it) => it.id === itemId ? { ...it, quantity_delivered: qty } : it);
      setDetailItems(updated);
      const allDelivered = updated.every((it) => Number(it.quantity_delivered) >= Number(it.quantity_ordered));
      const noneDelivered = updated.every((it) => Number(it.quantity_delivered) === 0);
      const newStatus = allDelivered ? 'delivered' : noneDelivered ? 'pending' : 'partially_delivered';
      if (newStatus !== detailOpen.status) {
        await updateStatus(detailOpen, newStatus);
        setDetailOpen({ ...detailOpen, status: newStatus });
      }
    }
  };

  const completeDelivery = async () => {
    if (!detailOpen) return;
    // Mark all remaining items as delivered
    for (const it of detailItems) {
      if (Number(it.quantity_delivered) < Number(it.quantity_ordered)) {
        const { error } = await supabase.from('delivery_items').update({ quantity_delivered: it.quantity_ordered }).eq('id', it.id);
        if (error) { toast('error', error.message); return; }
      }
    }
    await updateStatus(detailOpen, 'delivered');
    setDetailOpen(null);
    await reload();
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
              { key: 'customer', label: 'Client', render: (d) => <div><span className="font-semibold text-ink-900 dark:text-ink-50">{d.customer_name}</span>{d.sale_id && <p className="text-[10px] text-brand-600">Vente liée</p>}</div> },
              { key: 'city', label: 'Ville', render: (d) => <span className="text-ink-600 dark:text-ink-300">{d.city ?? '—'}</span> },
              { key: 'date', label: 'Date prévue', render: (d) => <span className="text-ink-500 dark:text-ink-400">{d.scheduled_date ? new Date(d.scheduled_date).toLocaleDateString('fr-FR') : '—'}</span> },
              { key: 'carrier', label: 'Transporteur', render: (d) => <span className="text-ink-600 dark:text-ink-300">{d.carrier ?? '—'}</span> },
              { key: 'status', label: 'Statut', render: (d) => <Badge tone={STATUS_LABELS[d.status]?.tone}>{STATUS_LABELS[d.status]?.label ?? d.status}</Badge> },
              { key: 'actions', label: '', className: 'text-right', render: (d) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => openDetail(d)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Eye size={15} /></button>
                  <select value={d.status} onChange={(e) => updateStatus(d, e.target.value)} className="input max-w-[140px]">
                    {Object.entries(STATUS_LABELS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                  </select>
                </div>
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

      {/* Detail modal — partial delivery tracking */}
      <Modal open={!!detailOpen} onClose={() => setDetailOpen(null)} title={`Livraison — ${detailOpen?.customer_name ?? ''}`} maxWidth="max-w-2xl">
        {detailOpen && (
          <div>
            {detailItems.length === 0 ? (
              <div className="py-6 text-center">
                <Package className="mx-auto mb-2 text-ink-300" size={32} />
                <p className="text-sm text-ink-500 dark:text-ink-400">Livraison sans détails produit (saisie manuelle).</p>
                <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">Statut actuel : <Badge tone={STATUS_LABELS[detailOpen.status]?.tone}>{STATUS_LABELS[detailOpen.status]?.label}</Badge></p>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                    <th className="pb-2">Produit</th><th className="pb-2 text-right">Commandé</th><th className="pb-2 text-right">Livré</th><th className="pb-2 text-right">Reste</th>
                  </tr></thead>
                  <tbody>
                    {detailItems.map((it) => {
                      const reste = Number(it.quantity_ordered) - Number(it.quantity_delivered);
                      return (
                        <tr key={it.id} className="border-b border-ink-50 dark:border-ink-800">
                          <td className="py-2 font-medium text-ink-900 dark:text-ink-50">{it.product_name}</td>
                          <td className="py-2 text-right text-ink-600 dark:text-ink-300">{it.quantity_ordered}</td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={Number(it.quantity_ordered)}
                              value={it.quantity_delivered}
                              onChange={(e) => updateItemDelivered(it.id, Number(e.target.value))}
                              className="input w-20 py-1 text-right"
                            />
                          </td>
                          <td className={`py-2 text-right font-semibold ${reste > 0 ? 'text-warning-600' : 'text-success-600'}`}>{reste}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center justify-between">
                  <Badge tone={STATUS_LABELS[detailOpen.status]?.tone}>{STATUS_LABELS[detailOpen.status]?.label ?? detailOpen.status}</Badge>
                  {detailOpen.status !== 'delivered' && detailOpen.status !== 'cancelled' && (
                    <button onClick={completeDelivery} className="btn-primary text-sm"><Package size={15} /> Tout livrer</button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
