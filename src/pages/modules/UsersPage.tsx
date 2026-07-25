import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, Shield, Pencil } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Member, CustomRole } from '../../lib/types';
import { MODULES, PERMISSION_ACTIONS, type ModuleCode, type PermissionAction, type Permissions } from '../../lib/types';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Propriétaire',
  manager: 'Manager',
  staff: 'Vendeur',
};

const ROLE_TONES: Record<string, any> = {
  super_admin: 'error',
  admin: 'brand',
  manager: 'flow',
  staff: 'neutral',
};

const MODULE_LABELS: Record<ModuleCode, string> = {
  dashboard: 'Tableau de bord',
  pos: 'Point de vente',
  products: 'Produits',
  stock: 'Stock',
  stores: 'Magasins',
  invoices: 'Factures',
  deliveries: 'Livraisons',
  customers: 'Clients',
  suppliers: 'Fournisseurs',
  expenses: 'Dépenses',
  purchases: 'Achats',
  quotes: 'Devis',
  reports: 'Rapports',
  accounting: 'Comptabilité',
  users: 'Utilisateurs',
  administration: 'Administration',
  settings: 'Paramètres',
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Voir',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
};

const emptyPerms = (): Permissions => {
  const p: any = {};
  MODULES.forEach((m) => { p[m] = { view: false, create: false, update: false, delete: false }; });
  return p as Permissions;
};

export function UsersPage() {
  const { tenant, member } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'members' | 'roles'>('members');

  // Member invite modal
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Role editor modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleForm, setRoleForm] = useState<{ name: string; description: string; permissions: Permissions }>({
    name: '', description: '', permissions: emptyPerms(),
  });

  const reload = async () => {
    if (!tenant) return;
    const [m, r] = await Promise.all([
      supabase.from('tenant_members').select('*').eq('tenant_id', tenant.id),
      supabase.from('custom_roles').select('*').eq('tenant_id', tenant.id).order('name'),
    ]);
    setMembers((m.data as Member[]) ?? []);
    setRoles((r.data as CustomRole[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [tenant]);

  const invite = async () => {
    setInfo(null);
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-member`;
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          tenant_id: tenant.id,
          role: inviteRole,
          custom_role_id: inviteCustomRoleId || undefined,
          display_name: inviteName || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setInfo(`Erreur: ${json.error ?? res.statusText}`); return; }
      setInfo(json.invited
        ? `Invitation envoyée par email à ${inviteEmail}.`
        : `${inviteEmail} a été ajouté comme membre.`);
      setInviteEmail(''); setInviteName(''); setInviteRole('staff'); setInviteCustomRoleId('');
      setModalOpen(false);
      await reload();
    } catch (e: any) {
      setInfo(`Erreur: ${e.message}`);
    } finally {
      setInviting(false);
    }
  };

  const remove = async (m: Member) => {
    if (m.user_id === member?.user_id) { setInfo('Vous ne pouvez pas vous retirer vous-même.'); return; }
    if (!confirm(`Retirer ${m.display_name ?? 'cet utilisateur'} ?`)) return;
    await supabase.from('tenant_members').delete().eq('id', m.id);
    await reload();
  };

  const updateRole = async (m: Member, role: string, customRoleId: string | null) => {
    const patch: any = { role };
    if (customRoleId) patch.custom_role_id = customRoleId;
    else patch.custom_role_id = null;
    await supabase.from('tenant_members').update(patch).eq('id', m.id);
    await reload();
  };

  // --- Role management ---
  const openNewRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', permissions: emptyPerms() });
    setRoleModalOpen(true);
  };

  const openEditRole = (r: CustomRole) => {
    setEditingRole(r);
    setRoleForm({ name: r.name, description: r.description ?? '', permissions: r.permissions });
    setRoleModalOpen(true);
  };

  const togglePerm = (mod: ModuleCode, act: PermissionAction) => {
    setRoleForm((f) => ({
      ...f,
      permissions: {
        ...f.permissions,
        [mod]: { ...(f.permissions[mod] ?? {}), [act]: !f.permissions[mod]?.[act] },
      },
    }));
  };

  const saveRole = async () => {
    if (!tenant || !roleForm.name.trim()) return;
    const payload = {
      tenant_id: tenant.id,
      name: roleForm.name.trim(),
      description: roleForm.description || null,
      permissions: roleForm.permissions,
    };
    if (editingRole) {
      await supabase.from('custom_roles').update(payload).eq('id', editingRole.id);
    } else {
      await supabase.from('custom_roles').insert(payload);
    }
    setRoleModalOpen(false);
    await reload();
  };

  const deleteRole = async (r: CustomRole) => {
    if (!confirm(`Supprimer le rôle "${r.name}" ? Les membres associés redeviendront "Vendeur".`)) return;
    await supabase.from('custom_roles').delete().eq('id', r.id);
    await reload();
  };

  const canManageRoles = member?.role === 'admin' || member?.role === 'super_admin';

  return (
    <div>
      <PageHeader
        title="Utilisateurs & Rôles"
        subtitle={`${members.length} membre(s) · ${roles.length} rôle(s) personnalisé(s)`}
        action={canManageRoles ? (
          tab === 'members'
            ? <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> Inviter</button>
            : <button onClick={openNewRole} className="btn-primary"><Plus size={16} /> Nouveau rôle</button>
        ) : undefined}
      />

      {info && <div className="mb-4 rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-sm text-brand-700">{info}</div>}

      <div className="mb-4 inline-flex rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
        <button
          onClick={() => setTab('members')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'members' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}
        >Équipe</button>
        {canManageRoles && (
          <button
            onClick={() => setTab('roles')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'roles' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}
          >Rôles & Permissions</button>
        )}
      </div>

      {tab === 'members' ? (
        members.length === 0 && !loading ? (
          <EmptyState icon={UserCog} title="Aucun membre" description="Invitez votre équipe." />
        ) : (
          <div className="card p-5">
            <div className="space-y-2">
              {members.map((m) => {
                const customRole = roles.find((r) => r.id === m.custom_role_id);
                return (
                  <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-action-500 text-sm font-bold text-white">
                        {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">{m.display_name ?? 'Invité'}</p>
                        {m.user_id === member?.user_id && <p className="text-xs text-ink-500 dark:text-ink-400">Vous</p>}
                        {customRole && <p className="text-xs text-brand-600">{customRole.name}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canManageRoles && (
                        <select
                          value={m.role}
                          onChange={(e) => {
                            const newRole = e.target.value;
                            if (newRole === 'staff' || newRole === 'manager') {
                              const cr = roles.find((r) => r.name.toLowerCase().includes(newRole === 'staff' ? 'caissier' : 'manager'));
                              updateRole(m, newRole, cr?.id ?? null);
                            } else {
                              updateRole(m, newRole, null);
                            }
                          }}
                          disabled={m.user_id === member?.user_id || m.role === 'super_admin'}
                          className="input max-w-[140px]"
                        >
                          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      )}
                      {m.role === 'staff' && canManageRoles && roles.length > 0 && (
                        <select
                          value={m.custom_role_id ?? ''}
                          onChange={(e) => updateRole(m, m.role, e.target.value || null)}
                          disabled={m.user_id === member?.user_id}
                          className="input max-w-[160px]"
                        >
                          <option value="">Rôle par défaut</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      )}
                      <Badge tone={customRole ? 'flow' : ROLE_TONES[m.role]}>
                        {customRole?.name ?? ROLE_LABELS[m.role]}
                      </Badge>
                      {canManageRoles && m.role !== 'super_admin' && (
                        <button onClick={() => remove(m)} className="rounded-lg p-1.5 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {roles.length === 0 && !loading ? (
            <EmptyState icon={Shield} title="Aucun rôle personnalisé" description="Créez des rôles avec des permissions sur mesure." action={<button onClick={openNewRole} className="btn-primary"><Plus size={15} /> Créer un rôle</button>} />
          ) : (
            <>
              <div className="card p-4">
                <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
                  Créez des rôles personnalisés pour contrôler précisément ce que chaque membre peut faire, module par module.
                  Exemple : un rôle « Caissier » peut voir les produits et encaisser des ventes, mais ne voit pas les prix d'achat ni ne peut modifier le stock.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {roles.map((r) => (
                    <div key={r.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-brand-600" />
                          <h4 className="font-semibold text-ink-900 dark:text-ink-50">{r.name}</h4>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditRole(r)} className="rounded-md p-1 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={13} /></button>
                          <button onClick={() => deleteRole(r)} className="rounded-md p-1 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {r.description && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{r.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {MODULES.filter((m) => r.permissions[m]?.view).slice(0, 6).map((m) => (
                          <span key={m} className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-[10px] text-ink-600 dark:text-ink-300">{MODULE_LABELS[m]}</span>
                        ))}
                        {MODULES.filter((m) => r.permissions[m]?.view).length > 6 && (
                          <span className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-[10px] text-ink-600 dark:text-ink-300">+{MODULES.filter((m) => r.permissions[m]?.view).length - 6}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Invite modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Inviter un membre">
        <div className="space-y-4">
          <Field label="Nom"><input value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="input" placeholder="Optionnel" /></Field>
          <Field label="Email"><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input" placeholder="email@exemple.com" /></Field>
          <Field label="Rôle de base">
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input">
              {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'super_admin').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {inviteRole === 'staff' && roles.length > 0 && (
            <Field label="Rôle personnalisé (optionnel)">
              <select value={inviteCustomRoleId} onChange={(e) => setInviteCustomRoleId(e.target.value)} className="input">
                <option value="">Rôle par défaut</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={invite} disabled={inviting} className="btn-primary">{inviting ? 'Envoi…' : 'Envoyer l\'invitation'}</button>
        </div>
      </Modal>

      {/* Role editor modal */}
      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={editingRole ? 'Modifier le rôle' : 'Nouveau rôle'} maxWidth="max-w-3xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom du rôle"><input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="input" placeholder="Ex: Caissier, Responsable stock…" /></Field>
            <Field label="Description"><input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className="input" placeholder="Optionnel" /></Field>
          </div>
          <div className="rounded-xl border border-ink-100 dark:border-ink-800">
            <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 px-4 py-2.5">
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-50">Matrice de permissions</p>
              <div className="flex gap-2 text-[10px]">
                <span className="font-medium text-ink-400 dark:text-ink-500">Module</span>
                <span className="flex-1 text-center font-medium text-ink-400 dark:text-ink-500">Droits (Voir / Créer / Modifier / Supprimer)</span>
              </div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto scroll-thin">
              {MODULES.map((m) => (
                <div key={m} className="flex items-center justify-between border-b border-ink-50 dark:border-ink-800 px-4 py-2.5 last:border-0">
                  <span className="text-sm text-ink-700 dark:text-ink-200">{MODULE_LABELS[m]}</span>
                  <div className="flex gap-1.5">
                    {PERMISSION_ACTIONS.map((a) => {
                      const active = roleForm.permissions[m]?.[a] === true;
                      return (
                        <button
                          key={a}
                          onClick={() => togglePerm(m, a)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            active ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:bg-ink-700'
                          }`}
                          title={`${ACTION_LABELS[a]} — ${MODULE_LABELS[m]}`}
                        >
                          {ACTION_LABELS[a]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setRoleModalOpen(false)} className="btn-ghost">Annuler</button>
          <button onClick={saveRole} className="btn-primary">{editingRole ? 'Enregistrer' : 'Créer le rôle'}</button>
        </div>
      </Modal>
    </div>
  );
}
