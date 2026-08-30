import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Crown, Building2, Users, DollarSign, TrendingUp,
  Pencil, Trash2, Ban, Check, Plus, Activity, CreditCard,
  Search, AlertTriangle, Mail, Eye, Loader2, BarChart3, Award, UserCog, Headset, Send, Plug, MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useI18n } from '../../lib/i18n';
import { convertToUSD } from '../../lib/localization';
import { PageHeader, Modal, Badge, StatCard, EmptyState, Spinner, useToast } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Tenant, Plan, CommercialCode, AuditLog } from '../../lib/types';

type Tab = 'overview' | 'tenants' | 'employees' | 'subscriptions' | 'admins' | 'staff' | 'plans' | 'codes' | 'performance' | 'audit' | 'monitoring' | 'comms' | 'messages' | 'support' | 'integrations';

// Sections a scoped staff member can ever be granted. Must mirror
// GRANTABLE_SECTIONS in the platform-staff-manage edge function.
const GRANTABLE_SECTIONS: { id: Tab; labelKey: string }[] = [
  { id: 'overview', labelKey: 'super.tab.overview' },
  { id: 'tenants', labelKey: 'super.tab.tenants' },
  { id: 'employees', labelKey: 'super.tab.employees' },
  { id: 'subscriptions', labelKey: 'super.tab.subscriptions' },
  { id: 'plans', labelKey: 'super.tab.plans' },
  { id: 'codes', labelKey: 'super.tab.codes' },
  { id: 'performance', labelKey: 'super.tab.performance' },
  { id: 'audit', labelKey: 'super.tab.audit' },
  { id: 'monitoring', labelKey: 'super.tab.monitoring' },
  { id: 'comms', labelKey: 'super.tab.comms' },
  { id: 'messages', labelKey: 'super.tab.messages' },
  { id: 'support', labelKey: 'super.tab.support' },
];

const ROLE_KEYS: Record<string, string> = {
  super_admin: 'users.role.super_admin',
  admin: 'users.role.admin',
  manager: 'users.role.manager',
  staff: 'users.role.staff',
};

export function SuperAdminPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab | null>(null);
  const [backendVerified, setBackendVerified] = useState<boolean | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [staffPermissions, setStaffPermissions] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) { setBackendVerified(false); setVerifyError(t('super.err.notConnected')); return; }
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-auth`;
        const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.authorized) {
          setBackendVerified(true);
          setIsFullAdmin(!!json.isFullAdmin);
          setStaffPermissions(json.permissions ?? null);
        } else {
          setBackendVerified(false);
          setVerifyError(json.reason ?? json.error ?? t('super.err.accessDenied'));
        }
      } catch (e: any) {
        setBackendVerified(false);
        setVerifyError(e.message ?? t('super.err.verifyError'));
      }
    })();
  }, [t]);

  if (backendVerified === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-brand-500" />
        <p className="text-sm text-ink-500 dark:text-ink-400">{t('super.verifying')}</p>
      </div>
    );
  }

  if (!backendVerified) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-error-50 dark:bg-error-900/25 text-error-600">
          <Shield size={26} />
        </div>
        <h2 className="text-lg font-medium text-ink-900 dark:text-ink-50">{t('super.accessRestricted')}</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
          {verifyError ?? t('super.accessRestrictedDesc')}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-5">{t('super.backToDashboard')}</button>
      </div>
    );
  }

  const allTabs: { id: Tab; labelKey: string; icon: typeof Shield }[] = [
    { id: 'overview', labelKey: 'super.tab.overview', icon: TrendingUp },
    { id: 'integrations', labelKey: 'super.tab.integrations', icon: Plug },
    { id: 'tenants', labelKey: 'super.tab.tenants', icon: Building2 },
    { id: 'employees', labelKey: 'super.tab.employees', icon: Users },
    { id: 'subscriptions', labelKey: 'super.tab.subscriptions', icon: CreditCard },
    { id: 'admins', labelKey: 'super.tab.admins', icon: Crown },
    { id: 'staff', labelKey: 'super.tab.staff', icon: UserCog },
    { id: 'plans', labelKey: 'super.tab.plans', icon: DollarSign },
    { id: 'codes', labelKey: 'super.tab.codes', icon: Activity },
    { id: 'performance', labelKey: 'super.tab.performance', icon: BarChart3 },
    { id: 'monitoring', labelKey: 'super.tab.monitoring', icon: Eye },
    { id: 'audit', labelKey: 'super.tab.audit', icon: Shield },
    { id: 'comms', labelKey: 'super.tab.comms', icon: Mail },
    { id: 'messages', labelKey: 'super.tab.messages', icon: MessageSquare },
    { id: 'support', labelKey: 'super.tab.support', icon: Headset },
  ];

  // 'admins', 'staff' (managing staff itself) and 'integrations' (payment
  // processor credentials) are never delegable — only full platform admins
  // ever see them. Everything else is gated by the staff member's granted
  // permissions.
  const tabs = isFullAdmin
    ? allTabs
    : allTabs.filter((t) => t.id !== 'admins' && t.id !== 'staff' && t.id !== 'integrations' && staffPermissions?.[t.id]);

  const activeTab = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id ?? null;

  return (
    <div>
      <PageHeader
        title={t('super.title')}
        subtitle={t('super.subtitle')}
        action={<Badge tone="error"><Crown size={12} /> {t('super.title')}</Badge>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === tabItem.id ? 'bg-brand-500 text-white shadow-soft' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:border-brand-200'
            }`}
          >
            <tabItem.icon size={15} /> {t(tabItem.labelKey)}
          </button>
        ))}
      </div>
      {!isFullAdmin && (
        <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-900/25 dark:border-warning-800 px-4 py-2 text-xs text-warning-700 dark:text-warning-300">
          {t('super.staffLimitedAccess')}
        </div>
      )}
      {activeTab === 'overview' && <SuperOverview />}
      {activeTab === 'integrations' && <SuperIntegrations />}
      {activeTab === 'tenants' && <SuperTenants />}
      {activeTab === 'employees' && <SuperEmployees />}
      {activeTab === 'subscriptions' && <SuperSubscriptions />}
      {activeTab === 'admins' && <SuperAdmins />}
      {activeTab === 'staff' && <SuperStaff />}
      {activeTab === 'plans' && <SuperPlans />}
      {activeTab === 'codes' && <SuperCodes />}
      {activeTab === 'performance' && <SuperPerformance />}
      {activeTab === 'monitoring' && <SuperMonitoring />}
      {activeTab === 'audit' && <SuperAudit />}
      {activeTab === 'comms' && <SuperComms />}
      {activeTab === 'messages' && <SuperMessages />}
      {activeTab === 'support' && <SuperSupport />}
    </div>
  );
}

function SuperOverview() {
  const { t } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState(0);
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => { (async () => {
    const [ten, p, m, s] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('plans').select('*'),
      supabase.from('tenant_members').select('id', { count: 'exact', head: true }),
      supabase.from('sales').select('total').eq('status', 'completed'),
    ]);
    setTenants((ten.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
    setEmployees(m.count ?? 0);
    setTotalSales((s.data ?? []).reduce((sum: number, x: any) => sum + Number(x.total), 0));
  })(); }, []);

  const mrrUSD = tenants.reduce((s, ten) => {
    const plan = plans.find((p) => p.id === ten.plan_id);
    return s + (plan?.price_usd ?? 0);
  }, 0);
  const arrUSD = mrrUSD * 12;
  const activeTenants = tenants.filter((ten) => ten.status === 'active').length;
  const churnRate = tenants.length > 0 ? ((tenants.length - activeTenants) / tenants.length * 100).toFixed(1) : '0';

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
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label={t('super.overview.tenants')} value={tenants.length} icon={Building2} tone="brand" />
        <StatCard label={t('super.overview.employees')} value={employees} icon={Users} tone="action" />
        <StatCard label={t('super.overview.mrr')} value={`$${mrrUSD.toFixed(0)}`} icon={DollarSign} tone="success" />
        <StatCard label={t('super.overview.arr')} value={`$${arrUSD.toFixed(0)}`} icon={TrendingUp} tone="flow" />
        <StatCard label={t('super.overview.churn')} value={`${churnRate}%`} icon={AlertTriangle} tone="warning" />
        <StatCard label={t('super.overview.totalSales')} value={`$${totalSales.toFixed(0)}`} icon={Activity} tone="action" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('super.overview.byPlan')}</h3>
          <div className="space-y-2">
            {Object.entries(byPlan).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 dark:text-ink-200">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${tenants.length ? (count / tenants.length) * 100 : 0}%` }} />
                  </div>
                  <span className="font-medium text-ink-900 dark:text-ink-50">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('super.overview.byCountry')}</h3>
          <div className="space-y-2">
            {Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => (
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
  const { t, formatDate } = useI18n();
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [impersonating, setImpersonating] = useState<Tenant | null>(null);

  useEffect(() => { (async () => {
    const [ten, p] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('*'),
    ]);
    setTenants((ten.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
  })(); }, []);

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';
  const filtered = tenants.filter((ten) => !search || ten.name.toLowerCase().includes(search.toLowerCase()) || ten.country_name.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = async (ten: Tenant) => {
    const newStatus = ten.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', ten.id);
    if (error) { toast('error', error.message); return; }
    setTenants((list) => list.map((x) => x.id === ten.id ? { ...x, status: newStatus } : x));
    toast(newStatus === 'active' ? 'success' : 'info', t(newStatus === 'active' ? 'super.tenants.activated' : 'super.tenants.suspended', { name: ten.name }));
  };

  const deleteTenant = async (ten: Tenant) => {
    if (!confirm(t('super.tenants.confirmDelete', { name: ten.name }))) return;
    const { error } = await supabase.from('tenants').delete().eq('id', ten.id);
    if (error) { toast('error', t('super.tenants.deleteFailed', { msg: error.message })); return; }
    setTenants((list) => list.filter((x) => x.id !== ten.id));
    toast('error', t('super.tenants.deleted', { name: ten.name }));
  };

  const impersonate = (ten: Tenant) => {
    localStorage.setItem('liafrik_impersonation', ten.id);
    setImpersonating(ten);
    toast('info', t('super.tenants.impersonating', { name: ten.name }));
    setTimeout(() => window.location.reload(), 1500);
  };

  const subStatus = (ten: Tenant) => {
    if (ten.status === 'suspended') return { tone: 'error' as const, labelKey: 'super.tenants.statusSuspended' };
    const created = new Date(ten.created_at);
    const trialEnd = new Date(created.getTime() + 14 * 86400000); // FIX: real trial is 14 days, not 7 — keep in sync with TRIAL_DAYS (lib/access.ts, lib/plans.ts) and tenant_access_active()
    if (new Date() < trialEnd) return { tone: 'warning' as const, labelKey: 'super.tenants.statusTrial' };
    return { tone: 'success' as const, labelKey: 'super.tenants.statusActive' };
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('super.tenants.count', { count: tenants.length })}</h3>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('super.tenants.search')} className="input pl-9" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
            <th className="pb-2 font-medium">{t('super.tenants.company')}</th><th className="pb-2 font-medium">{t('super.tenants.country')}</th><th className="pb-2 font-medium">{t('super.tenants.plan')}</th><th className="pb-2 font-medium">{t('super.tenants.status')}</th><th className="pb-2 font-medium">{t('super.tenants.created')}</th><th className="pb-2 font-medium text-right">{t('super.tenants.actions')}</th>
          </tr></thead>
          <tbody>
            {filtered.map((ten) => {
              const ss = subStatus(ten);
              return (
                <tr key={ten.id} className="border-b border-ink-50 dark:border-ink-800">
                  <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{ten.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{ten.city}</p></td>
                  <td className="py-3 text-ink-600 dark:text-ink-300">{ten.country_name}</td>
                  <td className="py-3"><Badge tone="brand">{planName(ten.plan_id)}</Badge></td>
                  <td className="py-3"><Badge tone={ss.tone}>{t(ss.labelKey)}</Badge></td>
                  <td className="py-3 text-ink-500 dark:text-ink-400 text-xs">{formatDate(ten.created_at)}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => impersonate(ten)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-flow-50 dark:hover:bg-flow-900/25 hover:text-flow-600" title={t('super.tenants.impersonate')}><Eye size={15} /></button>
                      <button onClick={() => toggleStatus(ten)} className={`rounded-lg p-1.5 ${ten.status === 'active' ? 'text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25' : 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25'}`} title={ten.status === 'active' ? t('super.tenants.suspend') : t('super.tenants.activate')}>
                        {ten.status === 'active' ? <Ban size={15} /> : <Check size={15} />}
                      </button>
                      <button onClick={() => deleteTenant(ten)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600" title={t('common.delete')}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!impersonating} onClose={() => setImpersonating(null)} title={t('super.tenants.impersonationTitle')}>
        <p className="text-sm text-ink-600 dark:text-ink-300">{t('super.tenants.impersonationDesc', { name: impersonating?.name ?? '' })}</p>
      </Modal>
    </div>
  );
}

function SuperEmployees() {
  const { t, formatDate } = useI18n();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => { (async () => {
    const { data, error } = await supabase
      .from('tenant_members')
      .select('id, user_id, role, custom_role_id, display_name, avatar_color, created_at, accepted_at, tenants!inner(name, country_name, city)')
      .order('created_at', { ascending: false });
    if (!error) setMembers(data ?? []);
    setLoading(false);
  })(); }, []);

  const filtered = members.filter((m) => {
    const matchesSearch = !search ||
      (m.display_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.tenants?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts: Record<string, number> = {};
  members.forEach((m) => { roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1; });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('super.employees.total')} value={members.length} icon={Users} tone="brand" />
        <StatCard label={t('super.employees.owners')} value={roleCounts['admin'] ?? 0} icon={Crown} tone="flow" />
        <StatCard label={t('super.employees.managers')} value={roleCounts['manager'] ?? 0} icon={Shield} tone="action" />
        <StatCard label={t('super.employees.sellers')} value={roleCounts['staff'] ?? 0} icon={Activity} tone="success" />
      </div>
      <div className="card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('super.employees.title')}</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('super.employees.search')} className="input pl-9" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input max-w-[140px]">
              <option value="all">{t('super.employees.allRoles')}</option>
              <option value="super_admin">{t('users.role.super_admin')}</option>
              <option value="admin">{t('users.role.admin')}</option>
              <option value="manager">{t('users.role.manager')}</option>
              <option value="staff">{t('users.role.staff')}</option>
            </select>
          </div>
        </div>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title={t('super.employees.empty.title')} description={t('super.employees.empty.desc')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                <th className="pb-2 font-medium">{t('super.employees.employee')}</th><th className="pb-2 font-medium">{t('super.employees.company')}</th><th className="pb-2 font-medium">{t('super.employees.role')}</th><th className="pb-2 font-medium">{t('super.employees.memberSince')}</th>
              </tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                          {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium text-ink-900 dark:text-ink-50">{m.display_name ?? t('users.invited')}</p>
                      </div>
                    </td>
                    <td className="py-3"><p className="text-ink-700 dark:text-ink-200">{m.tenants?.name ?? '—'}</p><p className="text-xs text-ink-500 dark:text-ink-400">{m.tenants?.city}, {m.tenants?.country_name}</p></td>
                    <td className="py-3"><Badge tone={m.role === 'super_admin' ? 'error' : m.role === 'admin' ? 'brand' : m.role === 'manager' ? 'flow' : 'neutral'}>{t(ROLE_KEYS[m.role] ?? m.role)}</Badge></td>
                    <td className="py-3 text-ink-500 dark:text-ink-400 text-xs">{formatDate(m.accepted_at ?? m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SuperSubscriptions() {
  const { t, formatDate } = useI18n();
  const [subs, setSubs] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const [s, p] = await Promise.all([
      supabase.from('subscriptions').select('*, tenants!inner(name, country_name)').order('created_at', { ascending: false }),
      supabase.from('plans').select('*'),
    ]);
    setSubs(s.data ?? []);
    setPlans((p.data as Plan[]) ?? []);
    setLoading(false);
  })(); }, []);

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';
  const totalMRR = subs.filter((s) => s.status === 'active').reduce((sum, s) => {
    const plan = plans.find((p) => p.id === s.plan_id);
    return sum + (plan?.price_usd ?? 0);
  }, 0);
  const unpaid = subs.filter((s) => s.status === 'past_due' || s.status === 'incomplete');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t('super.subs.active')} value={subs.filter((s) => s.status === 'active').length} icon={CreditCard} tone="success" />
        <StatCard label={t('super.overview.mrr')} value={`$${totalMRR.toFixed(0)}`} icon={DollarSign} tone="brand" />
        <StatCard label={t('super.subs.unpaid')} value={unpaid.length} icon={AlertTriangle} tone="error" />
      </div>
      {unpaid.length > 0 && (
        <div className="card border-error-200 p-4">
          <div className="flex items-center gap-2 text-error-700">
            <AlertTriangle size={18} />
            <p className="text-sm font-medium">{t('super.subs.overdueNotice', { count: unpaid.length })}</p>
          </div>
        </div>
      )}
      <div className="card p-5">
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('super.subs.history')}</h3>
        {loading ? <Spinner /> : subs.length === 0 ? (
          <EmptyState icon={CreditCard} title={t('super.subs.empty.title')} description={t('super.subs.empty.desc')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                <th className="pb-2 font-medium">{t('super.tenants.company')}</th><th className="pb-2 font-medium">{t('super.tenants.plan')}</th><th className="pb-2 font-medium">{t('super.tenants.status')}</th><th className="pb-2 font-medium">{t('super.subs.cycle')}</th><th className="pb-2 font-medium">{t('super.subs.periodEnd')}</th>
              </tr></thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{s.tenants?.name ?? '—'}</p><p className="text-xs text-ink-500 dark:text-ink-400">{s.tenants?.country_name}</p></td>
                    <td className="py-3"><Badge tone="brand">{planName(s.plan_id)}</Badge></td>
                    <td className="py-3"><Badge tone={s.status === 'active' ? 'success' : s.status === 'trialing' ? 'warning' : s.status === 'past_due' ? 'error' : 'neutral'}>{s.status}</Badge></td>
                    <td className="py-3 text-ink-600 dark:text-ink-300">{s.billing_cycle}</td>
                    <td className="py-3 text-ink-500 dark:text-ink-400 text-xs">{s.current_period_end ? formatDate(s.current_period_end) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SuperAdmins() {
  const { t } = useI18n();
  const [admins, setAdmins] = useState<any[]>([]);
  const [superAdminMembers, setSuperAdminMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const toast = useToast();

  const callManage = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-manage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? t('super.err.unknown'));
    return json;
  };

  const reload = async () => {
    setLoading(true);
    const [sa, pa] = await Promise.all([
      supabase.from('tenant_members').select('*, tenants!inner(name)').eq('role', 'super_admin').order('created_at', { ascending: false }),
      callManage({ action: 'list' }).catch(() => ({ admins: [] })),
    ]);
    setSuperAdminMembers(sa.data ?? []);
    setAdmins(pa.admins ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setBusy(true);
    try {
      const result = await callManage({ action: 'add', email: newEmail.trim(), label: newLabel.trim() });
      toast('success', result.accountExists
        ? t('super.admins.nowSuperAdmin', { email: newEmail })
        : t('super.admins.addedToList', { email: newEmail }));
      setNewEmail(''); setNewLabel(''); setFormOpen(false);
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(t('super.admins.confirmRemove', { email }))) return;
    setBusy(true);
    try {
      await callManage({ action: 'remove', email });
      toast('success', t('super.admins.removed', { email }));
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateLabel = async (email: string) => {
    setBusy(true);
    try {
      await callManage({ action: 'update_label', email, label: editingLabel });
      setEditingEmail(null);
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const canRemove = admins.length > 2;

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-error-600" />
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('super.admins.title')}</h3>
          </div>
          <button onClick={() => setFormOpen((v) => !v)} className="btn-primary text-sm"><Plus size={15} /> {t('super.admins.add')}</button>
        </div>
        <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
          {t('super.admins.desc')}
          {!canRemove && <span className="ml-1 font-medium text-warning-600">{t('super.admins.minAdmins')}</span>}
        </p>

        {formOpen && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-ink-100 dark:border-ink-800 p-4 sm:flex-row sm:items-end">
            <Field label={t('super.admins.email')}>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="email@exemple.com" className="input" />
            </Field>
            <Field label={t('super.admins.labelOptional')}>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t('super.admins.labelPlaceholder')} className="input" />
            </Field>
            <button disabled={busy} onClick={handleAdd} className="btn-primary shrink-0">{t('super.admins.confirm')}</button>
          </div>
        )}

        <div className="space-y-2">
          {admins.map((pa) => (
            <div key={pa.id} className="flex items-center justify-between rounded-xl border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error-500 text-xs font-medium text-white">
                  {pa.email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{pa.email}</p>
                  {editingEmail === pa.email ? (
                    <div className="mt-1 flex items-center gap-2">
                      <input value={editingLabel} onChange={(e) => setEditingLabel(e.target.value)} className="input h-7 text-xs" />
                      <button onClick={() => handleUpdateLabel(pa.email)} className="text-xs font-medium text-brand-600">OK</button>
                      <button onClick={() => setEditingEmail(null)} className="text-xs text-ink-400">{t('common.cancel')}</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingEmail(pa.email); setEditingLabel(pa.label ?? ''); }} className="text-xs text-error-600 hover:underline">
                      {pa.label ?? t('super.admins.admin')} — {t('super.admins.edit')}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="error"><Crown size={11} /> {pa.label}</Badge>
                <button
                  disabled={!canRemove || busy}
                  onClick={() => handleRemove(pa.email)}
                  title={!canRemove ? t('super.admins.minAdminsTitle') : t('super.admins.remove')}
                  className="rounded-full p-1.5 text-ink-400 transition hover:bg-error-50 hover:text-error-600 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-error-900/25"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('super.admins.membersTitle')}</h3>
        {loading ? <Spinner /> : superAdminMembers.length === 0 ? (
          <EmptyState icon={Users} title={t('super.admins.empty.title')} description={t('super.admins.empty.desc')} />
        ) : (
          <div className="space-y-2">
            {superAdminMembers.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-ink-100 dark:border-ink-800 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                    {(a.display_name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{a.display_name ?? t('users.invited')}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{(a.tenants as any)?.name ?? '—'}</p>
                  </div>
                </div>
                <Badge tone="brand">{t('users.role.super_admin')}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuperStaff() {
  const { t } = useI18n();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newPerms, setNewPerms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GRANTABLE_SECTIONS.map((s) => [s.id, false]))
  );
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editingPerms, setEditingPerms] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const callManage = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-staff-manage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? t('super.err.unknown'));
    return json;
  };

  const reload = async () => {
    setLoading(true);
    try {
      const result = await callManage({ action: 'list' });
      setStaff(result.staff ?? []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleAdd = async () => {
    if (!newEmail.trim()) return;
    setBusy(true);
    try {
      const result = await callManage({ action: 'add', email: newEmail.trim(), label: newLabel.trim(), permissions: newPerms });
      toast('success', result.accountExists
        ? t('super.staff.nowStaff', { email: newEmail })
        : t('super.staff.added', { email: newEmail }));
      setNewEmail(''); setNewLabel('');
      setNewPerms(Object.fromEntries(GRANTABLE_SECTIONS.map((s) => [s.id, false])));
      setFormOpen(false);
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(t('super.staff.confirmRemove', { email }))) return;
    setBusy(true);
    try {
      await callManage({ action: 'remove', email });
      toast('success', t('super.staff.removed', { email }));
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: any) => {
    setEditingEmail(s.email);
    setEditingPerms({ ...Object.fromEntries(GRANTABLE_SECTIONS.map((sec) => [sec.id, false])), ...s.permissions });
  };

  const saveEdit = async (email: string) => {
    setBusy(true);
    try {
      await callManage({ action: 'update', email, permissions: editingPerms });
      setEditingEmail(null);
      await reload();
      toast('success', t('super.staff.permsUpdated'));
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const permBadges = (perms: Record<string, boolean>) => {
    const granted = GRANTABLE_SECTIONS.filter((s) => perms?.[s.id]);
    if (granted.length === 0) return <span className="text-xs text-ink-400 dark:text-ink-500">{t('super.staff.noAccess')}</span>;
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {granted.map((s) => <Badge key={s.id} tone="neutral">{t(s.labelKey)}</Badge>)}
      </div>
    );
  };

  return (
    <div className="card p-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={18} className="text-brand-600" />
          <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('super.staff.title')}</h3>
        </div>
        <button onClick={() => setFormOpen((v) => !v)} className="btn-primary text-sm"><Plus size={15} /> {t('super.admins.add')}</button>
      </div>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
        {t('super.staff.desc')}
      </p>

      {formOpen && (
        <div className="mb-4 space-y-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Field label={t('super.admins.email')}><input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="email@exemple.com" className="input" /></Field>
            <Field label={t('super.staff.label')}><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t('super.staff.labelPlaceholder')} className="input" /></Field>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-ink-500 dark:text-ink-400">{t('super.staff.accessibleSections')}</p>
            <div className="flex flex-wrap gap-3">
              {GRANTABLE_SECTIONS.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-ink-700 dark:text-ink-200">
                  <input type="checkbox" checked={!!newPerms[s.id]} onChange={(e) => setNewPerms((p) => ({ ...p, [s.id]: e.target.checked }))} />
                  {t(s.labelKey)}
                </label>
              ))}
            </div>
          </div>
          <button disabled={busy} onClick={handleAdd} className="btn-primary">{t('super.admins.confirm')}</button>
        </div>
      )}

      {loading ? <Spinner /> : staff.length === 0 ? (
        <EmptyState icon={UserCog} title={t('super.staff.empty.title')} description={t('super.staff.empty.desc')} />
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                    {s.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{s.email}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{t(s.labelKey)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => editingEmail === s.email ? setEditingEmail(null) : startEdit(s)} className="rounded-full p-1.5 text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={14} /></button>
                  <button disabled={busy} onClick={() => handleRemove(s.email)} className="rounded-full p-1.5 text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={14} /></button>
                </div>
              </div>
              {editingEmail === s.email ? (
                <div className="mt-3 border-t border-ink-100 dark:border-ink-800 pt-3">
                  <div className="flex flex-wrap gap-3">
                    {GRANTABLE_SECTIONS.map((sec) => (
                      <label key={sec.id} className="flex items-center gap-1.5 text-sm text-ink-700 dark:text-ink-200">
                        <input type="checkbox" checked={!!editingPerms[sec.id]} onChange={(e) => setEditingPerms((p) => ({ ...p, [sec.id]: e.target.checked }))} />
                        {t(sec.labelKey)}
                      </label>
                    ))}
                  </div>
                  <button disabled={busy} onClick={() => saveEdit(s.email)} className="btn-primary mt-3 text-sm">{t('common.save')}</button>
                </div>
              ) : permBadges(s.permissions ?? {})}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuperPlans() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<any>({ name: '', code: '', price_usd: 0, max_users: 1, max_stores: 1, max_products: 50 });
  const toast = useToast();

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
    setModalOpen(false); await reload();
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
  const [codes, setCodes] = useState<CommercialCode[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ code: '', rep_name: '', rep_email: '', region: '' });
  const toast = useToast();

  const reload = async () => {
    const { data } = await supabase.from('commercial_codes').select('*').order('created_at', { ascending: false });
    setCodes((data as CommercialCode[]) ?? []);
  };
  useEffect(() => { reload(); }, []);

  const save = async () => {
    const { error } = await supabase.from('commercial_codes').insert({ code: form.code, rep_name: form.rep_name, rep_email: form.rep_email || null, region: form.region || null, is_active: true });
    if (error) { toast('error', error.message); return; }
    setModalOpen(false); setForm({ code: '', rep_name: '', rep_email: '', region: '' }); await reload();
    toast('success', t('admin.codes.created'));
  };

  const toggle = async (c: CommercialCode) => {
    const { error } = await supabase.from('commercial_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) { toast('error', error.message); return; }
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-500 dark:text-ink-400">{t('super.codes.seePerformance', { tab: t('super.tab.performance') })}</p>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> {t('admin.codes.new')}</button>
      </div>
      {codes.length === 0 ? (
        <EmptyState icon={Activity} title={t('admin.codes.empty.title')} description={t('admin.codes.empty.desc')} />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
            <th className="pb-2 font-medium">{t('admin.codes.code')}</th><th className="pb-2 font-medium">{t('admin.codes.rep')}</th><th className="pb-2 font-medium">{t('admin.codes.region')}</th><th className="pb-2 font-medium">{t('admin.codes.status')}</th><th></th>
          </tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-ink-50 dark:border-ink-800">
                <td className="py-3 font-mono font-medium text-brand-700">{c.code}</td>
                <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{c.rep_name}</p>{c.rep_email && <p className="text-xs text-ink-500 dark:text-ink-400">{c.rep_email}</p>}</td>
                <td className="py-3 text-ink-600 dark:text-ink-300">{c.region ?? '—'}</td>
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

function SuperPerformance() {
  const { t, formatDate } = useI18n();
  const [staff, setStaff] = useState<any[]>([]);
  const [commercials, setCommercials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [view, setView] = useState<'staff' | 'commercials'>('staff');

  useEffect(() => { (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/platform-performance`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? t('super.err.unknown'));
      setStaff(json.staff ?? []);
      setCommercials(json.commercials ?? []);
    } catch (e: any) {
      setError(e.message ?? t('super.perf.loadError'));
    } finally {
      setLoading(false);
    }
  })(); }, []);

  const fmtUSD = (n: number) => `$${convertToUSD(n, 'USD').toFixed(0)}`;
  const timeAgo = (iso: string | null) => {
    if (!iso) return t('super.perf.never');
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return t('super.perf.today');
    if (days === 1) return t('super.perf.yesterday');
    return t('super.perf.daysAgo', { count: days });
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error) return <EmptyState icon={AlertTriangle} title={t('super.err.title')} description={error} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView('staff')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === 'staff' ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'}`}>
          {t('super.perf.staffPerf')}
        </button>
        <button onClick={() => setView('commercials')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === 'commercials' ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'}`}>
          {t('super.perf.commercialPerf')}
        </button>
      </div>

      {view === 'staff' && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award size={18} className="text-brand-600" />
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('super.perf.staffTitle')}</h3>
          </div>
          {staff.length === 0 ? (
            <EmptyState icon={Users} title={t('super.perf.noData.title')} description={t('super.perf.noData.desc')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                    <th className="pb-2 font-medium">{t('super.perf.member')}</th>
                    <th className="pb-2 font-medium">{t('super.tenants.company')}</th>
                    <th className="pb-2 font-medium">{t('super.employees.role')}</th>
                    <th className="pb-2 text-right font-medium">{t('super.perf.sales')}</th>
                    <th className="pb-2 text-right font-medium">{t('super.perf.revenue')}</th>
                    <th className="pb-2 text-right font-medium">{t('super.perf.actions')}</th>
                    <th className="pb-2 text-right font-medium">{t('super.perf.lastActivity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.userId} className="border-b border-ink-50 dark:border-ink-800">
                      <td className="py-3">
                        <p className="font-medium text-ink-900 dark:text-ink-50">{s.displayName}</p>
                        {s.email && <p className="text-xs text-ink-500 dark:text-ink-400">{s.email}</p>}
                      </td>
                      <td className="py-3 text-ink-600 dark:text-ink-300">{s.tenantName}</td>
                      <td className="py-3"><Badge tone="neutral">{t(ROLE_KEYS[s.role] ?? s.role)}</Badge></td>
                      <td className="py-3 text-right text-ink-700 dark:text-ink-200">{s.salesCount}</td>
                      <td className="py-3 text-right font-medium text-ink-900 dark:text-ink-50">{fmtUSD(s.salesRevenue)}</td>
                      <td className="py-3 text-right text-ink-600 dark:text-ink-300">{s.activityCount}</td>
                      <td className="py-3 text-right text-xs text-ink-500 dark:text-ink-400">{timeAgo(s.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'commercials' && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={18} className="text-brand-600" />
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{t('super.perf.commercialTitle')}</h3>
          </div>
          {commercials.length === 0 ? (
            <EmptyState icon={Activity} title={t('admin.codes.empty.title')} description={t('super.perf.createCodesHint')} />
          ) : (
            <div className="space-y-2">
              {commercials.map((c) => (
                <div key={c.id} className="rounded-xl border border-ink-100 dark:border-ink-800">
                  <button
                    onClick={() => setExpandedCode(expandedCode === c.id ? null : c.id)}
                    className="flex w-full items-center justify-between p-3 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-brand-50 dark:bg-brand-900/25 px-2 py-1 font-mono text-xs font-medium text-brand-700 dark:text-brand-300">{c.code}</span>
                      <div>
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{c.repName}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">{c.region ?? '—'} · {t('super.perf.clientsWithCode', { count: c.clients.length })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{fmtUSD(c.salesRevenue)}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">{t('super.perf.salesCount', { count: c.salesCount })}</p>
                      </div>
                      <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? t('admin.codes.active') : t('admin.codes.inactive')}</Badge>
                    </div>
                  </button>
                  {expandedCode === c.id && (
                    <div className="border-t border-ink-100 dark:border-ink-800 p-3">
                      {c.clients.length === 0 ? (
                        <p className="text-xs text-ink-500 dark:text-ink-400">{t('super.perf.noClients')}</p>
                      ) : (
                        <div className="space-y-1.5">
                          {c.clients.map((cl: any) => (
                            <div key={cl.id} className="flex items-center justify-between rounded-lg bg-ink-50 dark:bg-ink-800/60 px-3 py-2 text-sm">
                              <span className="font-medium text-ink-800 dark:text-ink-100">{cl.name}</span>
                              <span className="text-xs text-ink-500 dark:text-ink-400">{t('super.perf.signedUpOn')} {formatDate(cl.signedUpAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuperMonitoring() {
  const { t, formatDate } = useI18n();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => { (async () => {
    const { data: ten } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants((ten as Tenant[]) ?? []);
    const tables = ['products', 'sales', 'customers', 'invoices', 'stores', 'expenses'];
    const results: Record<string, number> = {};
    for (const table of tables) {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      results[table] = count ?? 0;
    }
    setCounts(results);
  })(); }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(counts).map(([table, count]) => (
          <StatCard key={table} label={table} value={count} icon={Activity} tone="brand" />
        ))}
      </div>
      <div className="card p-5">
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('super.monitoring.title')}</h3>
        <div className="space-y-2">
          {tenants.map((ten) => (
            <div key={ten.id} className="flex items-center justify-between rounded-xl border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${ten.status === 'active' ? 'bg-success-500' : 'bg-error-500'}`} />
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{ten.name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{ten.country_name} · {ten.currency}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                <span>{t('super.tenants.created')}: {formatDate(ten.created_at)}</span>
                <Badge tone={ten.status === 'active' ? 'success' : 'error'}>{ten.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperAudit() {
  const { t, formatDateTime } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);
  const [view, setView] = useState<'audit' | 'access'>('audit');

  useEffect(() => { (async () => {
    const [a, al] = await Promise.all([
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('super_admin_access_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setLogs((a.data as AuditLog[]) ?? []);
    setAccessLogs(al.data ?? []);
  })(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView('audit')} className={`rounded-full px-4 py-2 text-sm font-medium ${view === 'audit' ? 'bg-brand-500 text-white' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200'}`}>{t('admin.tab.audit')}</button>
        <button onClick={() => setView('access')} className={`rounded-full px-4 py-2 text-sm font-medium ${view === 'access' ? 'bg-brand-500 text-white' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200'}`}>{t('super.audit.accessAttempts')}</button>
      </div>
      <div className="card p-5">
        {view === 'audit' ? (
          logs.length === 0 ? <EmptyState icon={Shield} title={t('admin.audit.empty.title')} description={t('admin.audit.empty.desc')} /> : (
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
          )
        ) : (
          accessLogs.length === 0 ? <EmptyState icon={Shield} title={t('super.audit.noAttempts.title')} description={t('super.audit.noAttempts.desc')} /> : (
            <div className="space-y-2">
              {accessLogs.map((al) => (
                <div key={al.id} className={`rounded-xl border p-3 text-sm ${al.authorized ? 'border-success-100 bg-success-50/30 dark:bg-success-900/25' : 'border-error-100 bg-error-50/30 dark:bg-error-900/25'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone={al.authorized ? 'success' : 'error'}>{al.authorized ? t('super.audit.authorized') : t('super.audit.denied')}</Badge>
                      <span className="font-medium text-ink-900 dark:text-ink-50">{al.actor_email ?? t('super.audit.unknown')}</span>
                    </div>
                    <span className="text-xs text-ink-500 dark:text-ink-400">{formatDateTime(al.created_at)}</span>
                  </div>
                  {al.reason && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{al.reason}</p>}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SuperComms() {
  const { t } = useI18n();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<'all' | 'active' | 'trial' | 'suspended'>('all');
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => { (async () => {
    const { data } = await supabase.from('tenants').select('status, created_at');
    const now = new Date();
    const count = (data ?? []).filter((ten: any) => {
      if (segment === 'all') return true;
      if (segment === 'active') return ten.status === 'active';
      if (segment === 'suspended') return ten.status === 'suspended';
      if (segment === 'trial') {
        const trialEnd = new Date(new Date(ten.created_at).getTime() + 14 * 86400000); // FIX: real trial is 14 days, not 7
        return now < trialEnd;
      }
      return true;
    }).length;
    setRecipientCount(count);
  })(); }, [segment]);

  const send = async () => {
    if (!subject || !body) { toast('error', t('super.comms.subjectBodyRequired')); return; }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/broadcast-notification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, segment }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error ?? t('super.err.unknown'));
      toast('success', t('super.comms.sent', { sent: result.sent, tenants: result.tenants ?? recipientCount }));
      setSubject(''); setBody('');
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card max-w-2xl p-6">
      <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">{t('super.comms.title')}</h3>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">{t('super.comms.desc')}</p>
      <div className="space-y-4">
        <Field label={t('super.comms.segment')}>
          <select value={segment} onChange={(e) => setSegment(e.target.value as any)} className="input">
            <option value="all">{t('super.comms.allTenants', { count: recipientCount })}</option>
            <option value="active">{t('super.comms.activeOnly')}</option>
            <option value="trial">{t('super.comms.trial')}</option>
            <option value="suspended">{t('super.comms.suspended')}</option>
          </select>
        </Field>
        <Field label={t('super.comms.subject')}><input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder={t('super.comms.subjectPlaceholder')} /></Field>
        <Field label={t('super.comms.message')}><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="input" placeholder={t('super.comms.messagePlaceholder')} /></Field>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500 dark:text-ink-400">{t('super.comms.recipients', { count: recipientCount })}</p>
          <button onClick={send} disabled={sending} className="btn-primary">
            {sending ? t('super.comms.sending') : <><Mail size={16} /> {t('super.comms.send')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuperMessages() {
  const { t, formatDateTime } = useI18n();
  const toast = useToast();
  // Real gap: the public Contact page (src/pages/ContactPage.tsx) has
  // always inserted into contact_messages, and that table's own RLS
  // policies were written for "super_admin can read/handle"
  // (migration 0006) — but no screen anywhere ever read from it. Every
  // message submitted through the site was invisible to the team unless
  // someone queried the database directly. This is the whole fix: list,
  // filter, and mark-handled, reusing the same tab pattern as the other
  // Super Admin sections.
  const [messages, setMessages] = useState<{ id: string; name: string; email: string; subject: string | null; message: string; handled: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unhandled'>('unhandled');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
    setMessages(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleHandled = async (m: { id: string; handled: boolean }) => {
    const { error } = await supabase.from('contact_messages').update({ handled: !m.handled }).eq('id', m.id);
    if (error) { toast('error', error.message); return; }
    setMessages((list) => list.map((x) => x.id === m.id ? { ...x, handled: !m.handled } : x));
  };

  const filtered = messages.filter((m) => filter === 'all' || !m.handled);
  const unhandledCount = messages.filter((m) => !m.handled).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setFilter('unhandled')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${filter === 'unhandled' ? 'bg-brand-500 text-white' : 'border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'}`}>
            {t('super.messages.unhandled', { count: unhandledCount })}
          </button>
          <button onClick={() => setFilter('all')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${filter === 'all' ? 'bg-brand-500 text-white' : 'border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300'}`}>
            {t('super.messages.all', { count: messages.length })}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="mx-auto animate-spin text-ink-300" size={24} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={MessageSquare} title={t('super.messages.empty.title')} description={t('super.messages.empty.desc')} />
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.id} className={`card p-4 ${m.handled ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink-900 dark:text-ink-50">{m.name} <span className="font-normal text-ink-400 dark:text-ink-500">— {m.email}</span></p>
                  {m.subject && <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{m.subject}</p>}
                  <p className="mt-1 text-sm text-ink-600 dark:text-ink-300 whitespace-pre-wrap">{m.message}</p>
                  <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">{formatDateTime(new Date(m.created_at))}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <a href={`mailto:${m.email}${m.subject ? `?subject=${encodeURIComponent('Re: ' + m.subject)}` : ''}`} className="rounded-lg border border-ink-200 dark:border-ink-700 p-2 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600" title={t('super.messages.reply')}>
                    <Mail size={15} />
                  </a>
                  <button onClick={() => toggleHandled(m)} className={`rounded-lg border p-2 ${m.handled ? 'border-ink-200 dark:border-ink-700 text-ink-400' : 'border-success-200 dark:border-success-800 text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25'}`} title={t(m.handled ? 'super.messages.markUnhandled' : 'super.messages.markHandled')}>
                    <Check size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuperSupport() {
  const { t, formatDateTime } = useI18n();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const callAgent = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-agent`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.error) throw new Error(json.error ?? t('super.err.unknown'));
    return json;
  };

  const reload = async () => {
    setLoading(true);
    try {
      const result = await callAgent({ action: 'list' });
      setConversations(result.conversations ?? []);
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); const i = setInterval(reload, 10000); return () => clearInterval(i); }, []);

  const openConversation = async (conv: any) => {
    setActive(conv);
    try {
      const result = await callAgent({ action: 'messages', conversation_id: conv.id });
      setMessages(result.messages ?? []);
    } catch (e: any) {
      toast('error', e.message);
    }
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    try {
      await callAgent({ action: 'reply', conversation_id: active.id, message: reply.trim() });
      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, sender: 'agent', content: reply.trim(), created_at: new Date().toISOString() }]);
      setReply('');
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async () => {
    if (!active) return;
    try {
      await callAgent({ action: 'close', conversation_id: active.id });
      toast('success', t('super.support.closed'));
      setActive(null);
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pending_human') return <Badge tone="warning">{t('super.support.pending')}</Badge>;
    if (status === 'active') return <Badge tone="brand">{t('super.support.active')}</Badge>;
    if (status === 'closed') return <Badge tone="neutral">{t('super.support.closedStatus')}</Badge>;
    return <Badge tone="neutral">{t('super.support.ai')}</Badge>;
  };

  const sorted = [...conversations].sort((a, b) => {
    const priority: Record<string, number> = { pending_human: 0, active: 1, ai: 2, closed: 3 };
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="card max-h-[70vh] overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <h3 className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('super.support.conversations')}</h3>
          {loading && <Loader2 size={14} className="animate-spin text-ink-400" />}
        </div>
        {sorted.length === 0 ? (
          <EmptyState icon={Headset} title={t('super.support.noConversation.title')} description={t('super.support.noConversation.desc')} />
        ) : (
          <div className="space-y-1">
            {sorted.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={`w-full rounded-xl p-2.5 text-left transition ${active?.id === c.id ? 'bg-brand-50 dark:bg-brand-900/25' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{c.visitor_email || c.tenants?.name || t('super.support.anonymous')}</p>
                  {statusBadge(c.status)}
                </div>
                <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">{formatDateTime(c.last_message_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card flex h-[70vh] flex-col p-0">
        {!active ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={Headset} title={t('super.support.selectConversation.title')} description={t('super.support.selectConversation.desc')} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 p-4">
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{active.visitor_email || active.tenants?.name || t('super.support.anonymous')}</p>
                <p className="text-xs text-ink-400 dark:text-ink-500">{statusBadge(active.status)}</p>
              </div>
              {active.status !== 'closed' && (
                <button onClick={closeConversation} className="btn-ghost text-xs"><Check size={13} /> {t('super.support.close')}</button>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.sender === 'agent' ? 'bg-brand-500 text-white' : m.sender === 'ai' ? 'bg-ink-100 dark:bg-ink-700 text-ink-800 dark:text-ink-100' : 'bg-action-50 dark:bg-action-900/30 text-ink-800 dark:text-ink-100'
                  }`}>
                    {m.sender === 'ai' && <span className="mb-0.5 block text-[10px] font-medium uppercase text-ink-400">{t('super.support.aiAssistant')}</span>}
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
            {active.status !== 'closed' && (
              <div className="flex items-center gap-2 border-t border-ink-100 dark:border-ink-800 p-3">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }}
                  placeholder={t('super.support.replyPlaceholder')}
                  className="input flex-1"
                />
                <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn-primary"><Send size={15} /></button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface SuperIntegration {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  logo_url: string;
  featured: boolean;
}

interface SuperConnection {
  id: string;
  tenant_id: string;
  integration_id: string;
  status: string;
  created_at: string;
}

function SuperIntegrations() {
  const { t, formatDate } = useI18n();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<SuperIntegration[]>([]);
  const [connections, setConnections] = useState<SuperConnection[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<SuperIntegration | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: integsData }, { data: connsData }] = await Promise.all([
      supabase.from('integration_providers').select('*').eq('status', 'active'),
      supabase.from('integration_connections').select('*'),
    ]);
    setIntegrations((integsData as SuperIntegration[]) ?? []);
    setConnections((connsData as SuperConnection[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const disconnect = async (connectionId: string) => {
    await supabase.from('integration_connections').delete().eq('id', connectionId);
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => {
          const integrationConnections = connections.filter((c) => c.integration_id === integration.id);
          const isConnected = integrationConnections.length > 0;
          return (
            <div key={integration.id} className="card p-5">
              <div className="mb-3 flex items-center gap-3">
                <img
                  src={integration.logo_url}
                  alt={integration.name}
                  className="h-10 w-10 rounded-lg object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ccc"/></svg>';
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{integration.name}</p>
                  <p className="text-xs text-ink-400 dark:text-ink-500">{integration.category}</p>
                </div>
                {integration.featured && <Badge tone="brand">{t('super.integrations.featured')}</Badge>}
              </div>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">{integration.description}</p>
              {isConnected && (
                <div className="mb-3 rounded-lg border border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/25 px-2.5 py-1.5">
                  <p className="flex items-center gap-1 text-xs text-success-700 dark:text-success-300">
                    <Check size={12} />
                    {t('super.integrations.connectionsCount').replace('{n}', String(integrationConnections.length))}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setSelectedIntegration(integration);
                  document.getElementById('super-active-connections')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="btn-secondary w-full text-sm"
              >
                {isConnected ? t('super.integrations.manage') : t('super.integrations.connect')}
              </button>
            </div>
          );
        })}
        {integrations.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon={Plug} title={t('super.integrations.empty.title')} description={t('super.integrations.empty.desc')} />
          </div>
        )}
      </div>

      {connections.length > 0 && (
        <div id="super-active-connections" className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">
            {t('super.integrations.activeConnections').replace('{n}', String(connections.length))}
          </h3>
          <div className="space-y-2">
            {connections.map((conn) => {
              const integration = integrations.find((i) => i.id === conn.integration_id);
              const isSelected = selectedIntegration?.id === conn.integration_id;
              return (
                <div
                  key={conn.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition ${
                    isSelected ? 'border-brand-400 ring-1 ring-brand-200 dark:ring-brand-800' : 'border-ink-100 dark:border-ink-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Check size={16} className="text-success-500" />
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{integration?.name ?? conn.integration_id}</p>
                      <p className="text-xs text-ink-400 dark:text-ink-500">{formatDate(conn.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => disconnect(conn.id)} className="btn-ghost text-xs text-error-600">
                    <Trash2 size={13} /> {t('super.integrations.disconnect')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
