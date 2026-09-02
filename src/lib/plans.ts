export type Plan = {
  name: string;
  code: string;
  priceMonthly: number;
  maxUsers: number;
  maxStores: number;
  maxProducts: number;
  // Feature i18n keys (see plan.feature.* in locales/{fr,en}.ts) — NOT
  // display text. Every consumer must call t(`plan.feature.${id}`), same
  // as they already call t(`plan.name.${code}`) for the plan name. Kept
  // as stable IDs here (not French/English strings) so this single
  // source of truth works for every language, not just one.
  features: string[];
  highlight: boolean;
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: 'Starter',
    code: 'starter',
    priceMonthly: 9,
    maxUsers: 2,
    maxStores: 1,
    maxProducts: 50,
    features: ['pos', 'stock', 'customers', 'communitySupport'],
    highlight: false,
  },
  {
    name: 'Pro',
    code: 'pro',
    priceMonthly: 19,
    maxUsers: 5,
    maxStores: 2,
    maxProducts: 500,
    features: ['pos', 'stock', 'customers', 'autoInvoices', 'deliveries', 'suppliers', 'advancedReports', 'emailSupport24h'],
    highlight: true,
    popular: true,
  },
  {
    name: 'Premium',
    code: 'premium',
    priceMonthly: 49,
    maxUsers: 15,
    maxStores: 5,
    maxProducts: 10000,
    features: ['pos', 'stock', 'customers', 'autoInvoices', 'deliveries', 'suppliers', 'advancedReports', 'fullAccounting', 'customRoles', 'prioritySupport2h'],
    highlight: false,
  },
  {
    name: 'Entreprise',
    code: 'entreprise',
    priceMonthly: 119,
    maxUsers: 50,
    maxStores: 20,
    maxProducts: 100000,
    features: ['pos', 'stock', 'customers', 'autoInvoices', 'deliveries', 'suppliers', 'advancedReports', 'fullAccounting', 'customRoles', 'advancedAutomations', 'fullRestApi', 'dedicatedManager', 'support247', 'slaGuarantee'],
    highlight: false,
  },
];

export const ANNUAL_DISCOUNT = 2;
export const TRIAL_DAYS = 14; // FIX: real trial length is 14 days, not 7 — see supabase/migrations/20260830000000_0047_extend_trial_to_14_days.sql, must match

export function annualPrice(monthly: number): number {
  return monthly * 10;
}

export function annualSavings(monthly: number): number {
  return monthly * 2;
}
