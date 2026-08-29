import type { Tenant } from './types';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete';

export type Subscription = {
  id: string;
  tenant_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_cycle: string;
};

export const TRIAL_DAYS = 14; // FIX: real trial length is 14 days, not 7 — see supabase/migrations/20260830000000_0047_extend_trial_to_14_days.sql, must match

export type AccessState = {
  isSuperAdmin: boolean;
  inTrial: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  hasActiveSubscription: boolean;
  subscription: Subscription | null;
  blocked: boolean;
};

export function computeAccess(
  tenant: Tenant | null,
  subscription: Subscription | null,
  isSuperAdmin: boolean,
  tenantCreatedAt: string | undefined,
): AccessState {
  if (isSuperAdmin) {
    return {
      isSuperAdmin: true,
      inTrial: false,
      trialDaysLeft: 0,
      trialEndsAt: null,
      hasActiveSubscription: true,
      subscription: subscription,
      blocked: false,
    };
  }

  if (!tenant) {
    return {
      isSuperAdmin: false,
      inTrial: false,
      trialDaysLeft: 0,
      trialEndsAt: null,
      hasActiveSubscription: false,
      subscription: null,
      blocked: false,
    };
  }

  const now = new Date();

  if (subscription) {
    const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
    // CRITICAL: trust the trial end DATE over the status label. The
    // status field can go stale — nothing ever flips it from 'trialing'
    // to 'expired' on its own once the date passes (only a successful
    // payment webhook moves it to 'active'). Relying on
    // status === 'trialing' alone let anyone who simply never paid keep
    // indefinite access after their trial date had already passed.
    // When trial_ends_at is missing, fall back to the tenant creation
    // date + TRIAL_DAYS — matching the server-side tenant_access_active()
    // behavior, so a NULL trial date can never grant indefinite access.
    const fallbackTrialEnd = new Date(new Date(tenantCreatedAt ?? tenant.created_at).getTime() + TRIAL_DAYS * 86400000);
    const effectiveTrialEnd = trialEnd ?? fallbackTrialEnd;
    const inTrial = now < effectiveTrialEnd;
    const trialDaysLeft = Math.max(0, Math.ceil((effectiveTrialEnd.getTime() - now.getTime()) / 86400000));
    const hasActive = subscription.status === 'active' || subscription.status === 'past_due' || inTrial;

    return {
      isSuperAdmin: false,
      inTrial,
      trialDaysLeft,
      trialEndsAt: effectiveTrialEnd,
      hasActiveSubscription: hasActive,
      subscription,
      blocked: !hasActive,
    };
  }

  const created = new Date(tenantCreatedAt ?? tenant.created_at);
  const trialEnd = new Date(created.getTime() + TRIAL_DAYS * 86400000);
  const inTrial = now < trialEnd;
  const trialDaysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000));

  return {
    isSuperAdmin: false,
    inTrial,
    trialDaysLeft,
    trialEndsAt: trialEnd,
    hasActiveSubscription: false,
    subscription: null,
    blocked: !inTrial,
  };
}

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Email ou mot de passe incorrect.',
  'Invalid credentials': 'Email ou mot de passe incorrect.',
  'Email not confirmed': 'Email non confirmé. Veuillez vérifier votre boîte de réception.',
  'User already registered': 'Un compte existe déjà avec cet email. Essayez de vous connecter.',
  'Password should be at least 6 characters.': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Unable to validate email address: invalid format': 'Adresse email invalide.',
  'Email rate limit exceeded': 'Trop de tentatives. Veuillez patienter quelques minutes.',
  'User not found': 'Aucun compte trouvé avec cet email.',
  'Signup requires a valid password': 'Veuillez saisir un mot de passe valide.',
  'new row violates row-level security policy': 'Action non autorisée. Vérifiez que vous êtes connecté.',
};

export function translateAuthError(message: string | null): string | null {
  if (!message) return null;
  for (const [key, val] of Object.entries(ERROR_MAP)) {
    if (message.includes(key)) return val;
  }
  return message;
}
