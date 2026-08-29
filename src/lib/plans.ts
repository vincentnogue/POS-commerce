export type Plan = {
  name: string;
  code: string;
  priceMonthly: number;
  maxUsers: number;
  maxStores: number;
  maxProducts: number;
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
    features: [
      'Système de caisse (POS)',
      'Gestion du stock',
      'Gestion des clients',
      'Support communautaire',
    ],
    highlight: false,
  },
  {
    name: 'Pro',
    code: 'pro',
    priceMonthly: 19,
    maxUsers: 5,
    maxStores: 2,
    maxProducts: 500,
    features: [
      'Système de caisse (POS)',
      'Gestion du stock',
      'Gestion des clients',
      'Factures automatiques',
      'Gestion livraisons',
      'Gestion fournisseurs',
      'Rapports avancés',
      'Support email (24h)',
    ],
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
    features: [
      'Système de caisse (POS)',
      'Gestion du stock',
      'Gestion des clients',
      'Factures automatiques',
      'Gestion livraisons',
      'Gestion fournisseurs',
      'Rapports avancés',
      'Comptabilité complète',
      'Rôles et permissions personnalisés',
      'Support prioritaire (2h)',
    ],
    highlight: false,
  },
  {
    name: 'Entreprise',
    code: 'entreprise',
    priceMonthly: 119,
    maxUsers: 50,
    maxStores: 20,
    maxProducts: 100000,
    features: [
      'Système de caisse (POS)',
      'Gestion du stock',
      'Gestion des clients',
      'Factures automatiques',
      'Gestion livraisons',
      'Gestion fournisseurs',
      'Rapports avancés',
      'Comptabilité complète',
      'Rôles et permissions personnalisés',
      'Automatisations avancées',
      'API REST complète',
      'Gestionnaire dédié',
      'Support 24/7',
      'SLA garanti (99.9%)',
    ],
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
