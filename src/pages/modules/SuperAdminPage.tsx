import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Crown, Building2, Users, DollarSign, TrendingUp,
  Pencil, Trash2, Ban, Check, Plus, Activity, CreditCard,
  Search, AlertTriangle, Mail, Eye, Loader2, BarChart3, Award, UserCog, Headset, Send,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { convertToUSD } from '../../lib/localization';
import { PageHeader, Modal, Badge, StatCard, EmptyState, Spinner, useToast } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Tenant, Plan, CommercialCode, AuditLog } from '../../lib/types';

type Tab = 'overview' | 'tenants' | 'employees' | 'subscriptions' | 'admins' | 'staff' | 'plans' | 'codes' | 'performance' | 'audit' | 'monitoring' | 'comms' | 'support';

// Sections a scoped staff member can ever be granted. Must mirror
// GRANTABLE_SECTIONS in the platform-staff-manage edge function.
const GRANTABLE_SECTIONS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Vue plateforme' },
  { id: 'tenants', label: 'Entreprises' },
  { id: 'employees', label: 'Employés' },
  { id: 'subscriptions', label: 'Abonnements' },
  { id: 'plans', label: 'Forfaits' },
  { id: 'codes', label: 'Codes commerciaux' },
  { id: 'performance', label: 'Performance' },
  { id: 'audit', label: "Journal d'audit" },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'comms', label: 'Communications' },
  { id: 'support', label: 'Support client' },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Propriétaire',
  manager: 'Manager',
  staff: 'Vendeur',
};

export function SuperAdminPage() {
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
        if (!token) { setBackendVerified(false); setVerifyError('Non connecté.'); return; }
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-auth`;
        const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.authorized) {
          setBackendVerified(true);
          setIsFullAdmin(!!json.isFullAdmin);
          setStaffPermissions(json.permissions ?? null);
        } else {
          setBackendVerified(false);
          setVerifyError(json.reason ?? json.error ?? 'Accès refusé.');
        }
      } catch (e: any) {
        setBackendVerified(false);
        setVerifyError(e.message ?? 'Erreur de vérification.');
      }
    })();
  }, []);

  if (backendVerified === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-brand-500" />
        <p className="text-sm text-ink-500 dark:text-ink-400">Vérification de l'accès…</p>
      </div>
    );
  }

  if (!backendVerified) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-error-50 dark:bg-error-900/25 text-error-600">
          <Shield size={26} />
        </div>
        <h2 className="text-lg font-medium text-ink-900 dark:text-ink-50">Accès réservé</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">
          {verifyError ?? "Ce module est réservé aux administrateurs de la plateforme. Votre tentative d'accès a été journalisée."}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-5">Retour au tableau de bord</button>
      </div>
    );
  }

  const allTabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Vue plateforme', icon: TrendingUp },
    { id: 'tenants', label: 'Entreprises', icon: Building2 },
    { id: 'employees', label: 'Employés', icon: Users },
    { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
    { id: 'admins', label: 'Super Admins', icon: Crown },
    { id: 'staff', label: 'Staff plateforme', icon: UserCog },
    { id: 'plans', label: 'Forfaits', icon: DollarSign },
    { id: 'codes', label: 'Codes commerciaux', icon: Activity },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'monitoring', label: 'Monitoring', icon: Eye },
    { id: 'audit', label: "Journal d'audit", icon: Shield },
    { id: 'comms', label: 'Communications', icon: Mail },
    { id: 'support', label: 'Support client', icon: Headset },
  ];

  // 'admins' and 'staff' (managing staff itself) are never delegable — only
  // full platform admins ever see them. Everything else is gated by the
  // staff member's granted permissions.
  const tabs = isFullAdmin
    ? allTabs
    : allTabs.filter((t) => t.id !== 'admins' && t.id !== 'staff' && staffPermissions?.[t.id]);

  const activeTab = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id ?? null;

  return (
    <div>
      <PageHeader
        title="Super Admin"
        subtitle="Console de gestion de la plateforme LiAfrik"
        action={<Badge tone="error"><Crown size={12} /> Super Admin</Badge>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === t.id ? 'bg-brand-500 text-white shadow-soft' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:border-brand-200'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {!isFullAdmin && (
        <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-900/25 dark:border-warning-800 px-4 py-2 text-xs text-warning-700 dark:text-warning-300">
          Accès staff plateforme — sections limitées à ce qui vous a été accordé.
        </div>
      )}
      {activeTab === 'overview' && <SuperOverview />}
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
      {activeTab === 'support' && <SuperSupport />}
    </div>
  );
}

function SuperOverview() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState(0);
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => { (async () => {
    const [t, p, m, s] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('plans').select('*'),
      supabase.from('tenant_members').select('id', { count: 'exact', head: true }),
      supabase.from('sales').select('total').eq('status', 'completed'),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
    setEmployees(m.count ?? 0);
    setTotalSales((s.data ?? []).reduce((sum: number, x: any) => sum + Number(x.total), 0));
  })(); }, []);

  const mrrUSD = tenants.reduce((s, t) => {
    const plan = plans.find((p) => p.id === t.plan_id);
    return s + (plan?.price_usd ?? 0);
  }, 0);
  const arrUSD = mrrUSD * 12;
  const activeTenants = tenants.filter((t) => t.status === 'active').length;
  const churnRate = tenants.length > 0 ? ((tenants.length - activeTenants) / tenants.length * 100).toFixed(1) : '0';

  const byCountry: Record<string, number> = {};
  tenants.forEach((t) => { byCountry[t.country_name] = (byCountry[t.country_name] ?? 0) + 1; });
  const byPlan: Record<string, number> = {};
  tenants.forEach((t) => {
    const plan = plans.find((p) => p.id === t.plan_id);
    const name = plan?.name ?? 'Aucun';
    byPlan[name] = (byPlan[name] ?? 0) + 1;
  });

  return (
    <div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Entreprises" value={tenants.length} icon={Building2} tone="brand" />
        <StatCard label="Employés" value={employees} icon={Users} tone="action" />
        <StatCard label="MRR (USD)" value={`$${mrrUSD.toFixed(0)}`} icon={DollarSign} tone="success" />
        <StatCard label="ARR (USD)" value={`$${arrUSD.toFixed(0)}`} icon={TrendingUp} tone="flow" />
        <StatCard label="Churn" value={`${churnRate}%`} icon={AlertTriangle} tone="warning" />
        <StatCard label="Ventes globales" value={`$${totalSales.toFixed(0)}`} icon={Activity} tone="action" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">Répartition par forfait</h3>
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
          <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">Répartition par pays</h3>
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
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [impersonating, setImpersonating] = useState<Tenant | null>(null);

  useEffect(() => { (async () => {
    const [t, p] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('*'),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
  })(); }, []);

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';
  const filtered = tenants.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.country_name.toLowerCase().includes(search.toLowerCase()));

  const toggleStatus = async (t: Tenant) => {
    const newStatus = t.status === 'active' ? 'suspended' : 'active';
    const { error } = await supabase.from('tenants').update({ status: newStatus }).eq('id', t.id);
    if (error) { toast('error', error.message); return; }
    setTenants((list) => list.map((x) => x.id === t.id ? { ...x, status: newStatus } : x));
    toast(newStatus === 'active' ? 'success' : 'info', `${t.name} ${newStatus === 'active' ? 'activé' : 'suspendu'}`);
  };

  const deleteTenant = async (t: Tenant) => {
    if (!confirm(`Supprimer définitivement ${t.name} ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from('tenants').delete().eq('id', t.id);
    if (error) { toast('error', `Échec de la suppression : ${error.message}`); return; }
    setTenants((list) => list.filter((x) => x.id !== t.id));
    toast('error', `${t.name} supprimé`);
  };

  const impersonate = (t: Tenant) => {
    localStorage.setItem('liafrik_impersonation', t.id);
    setImpersonating(t);
    toast('info', `Connexion en tant que ${t.name}…`);
    setTimeout(() => window.location.reload(), 1500);
  };

  const subStatus = (t: Tenant) => {
    if (t.status === 'suspended') return { tone: 'error' as const, label: 'Suspendu' };
    const created = new Date(t.created_at);
    const trialEnd = new Date(created.getTime() + 7 * 86400000);
    if (new Date() < trialEnd) return { tone: 'warning' as const, label: 'Essai' };
    return { tone: 'success' as const, label: 'Actif' };
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">{tenants.length} entreprises</h3>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
            <th className="pb-2 font-medium">Entreprise</th><th className="pb-2 font-medium">Pays</th><th className="pb-2 font-medium">Forfait</th><th className="pb-2 font-medium">Statut</th><th className="pb-2 font-medium">Créé le</th><th className="pb-2 font-medium text-right">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((t) => {
              const ss = subStatus(t);
              return (
                <tr key={t.id} className="border-b border-ink-50 dark:border-ink-800">
                  <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{t.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{t.city}</p></td>
                  <td className="py-3 text-ink-600 dark:text-ink-300">{t.country_name}</td>
                  <td className="py-3"><Badge tone="brand">{planName(t.plan_id)}</Badge></td>
                  <td className="py-3"><Badge tone={ss.tone}>{ss.label}</Badge></td>
                  <td className="py-3 text-ink-500 dark:text-ink-400 text-xs">{new Date(t.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => impersonate(t)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-flow-50 dark:hover:bg-flow-900/25 hover:text-flow-600" title="Se connecter en tant que"><Eye size={15} /></button>
                      <button onClick={() => toggleStatus(t)} className={`rounded-lg p-1.5 ${t.status === 'active' ? 'text-error-600 hover:bg-error-50 dark:hover:bg-error-900/25' : 'text-success-600 hover:bg-success-50 dark:hover:bg-success-900/25'}`} title={t.status === 'active' ? 'Suspendre' : 'Activer'}>
                        {t.status === 'active' ? <Ban size={15} /> : <Check size={15} />}
                      </button>
                      <button onClick={() => deleteTenant(t)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600" title="Supprimer"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!impersonating} onClose={() => setImpersonating(null)} title="Impersonation">
        <p className="text-sm text-ink-600 dark:text-ink-300">Connexion en tant que <strong>{impersonating?.name}</strong>… Cette action est journalisée.</p>
      </Modal>
    </div>
  );
}

function SuperEmployees() {
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
        <StatCard label="Total employés" value={members.length} icon={Users} tone="brand" />
        <StatCard label="Propriétaires" value={roleCounts['admin'] ?? 0} icon={Crown} tone="flow" />
        <StatCard label="Managers" value={roleCounts['manager'] ?? 0} icon={Shield} tone="action" />
        <StatCard label="Vendeurs" value={roleCounts['staff'] ?? 0} icon={Activity} tone="success" />
      </div>
      <div className="card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">Tous les employés de la plateforme</h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="input pl-9" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input max-w-[140px]">
              <option value="all">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Propriétaire</option>
              <option value="manager">Manager</option>
              <option value="staff">Vendeur</option>
            </select>
          </div>
        </div>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Aucun employé" description="Aucun membre ne correspond à votre recherche." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                <th className="pb-2 font-medium">Employé</th><th className="pb-2 font-medium">Entreprise</th><th className="pb-2 font-medium">Rôle</th><th className="pb-2 font-medium">Membre depuis</th>
              </tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                          {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium text-ink-900 dark:text-ink-50">{m.display_name ?? 'Invité'}</p>
                      </div>
                    </td>
                    <td className="py-3"><p className="text-ink-700 dark:text-ink-200">{m.tenants?.name ?? '—'}</p><p className="text-xs text-ink-500 dark:text-ink-400">{m.tenants?.city}, {m.tenants?.country_name}</p></td>
                    <td className="py-3"><Badge tone={m.role === 'super_admin' ? 'error' : m.role === 'admin' ? 'brand' : m.role === 'manager' ? 'flow' : 'neutral'}>{ROLE_LABELS[m.role] ?? m.role}</Badge></td>
                    <td className="py-3 text-ink-500 dark:text-ink-400 text-xs">{new Date(m.accepted_at ?? m.created_at).toLocaleDateString('fr-FR')}</td>
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
        <StatCard label="Abonnements actifs" value={subs.filter((s) => s.status === 'active').length} icon={CreditCard} tone="success" />
        <StatCard label="MRR (USD)" value={`$${totalMRR.toFixed(0)}`} icon={DollarSign} tone="brand" />
        <StatCard label="Impayés" value={unpaid.length} icon={AlertTriangle} tone="error" />
      </div>
      {unpaid.length > 0 && (
        <div className="card border-error-200 p-4">
          <div className="flex items-center gap-2 text-error-700">
            <AlertTriangle size={18} />
            <p className="text-sm font-medium">{unpaid.length} abonnement(s) en retard de paiement — relance nécessaire</p>
          </div>
        </div>
      )}
      <div className="card p-5">
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">Historique des abonnements</h3>
        {loading ? <Spinner /> : subs.length === 0 ? (
          <EmptyState icon={CreditCard} title="Aucun abonnement" description="Les abonnements apparaîtront ici." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                <th className="pb-2 font-medium">Entreprise</th><th className="pb-2 font-medium">Forfait</th><th className="pb-2 font-medium">Statut</th><th className="pb-2 font-medium">Cycle</th><th className="pb-2 font-medium">Période fin</th>
              </tr></thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b border-ink-50 dark:border-ink-800">
                    <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{s.tenants?.name ?? '—'}</p><p className="text-xs text-ink-500 dark:text-ink-400">{s.tenants?.country_name}</p></td>
                    <td className="py-3"><Badge tone="brand">{planName(s.plan_id)}</Badge></td>
                    <td className="py-3"><Badge tone={s.status === 'active' ? 'success' : s.status === 'trialing' ? 'warning' : s.status === 'past_due' ? 'error' : 'neutral'}>{s.status}</Badge></td>
                    <td className="py-3 text-ink-600 dark:text-ink-300">{s.billing_cycle}</td>
                    <td className="py-3 text-ink-500 dark:text-ink-400 text-xs">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString('fr-FR') : '—'}</td>
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
    if (!res.ok || json.error) throw new Error(json.error ?? 'Erreur inconnue');
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
        ? `${newEmail} est maintenant Super Admin.`
        : `${newEmail} ajouté à la liste — l'accès s'activera dès que ce compte sera créé.`);
      setNewEmail(''); setNewLabel(''); setFormOpen(false);
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (email: string) => {
    if (!confirm(`Retirer ${email} des administrateurs de la plateforme ?`)) return;
    setBusy(true);
    try {
      await callManage({ action: 'remove', email });
      toast('success', `${email} retiré des Super Admins.`);
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
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">Administrateurs de la plateforme</h3>
          </div>
          <button onClick={() => setFormOpen((v) => !v)} className="btn-primary text-sm"><Plus size={15} /> Ajouter</button>
        </div>
        <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
          Vérifiés côté serveur (table platform_admins). L'accès Super Admin nécessite d'être dans cette liste ET d'avoir le rôle super_admin.
          {!canRemove && <span className="ml-1 font-medium text-warning-600">Minimum 2 administrateurs — retrait désactivé tant qu'il n'y en a pas plus.</span>}
        </p>

        {formOpen && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-ink-100 dark:border-ink-800 p-4 sm:flex-row sm:items-end">
            <Field label="Email">
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="email@exemple.com" className="input" />
            </Field>
            <Field label="Étiquette (optionnel)">
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex: Responsable support" className="input" />
            </Field>
            <button disabled={busy} onClick={handleAdd} className="btn-primary shrink-0">Confirmer</button>
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
                      <button onClick={() => setEditingEmail(null)} className="text-xs text-ink-400">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingEmail(pa.email); setEditingLabel(pa.label ?? ''); }} className="text-xs text-error-600 hover:underline">
                      {pa.label ?? 'Admin'} — modifier
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="error"><Crown size={11} /> {pa.label}</Badge>
                <button
                  disabled={!canRemove || busy}
                  onClick={() => handleRemove(pa.email)}
                  title={!canRemove ? 'Il doit rester au moins 2 administrateurs' : 'Retirer'}
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
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">Membres avec rôle super_admin</h3>
        {loading ? <Spinner /> : superAdminMembers.length === 0 ? (
          <EmptyState icon={Users} title="Aucun super admin" description="Aucun membre avec rôle super_admin." />
        ) : (
          <div className="space-y-2">
            {superAdminMembers.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-ink-100 dark:border-ink-800 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                    {(a.display_name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{a.display_name ?? 'Invité'}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400">{(a.tenants as any)?.name ?? '—'}</p>
                  </div>
                </div>
                <Badge tone="brand">Super Admin</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuperStaff() {
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
    if (!res.ok || json.error) throw new Error(json.error ?? 'Erreur inconnue');
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
        ? `${newEmail} a maintenant un accès staff limité.`
        : `${newEmail} ajouté — l'accès s'activera dès que ce compte sera créé.`);
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
    if (!confirm(`Retirer ${email} du staff plateforme ?`)) return;
    setBusy(true);
    try {
      await callManage({ action: 'remove', email });
      toast('success', `${email} retiré.`);
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
      toast('success', 'Permissions mises à jour.');
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const permBadges = (perms: Record<string, boolean>) => {
    const granted = GRANTABLE_SECTIONS.filter((s) => perms?.[s.id]);
    if (granted.length === 0) return <span className="text-xs text-ink-400 dark:text-ink-500">Aucun accès accordé</span>;
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {granted.map((s) => <Badge key={s.id} tone="neutral">{s.label}</Badge>)}
      </div>
    );
  };

  return (
    <div className="card p-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={18} className="text-brand-600" />
          <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">Staff plateforme (accès limité)</h3>
        </div>
        <button onClick={() => setFormOpen((v) => !v)} className="btn-primary text-sm"><Plus size={15} /> Ajouter</button>
      </div>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
        Employés LiAfrik avec un accès partiel au Super Admin (ex: support client). Distinct des Super Admins — ne peuvent jamais gérer d'autres admins/staff.
      </p>

      {formOpen && (
        <div className="mb-4 space-y-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Field label="Email"><input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" placeholder="email@exemple.com" className="input" /></Field>
            <Field label="Étiquette"><input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Ex: Support client" className="input" /></Field>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-ink-500 dark:text-ink-400">Sections accessibles</p>
            <div className="flex flex-wrap gap-3">
              {GRANTABLE_SECTIONS.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-ink-700 dark:text-ink-200">
                  <input type="checkbox" checked={!!newPerms[s.id]} onChange={(e) => setNewPerms((p) => ({ ...p, [s.id]: e.target.checked }))} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <button disabled={busy} onClick={handleAdd} className="btn-primary">Confirmer</button>
        </div>
      )}

      {loading ? <Spinner /> : staff.length === 0 ? (
        <EmptyState icon={UserCog} title="Aucun staff" description="Aucun membre du staff plateforme pour l'instant." />
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
                    <p className="text-xs text-ink-500 dark:text-ink-400">{s.label}</p>
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
                        {sec.label}
                      </label>
                    ))}
                  </div>
                  <button disabled={busy} onClick={() => saveEdit(s.email)} className="btn-primary mt-3 text-sm">Enregistrer</button>
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
    toast('success', 'Forfait enregistré.');
  };

  const remove = async (p: Plan) => {
    if (!confirm(`Supprimer le forfait ${p.name} ?`)) return;
    const { error } = await supabase.from('plans').delete().eq('id', p.id);
    if (error) { toast('error', error.message); return; }
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end"><button onClick={() => { setEditing(null); setForm({ name: '', code: '', price_usd: 0, max_users: 1, max_stores: 1, max_products: 50 }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nouveau forfait</button></div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
          <th className="pb-2 font-medium">Nom</th><th className="pb-2 font-medium">Code</th><th className="pb-2 font-medium">Prix (USD)</th><th className="pb-2 font-medium">Utilisateurs</th><th className="pb-2 font-medium">Magasins</th><th className="pb-2 font-medium">Produits</th><th></th>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le forfait' : 'Nouveau forfait'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <Field label="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" /></Field>
          <Field label="Prix USD"><input type="number" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: Number(e.target.value) })} className="input" /></Field>
          <Field label="Utilisateurs max"><input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: Number(e.target.value) })} className="input" /></Field>
          <Field label="Magasins max"><input type="number" value={form.max_stores} onChange={(e) => setForm({ ...form, max_stores: Number(e.target.value) })} className="input" /></Field>
          <Field label="Produits max"><input type="number" value={form.max_products} onChange={(e) => setForm({ ...form, max_products: Number(e.target.value) })} className="input" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </Modal>
    </div>
  );
}

function SuperCodes() {
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
    toast('success', 'Code commercial créé.');
  };

  const toggle = async (c: CommercialCode) => {
    const { error } = await supabase.from('commercial_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    if (error) { toast('error', error.message); return; }
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-ink-500 dark:text-ink-400">Ventes et clients par code : voir l'onglet <span className="font-medium text-brand-600">Performance</span>.</p>
        <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> Nouveau code</button>
      </div>
      {codes.length === 0 ? (
        <EmptyState icon={Activity} title="Aucun code commercial" description="Créez des codes pour tracer vos commerciaux." />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
            <th className="pb-2 font-medium">Code</th><th className="pb-2 font-medium">Commercial</th><th className="pb-2 font-medium">Région</th><th className="pb-2 font-medium">Statut</th><th></th>
          </tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-ink-50 dark:border-ink-800">
                <td className="py-3 font-mono font-medium text-brand-700">{c.code}</td>
                <td className="py-3"><p className="font-medium text-ink-900 dark:text-ink-50">{c.rep_name}</p>{c.rep_email && <p className="text-xs text-ink-500 dark:text-ink-400">{c.rep_email}</p>}</td>
                <td className="py-3 text-ink-600 dark:text-ink-300">{c.region ?? '—'}</td>
                <td className="py-3"><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Actif' : 'Inactif'}</Badge></td>
                <td className="py-3"><button onClick={() => toggle(c)} className="text-xs font-medium text-brand-600 hover:underline">{c.is_active ? 'Désactiver' : 'Activer'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau code commercial">
        <div className="space-y-4">
          <Field label="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" placeholder="Ex: LIAFRIK-001" /></Field>
          <Field label="Nom du commercial"><input value={form.rep_name} onChange={(e) => setForm({ ...form, rep_name: e.target.value })} className="input" /></Field>
          <Field label="Email"><input value={form.rep_email} onChange={(e) => setForm({ ...form, rep_email: e.target.value })} className="input" /></Field>
          <Field label="Région"><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="input" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={save} className="btn-primary">Créer</button>
        </div>
      </Modal>
    </div>
  );
}

function SuperPerformance() {
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
      if (!res.ok || json.error) throw new Error(json.error ?? 'Erreur');
      setStaff(json.staff ?? []);
      setCommercials(json.commercials ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  })(); }, []);

  const fmtUSD = (n: number) => `$${convertToUSD(n, 'USD').toFixed(0)}`;
  const timeAgo = (iso: string | null) => {
    if (!iso) return 'Jamais';
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    return `Il y a ${days} j`;
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error) return <EmptyState icon={AlertTriangle} title="Erreur" description={error} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setView('staff')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === 'staff' ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'}`}>
          Performance staff
        </button>
        <button onClick={() => setView('commercials')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${view === 'commercials' ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300'}`}>
          Performance commerciaux
        </button>
      </div>

      {view === 'staff' && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award size={18} className="text-brand-600" />
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">Performance du staff — toutes entreprises</h3>
          </div>
          {staff.length === 0 ? (
            <EmptyState icon={Users} title="Aucune donnée" description="Aucun membre du staff trouvé." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
                    <th className="pb-2 font-medium">Membre</th>
                    <th className="pb-2 font-medium">Entreprise</th>
                    <th className="pb-2 font-medium">Rôle</th>
                    <th className="pb-2 text-right font-medium">Ventes</th>
                    <th className="pb-2 text-right font-medium">CA généré</th>
                    <th className="pb-2 text-right font-medium">Actions (log)</th>
                    <th className="pb-2 text-right font-medium">Dernière activité</th>
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
                      <td className="py-3"><Badge tone="neutral">{ROLE_LABELS[s.role] ?? s.role}</Badge></td>
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
            <h3 className="text-base font-medium text-ink-900 dark:text-ink-50">Performance des commerciaux — par code</h3>
          </div>
          {commercials.length === 0 ? (
            <EmptyState icon={Activity} title="Aucun code commercial" description="Créez des codes dans l'onglet Codes commerciaux." />
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
                        <p className="text-xs text-ink-500 dark:text-ink-400">{c.region ?? '—'} · {c.clients.length} client(s) inscrit(s) avec ce code</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{fmtUSD(c.salesRevenue)}</p>
                        <p className="text-xs text-ink-500 dark:text-ink-400">{c.salesCount} vente(s)</p>
                      </div>
                      <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Actif' : 'Inactif'}</Badge>
                    </div>
                  </button>
                  {expandedCode === c.id && (
                    <div className="border-t border-ink-100 dark:border-ink-800 p-3">
                      {c.clients.length === 0 ? (
                        <p className="text-xs text-ink-500 dark:text-ink-400">Aucun client n'a encore utilisé ce code à l'inscription.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {c.clients.map((cl: any) => (
                            <div key={cl.id} className="flex items-center justify-between rounded-lg bg-ink-50 dark:bg-ink-800/60 px-3 py-2 text-sm">
                              <span className="font-medium text-ink-800 dark:text-ink-100">{cl.name}</span>
                              <span className="text-xs text-ink-500 dark:text-ink-400">Inscrit le {new Date(cl.signedUpAt).toLocaleDateString('fr-FR')}</span>
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => { (async () => {
    const { data: t } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
    setTenants((t as Tenant[]) ?? []);
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
        <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">État des entreprises</h3>
        <div className="space-y-2">
          {tenants.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-ink-100 dark:border-ink-800 p-3">
              <div className="flex items-center gap-3">
                <div className={`h-2.5 w-2.5 rounded-full ${t.status === 'active' ? 'bg-success-500' : 'bg-error-500'}`} />
                <div>
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t.name}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">{t.country_name} · {t.currency}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                <span>Créé: {new Date(t.created_at).toLocaleDateString('fr-FR')}</span>
                <Badge tone={t.status === 'active' ? 'success' : 'error'}>{t.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperAudit() {
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
        <button onClick={() => setView('audit')} className={`rounded-full px-4 py-2 text-sm font-medium ${view === 'audit' ? 'bg-brand-500 text-white' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200'}`}>Journal d'audit</button>
        <button onClick={() => setView('access')} className={`rounded-full px-4 py-2 text-sm font-medium ${view === 'access' ? 'bg-brand-500 text-white' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200'}`}>Tentatives d'accès Super Admin</button>
      </div>
      <div className="card p-5">
        {view === 'audit' ? (
          logs.length === 0 ? <EmptyState icon={Shield} title="Journal vide" description="Les actions sensibles apparaîtront ici." /> : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink-900 dark:text-ink-50">{l.action}</p>
                    <span className="text-xs text-ink-500 dark:text-ink-400">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  {l.actor_email && <p className="text-xs text-ink-500 dark:text-ink-400">par {l.actor_email}</p>}
                  {l.entity && <p className="text-xs text-ink-500 dark:text-ink-400">{l.entity}</p>}
                </div>
              ))}
            </div>
          )
        ) : (
          accessLogs.length === 0 ? <EmptyState icon={Shield} title="Aucune tentative" description="Les tentatives d'accès au Super Admin apparaîtront ici." /> : (
            <div className="space-y-2">
              {accessLogs.map((al) => (
                <div key={al.id} className={`rounded-xl border p-3 text-sm ${al.authorized ? 'border-success-100 bg-success-50/30 dark:bg-success-900/25' : 'border-error-100 bg-error-50/30 dark:bg-error-900/25'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone={al.authorized ? 'success' : 'error'}>{al.authorized ? 'Autorisé' : 'Refusé'}</Badge>
                      <span className="font-medium text-ink-900 dark:text-ink-50">{al.actor_email ?? 'Inconnu'}</span>
                    </div>
                    <span className="text-xs text-ink-500 dark:text-ink-400">{new Date(al.created_at).toLocaleString('fr-FR')}</span>
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
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<'all' | 'active' | 'trial' | 'suspended'>('all');
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => { (async () => {
    const { data } = await supabase.from('tenants').select('status, created_at');
    const now = new Date();
    const count = (data ?? []).filter((t: any) => {
      if (segment === 'all') return true;
      if (segment === 'active') return t.status === 'active';
      if (segment === 'suspended') return t.status === 'suspended';
      if (segment === 'trial') {
        const trialEnd = new Date(new Date(t.created_at).getTime() + 7 * 86400000);
        return now < trialEnd;
      }
      return true;
    }).length;
    setRecipientCount(count);
  })(); }, [segment]);

  const send = async () => {
    if (!subject || !body) { toast('error', 'Sujet et message requis'); return; }
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
      if (!res.ok || result.error) throw new Error(result.error ?? 'Erreur inconnue');
      toast('success', `Notification envoyée à ${result.sent} destinataire(s) dans ${result.tenants ?? recipientCount} entreprise(s).`);
      setSubject(''); setBody('');
    } catch (e: any) {
      toast('error', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card max-w-2xl p-6">
      <h3 className="mb-4 text-base font-medium text-ink-900 dark:text-ink-50">Communication globale</h3>
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">Envoyez une annonce à tous les tenants ou un segment spécifique.</p>
      <div className="space-y-4">
        <Field label="Segment">
          <select value={segment} onChange={(e) => setSegment(e.target.value as any)} className="input">
            <option value="all">Tous les tenants ({recipientCount})</option>
            <option value="active">Actifs uniquement</option>
            <option value="trial">En essai</option>
            <option value="suspended">Suspendus</option>
          </select>
        </Field>
        <Field label="Sujet"><input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Objet du message" /></Field>
        <Field label="Message"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="input" placeholder="Contenu du message…" /></Field>
        <div className="flex items-center justify-between">
          <p className="text-sm text-ink-500 dark:text-ink-400">{recipientCount} destinataire(s)</p>
          <button onClick={send} disabled={sending} className="btn-primary">
            {sending ? 'Envoi…' : <><Mail size={16} /> Envoyer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function SuperSupport() {
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
    if (!res.ok || json.error) throw new Error(json.error ?? 'Erreur inconnue');
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
      toast('success', 'Conversation clôturée.');
      setActive(null);
      await reload();
    } catch (e: any) {
      toast('error', e.message);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'pending_human') return <Badge tone="warning">En attente</Badge>;
    if (status === 'active') return <Badge tone="brand">Active</Badge>;
    if (status === 'closed') return <Badge tone="neutral">Clôturée</Badge>;
    return <Badge tone="neutral">IA</Badge>;
  };

  const sorted = [...conversations].sort((a, b) => {
    const priority: Record<string, number> = { pending_human: 0, active: 1, ai: 2, closed: 3 };
    return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="card max-h-[70vh] overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <h3 className="text-sm font-medium text-ink-900 dark:text-ink-50">Conversations</h3>
          {loading && <Loader2 size={14} className="animate-spin text-ink-400" />}
        </div>
        {sorted.length === 0 ? (
          <EmptyState icon={Headset} title="Aucune conversation" description="Les demandes de support apparaîtront ici." />
        ) : (
          <div className="space-y-1">
            {sorted.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={`w-full rounded-xl p-2.5 text-left transition ${active?.id === c.id ? 'bg-brand-50 dark:bg-brand-900/25' : 'hover:bg-ink-50 dark:hover:bg-ink-800/60'}`}
              >
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{c.visitor_email || c.tenants?.name || 'Visiteur anonyme'}</p>
                  {statusBadge(c.status)}
                </div>
                <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">{new Date(c.last_message_at).toLocaleString('fr-FR')}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card flex h-[70vh] flex-col p-0">
        {!active ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState icon={Headset} title="Sélectionnez une conversation" description="Choisissez une conversation dans la liste pour répondre." />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 p-4">
              <div>
                <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{active.visitor_email || active.tenants?.name || 'Visiteur anonyme'}</p>
                <p className="text-xs text-ink-400 dark:text-ink-500">{statusBadge(active.status)}</p>
              </div>
              {active.status !== 'closed' && (
                <button onClick={closeConversation} className="btn-ghost text-xs"><Check size={13} /> Clôturer</button>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    m.sender === 'agent' ? 'bg-brand-500 text-white' : m.sender === 'ai' ? 'bg-ink-100 dark:bg-ink-700 text-ink-800 dark:text-ink-100' : 'bg-action-50 dark:bg-action-900/30 text-ink-800 dark:text-ink-100'
                  }`}>
                    {m.sender === 'ai' && <span className="mb-0.5 block text-[10px] font-medium uppercase text-ink-400">Assistant IA</span>}
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
                  placeholder="Répondre au client…"
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
