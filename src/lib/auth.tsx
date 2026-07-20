import { useEffect, useState, useCallback, createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { supabase } from './supabase';
import type { Member, Role, Tenant, Permissions, ModuleCode, PermissionAction, CustomRole } from './types';
import { DEFAULT_PERMISSIONS } from './types';
import type { Subscription } from './access';
import { computeAccess, translateAuthError } from './access';

type AuthUser = {
  id: string;
  email: string;
};

const PLATFORM_ADMIN_EMAILS = [
  'vincentnogue2@gmail.com',
  'vincentnogue@yahoo.com',
  'webdxb1@gmail.com',
];

type AuthContextValue = {
  user: AuthUser | null;
  member: Member | null;
  tenant: Tenant | null;
  tenants: { tenant: Tenant; member: Member }[];
  permissions: Permissions;
  customRole: CustomRole | null;
  can: (mod: ModuleCode, act: PermissionAction) => boolean;
  loading: boolean;
  subscription: Subscription | null;
  access: ReturnType<typeof computeAccess>;
  isPlatformAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; data: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchTenant: (tenantId: string) => void;
  activeTenantId: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACTIVE_TENANT_KEY = 'liafrik_active_tenant';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<{ tenant: Tenant; member: Member }[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [customRole, setCustomRole] = useState<CustomRole | null>(null);

  const loadSubscription = useCallback(async (tenantId: string | null) => {
    if (!tenantId) { setSubscription(null); setCustomRole(null); return; }
    const [subRes, roleRes] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle(),
      // Load custom role for the active member (resolved in loadProfile)
      Promise.resolve({ data: null as any }),
    ]);
    setSubscription((subRes.data as Subscription) ?? null);
    setCustomRole((roleRes.data as CustomRole) ?? null);
  }, []);

  const loadCustomRole = useCallback(async (member: Member | null) => {
    if (!member?.custom_role_id) { setCustomRole(null); return; }
    const { data } = await supabase.from('custom_roles').select('*').eq('id', member.custom_role_id).maybeSingle();
    setCustomRole((data as CustomRole) ?? null);
  }, []);

  const loadProfile = useCallback(async (uid: string, email: string) => {
    // Fetch all memberships for this user, with tenant + role data
    const { data: members } = await supabase
      .from('tenant_members')
      .select('id, tenant_id, user_id, role, custom_role_id, display_name, avatar_color')
      .eq('user_id', uid);

    if (!members || members.length === 0) {
      setUser({ id: uid, email });
      setMember(null);
      setTenant(null);
      setTenants([]);
      setLoading(false);
      return;
    }

    const tenantIds = members.map((m) => m.tenant_id);
    const { data: tenantRows } = await supabase
      .from('tenants')
      .select('*')
      .in('id', tenantIds);

    const list = (tenantRows || []).map((t) => ({
      tenant: t as Tenant,
      member: (members.find((m) => m.tenant_id === t.id) as unknown) as Member,
    }));

    setTenants(list);
    setUser({ id: uid, email });

    // Pick active tenant: stored preference, else first
    const stored = localStorage.getItem(ACTIVE_TENANT_KEY);
    const chosen = list.find((l) => l.tenant.id === stored) ?? list[0];
    setTenant(chosen.tenant);
    setMember(chosen.member);
    setActiveTenantId(chosen.tenant.id);
    await Promise.all([loadSubscription(chosen.tenant.id), loadCustomRole(chosen.member)]);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id, user.email);
  }, [user, loadProfile]);

  const switchTenant = useCallback((tenantId: string) => {
    const found = tenants.find((l) => l.tenant.id === tenantId);
    if (found) {
      setTenant(found.tenant);
      setMember(found.member);
      setActiveTenantId(found.tenant.id);
      localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
      loadSubscription(tenantId);
      loadCustomRole(found.member);
    }
  }, [tenants, loadSubscription, loadCustomRole]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!mounted) return;
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email ?? '');
        } else {
          setUser(null);
          setMember(null);
          setTenant(null);
          setTenants([]);
          setSubscription(null);
          setCustomRole(null);
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
    };
  }, [loadProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: translateAuthError(error?.message ?? null) };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error: translateAuthError(error?.message ?? null), data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    setUser(null);
    setMember(null);
    setTenant(null);
    setTenants([]);
    setSubscription(null);
    setCustomRole(null);
  };

  const role: Role = (member?.role ?? 'staff') as Role;
  const builtInPerms = DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.staff;
  const isSuperAdmin = role === 'super_admin';
  const isPlatformAdmin = isSuperAdmin && !!user?.email && PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase());
  // Custom role permissions override built-in defaults for non-admin roles
  const permissions: Permissions = (role === 'admin' || role === 'super_admin')
    ? builtInPerms
    : (customRole?.permissions ?? builtInPerms);

  const can = useCallback((mod: ModuleCode, act: PermissionAction): boolean => {
    if (isSuperAdmin || role === 'admin') return true;
    const modPerms = permissions[mod];
    if (!modPerms) return false;
    return modPerms[act] === true;
  }, [permissions, isSuperAdmin, role]);
  const access = useMemo(
    () => computeAccess(tenant, subscription, isSuperAdmin, tenant?.created_at),
    [tenant, subscription, isSuperAdmin],
  );

  return (
    <AuthContext.Provider
      value={{
        user, member, tenant, tenants, permissions, customRole, can, loading, subscription, access, isPlatformAdmin,
        signIn, signUp, signOut, refreshProfile, switchTenant, activeTenantId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
