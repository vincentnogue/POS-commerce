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
  const { user, tenant, member, access, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!tenant) return <Navigate to="/onboarding" replace />;
  
  // Super admins bypass subscription requirements
  if (member?.role === 'super_admin') {
    return <>{children}</>;
  }
  
  if (access.blocked) return <Navigate to="/subscribe" replace />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { member, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!member || !roles.includes(member.role)) {
    return <Navigate to="/dashboard" state={{ from: location, denied: true }} replace />;
  }
  return <>{children}</>;
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { user, member, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!member || member.role !== 'super_admin') {
    return <Navigate to="/" state={{ from: location, denied: true }} replace />;
  }
  return <>{children}</>;
}
