import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Crown, Building2, Users, DollarSign, Globe, TrendingUp,
  Pencil, Trash2, Ban, Check, Plus, Activity,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { convertToUSD } from '../../lib/localization';
import { PageHeader, Modal, Badge, StatCard, EmptyState } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Tenant, Plan, CommercialCode, AuditLog } from '../../lib/types';

type Tab = 'overview' | 'tenants' | 'employees' | 'admins' | 'plans' | 'codes' | 'audit';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Propriétaire',
  manager: 'Manager',
  staff: 'Vendeur',
};

export function SuperAdminPage() {
  const { member, isPlatformAdmin } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = member?.role === 'super_admin';
  const [tab, setTab] = useState<Tab>('overview');

  if (!isSuperAdmin || !isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-error-50 text-error-600">
          <Crown size={26} />
        </div>
        <h2 className="text-lg font-semibold text-ink-900">Accès Super Admin</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          Ce module est réservé à l'administrateur de la plateforme. L'accès est vérifié par rôle et par adresse email.
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-5">Retour au tableau de bord</button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Vue plateforme', icon: TrendingUp },
    { id: 'tenants', label: 'Entreprises', icon: Building2 },
    { id: 'employees', label: 'Employés', icon: Users },
    { id: 'admins', label: 'Super Admins', icon: Crown },
    { id: 'plans', label: 'Forfaits', icon: DollarSign },
    { id: 'codes', label: 'Codes commerciaux', icon: Activity },
    { id: 'audit', label: "Journal d'audit", icon: Shield },
  ];

  return (
    <div>
      <PageHeader
        title="Super Admin"
        subtitle="Console de gestion de la plateforme LIYHA GROUP"
        action={<Badge tone="error"><Crown size={12} /> Super Admin</Badge>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-500 text-white shadow-soft' : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-200'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <SuperOverview />}
      {tab === 'tenants' && <SuperTenants />}
      {tab === 'employees' && <SuperEmployees />}
      {tab === 'admins' && <SuperAdmins />}
      {tab === 'plans' && <SuperPlans />}
      {tab === 'codes' && <SuperCodes />}
      {tab === 'audit' && <SuperAudit />}
    </div>
  );
}

function SuperOverview() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState(0);

  useEffect(() => { (async () => {
    const [t, p, m] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('plans').select('*'),
      supabase.from('tenant_members').select('id', { count: 'exact', head: true }),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
    setEmployees(m.count ?? 0);
  })(); }, []);

  const mrrUSD = tenants.reduce((s, t) => {
    const plan = plans.find((p) => p.id === t.plan_id);
    return s + (plan?.price_usd ?? 0);
  }, 0);

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
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Entreprises" value={tenants.length} icon={Building2} tone="brand" />
        <StatCard label="Employés" value={employees} icon={Users} tone="action" />
        <StatCard label="MRR (USD)" value={`$${mrrUSD.toFixed(0)}`} icon={DollarSign} tone="success" />
        <StatCard label="Plans actifs" value={plans.length} icon={Shield} tone="flow" />
        <StatCard label="Pays couverts" value={Object.keys(byCountry).length} icon={Globe} tone="action" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-ink-900">Répartition par forfait</h3>
          <div className="space-y-2">
            {Object.entries(byPlan).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${tenants.length ? (count / tenants.length) * 100 : 0}%` }} />
                  </div>
                  <span className="font-semibold text-ink-900">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-ink-900">Répartition par pays</h3>
          <div className="space-y-2">
            {Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700">{name}</span>
                <span className="font-semibold text-ink-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SuperTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  useEffect(() => { (async () => {
    const [t, p] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('*'),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
  })(); }, []);

  const planName = (id: string | null) => plans.find((p) => p.id === id)?.name ?? '—';
  const toggleStatus = async (t: Tenant) => {
    const newStatus = t.status === 'active' ? 'suspended' : 'active';
    await supabase.from('tenants').update({ status: newStatus }).eq('id', t.id);
    setTenants((list) => list.map((x) => x.id === t.id ? { ...x, status: newStatus } : x));
  };

  return (
    <div className="card p-5">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-500">
          <th className="pb-2 font-semibold">Entreprise</th><th className="pb-2 font-semibold">Pays</th><th className="pb-2 font-semibold">Devise</th><th className="pb-2 font-semibold">Forfait</th><th className="pb-2 font-semibold">Statut</th><th></th>
        </tr></thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} className="border-b border-ink-50">
              <td className="py-3"><p className="font-semibold text-ink-900">{t.name}</p><p className="text-xs text-ink-500">{t.city} · {new Date(t.created_at).toLocaleDateString('fr-FR')}</p></td>
              <td className="py-3 text-ink-600">{t.country_name}</td>
              <td className="py-3 text-ink-600">{t.currency}</td>
              <td className="py-3"><Badge tone="brand">{planName(t.plan_id)}</Badge></td>
              <td className="py-3"><Badge tone={t.status === 'active' ? 'success' : 'error'}>{t.status === 'active' ? 'Actif' : 'Suspendu'}</Badge></td>
              <td className="py-3 text-right">
                <button onClick={() => toggleStatus(t)} className={`rounded-lg p-1.5 ${t.status === 'active' ? 'text-error-600 hover:bg-error-50' : 'text-success-600 hover:bg-success-50'}`} title={t.status === 'active' ? 'Suspendre' : 'Activer'}>
                  {t.status === 'active' ? <Ban size={15} /> : <Check size={15} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <h3 className="text-base font-semibold text-ink-900">Tous les employés de la plateforme</h3>
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="input max-w-[200px]"
            />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input max-w-[140px]">
              <option value="all">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Propriétaire</option>
              <option value="manager">Manager</option>
              <option value="staff">Vendeur</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-ink-400">Chargement…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="Aucun employé" description="Aucun membre ne correspond à votre recherche." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-500">
                <th className="pb-2 font-semibold">Employé</th><th className="pb-2 font-semibold">Entreprise</th><th className="pb-2 font-semibold">Rôle</th><th className="pb-2 font-semibold">Membre depuis</th>
              </tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-ink-50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                          {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-semibold text-ink-900">{m.display_name ?? 'Invité'}</p>
                      </div>
                    </td>
                    <td className="py-3">
                      <p className="text-ink-700">{m.tenants?.name ?? '—'}</p>
                      <p className="text-xs text-ink-500">{m.tenants?.city}, {m.tenants?.country_name}</p>
                    </td>
                    <td className="py-3"><Badge tone={m.role === 'super_admin' ? 'error' : m.role === 'admin' ? 'brand' : m.role === 'manager' ? 'flow' : 'neutral'}>{ROLE_LABELS[m.role] ?? m.role}</Badge></td>
                    <td className="py-3 text-ink-500 text-xs">{new Date(m.accepted_at ?? m.created_at).toLocaleDateString('fr-FR')}</td>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase.from('tenant_members').select('*, tenants!inner(name)').eq('role', 'super_admin').order('created_at', { ascending: false });
    setAdmins(data ?? []);
    setLoading(false);
  })(); }, []);

  const PLATFORM_ADMIN_EMAILS = [
    'vincentnogue2@gmail.com',
    'vincentnogue@yahoo.com',
    'webdxb1@gmail.com',
  ];

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Crown size={18} className="text-error-600" />
          <h3 className="text-base font-semibold text-ink-900">Administrateurs de la plateforme</h3>
        </div>
        <p className="mb-4 text-sm text-ink-500">
          Ces emails ont accès total à la console Super Admin. Seuls ces comptes peuvent accéder au module Super Admin, quelle que soit l'entreprise à laquelle ils appartiennent.
        </p>
        <div className="space-y-2">
          {PLATFORM_ADMIN_EMAILS.map((email) => (
            <div key={email} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error-500 text-xs font-bold text-white">
                  {email.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{email}</p>
                  <p className="text-xs text-error-600">Accès plateforme complet</p>
                </div>
              </div>
              <Badge tone="error"><Crown size={11} /> Fondateur</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <h3 className="mb-4 text-base font-semibold text-ink-900">Membres avec rôle super_admin</h3>
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-400">Chargement…</p>
        ) : admins.length === 0 ? (
          <EmptyState icon={Users} title="Aucun super admin" description="Aucun membre avec rôle super_admin trouvé." />
        ) : (
          <div className="space-y-2">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                    {(a.display_name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{a.display_name ?? 'Invité'}</p>
                    <p className="text-xs text-ink-500">{(a.tenants as any)?.name ?? '—'}</p>
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

function SuperPlans() {
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
    if (editing) {
      await supabase.from('plans').update(form).eq('id', editing.id);
    } else {
      await supabase.from('plans').insert({ ...form, features: [], is_active: true, sort_order: plans.length });
    }
    setModalOpen(false);
    await reload();
  };

  const remove = async (p: Plan) => {
    if (!confirm(`Supprimer le forfait ${p.name} ?`)) return;
    await supabase.from('plans').delete().eq('id', p.id);
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end"><button onClick={() => { setEditing(null); setForm({ name: '', code: '', price_usd: 0, max_users: 1, max_stores: 1, max_products: 50 }); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nouveau forfait</button></div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-500">
          <th className="pb-2 font-semibold">Nom</th><th className="pb-2 font-semibold">Code</th><th className="pb-2 font-semibold">Prix (USD)</th><th className="pb-2 font-semibold">Utilisateurs</th><th className="pb-2 font-semibold">Magasins</th><th className="pb-2 font-semibold">Produits</th><th></th>
        </tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-b border-ink-50">
              <td className="py-3 font-semibold text-ink-900">{p.name}</td>
              <td className="py-3 text-ink-600">{p.code}</td>
              <td className="py-3 font-semibold text-ink-900">${p.price_usd}</td>
              <td className="py-3 text-ink-600">{p.max_users}</td>
              <td className="py-3 text-ink-600">{p.max_stores}</td>
              <td className="py-3 text-ink-600">{p.max_products}</td>
              <td className="py-3 text-right">
                <button onClick={() => { setEditing(p); setForm({ name: p.name, code: p.code, price_usd: p.price_usd, max_users: p.max_users, max_stores: p.max_stores, max_products: p.max_products }); setModalOpen(true); }} className="rounded-lg p-1.5 text-ink-500 hover:bg-brand-50 hover:text-brand-600"><Pencil size={15} /></button>
                <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-ink-500 hover:bg-error-50 hover:text-error-600"><Trash2 size={15} /></button>
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

  const reload = async () => {
    const { data } = await supabase.from('commercial_codes').select('*').order('created_at', { ascending: false });
    setCodes((data as CommercialCode[]) ?? []);
  };
  useEffect(() => { reload(); }, []);

  const save = async () => {
    await supabase.from('commercial_codes').insert({ code: form.code, rep_name: form.rep_name, rep_email: form.rep_email || null, region: form.region || null, is_active: true });
    setModalOpen(false);
    setForm({ code: '', rep_name: '', rep_email: '', region: '' });
    await reload();
  };

  const toggle = async (c: CommercialCode) => {
    await supabase.from('commercial_codes').update({ is_active: !c.is_active }).eq('id', c.id);
    await reload();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex justify-end"><button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> Nouveau code</button></div>
      {codes.length === 0 ? (
        <EmptyState icon={Activity} title="Aucun code commercial" description="Créez des codes pour tracer vos commerciaux." />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 text-left text-xs uppercase text-ink-500">
            <th className="pb-2 font-semibold">Code</th><th className="pb-2 font-semibold">Commercial</th><th className="pb-2 font-semibold">Région</th><th className="pb-2 font-semibold">Ventes</th><th className="pb-2 font-semibold">Revenu</th><th className="pb-2 font-semibold">Statut</th><th></th>
          </tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-ink-50">
                <td className="py-3 font-mono font-semibold text-brand-700">{c.code}</td>
                <td className="py-3"><p className="font-semibold text-ink-900">{c.rep_name}</p>{c.rep_email && <p className="text-xs text-ink-500">{c.rep_email}</p>}</td>
                <td className="py-3 text-ink-600">{c.region ?? '—'}</td>
                <td className="py-3 text-ink-600">{c.total_sales}</td>
                <td className="py-3 font-semibold text-ink-900">${convertToUSD(c.total_revenue, 'USD').toFixed(0)}</td>
                <td className="py-3"><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Actif' : 'Inactif'}</Badge></td>
                <td className="py-3"><button onClick={() => toggle(c)} className="text-xs font-semibold text-brand-600 hover:underline">{c.is_active ? 'Désactiver' : 'Activer'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau code commercial">
        <div className="space-y-4">
          <Field label="Code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" placeholder="Ex: LIYHA-001" /></Field>
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

function SuperAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    setLogs((data as AuditLog[]) ?? []);
  })(); }, []);

  return (
    <div className="card p-5">
      {logs.length === 0 ? (
        <EmptyState icon={Shield} title="Journal vide" description="Les actions sensibles apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-ink-100 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">{l.action}</p>
                <span className="text-xs text-ink-500">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
              </div>
              {l.actor_email && <p className="text-xs text-ink-500">par {l.actor_email}</p>}
              {l.entity && <p className="text-xs text-ink-500">{l.entity}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
