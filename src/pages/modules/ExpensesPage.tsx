import { useEffect, useState, useMemo } from 'react';
import { Plus, Wallet, Download, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney, localDateStr } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, StatCard, useToast } from '../../components/ui';
import { DataTable, SearchInput, Select, Field, exportCSV } from '../../components/DataTable';
import type { Expense, Store, Supplier } from '../../lib/types';

const CATEGORIES = [
  { value: 'rent', labelKey: 'expense.cat.rent' },
  { value: 'salaries', labelKey: 'expense.cat.salaries' },
  { value: 'electricity', labelKey: 'expense.cat.electricity' },
  { value: 'water', labelKey: 'expense.cat.water' },
  { value: 'transport', labelKey: 'expense.cat.transport' },
  { value: 'marketing', labelKey: 'expense.cat.marketing' },
  { value: 'supplies', labelKey: 'expense.cat.supplies' },
  { value: 'maintenance', labelKey: 'expense.cat.maintenance' },
  { value: 'taxes', labelKey: 'expense.cat.taxes' },
  { value: 'other', labelKey: 'expense.cat.other' },
];
const EMPTY = { description: '', amount: 0, category: CATEGORIES[0].value, payment_method: 'cash', store_id: '', supplier_id: '', expense_date: localDateStr(), notes: '' };

export function ExpensesPage() {
  const toast = useToast();
  const { tenant } = useAuth();
  const { t, formatDate } = useI18n();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const currency = tenant?.currency ?? 'XOF';

  useEffect(() => { (async () => {
    if (!tenant) return;
    const [e, s, sup] = await Promise.all([
      supabase.from('expenses').select('*').eq('tenant_id', tenant.id).order('expense_date', { ascending: false }),
      supabase.from('stores').select('*').eq('tenant_id', tenant.id),
      supabase.from('suppliers').select('*').eq('tenant_id', tenant.id),
    ]);
    setExpenses((e.data as Expense[]) ?? []);
    setStores((s.data as Store[]) ?? []);
    setSuppliers((sup.data as Supplier[]) ?? []);
    setLoading(false);
  })(); }, [tenant]);

  const filtered = useMemo(() => expenses.filter((x) => {
    const q = search.toLowerCase().trim();
    return (!q || x.description.toLowerCase().includes(q) || x.category?.toLowerCase().includes(q)) && (!catFilter || x.category === catFilter);
  }), [expenses, search, catFilter]);

  const totalMonth = expenses.filter((e) => new Date(e.expense_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).reduce((s, e) => s + Number(e.amount), 0);
  const totalAll = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const openNew = () => { setEditing(null); setForm({ ...EMPTY, store_id: stores[0]?.id ?? '' }); setModalOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm({ description: e.description, amount: Number(e.amount), category: e.category ?? CATEGORIES[0].value, payment_method: e.payment_method ?? 'cash', store_id: e.store_id ?? '', supplier_id: e.supplier_id ?? '', expense_date: e.expense_date, notes: e.notes ?? '' }); setModalOpen(true); };

  const save = async () => {
    if (!tenant || !form.description.trim()) return;
    const payload = { tenant_id: tenant.id, description: form.description.trim(), amount: Number(form.amount), category: form.category, payment_method: form.payment_method, store_id: form.store_id || null, supplier_id: form.supplier_id || null, expense_date: form.expense_date, notes: form.notes || null };
    const { error } = editing
      ? await supabase.from('expenses').update(payload).eq('id', editing.id)
      : await supabase.from('expenses').insert(payload);
    if (error) { toast('error', error.message); return; }
    setModalOpen(false);
    const { data } = await supabase.from('expenses').select('*').eq('tenant_id', tenant.id).order('expense_date', { ascending: false });
    setExpenses((data as Expense[]) ?? []);
    toast('success', editing ? t('expense.toast.updated') : t('expense.toast.added'));
  };

  const remove = async (e: Expense) => {
    if (!confirm(t('expense.confirmDelete'))) return;
    const { error } = await supabase.from('expenses').delete().eq('id', e.id);
    if (error) { toast('error', error.message); return; }
    setExpenses((list) => list.filter((x) => x.id !== e.id));
  };

  return (
    <div>
      <PageHeader
        title={t('expense.title')}
        subtitle={t('expense.subtitle')}
        action={
          <div className="flex gap-2">
            <button onClick={() => exportCSV('depenses.csv', filtered.map((e) => ({ date: e.expense_date, description: e.description, categorie: e.category, montant: e.amount, paiement: e.payment_method })))} className="btn-ghost"><Download size={16} /> {t('common.export')}</button>
            <button onClick={openNew} className="btn-primary"><Plus size={16} /> {t('expense.new')}</button>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label={t('expense.monthTotal')} value={formatMoney(totalMonth, currency)} icon={Wallet} tone="action" />
        <StatCard label={t('expense.allTotal')} value={formatMoney(totalAll, currency)} icon={Wallet} tone="brand" />
      </div>
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} />
          <Select value={catFilter} onChange={setCatFilter} placeholder={t('expense.allCategories')} options={CATEGORIES.map((c) => ({ value: c.value, label: t(c.labelKey) }))} />
        </div>
        {filtered.length === 0 && !loading ? (
          <EmptyState icon={Wallet} title={t('expense.empty.title')} description={t('expense.empty.desc')} action={<button onClick={openNew} className="btn-primary"><Plus size={15} /> {t('common.add')}</button>} />
        ) : (
          <DataTable
            loading={loading}
            columns={[
              { key: 'date', label: t('common.date'), render: (e) => <span className="text-ink-500 dark:text-ink-400">{formatDate(e.expense_date)}</span> },
              { key: 'description', label: t('expense.col.description'), render: (e) => <span className="font-medium text-ink-900 dark:text-ink-50">{e.description}</span> },
              { key: 'category', label: t('expense.col.category'), render: (e) => { const c = CATEGORIES.find((x) => x.value === e.category); return <span className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-xs text-ink-700 dark:text-ink-200">{c ? t(c.labelKey) : (e.category ?? '—')}</span>; } },
              { key: 'method', label: t('expense.col.method'), render: (e) => <span className="text-ink-500 dark:text-ink-400">{e.payment_method ? t(`expense.method.${e.payment_method}`) : '—'}</span> },
              { key: 'amount', label: t('expense.col.amount'), className: 'text-right', render: (e) => <span className="font-medium text-ink-900 dark:text-ink-50">{formatMoney(e.amount, currency)}</span> },
              { key: 'actions', label: '', className: 'text-right', render: (e) => (
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEdit(e)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={15} /></button>
                  <button onClick={() => remove(e)} className="rounded-full p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>
                </div>
              )},
            ]}
            rows={filtered}
          />
        )}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('expense.editTitle') : t('expense.newTitle')}>
        <div className="space-y-4">
          <Field label={t('expense.col.description')}><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('expense.col.amount')}><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></Field>
            <Field label={t('common.date')}><input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('expense.col.category')}>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
              </select>
            </Field>
            <Field label={t('expense.col.method')}>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input">
                <option value="cash">{t('expense.method.cash')}</option>
                <option value="card">{t('expense.method.card')}</option>
                <option value="mobile_money">{t('expense.method.mobile_money')}</option>
                <option value="transfer">{t('expense.method.transfer')}</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('stores.title')}>
              <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
                <option value="">—</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label={t('suppliers.title')}>
              <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className="input">
                <option value="">—</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{editing ? t('common.save') : t('common.create')}</button>
        </div>
      </Modal>
    </div>
  );
}
