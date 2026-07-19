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
    maxProducts: 100,
    features: ['1 magasin', '2 utilisateurs', '100 produits', 'Point de Vente', 'Gestion du stock', 'Fichier clients', 'Support communautaire'],
    highlight: false,
  },
  {
    name: 'Pro',
    code: 'pro',
    priceMonthly: 19,
    maxUsers: 5,
    maxStores: 2,
    maxProducts: 1000,
    features: ['2 magasins', '5 utilisateurs', '1 000 produits', 'Tout Starter +', 'Factures & devis', 'Livraisons', 'Fournisseurs & achats', 'Rapports avancés', 'Support email'],
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
    features: ['5 magasins', '15 utilisateurs', '10 000 produits', 'Tout Pro +', 'Comptabilité complète', 'Multi-rôles personnalisés', 'Tracking commerciaux', "Journal d'audit", 'Support prioritaire'],
    highlight: false,
  },
  {
    name: 'Entreprise',
    code: 'entreprise',
    priceMonthly: 119,
    maxUsers: 50,
    maxStores: 20,
    maxProducts: 100000,
    features: ['20 magasins', '50 utilisateurs', 'Produits illimités', 'Tout Premium +', 'Automatisations avancées', 'API & intégrations', 'Gestionnaire de compte dédié', 'Support 24/7', 'SLA garanti'],
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
