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
    features: ['plan.feat.1store', 'plan.feat.2users', 'plan.feat.50products', 'plan.feat.pos', 'plan.feat.stock', 'plan.feat.customers', 'plan.feat.communitySupport'],
    highlight: false,
  },
  {
    name: 'Pro',
    code: 'pro',
    priceMonthly: 19,
    maxUsers: 5,
    maxStores: 2,
    maxProducts: 500,
    features: ['plan.feat.2stores', 'plan.feat.5users', 'plan.feat.500products', 'plan.feat.allStarter', 'plan.feat.invoices', 'plan.feat.deliveries', 'plan.feat.suppliers', 'plan.feat.advancedReports', 'plan.feat.emailSupport'],
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
    features: ['plan.feat.5stores', 'plan.feat.15users', 'plan.feat.10000products', 'plan.feat.allPro', 'plan.feat.fullAccounting', 'plan.feat.customRoles', 'plan.feat.prioritySupport'],
    highlight: false,
  },
  {
    name: 'Entreprise',
    code: 'entreprise',
    priceMonthly: 119,
    maxUsers: 50,
    maxStores: 20,
    maxProducts: 100000,
    features: ['plan.feat.20stores', 'plan.feat.50users', 'plan.feat.unlimitedProducts', 'plan.feat.allPremium', 'plan.feat.advancedAutomation', 'plan.feat.api', 'plan.feat.dedicatedManager', 'plan.feat.support247', 'plan.feat.sla'],
    highlight: false,
  },
];

export const ANNUAL_DISCOUNT = 2;
export const TRIAL_DAYS = 7;

export function annualPrice(monthly: number): number {
  return monthly * 10;
}

export function annualSavings(monthly: number): number {
  return monthly * 2;
}
