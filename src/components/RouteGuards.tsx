import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import { Spinner } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { user, tenant, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!tenant) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export function RequireActiveSubscription({ children }: { children: ReactNode }) {
  const { user, tenant, isSuperAdmin, access, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!tenant) return <Navigate to="/onboarding" replace />;

  // Super admins bypass subscription requirements. isSuperAdmin (unlike
  // member.role) checks every tenant_members row the user has, not just
  // the currently active tenant — see the comment on isSuperAdmin in
  // lib/auth.tsx. Using member.role here let a real super admin get
  // redirected to /subscribe simply because their currently-selected
  // tenant happened to be one where their own row isn't 'super_admin'.
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (access.blocked) return <Navigate to="/subscribe" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { member, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (isSuperAdmin) return <>{children}</>;
  if (!member || !roles.includes(member.role)) {
    return <Navigate to="/dashboard" state={{ from: location, denied: true }} replace />;
  }
  return <>{children}</>;
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // BUG FIX: this used member.role !== 'super_admin', but `member` is
  // scoped to whichever tenant is currently active (see lib/auth.tsx).
  // A genuine platform super admin who simply had a different tenant
  // selected — or who is also an ordinary member of another tenant —
  // was bounced straight back to "/" and could never reach /superadmin.
  // isSuperAdmin checks the role across ALL of the user's tenant_members
  // rows, exactly like the Super Admin nav item and the backend RLS
  // bypass (is_super_admin() in Postgres) already do.
  if (!isSuperAdmin) {
    return <Navigate to="/" state={{ from: location, denied: true }} replace />;
  }
  return <>{children}</>;
}
