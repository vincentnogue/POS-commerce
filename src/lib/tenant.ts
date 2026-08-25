import { useAuth } from './auth';

export function useTenant() {
  const { tenant, subscription } = useAuth();

  return {
    tenant,
    plan: subscription,
  };
}
