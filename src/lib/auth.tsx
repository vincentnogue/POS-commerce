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
  planModules: string[] | null;
  isSuperAdmin: boolean;
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
  const [planModules, setPlanModules] = useState<string[] | null>(null);
  const [customRole, setCustomRole] = useState<CustomRole | null>(null);

  const loadSubscription = useCallback(async (tenantId: string | null) => {
    if (!tenantId) { setSubscription(null); setPlanModules(null); setCustomRole(null); return; }
    const [subRes, roleRes, tenantRes] = await Promise.all([
      supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle(),
      // Load custom role for the active member (resolved in loadProfile)
      Promise.resolve({ data: null as any }),
      supabase.from('tenants').select('plan_id').eq('id', tenantId).maybeSingle(),
    ]);
    setSubscription((subRes.data as Subscription) ?? null);
    setCustomRole((roleRes.data as CustomRole) ?? null);
    const planId = tenantRes.data?.plan_id;
    if (planId) {
      const { data: plan } = await supabase.from('plans').select('included_modules').eq('id', planId).maybeSingle();
      setPlanModules((plan?.included_modules as string[]) ?? null);
    } else {
      setPlanModules(null);
    }
  }, []);

  const loadCustomRole = useCallback(async (member: Member | null) => {
    if (!member?.custom_role_id) { setCustomRole(null); return; }
    const { data } = await supabase.from('custom_roles').select('*').eq('id', member.custom_role_id).maybeSingle();
    setCustomRole((data as CustomRole) ?? null);
  }, []);

  const loadProfile = useCallback(async (uid: string, email: string) => {
    // CRITICAL BUG FIX: this used to do `const { data: members } = await
    // supabase.from('tenant_members')...` and treat ANY falsy/empty
    // result — including a query that FAILED (expired/refreshing JWT,
    // transient network error) — identically to "this user genuinely has
    // zero tenants", which immediately set tenant=null and sent them to
    // /onboarding via RequireOnboarded. Onboarding asks for a business
    // name/country/etc., which looks exactly like "create a new account".
    // A real, returning user whose session access token needed a silent
    // refresh (tokens are short-lived; anyone coming back after it expired
    // would hit this on literally every visit) got bounced into onboarding
    // instead of seeing their existing business — reported as "the app
    // asks me to create a new account every time I log in".
    //
    // Fix: distinguish a genuinely-empty, successful result (0 rows, no
    // error — this user really has no tenant yet) from a failed request
    // (error present, or Supabase's browser client not yet done attaching
    // a just-refreshed session to outgoing requests). On failure, retry
    // once after a short delay instead of concluding "no tenant" from a
    // request that never actually got a real answer.
    const fetchMembers = () =>
      supabase.from('tenant_members')
        .select('id, tenant_id, user_id, role, custom_role_id, display_name, avatar_color')
        .eq('user_id', uid);

    let { data: members, error: membersError } = await fetchMembers();
    if (membersError) {
      // Give a possibly-still-refreshing session a moment, then retry once
      // before accepting the failure. This is the common case: the tab
      // was reopened / left open across the JWT's expiry window.
      await new Promise((r) => setTimeout(r, 800));
      ({ data: members, error: membersError } = await fetchMembers());
    }

    if (membersError) {
      // Still failing after a retry — a real (non-auth) problem. Do NOT
      // wipe an existing session's tenant/member state over a failed
      // request; just stop the loading spinner and leave things as they
      // were so the user isn't silently dropped into onboarding.
      console.error('Failed to load tenant memberships:', membersError.message);
      setUser({ id: uid, email });
      setLoading(false);
      return;
    }

    if (!members || members.length === 0) {
      setUser({ id: uid, email });
      setMember(null);
      setTenant(null);
      setTenants([]);
      setLoading(false);
      return;
    }

    const tenantIds = members.map((m) => m.tenant_id);
    const { data: tenantRows, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .in('id', tenantIds);

    if (tenantsError || !tenantRows) {
      console.error('Failed to load tenants:', tenantsError?.message);
      setUser({ id: uid, email });
      setLoading(false);
      return;
    }

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
  }, [loadSubscription, loadCustomRole]);

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
  // BUG FIX: `member` is scoped to the currently ACTIVE tenant, so checking
  // `member.role` here made super-admin status flip on/off depending on
  // which tenant the user happened to have selected. The real backend check
  // (see supabase/functions/super-admin-auth) looks for a super_admin role
  // across ALL of the user's tenant_members rows, independent of the active
  // tenant. Mirror that here so the Super Admin nav item stays visible
  // regardless of which store is currently selected.
  const isSuperAdmin = role === 'super_admin'
    || tenants.some((t) => t.member?.role === 'super_admin');
  // Custom role permissions override built-in defaults for non-admin roles
  const permissions: Permissions = (role === 'admin' || role === 'super_admin')
    ? builtInPerms
    : (customRole?.permissions ?? builtInPerms);

  const can = useCallback((mod: ModuleCode, act: PermissionAction): boolean => {
    if (isSuperAdmin) return true;
    // Plan-tier gating (mirrors can_on_tenant() in Postgres): a handful of
    // modules are always available regardless of plan; everything else
    // must be included in the tenant's current plan, independent of role.
    const alwaysAvailable = mod === 'dashboard' || mod === 'pos' || mod === 'settings';
    if (!alwaysAvailable && planModules && !planModules.includes(mod)) return false;
    if (role === 'admin') return true;
    const modPerms = permissions[mod];
    if (!modPerms) return false;
    return modPerms[act] === true;
  }, [permissions, isSuperAdmin, role, planModules]);
  const access = useMemo(
    () => computeAccess(tenant, subscription, isSuperAdmin, tenant?.created_at),
    [tenant, subscription, isSuperAdmin],
  );

  return (
    <AuthContext.Provider
      value={{
        user, member, tenant, tenants, permissions, customRole, can, loading, subscription, access, planModules, isSuperAdmin,
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
