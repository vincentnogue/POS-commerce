import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Users, Download, Mail, Phone, Gift } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { DataTable, SearchInput, Field, exportCSV } from '../../components/DataTable';
import type { Customer } from '../../lib/types';

const EMPTY = { name: '', email: '', phone: '', address: '', city: '', tax_id: '', notes: '' };

type LoyaltyTx = { id: string; points_delta: number; reason: string; created_at: string };

export function CustomersPage() {
  const toast = useToast();
  const { t, formatDate } = useI18n();
  const { tenant } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null);
  const [loyaltyTx, setLoyaltyTx] = useState<LoyaltyTx[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

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
    const payload = { tenant_id: tenant.id, name: form.name.trim(), email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, tax_id: form.tax_id || null, notes: form.notes || null };
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

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle', { count: customers.length })}
        action={
          <div className="flex gap-2">
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
    </div>
  );
}
