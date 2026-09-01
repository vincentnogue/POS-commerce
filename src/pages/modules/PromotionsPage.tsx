import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Tag, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/localization';
import { PageHeader, Modal, EmptyState, useToast } from '../../components/ui';
import { DataTable, Field } from '../../components/DataTable';
import type { Promotion, PromotionType } from '../../lib/types';

// D365-style cart-level promotions (see migration 0070) — MVP scope:
// percent/fixed off the whole cart, automatic or coupon-code gated, with
// an optional minimum purchase and active date window. No category/
// product scoping or multi-buy yet — see the migration comment.
type PromotionForm = {
  name: string;
  type: PromotionType;
  value: string;
  requires_code: boolean;
  code: string;
  min_purchase: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const EMPTY: PromotionForm = {
  name: '', type: 'percent', value: '', requires_code: false, code: '',
  min_purchase: '', starts_at: '', ends_at: '', is_active: true,
};

export function PromotionsPage() {
  const toast = useToast();
  const { t } = useI18n();
  const { tenant } = useAuth();
  const currency = tenant?.currency ?? 'XOF';
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data } = await supabase.from('promotions').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    setPromotions((data as Promotion[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setEditing(null); setForm(EMPTY); setFormErr(null); setModalOpen(true); };
  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      name: p.name,
      type: p.type,
      value: String(p.value),
      requires_code: p.requires_code,
      code: p.code ?? '',
      min_purchase: p.min_purchase != null ? String(p.min_purchase) : '',
      starts_at: p.starts_at ? p.starts_at.slice(0, 10) : '',
      ends_at: p.ends_at ? p.ends_at.slice(0, 10) : '',
      is_active: p.is_active,
    });
    setFormErr(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!tenant) return;
    if (!form.name.trim()) { setFormErr(t('promotions.err.nameRequired')); return; }
    const value = Number(form.value);
    if (!value || value <= 0) { setFormErr(t('promotions.err.valueInvalid')); return; }
    if (form.type === 'percent' && value > 100) { setFormErr(t('promotions.err.percentTooHigh')); return; }
    if (form.requires_code && !form.code.trim()) { setFormErr(t('promotions.err.codeRequired')); return; }

    setSaving(true);
    setFormErr(null);
    const payload = {
      tenant_id: tenant.id,
      name: form.name.trim(),
      type: form.type,
      value,
      requires_code: form.requires_code,
      code: form.requires_code ? form.code.trim().toUpperCase() : null,
      min_purchase: form.min_purchase.trim() ? Number(form.min_purchase) : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(`${form.ends_at}T23:59:59`).toISOString() : null,
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from('promotions').update(payload).eq('id', editing.id)
      : await supabase.from('promotions').insert(payload);
    setSaving(false);
    if (error) { setFormErr(error.message.includes('promotions_tenant_code_idx') ? t('promotions.err.codeTaken') : error.message); return; }
    setModalOpen(false);
    load();
  };

  const toggleActive = async (p: Promotion) => {
    const { error } = await supabase.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) { toast('error', error.message); return; }
    load();
  };

  const remove = async (p: Promotion) => {
    if (!window.confirm(t('promotions.confirmDelete'))) return;
    const { error } = await supabase.from('promotions').delete().eq('id', p.id);
    if (error) { toast('error', error.message); return; }
    load();
  };

  return (
    <div>
      <PageHeader
        icon={Tag}
        title={t('nav.promotions')}
        subtitle={t('promotions.subtitle')}
        action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> {t('promotions.new')}</button>}
      />

      {loading ? (
        <p className="text-sm text-ink-400">{t('common.loading')}</p>
      ) : promotions.length === 0 ? (
        <EmptyState icon={Tag} title={t('promotions.empty.title')} description={t('promotions.empty.desc')} action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> {t('promotions.new')}</button>} />
      ) : (
        <DataTable
          rows={promotions}
          columns={[
            { key: 'name', label: t('promotions.col.name'), render: (p) => (
              <div>
                <p className="font-medium text-ink-900 dark:text-ink-50">{p.name}</p>
                {p.requires_code && <p className="text-xs text-ink-400 dark:text-ink-500">{t('promotions.col.codeLabel')}: <span className="font-mono">{p.code}</span></p>}
              </div>
            )},
            { key: 'value', label: t('promotions.col.discount'), render: (p) => p.type === 'percent' ? `-${p.value}%` : `-${formatMoney(p.value, currency)}` },
            { key: 'min_purchase', label: t('promotions.col.minPurchase'), render: (p) => p.min_purchase ? formatMoney(p.min_purchase, currency) : '—' },
            { key: 'window', label: t('promotions.col.window'), render: (p) => (p.starts_at || p.ends_at) ? `${p.starts_at ? p.starts_at.slice(0, 10) : '…'} → ${p.ends_at ? p.ends_at.slice(0, 10) : '…'}` : t('promotions.col.alwaysOn') },
            { key: 'active', label: t('promotions.col.status'), render: (p) => (
              <button type="button" onClick={() => toggleActive(p)} className={`inline-flex items-center gap-1 text-xs font-semibold ${p.is_active ? 'text-success-700' : 'text-ink-400'}`}>
                {p.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />} {p.is_active ? t('promotions.status.active') : t('promotions.status.inactive')}
              </button>
            )},
            { key: 'actions', label: '', className: 'text-right', render: (p) => (
              <div className="flex justify-end gap-2">
                <button onClick={() => openEdit(p)} className="text-ink-400 hover:text-brand-600"><Pencil size={15} /></button>
                <button onClick={() => remove(p)} className="text-ink-400 hover:text-error-600"><Trash2 size={15} /></button>
              </div>
            )},
          ]}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('promotions.editTitle') : t('promotions.new')}>
        <div className="space-y-4">
          <Field label={t('promotions.field.name')}>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('promotions.field.type')}>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PromotionType }))} className="input">
                <option value="percent">{t('promotions.type.percent')}</option>
                <option value="fixed">{t('promotions.type.fixed')}</option>
              </select>
            </Field>
            <Field label={form.type === 'percent' ? t('promotions.field.valuePercent') : t('promotions.field.valueFixed')}>
              <input type="number" min={0} step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="input" />
            </Field>
          </div>
          <Field label={t('promotions.field.minPurchase')} hint={t('promotions.field.minPurchaseHint')}>
            <input type="number" min={0} step="0.01" value={form.min_purchase} onChange={(e) => setForm((f) => ({ ...f, min_purchase: e.target.value }))} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('promotions.field.startsAt')}>
              <input type="date" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} className="input" />
            </Field>
            <Field label={t('promotions.field.endsAt')}>
              <input type="date" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} className="input" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
            <input type="checkbox" checked={form.requires_code} onChange={(e) => setForm((f) => ({ ...f, requires_code: e.target.checked }))} />
            {t('promotions.field.requiresCode')}
          </label>
          {form.requires_code && (
            <Field label={t('promotions.field.code')} hint={t('promotions.field.codeHint')}>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className="input" placeholder={t('promotions.field.codePlaceholder')} />
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            {t('promotions.field.active')}
          </label>
          {formErr && <p className="text-xs font-medium text-error-600">{formErr}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{editing ? t('common.save') : t('common.create')}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
