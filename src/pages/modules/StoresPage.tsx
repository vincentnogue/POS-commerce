import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Store as StoreIcon, MapPin, Phone, Navigation, Users } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Store, Member, StoreAssignment } from '../../lib/types';

const EMPTY = { name: '', city: '', address: '', phone: '', latitude: '', longitude: '' };

export function StoresPage() {
  const { tenant, can } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<StoreAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [assignModalStore, setAssignModalStore] = useState<Store | null>(null);
  const [assignSelections, setAssignSelections] = useState<Record<string, { assigned: boolean; canTransfer: boolean }>>({});

  const canCreate = can('stores', 'create');
  const canUpdate = can('stores', 'update');
  const canDelete = can('stores', 'delete');

  const reload = async () => {
    if (!tenant) return;
    const [s, m, a] = await Promise.all([
      supabase.from('stores').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('tenant_members').select('*').eq('tenant_id', tenant.id),
      supabase.from('store_assignments').select('*, member:tenant_members(*)').eq('tenant_id', tenant.id),
    ]);
    setStores((s.data as Store[]) ?? []);
    setMembers((m.data as Member[]) ?? []);
    setAssignments((a.data as StoreAssignment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [tenant]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (s: Store) => {
    setEditing(s);
    setForm({
      name: s.name,
      city: s.city ?? '',
      address: s.address ?? '',
      phone: s.phone ?? '',
      latitude: s.latitude ?? '',
      longitude: s.longitude ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const payload: any = {
      tenant_id: tenant.id,
      name: form.name.trim(),
      city: form.city || null,
      address: form.address || null,
      phone: form.phone || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
    };
    if (editing) {
      if (canUpdate) await supabase.from('stores').update(payload).eq('id', editing.id);
    } else {
      if (canCreate) await supabase.from('stores').insert(payload);
    }
    setModalOpen(false);
    await reload();
  };

  const remove = async (s: Store) => {
    if (!canDelete) return;
    if (!confirm(`Supprimer "${s.name}" ?`)) return;
    await supabase.from('stores').delete().eq('id', s.id);
    await reload();
  };

  const openAssignments = (s: Store) => {
    setAssignModalStore(s);
    const sel: Record<string, { assigned: boolean; canTransfer: boolean }> = {};
    members.forEach((m) => {
      const a = assignments.find((x) => x.store_id === s.id && x.member_id === m.id);
      sel[m.id] = { assigned: !!a, canTransfer: a?.can_transfer ?? false };
    });
    setAssignSelections(sel);
  };

  const saveAssignments = async () => {
    if (!assignModalStore || !tenant) return;
    // Remove all existing assignments for this store, then re-insert selected
    await supabase.from('store_assignments').delete().eq('store_id', assignModalStore.id).eq('tenant_id', tenant.id);
    const toInsert = Object.entries(assignSelections)
      .filter(([, v]) => v.assigned)
      .map(([memberId, v]) => ({ tenant_id: tenant.id, member_id: memberId, store_id: assignModalStore.id, can_transfer: v.canTransfer }));
    if (toInsert.length > 0) await supabase.from('store_assignments').insert(toInsert);
    setAssignModalStore(null);
    await reload();
  };

  const memberName = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m?.display_name ?? 'Membre';
  };

  return (
    <div>
      <PageHeader
        title="Magasins"
        subtitle={`${stores.length} point(s) de vente`}
        action={canCreate ? <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nouveau magasin</button> : undefined}
      />

      {stores.length === 0 && !loading ? (
        <EmptyState icon={StoreIcon} title="Aucun magasin" description="Créez votre premier point de vente." action={canCreate ? <button onClick={openNew} className="btn-primary"><Plus size={15} /> Ajouter</button> : undefined} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => {
            const storeAssigns = assignments.filter((a) => a.store_id === s.id);
            return (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <StoreIcon size={20} />
                  </div>
                  <Badge tone={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Actif' : 'Inactif'}</Badge>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-ink-900">{s.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-ink-500">
                  {s.address && <p className="flex items-start gap-1.5"><MapPin size={14} className="mt-0.5 shrink-0" /> {s.address}</p>}
                  {s.city && <p className="pl-5">{s.city}</p>}
                  {s.phone && <p className="flex items-center gap-1.5"><Phone size={14} /> {s.phone}</p>}
                  {s.latitude != null && s.longitude != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=16/${s.latitude}/${s.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"
                    >
                      <Navigation size={14} /> {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                    </a>
                  )}
                </div>
                {storeAssigns.length > 0 && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-600"><Users size={12} /> Assignés ({storeAssigns.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {storeAssigns.map((a) => (
                        <span key={a.id} className={`rounded-md px-2 py-0.5 text-[10px] ${a.can_transfer ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-600'}`} title={a.can_transfer ? 'Peut transférer' : 'Lecture seule'}>
                          {memberName(a.member_id)}{a.can_transfer ? ' ⌀' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  {canUpdate && <button onClick={() => openEdit(s)} className="btn-ghost flex-1 justify-center text-xs"><Pencil size={13} /> Modifier</button>}
                  {canUpdate && <button onClick={() => openAssignments(s)} className="btn-ghost flex-1 justify-center text-xs border-brand-200 text-brand-700"><Users size={13} /> Assigner</button>}
                  {canDelete && <button onClick={() => remove(s)} className="rounded-full border border-ink-200 p-2 text-ink-500 hover:border-error-200 hover:text-error-600"><Trash2 size={14} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le magasin' : 'Nouveau magasin'}>
        <div className="space-y-4">
          <Field label="Nom du magasin"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Ex: Boutique Centre-Ville" /></Field>
          <Field label="Adresse"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ville"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
            <Field label="Téléphone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude (GPS)"><input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="input" placeholder="Ex: 3.8677" /></Field>
            <Field label="Longitude (GPS)"><input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="input" placeholder="Ex: 11.5184" /></Field>
          </div>
          <p className="text-xs text-ink-400">Astuce : récupérez les coordonnées depuis Google Maps (clic droit) ou OpenStreetMap.</p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </Modal>

      {/* Assignment modal */}
      <Modal open={!!assignModalStore} onClose={() => setAssignModalStore(null)} title={`Assigner — ${assignModalStore?.name ?? ''}`} maxWidth="max-w-lg">
        <div className="space-y-2">
          <p className="mb-2 text-sm text-ink-600">Assignez des membres à ce magasin. Seuls les membres assignés avec « Transfert » peuvent initier ou recevoir des transferts de stock pour ce magasin.</p>
          {members.filter((m) => m.role !== 'super_admin' && m.role !== 'admin').length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">Aucun membre staff à assigner. Invitez d'abord des vendeurs.</p>
          ) : (
            members.filter((m) => m.role !== 'super_admin' && m.role !== 'admin').map((m) => {
              const sel = assignSelections[m.id] ?? { assigned: false, canTransfer: false };
              return (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-action-500 text-xs font-bold text-white">{(m.display_name ?? '?').slice(0, 2).toUpperCase()}</div>
                    <span className="text-sm font-medium text-ink-900">{m.display_name ?? 'Membre'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-ink-600">
                      <input type="checkbox" checked={sel.assigned} onChange={(e) => setAssignSelections({ ...assignSelections, [m.id]: { ...sel, assigned: e.target.checked }})} className="rounded border-ink-300" /> Assigné
                    </label>
                    {sel.assigned && (
                      <label className="flex items-center gap-1.5 text-xs text-brand-700">
                        <input type="checkbox" checked={sel.canTransfer} onChange={(e) => setAssignSelections({ ...assignSelections, [m.id]: { ...sel, canTransfer: e.target.checked }})} className="rounded border-ink-300" /> Transfert
                      </label>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setAssignModalStore(null)} className="btn-ghost">Annuler</button>
          <button onClick={saveAssignments} className="btn-primary">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}
