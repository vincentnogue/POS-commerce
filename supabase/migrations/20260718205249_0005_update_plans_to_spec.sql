/*
# Update plans to exact spec: Starter $9, Pro $19, Premium $49, Entreprise $119
# All plans include 7-day free trial. Annual billing with ~2 months free discount.
*/

-- Remove old plans and insert the 4 correct ones
DELETE FROM public.plans;

INSERT INTO public.plans (name, code, price_usd, max_users, max_stores, max_products, features, sort_order, is_active)
VALUES
  ('Starter', 'starter', 9, 2, 1, 100,
    '["1 magasin","2 utilisateurs","100 produits","Point de Vente","Gestion du stock","Fichier clients","Support communautaire"]'::jsonb,
    0, true),
  ('Pro', 'pro', 19, 5, 2, 1000,
    '["2 magasins","5 utilisateurs","1 000 produits","Tout Starter +","Factures & devis","Livraisons","Fournisseurs & achats","Rapports avancés","Support email"]'::jsonb,
    1, true),
  ('Premium', 'premium', 49, 15, 5, 10000,
    '["5 magasins","15 utilisateurs","10 000 produits","Tout Pro +","Comptabilité complète","Multi-rôles personnalisés","Tracking commerciaux","Journal d audit","Support prioritaire"]'::jsonb,
    2, true),
  ('Entreprise', 'entreprise', 119, 50, 20, 100000,
    '["20 magasins","50 utilisateurs","Produits illimités","Tout Premium +","Automatisations avancées","API & intégrations","Gestionnaire de compte dédié","Support 24/7","SLA garanti"]'::jsonb,
    3, true);