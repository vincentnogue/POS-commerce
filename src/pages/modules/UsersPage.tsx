import { useEffect, useState } from 'react';
import { UserCog, Plus, Trash2, Shield, Pencil } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { supabase } from '../../lib/supabase';
import { PageHeader, Modal, EmptyState, Badge } from '../../components/ui';
import { Field } from '../../components/DataTable';
import type { Member, CustomRole } from '../../lib/types';
import { MODULES, PERMISSION_ACTIONS, type ModuleCode, type PermissionAction, type Permissions } from '../../lib/types';

const ROLE_LABELS: Record<string, { key: string; tone: any }> = {
  super_admin: { key: 'users.role.super_admin', tone: 'error' },
  admin: { key: 'users.role.admin', tone: 'brand' },
  manager: { key: 'users.role.manager', tone: 'flow' },
  staff: { key: 'users.role.staff', tone: 'neutral' },
};

const MODULE_LABELS: Record<ModuleCode, string> = {
  dashboard: 'users.module.dashboard',
  pos: 'users.module.pos',
  products: 'users.module.products',
  stock: 'users.module.stock',
  stores: 'users.module.stores',
  invoices: 'users.module.invoices',
  deliveries: 'users.module.deliveries',
  customers: 'users.module.customers',
  suppliers: 'users.module.suppliers',
  expenses: 'users.module.expenses',
  purchases: 'users.module.purchases',
  quotes: 'users.module.quotes',
  reports: 'users.module.reports',
  accounting: 'users.module.accounting',
  users: 'users.module.users',
  administration: 'users.module.administration',
  settings: 'users.module.settings',
};

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'users.action.view',
  create: 'users.action.create',
  update: 'users.action.update',
  delete: 'users.action.delete',
};

const emptyPerms = (): Permissions => {
  const p: any = {};
  MODULES.forEach((m) => { p[m] = { view: false, create: false, update: false, delete: false }; });
  return p as Permissions;
};

export function UsersPage() {
  const { tenant, member } = useAuth();
  const { t } = useI18n();
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
      if (!res.ok) { setInfo(t('users.err.generic', { msg: json.error ?? res.statusText })); return; }
      setInfo(json.invited
        ? t('users.info.invitedByEmail', { email: inviteEmail })
        : t('users.info.addedAsMember', { email: inviteEmail }));
      setInviteEmail(''); setInviteName(''); setInviteRole('staff'); setInviteCustomRoleId('');
      setModalOpen(false);
      await reload();
    } catch (e: any) {
      setInfo(t('users.err.generic', { msg: e.message }));
    } finally {
      setInviting(false);
    }
  };

  const remove = async (m: Member) => {
    if (m.user_id === member?.user_id) { setInfo(t('users.err.cannotRemoveSelf')); return; }
    if (!confirm(t('users.confirmRemove', { name: m.display_name ?? t('users.thisUser') }))) return;
    const { error } = await supabase.from('tenant_members').delete().eq('id', m.id);
    if (error) { setInfo(t('users.err.generic', { msg: error.message })); return; }
    await reload();
  };

  const updateRole = async (m: Member, role: string, customRoleId: string | null) => {
    const patch: any = { role };
    if (customRoleId) patch.custom_role_id = customRoleId;
    else patch.custom_role_id = null;
    const { error } = await supabase.from('tenant_members').update(patch).eq('id', m.id);
    if (error) { setInfo(t('users.err.generic', { msg: error.message })); return; }
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
      const { error } = await supabase.from('custom_roles').update(payload).eq('id', editingRole.id);
      if (error) { setInfo(t('users.err.generic', { msg: error.message })); return; }
    } else {
      const { error } = await supabase.from('custom_roles').insert(payload);
      if (error) { setInfo(t('users.err.generic', { msg: error.message })); return; }
    }
    setRoleModalOpen(false);
    await reload();
  };

  const deleteRole = async (r: CustomRole) => {
    if (!confirm(t('users.confirmDeleteRole', { name: r.name }))) return;
    const { error } = await supabase.from('custom_roles').delete().eq('id', r.id);
    if (error) { setInfo(t('users.err.generic', { msg: error.message })); return; }
    await reload();
  };

  const canManageRoles = member?.role === 'admin' || member?.role === 'super_admin';

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        subtitle={t('users.subtitle', { members: members.length, roles: roles.length })}
        action={canManageRoles ? (
          tab === 'members'
            ? <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={16} /> {t('users.invite')}</button>
            : <button onClick={openNewRole} className="btn-primary"><Plus size={16} /> {t('users.newRole')}</button>
        ) : undefined}
      />

      {info && <div className="mb-4 rounded-xl bg-brand-50 dark:bg-brand-900/25 p-3 text-sm text-brand-700">{info}</div>}

      <div className="mb-4 inline-flex rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-1">
        <button
          onClick={() => setTab('members')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'members' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}
        >{t('users.tab.team')}</button>
        {canManageRoles && (
          <button
            onClick={() => setTab('roles')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'roles' ? 'bg-brand-500 text-white' : 'text-ink-600 dark:text-ink-300'}`}
          >{t('users.tab.roles')}</button>
        )}
      </div>

      {tab === 'members' ? (
        members.length === 0 && !loading ? (
          <EmptyState icon={UserCog} title={t('users.emptyMembers.title')} description={t('users.emptyMembers.desc')} />
        ) : (
          <div className="card p-5">
            <div className="space-y-2">
              {members.map((m) => {
                const customRole = roles.find((r) => r.id === m.custom_role_id);
                return (
                  <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-ink-100 dark:border-ink-800 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-action-500 text-sm font-medium text-white">
                        {(m.display_name ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{m.display_name ?? t('users.invited')}</p>
                        {m.user_id === member?.user_id && <p className="text-xs text-ink-500 dark:text-ink-400">{t('users.you')}</p>}
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
                          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{t(l.key)}</option>)}
                        </select>
                      )}
                      {m.role === 'staff' && canManageRoles && roles.length > 0 && (
                        <select
                          value={m.custom_role_id ?? ''}
                          onChange={(e) => updateRole(m, m.role, e.target.value || null)}
                          disabled={m.user_id === member?.user_id}
                          className="input max-w-[160px]"
                        >
                          <option value="">{t('users.defaultRole')}</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      )}
                      <Badge tone={customRole ? 'flow' : ROLE_LABELS[m.role]?.tone}>
                        {customRole?.name ?? t(ROLE_LABELS[m.role]?.key ?? 'users.role.staff')}
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
            <EmptyState icon={Shield} title={t('users.emptyRoles.title')} description={t('users.emptyRoles.desc')} action={<button onClick={openNewRole} className="btn-primary"><Plus size={15} /> {t('users.createRole')}</button>} />
          ) : (
            <>
              <div className="card p-4">
                <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">
                  {t('users.rolesDesc.intro')} {t('users.rolesDesc.example')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {roles.map((r) => (
                    <div key={r.id} className="rounded-xl border border-ink-100 dark:border-ink-800 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-brand-600" />
                          <h4 className="font-medium text-ink-900 dark:text-ink-50">{r.name}</h4>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditRole(r)} className="rounded-md p-1 text-ink-500 dark:text-ink-400 hover:bg-brand-50 dark:hover:bg-brand-900/25 hover:text-brand-600"><Pencil size={13} /></button>
                          <button onClick={() => deleteRole(r)} className="rounded-md p-1 text-ink-500 dark:text-ink-400 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      {r.description && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{r.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {MODULES.filter((m) => r.permissions[m]?.view).slice(0, 6).map((m) => (
                          <span key={m} className="rounded-md bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-[10px] text-ink-600 dark:text-ink-300">{t(MODULE_LABELS[m])}</span>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('users.inviteMember')}>
        <div className="space-y-4">
          <Field label={t('users.field.name')}><input value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="input" placeholder={t('users.placeholder.optional')} /></Field>
          <Field label={t('users.field.email')}><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input" placeholder="email@exemple.com" /></Field>
          <Field label={t('users.field.baseRole')}>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input">
              {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'super_admin').map(([v, l]) => <option key={v} value={v}>{t(l.key)}</option>)}
            </select>
          </Field>
          {inviteRole === 'staff' && roles.length > 0 && (
            <Field label={t('users.field.customRoleOptional')}>
              <select value={inviteCustomRoleId} onChange={(e) => setInviteCustomRoleId(e.target.value)} className="input">
                <option value="">{t('users.defaultRole')}</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={invite} disabled={inviting} className="btn-primary">{inviting ? t('users.sending') : t('users.sendInvite')}</button>
        </div>
      </Modal>

      {/* Role editor modal */}
      <Modal open={roleModalOpen} onClose={() => setRoleModalOpen(false)} title={editingRole ? t('users.editRole') : t('users.newRoleTitle')} maxWidth="max-w-3xl">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('users.field.roleName')}><input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} className="input" placeholder={t('users.placeholder.roleName')} /></Field>
            <Field label={t('users.field.description')}><input value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} className="input" placeholder={t('users.placeholder.optional')} /></Field>
          </div>
          <div className="rounded-xl border border-ink-100 dark:border-ink-800">
            <div className="flex items-center justify-between border-b border-ink-100 dark:border-ink-800 px-4 py-2.5">
              <p className="text-sm font-medium text-ink-900 dark:text-ink-50">{t('users.permMatrix')}</p>
              <div className="flex gap-2 text-[10px]">
                <span className="font-medium text-ink-400 dark:text-ink-500">{t('users.moduleLabel')}</span>
                <span className="flex-1 text-center font-medium text-ink-400 dark:text-ink-500">{t('users.rightsHeader')}</span>
              </div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto scroll-thin">
              {MODULES.map((m) => (
                <div key={m} className="flex items-center justify-between border-b border-ink-50 dark:border-ink-800 px-4 py-2.5 last:border-0">
                  <span className="text-sm text-ink-700 dark:text-ink-200">{t(MODULE_LABELS[m])}</span>
                  <div className="flex gap-1.5">
                    {PERMISSION_ACTIONS.map((a) => {
                      const active = roleForm.permissions[m]?.[a] === true;
                      return (
                        <button
                          key={a}
                          onClick={() => togglePerm(m, a)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                            active ? 'bg-brand-500 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
                          }`}
                          title={`${t(ACTION_LABELS[a])} — ${t(MODULE_LABELS[m])}`}
                        >
                          {t(ACTION_LABELS[a])}
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
          <button onClick={() => setRoleModalOpen(false)} className="btn-ghost">{t('common.cancel')}</button>
          <button onClick={saveRole} className="btn-primary">{editingRole ? t('users.save') : t('users.createRoleBtn')}</button>
        </div>
      </Modal>
    </div>
  );
}
