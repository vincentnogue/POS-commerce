import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Building2, DollarSign, Code2, ScrollText, AlertTriangle,
  TrendingUp, Globe, Plus, Trash2, Pencil,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { convertToUSD } from '../../lib/localization';
import { PageHeader, Modal, Badge, EmptyState, StatCard, useToast } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { CommercialCode, AuditLog, Plan, Tenant } from '../../lib/types';

type Tab = 'overview' | 'tenants' | 'plans' | 'codes' | 'audit' | 'team';

export function AdministrationPage() {
  const { member, tenant } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isSuperAdmin = member?.role === 'super_admin';
  const isAdmin = member?.role === 'admin' || isSuperAdmin;

  const [tab, setTab] = useState<Tab>(isSuperAdmin ? 'overview' : 'team');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-error-50 dark:bg-error-900/25 text-error-600">
          <AlertTriangle size={26} />
        </div>
        <h2 className="text-lg font-medium text-ink-900 dark:text-ink-50">{t('admin.accessDenied')}</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{t('admin.accessDeniedDesc')}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-5">{t('admin.backToDashboard')}</button>
      </div>
    );
  }

  const tabs: { id: Tab; labelKey: string; icon: typeof Shield; superOnly?: boolean }[] = [
    ...(isSuperAdmin ? [{ id: 'overview' as Tab, labelKey: 'admin.tab.overview', icon: TrendingUp }] : []),
    ...(isSuperAdmin ? [{ id: 'tenants' as Tab, labelKey: 'admin.tab.tenants', icon: Building2 }] : []),
    ...(isSuperAdmin ? [{ id: 'plans' as Tab, labelKey: 'admin.tab.plans', icon: DollarSign }] : []),
    ...(isSuperAdmin ? [{ id: 'codes' as Tab, labelKey: 'admin.tab.codes', icon: Code2 }] : []),
    ...(isSuperAdmin ? [{ id: 'audit' as Tab, labelKey: 'admin.tab.audit', icon: ScrollText }] : []),
    { id: 'team' as Tab, labelKey: 'admin.tab.team', icon: Users },
  ];

  return (
    <div>
      <PageHeader
        title={t('admin.title')}
        subtitle={isSuperAdmin ? t('admin.subtitleSuper') : t('admin.subtitleAdmin')}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === tabItem.id ? 'bg-brand-500 text-white shadow-soft' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:border-brand-200'
            }`}
          >
            <tabItem.icon size={15} /> {t(tabItem.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview' && isSuperAdmin && <SuperOverview />}
      {tab === 'tenants' && isSuperAdmin && <SuperTenants />}
      {tab === 'plans' && isSuperAdmin && <SuperPlans />}
      {tab === 'codes' && isSuperAdmin && <SuperCodes />}
      {tab === 'audit' && isSuperAdmin && <SuperAudit />}
      {tab === 'team' && <TeamRoles tenantId={tenant?.id ?? ''} />}
    </div>
  );
}

function SuperOverview() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => { (async () => {
    const [ten, p] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('plans').select('*'),
    ]);
    setTenants((ten.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
  })(); }, []);

  const mrrUSD = tenants.reduce((s, ten) => {
    const plan = plans.find((p) => p.id === ten.plan_id);
    return s + (plan?.price_usd ?? 0);
  }, 0);

  const byCountry: Record<string, number> = {};
  tenants.forEach((ten) => { byCountry[ten.country_name] = (byCountry[ten.country_name] ?? 0) + 1; });
  const byPlan: Record<string, number> = {};
  tenants.forEach((ten) => {
    const plan = plans.find((p) => p.id === ten.plan_id);
    const name = plan?.name ?? t('admin.noPlan');
    byPlan[name] = (byPlan[name] ?? 0) + 1;
  });

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('admin.overview.tenants')} value={tenants.length} icon={Building2} tone="brand" />
        <StatCard label={t('admin.overview.mrr')} value={`$${mrrUSD.toFixed(0)}`} icon={DollarSign} tone="success" />
        <StatCard label={t('admin.overview.activePlans')} value={plans.length} icon={Shield} tone="flow" />
        <StatCard label={t('admin.overview.countries')} value={Object.keys(byCountry).length} icon={Globe} tone="action" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('admin.overview.byPlan')}</h3>
          <div className="space-y-2">
            {Object.entries(byPlan).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 dark:text-ink-200">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / tenants.length) * 100}%` }} />
                  </div>
                  <span className="font-medium text-ink-900 dark:text-ink-50">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('admin.overview.byCountry')}</h3>
          <div className="space-y-2">
            {Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 dark:text-ink-200">{name}</span>
                <span className="font-medium text-ink-900 dark:text-ink-50">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuperTenants() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => { (async () => {
    const [ten, p] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('*'),
    ]);
    setTenants((ten.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
  })(); }, []);

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';

  return (
    <div className="card p-5">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
          <th className="pb-2 font-medium">{t('admin.tenants.company')}</th><th className="pb-2 font-medium">{t('admin.tenants.country')}</th><th className="pb-2 font-medium">{t('admin.tenants.currency')}</th><th className="pb-2 font-medium">{t('admin.tenants.plan')}</th><th className="pb-2 font-medium">{t('admin.tenants.status')}</th>
        </tr></thead>
        <tbody>
          {tenants.map((ten) => (
            <tr key={ten.id} className="border-b border-ink-50 dark:border-ink-800">
              <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{ten.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{ten.city}</p></td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{ten.country_name}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{ten.currency}</td>
              <td className="py-3"><Badge tone="brand">{planName(ten.plan_id)}</Badge></td>
              <td className="py-3"><Badge tone={ten.status === 'active' ? 'success' : 'neutral'}>{ten.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuperPlans() {
  const { t } = useI18n();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<any>({ name: '', code: '', price_usd: 0, max_users: 1, max_stores: 1, max_products: 50 });

  const reload = async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order');
    setPlans((data as Plan[]) ?? []);
  };
  useEffect(() => { reload(); }, []);

  const save = async () => {
    const { error } = editing
      ? await supabase.from('plans').update(form).eq('id', editing.id)
      : await supabase.from('plans').insert({ ...form, features: [], is_active: true, sort_order: plans.length });
    if (error) { toast('error', error.message); return; }
    setModalOpen(false);
    await reload();
    toast('success', t('admin.plans.saved'));
  };

  const remove = async (p: Plan) => {
    if (!confirm(t('admin.plans.confirmDelete', { name: p.name }))) return;
    const { error } = await supabase.from('plans').delete().eq('id', p.id);
    if (error) { toast('error', error.message); return; }
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end"><button onClick={() => { setEditing(null); setForm({ name: '', code: '', price_usd: 0, max_users: 1, max_stores: 1, max_products: 50 }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> {t('admin.plans.new')}</button></div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
          <th className="pb-2 font-medium">{t('admin.plans.name')}</th><th className="pb-2 font-medium">{t('admin.plans.code')}</th><th className="pb-2 font-medium">{t('admin.plans.priceUsd')}</th><th className="pb-2 font-medium">{t('admin.plans.users')}</th><th className="pb-2 font-medium">{t('admin.plans.stores')}</th><th className="pb-2 font-medium">{t('admin.plans.products')}</th><th></th>
        </tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-b border-ink-50 dark:border-ink-800">
              <td className="py-3 font-medium text-ink-900 dark:text-ink-50">{p.name}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{p.code}</td>
              <td className="py-3 font-medium text-ink-900 dark:text-ink-50">${p.price_usd}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{p.max_users}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{p.max_stores}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{p.max_products}</td>
              <td className="py-3 text-right">
                <button onClick={() => { setEditing(p); setForm({ name: p.name, code: p.code, price_usd: p.price_usd, max_users: p.max_users, max_stores: p.max_stores, max_products: p.max_products }); setModalOpen(true); }} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={15} /></button>
                <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('admin.plans.edit') : t('admin.plans.new')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.plans.name')}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <Field label={t('admin.plans.code')}><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" /></Field>
          <Field label={t('admin.plans.priceUsd')}><input type="number" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: Number(e.target.value) })} className="input" /></Field>
          <Field label={t('admin.plans.maxUsers')}><input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: Number(e.target.value) })} className="input" /></Field>
          <Field label={t('admin.plans.maxStores')}><input type="number" value={form.max_stores} onChange={(e) => setForm({ ...form, max_stores: Number(e.target.value) })} className="input" /></Field>
          <Field label={t('admin.plans.maxProducts')}><input type="number" value={form.max_products} onChange={(e) => setForm({ ...form, max_products: Number(e.target.value) })} className="input" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{editing ? t('common.save') : t('admin.plans.create')}</button>
        </div>
      </Modal>
    </div>
  );
}

function SuperCodes() {
  const { t } = useI18n();
  const toast = useToast();
  const [codes, setCodes] = useState<CommercialCode[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ code: '', rep_name: '', rep_email: '', region: '' });

  const reload = async () => {
    const { data } = await supabase.from('commercial_codes').select('*').order('created_at', { ascending: false });
    setCodes((data as CommercialCode[]) ?? []);
  };
  useEffect(() => { reload(); }, []);

  const save = async () => {
    const { error } = await supabase.from('commercial_codes').insert({ code: form.code, rep_name: form.rep_name, rep_email: form.rep_email || null, region: form.region || null, is_active: true });
    if (error) { toast('error', error.message); return; }
    setModalOpen(false);
    setForm({ code: '', rep_name: '', rep_email: '', region: '' });
    await reload();
    toast('success', t('admin.codes.created'));
  };

  const toggle = async (c: CommercialCode) => {
    const { error } = await supabase.from('commercial_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) { toast('error', error.message); return; }
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end"><button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> {t('admin.codes.new')}</button></div>
      {codes.length === 0 ? (
        <EmptyState icon={Code2} title={t('admin.codes.empty.title')} description={t('admin.codes.empty.desc')} />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
            <th className="pb-2 font-medium">{t('admin.codes.code')}</th><th className="pb-2 font-medium">{t('admin.codes.rep')}</th><th className="pb-2 font-medium">{t('admin.codes.region')}</th><th className="pb-2 font-medium">{t('admin.codes.sales')}</th><th className="pb-2 font-medium">{t('admin.codes.revenue')}</th><th className="pb-2 font-medium">{t('admin.codes.status')}</th><th></th>
          </tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-ink-50 dark:border-ink-800">
                <td className="py-3 font-mono font-medium text-brand-700">{c.code}</td>
                <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{c.rep_name}</p>{c.rep_email && <p className="text-xs text-ink-500 dark:text-ink-400">{c.rep_email}</p>}</td>
                <td className="py-3 text-ink-600 dark:text-ink-300">{c.region ?? '—'}</td>
                <td className="py-3 text-ink-600 dark:text-ink-300">{c.total_sales}</td>
                <td className="py-3 font-medium text-ink-900 dark:text-ink-50">${convertToUSD(c.total_revenue, 'USD').toFixed(0)}</td>
                <td className="py-3"><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? t('admin.codes.active') : t('admin.codes.inactive')}</Badge></td>
                <td className="py-3"><button onClick={() => toggle(c)} className="text-xs font-medium text-brand-600 hover:underline">{c.is_active ? t('admin.codes.deactivate') : t('admin.codes.activate')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('admin.codes.newTitle')}>
        <div className="space-y-4">
          <Field label={t('admin.codes.code')}><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" placeholder="Ex: LIAFRIK-001" /></Field>
          <Field label={t('admin.codes.repName')}><input value={form.rep_name} onChange={(e) => setForm({ ...form, rep_name: e.target.value })} className="input" /></Field>
          <Field label={t('admin.codes.email')}><input value={form.rep_email} onChange={(e) => setForm({ ...form, rep_email: e.target.value })} className="input" /></Field>
          <Field label={t('admin.codes.region')}><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={save} className="btn-primary">{t('admin.codes.create')}</button>
        </div>
      </Modal>
    </div>
  );
}

function SuperAudit() {
  const { t, formatDateTime } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    setLogs((data as AuditLog[]) ?? []);
  })(); }, []);

  return (
    <div className="card p-5">
      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title={t('admin.audit.empty.title')} description={t('admin.audit.empty.desc')} />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium text-ink-900 dark:text-ink-50">{l.action}</p>
                <span className="text-xs text-ink-500 dark:text-ink-400">{formatDateTime(l.created_at)}</span>
              </div>
              {l.actor_email && <p className="text-xs text-ink-500 dark:text-ink-400">{t('admin.audit.by')} {l.actor_email}</p>}
              {l.entity && <p className="text-xs text-ink-500 dark:text-ink-400">{l.entity}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRoles({ tenantId }: { tenantId: string }) {
  const { t, formatDate } = useI18n();
  const [members, setMembers] = useState<any[]>([]);
  const [salesByUser, setSalesByUser] = useState<Record<string, number>>({});
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (!tenantId) return;
      const [m, s, r] = await Promise.all([
        supabase.from('tenant_members').select('*').eq('tenant_id', tenantId),
        supabase.from('sales').select('user_id, total, sale_date').eq('tenant_id', tenantId),
        supabase.from('custom_roles').select('id, name').eq('tenant_id', tenantId),
      ]);
      const salesMap: Record<string, number> = {};
      (s.data ?? []).forEach((sale: any) => {
        if (sale.user_id) {
          salesMap[sale.user_id] = (salesMap[sale.user_id] ?? 0) + 1;
        }
      });
      setSalesByUser(salesMap);
      const rl: Record<string, string> = {};
      (r.data ?? []).forEach((role: any) => { rl[role.id] = role.name; });
      setRoleLabels(rl);
      setMembers(m.data ?? []);
    })();
  }, [tenantId]);

  const lastSale = (userId: string) => {
    const sales = (salesByUser[userId] ?? 0);
    return sales > 0 ? t('admin.team.salesCount', { count: sales }) : t('admin.team.noSales');
  };

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('admin.team.title')}</h3>
        <p className="text-sm text-ink-500 dark:text-ink-400">{t('admin.team.desc')}</p>
      </div>
      {members.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">{t('admin.team.noMembers')}</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 dark:border-ink-800 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-action-500 text-xs font-medium text-white">
                  {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{m.display_name ?? t('users.invited')}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {t(`users.role.${m.role}`)}
                    {m.custom_role_id && roleLabels[m.custom_role_id] ? ` · ${roleLabels[m.custom_role_id]}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                <span className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-1">{lastSale(m.user_id)}</span>
                <span className="text-ink-400 dark:text-ink-500">{t('admin.team.memberSince')} {formatDate(m.accepted_at ?? m.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-ink-500 dark:text-ink-400">{t('admin.team.customRolesHint')}</p>
    </div>
  );
}
