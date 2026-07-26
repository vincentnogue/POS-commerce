import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, Building2, DollarSign, Code2, ScrollText, AlertTriangle,
  TrendingUp, Globe, Plus, Trash2, Pencil,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { convertToUSD } from '../../lib/localization';
import { PageHeader, Modal, Badge, EmptyState, StatCard } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { CommercialCode, AuditLog, Plan, Tenant } from '../../lib/types';

type Tab = 'overview' | 'tenants' | 'plans' | 'codes' | 'audit' | 'team';

export function AdministrationPage() {
  const { member, tenant } = useAuth();
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
        <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">Accès refusé</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">Vous n'avez pas les permissions nécessaires pour accéder à l'administration. Cette restriction est vérifiée côté serveur.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-5">Retour au tableau de bord</button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield; superOnly?: boolean }[] = [
    ...(isSuperAdmin ? [{ id: 'overview' as Tab, label: 'Vue plateforme', icon: TrendingUp }] : []),
    ...(isSuperAdmin ? [{ id: 'tenants' as Tab, label: 'Entreprises', icon: Building2 }] : []),
    ...(isSuperAdmin ? [{ id: 'plans' as Tab, label: 'Forfaits', icon: DollarSign }] : []),
    ...(isSuperAdmin ? [{ id: 'codes' as Tab, label: 'Codes commerciaux', icon: Code2 }] : []),
    ...(isSuperAdmin ? [{ id: 'audit' as Tab, label: "Journal d'audit", icon: ScrollText }] : []),
    { id: 'team' as Tab, label: 'Équipe & rôles', icon: Users },
  ];

  return (
    <div>
      <PageHeader
        title="Administration"
        subtitle={isSuperAdmin ? 'Espace Super Admin — vue plateforme LiAfrik' : 'Gérez votre équipe et vos rôles'}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-brand-500 text-white shadow-soft' : 'border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:border-brand-200'
            }`}
          >
            <t.icon size={15} /> {t.label}
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
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => { (async () => {
    const [t, p] = await Promise.all([
      supabase.from('tenants').select('*'),
      supabase.from('plans').select('*'),
    ]);
    setTenants((t.data as Tenant[]) ?? []);
    setPlans((p.data as Plan[]) ?? []);
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
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entreprises" value={tenants.length} icon={Building2} tone="brand" />
        <StatCard label="MRR (USD)" value={`$${mrrUSD.toFixed(0)}`} icon={DollarSign} tone="success" />
        <StatCard label="Plans actifs" value={plans.length} icon={Shield} tone="flow" />
        <StatCard label="Pays couverts" value={Object.keys(byCountry).length} icon={Globe} tone="action" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-ink-900 dark:text-ink-50">Répartition par forfait</h3>
          <div className="space-y-2">
            {Object.entries(byPlan).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 dark:text-ink-200">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(count / tenants.length) * 100}%` }} />
                  </div>
                  <span className="font-semibold text-ink-900 dark:text-ink-50">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-ink-900 dark:text-ink-50">Répartition par pays</h3>
          <div className="space-y-2">
            {Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-700 dark:text-ink-200">{name}</span>
                <span className="font-semibold text-ink-900 dark:text-ink-50">{count}</span>
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

  return (
    <div className="card p-5">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
          <th className="pb-2 font-semibold">Entreprise</th><th className="pb-2 font-semibold">Pays</th><th className="pb-2 font-semibold">Devise</th><th className="pb-2 font-semibold">Forfait</th><th className="pb-2 font-semibold">Statut</th>
        </tr></thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} className="border-b border-ink-50 dark:border-ink-800">
              <td className="py-3"><p className="font-semibold text-ink-900 dark:text-ink-50">{t.name}</p><p className="text-xs text-ink-500 dark:text-ink-400">{t.city}</p></td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{t.country_name}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{t.currency}</td>
              <td className="py-3"><Badge tone="brand">{planName(t.plan_id)}</Badge></td>
              <td className="py-3"><Badge tone={t.status === 'active' ? 'success' : 'neutral'}>{t.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
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
        <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
          <th className="pb-2 font-semibold">Nom</th><th className="pb-2 font-semibold">Code</th><th className="pb-2 font-semibold">Prix (USD)</th><th className="pb-2 font-semibold">Utilisateurs</th><th className="pb-2 font-semibold">Magasins</th><th className="pb-2 font-semibold">Produits</th><th></th>
        </tr></thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id} className="border-b border-ink-50 dark:border-ink-800">
              <td className="py-3 font-semibold text-ink-900 dark:text-ink-50">{p.name}</td>
              <td className="py-3 text-ink-600 dark:text-ink-300">{p.code}</td>
              <td className="py-3 font-semibold text-ink-900 dark:text-ink-50">${p.price_usd}</td>
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
        <EmptyState icon={Code2} title="Aucun code commercial" description="Créez des codes pour tracer vos commerciaux." />
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase text-ink-500 dark:text-ink-400">
            <th className="pb-2 font-semibold">Code</th><th className="pb-2 font-semibold">Commercial</th><th className="pb-2 font-semibold">Région</th><th className="pb-2 font-semibold">Ventes</th><th className="pb-2 font-semibold">Revenu généré</th><th className="pb-2 font-semibold">Statut</th><th></th>
          </tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-ink-50 dark:border-ink-800">
                <td className="py-3 font-mono font-semibold text-brand-700">{c.code}</td>
                <td className="py-3"><p className="font-semibold text-ink-900 dark:text-ink-50">{c.rep_name}</p>{c.rep_email && <p className="text-xs text-ink-500 dark:text-ink-400">{c.rep_email}</p>}</td>
                <td className="py-3 text-ink-600 dark:text-ink-300">{c.region ?? '—'}</td>
                <td className="py-3 text-ink-600 dark:text-ink-300">{c.total_sales}</td>
                <td className="py-3 font-semibold text-ink-900 dark:text-ink-50">${convertToUSD(c.total_revenue, 'USD').toFixed(0)}</td>
                <td className="py-3"><Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Actif' : 'Inactif'}</Badge></td>
                <td className="py-3"><button onClick={() => toggle(c)} className="text-xs font-semibold text-brand-600 hover:underline">{c.is_active ? 'Désactiver' : 'Activer'}</button></td>
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

function SuperAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100);
    setLogs((data as AuditLog[]) ?? []);
  })(); }, []);

  return (
    <div className="card p-5">
      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="Journal vide" description="Les actions sensibles apparaîtront ici." />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900 dark:text-ink-50">{l.action}</p>
                <span className="text-xs text-ink-500 dark:text-ink-400">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
              </div>
              {l.actor_email && <p className="text-xs text-ink-500 dark:text-ink-400">par {l.actor_email}</p>}
              {l.entity && <p className="text-xs text-ink-500 dark:text-ink-400">{l.entity}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamRoles({ tenantId }: { tenantId: string }) {
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
    return sales > 0 ? `${sales} vente(s)` : 'Aucune vente';
  };

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">Activité de l'équipe</h3>
        <p className="text-sm text-ink-500 dark:text-ink-400">Rôles, permissions et activité par membre du staff.</p>
      </div>
      {members.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">Aucun membre.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 dark:border-ink-800 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-action-500 text-xs font-bold text-white">
                  {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{m.display_name ?? 'Invité'}</p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    {m.role === 'super_admin' ? 'Super Admin' : m.role === 'admin' ? 'Propriétaire' : m.role === 'manager' ? 'Manager' : 'Vendeur'}
                    {m.custom_role_id && roleLabels[m.custom_role_id] ? ` · ${roleLabels[m.custom_role_id]}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
                <span className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-1">{lastSale(m.user_id)}</span>
                <span className="text-ink-400 dark:text-ink-500">Membre depuis {new Date(m.accepted_at ?? m.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-ink-500 dark:text-ink-400">La création de rôles personnalisés avec matrice de permissions fine par module est disponible dans Utilisateurs & Rôles.</p>
    </div>
  );
}
