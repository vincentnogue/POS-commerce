import { useEffect, useState, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Users, Download, Mail, Phone, Gift, Award, Layers, X as XIcon } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, Badge, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Customer, LoyaltyTier, CustomerSegment } from '../../lib/types';

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', tax_id: '', notes: '', segment_id: '' };

type LoyaltyTx = { id: string; points_delta: number; reason: string; created_at: string };

export function CustomersPage() {
  const toast = useToast();
  const { t, formatDate } = useI18n();
  const { tenant, member } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null);
  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTx[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [tiersModalOpen, setTiersModalOpen] = useState(false);
  const [segmentsModalOpen, setSegmentsModalOpen] = useState(false);
  const [tierForm, setTierForm] = useState({ name: '', min_points: '0' });
  const [segmentForm, setSegmentForm] = useState({ name: '' });

  const isManager = member?.role === 'admin' || member?.role === 'super_admin' || member?.role === 'manager';
  const currency = tenant?.currency ?? 'XOF';

  const loadLookups = useCallback(async () => {
    if (!tenant) return;
    const [{ data: tierRows }, { data: segmentRows }] = await Promise.all([
      supabase.from('loyalty_tiers').select('*').eq('tenant_id', tenant.id).order('min_points', { ascending: true }),
      supabase.from('customer_segments').select('*').eq('tenant_id', tenant.id).order('name', { ascending: true }),
    ]);
    setTiers((tierRows as LoyaltyTier[]) ?? []);
    setSegments((segmentRows as CustomerSegment[]) ?? []);
  }, [tenant]);

  useEffect(() => { loadLookups(); }, [loadLookups]);

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
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', city: c.city ?? '', tax_id: c.tax_id ?? '', notes: c.notes ?? '', segment_id: c.segment_id ?? '' }); setModalOpen(true); };

  // D365-style loyalty ledger (see migration 0067): every earn/redeem is
  // logged in loyalty_transactions — surface it per customer so a cashier
  // or manager can see how a balance was built up, not just the total.
  const openLoyaltyHistory = async (c: Customer) => {
    if (!tenant) return;
    setLoyaltyCustomer(c);
    setLoyaltyLoading(true);
    const { data } = await supabase
      .from('loyalty_transactions')
      .select('id, points_delta, reason, created_at')
      .eq('tenant_id', tenant.id)
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false });
    setLoyaltyTx((data as LoyaltyTx[]) ?? []);
    setLoyaltyLoading(false);
  };

  const save = async () => {
    if (!tenant || !form.name.trim()) return;
    const payload = { tenant_id: tenant.id, name: form.name.trim(), email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, tax_id: form.tax_id || null, notes: form.notes || null, segment_id: form.segment_id || null };
    const { error } = editing
      ? await supabase.from('customers').update(payload).eq('id', editing.id)
      : await supabase.from('customers').insert(payload);
    if (error) { toast('error', error.message); return; }
    setModalOpen(false);
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('name');
    setCustomers((data as Customer[]) ?? []);
    toast('success', editing ? t('customers.toast.updated') : t('customers.toast.added'));
  };

  const remove = async (c: Customer) => {
    if (!confirm(t('customers.confirmDelete', { name: c.name }))) return;
    const { error } = await supabase.from('customers').delete().eq('id', c.id);
    if (error) { toast('error', error.message); return; }
    setCustomers((list) => list.filter((x) => x.id !== c.id));
  };

  // Loyalty tiers (migration 0075 + auto-promotion trigger in 0077):
  // manager-curated list of VIP levels. Assignment to a customer happens
  // automatically via the DB trigger on loyalty_points — this modal only
  // manages the tier definitions (name + points threshold).
  const saveTier = async () => {
    if (!tenant || !tierForm.name.trim()) return;
    const { error } = await supabase.from('loyalty_tiers').insert({
      tenant_id: tenant.id, name: tierForm.name.trim(), min_points: Number(tierForm.min_points) || 0,
    });
    if (error) { toast('error', error.message); return; }
    setTierForm({ name: '', min_points: '0' });
    toast('success', t('customers.tiers.toast.created'));
    loadLookups();
  };

  const removeTier = async (id: string) => {
    if (!confirm(t('customers.tiers.confirmDelete'))) return;
    const { error } = await supabase.from('loyalty_tiers').delete().eq('id', id);
    if (error) { toast('error', error.message); return; }
    loadLookups();
  };

  // Customer segments (migration 0075): a named, manually-curated group —
  // criteria jsonb is reserved for a future auto-segment rule and isn't
  // evaluated by anything today, so assignment here is a plain manual pick.
  const saveSegment = async () => {
    if (!tenant || !segmentForm.name.trim()) return;
    const { error } = await supabase.from('customer_segments').insert({ tenant_id: tenant.id, name: segmentForm.name.trim() });
    if (error) { toast('error', error.message); return; }
    setSegmentForm({ name: '' });
    toast('success', t('customers.segments.toast.created'));
    loadLookups();
  };

  const removeSegment = async (id: string) => {
    if (!confirm(t('customers.segments.confirmDelete'))) return;
    const { error } = await supabase.from('customer_segments').delete().eq('id', id);
    if (error) { toast('error', error.message); return; }
    loadLookups();
  };

  const tierName = (id: string | null | undefined) => tiers.find((tr) => tr.id === id)?.name ?? null;
  const segmentName = (id: string | null | undefined) => segments.find((s) => s.id === id)?.name ?? null;

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle', { count: customers.length })}
        action={
          <div className="flex gap-2">
            {isManager && (
              <>
                <button onClick={() => setTiersModalOpen(true)} className="btn-ghost"><Award size={16} /> {t('customers.tiers.manage')}</button>
                <button onClick={() => setSegmentsModalOpen(true)} className="btn-ghost"><Layers size={16} /> {t('customers.segments.manage')}</button>
              </>
            )}
            <button onClick={() => exportCSV('clients.csv', filtered.map((c) => ({ nom: c.name, email: c.email, telephone: c.phone, ville: c.city, solde: c.balance })))} className="btn-ghost"><Download size={16} /> {t('common.export')}</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16} /> {t('customers.new')}</button>
          </div>
        }
      />
      <div className="card p-5">
        <div className="mb-4"><SearchInput value={search} onChange={setSearch} /></div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Users} title={t('customers.empty.title')} description={t('customers.empty.desc')} action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> {t('common.add')}</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'name', label: t('customers.col.name'), render: (c) => (
                <div>
                  <p className="font-medium text-ink-900 dark:text-ink-50">{c.name}</p>
                  {c.email && <p className="flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400"><Mail size={11} /> {c.email}</p>}
                </div>
              )},
              { key: 'phone', label: t('customers.col.phone'), render: (c) => c.phone ? <span className="flex items-center gap-1 text-ink-600 dark:text-ink-300"><Phone size={12} /> {c.phone}</span> : <span className="text-ink-400 dark:text-ink-500">—</span> },
              { key: 'city', label: t('customers.col.city'), render: (c) => <span className="text-ink-600 dark:text-ink-300">{c.city ?? '—'}</span> },
              { key: 'balance', label: t('customers.col.balance'), className: 'text-right', render: (c) => <span className={Number(c.balance) < 0 ? 'font-medium text-error-600' : 'text-ink-900 dark:text-ink-50'}>{formatMoney(c.balance, currency)}</span> },
              { key: 'loyalty_points', label: t('customers.col.loyaltyPoints'), className: 'text-right', render: (c) => (
                <button
                  type="button"
                  onClick={() => openLoyaltyHistory(c)}
                  className="inline-flex items-center gap-1 rounded-full border border-ink-200 dark:border-ink-700 px-2 py-0.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/25"
                >
                  <Gift size={12} /> {c.loyalty_points ?? 0}
                </button>
              )},
              { key: 'tier', label: t('customers.col.tier'), render: (c) => tierName(c.loyalty_tier_id) ? <Badge tone="brand">{tierName(c.loyalty_tier_id)}</Badge> : <span className="text-ink-400 dark:text-ink-500">—</span> },
              { key: 'segment', label: t('customers.col.segment'), render: (c) => segmentName(c.segment_id) ? <Badge tone="flow">{segmentName(c.segment_id)}</Badge> : <span className="text-ink-400 dark:text-ink-500">—</span> },
              { key: 'actions', label: '', className: 'text-right', render: (c) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEdit(c)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(c)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('customers.editTitle') : t('customers.newTitle')} maxWidth="max-w-lg">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label={t('customers.field.name')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field></div>
          <Field label={t('customers.field.email')}><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></Field>
          <Field label={t('customers.field.phone')}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
          <Field label={t('customers.field.city')}><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input" /></Field>
          <Field label={t('customers.field.taxId')}><input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} className="input" /></Field>
          <Field label={t('customers.field.segment')}>
            <select value={form.segment_id} onChange={(e) => setForm({ ...form, segment_id: e.target.value })} className="input">
              <option value="">{t('customers.field.noSegment')}</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label={t('customers.field.address')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input" /></Field></div>
          <div className="sm:col-span-2"><Field label={t('customers.field.notes')}><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input min-h-[60px]" /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{editing ? t('common.save') : t('common.create')}</button>
        </div>
      </Modal>
      <Modal open={!!loyaltyCustomer} onClose={() => setLoyaltyCustomer(null)} title={t('customers.loyalty.title', { name: loyaltyCustomer?.name ?? '' })}>
        <div className="space-y-3">
          <div className="rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-center">
            <p className="text-xs uppercase text-ink-500 dark:text-ink-400">{t('customers.loyalty.balance')}</p>
            <p className="text-2xl font-medium text-brand-700">{loyaltyCustomer?.loyalty_points ?? 0}</p>
          </div>
          {loyaltyLoading ? (
            <p className="py-4 text-center text-sm text-ink-400">{t('common.loading')}</p>
          ) : loyaltyTx.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">{t('customers.loyalty.empty')}</p>
          ) : (
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {loyaltyTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-2 text-sm">
                  <div>
                    <p className="text-ink-900 dark:text-ink-50">{tx.reason}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">{formatDate(new Date(tx.created_at))}</p>
                  </div>
                  <span className={`font-medium ${tx.points_delta >= 0 ? 'text-success-700' : 'text-error-600'}`}>
                    {tx.points_delta >= 0 ? '+' : ''}{tx.points_delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
      <Modal open={tiersModalOpen} onClose={() => setTiersModalOpen(false)} title={t('customers.tiers.title')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">{t('customers.tiers.hint')}</p>
          <div className="flex gap-2">
            <input value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} placeholder={t('customers.tiers.namePlaceholder')} className="input" />
            <input type="number" min={0} value={tierForm.min_points} onChange={(e) => setTierForm({ ...tierForm, min_points: e.target.value })} placeholder={t('customers.tiers.minPointsPlaceholder')} className="input w-32" />
            <button onClick={saveTier} aria-label={t('common.add')} className="btn-primary shrink-0"><Plus size={16} /></button>
          </div>
          {tiers.length === 0 ? (
            <p className="py-2 text-center text-sm text-ink-400">{t('customers.tiers.empty')}</p>
          ) : (
            <div className="space-y-1.5">
              {tiers.map((tr) => (
                <div key={tr.id} className="flex items-center justify-between rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-2 text-sm">
                  <span className="font-medium text-ink-900 dark:text-ink-50">{tr.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-ink-500 dark:text-ink-400">{t('customers.tiers.fromPoints', { points: tr.min_points })}</span>
                    <button onClick={() => removeTier(tr.id)} aria-label={t('common.delete')} className="rounded-full p-1 text-error-500 hover:bg-error-50 dark:hover:bg-error-900/25"><XIcon size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
      <Modal open={segmentsModalOpen} onClose={() => setSegmentsModalOpen(false)} title={t('customers.segments.title')}>
        <div className="space-y-4">
          <p className="text-sm text-ink-500 dark:text-ink-400">{t('customers.segments.hint')}</p>
          <div className="flex gap-2">
            <input value={segmentForm.name} onChange={(e) => setSegmentForm({ name: e.target.value })} placeholder={t('customers.segments.namePlaceholder')} className="input" />
            <button onClick={saveSegment} aria-label={t('common.add')} className="btn-primary shrink-0"><Plus size={16} /></button>
          </div>
          {segments.length === 0 ? (
            <p className="py-2 text-center text-sm text-ink-400">{t('customers.segments.empty')}</p>
          ) : (
            <div className="space-y-1.5">
              {segments.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-ink-100 dark:border-ink-800 px-3 py-2 text-sm">
                  <span className="font-medium text-ink-900 dark:text-ink-50">{s.name}</span>
                  <button onClick={() => removeSegment(s.id)} aria-label={t('common.delete')} className="rounded-full p-1 text-error-500 hover:bg-error-50 dark:hover:bg-error-900/25"><XIcon size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
