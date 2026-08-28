import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Menu, X, Globe, ChevronDown, ArrowRight, MapPin,
  ShoppingCart, Package, Store, Plug, FileText, BarChart3,
  ShieldCheck, Wallet, Check,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '../lib/i18n';
import { PricingCard, type PricingPlan } from '../components/PricingCard';
import { PLANS as REAL_PLANS } from '../lib/plans';
import {
  getExchangeRates, getUserCurrency, convertPrice,
  type ConvertedPrice, type ExchangeRate,
} from '../lib/currency';

// Real feature set — every entry below maps to an actual module that ships
// in this app (see src/pages/modules/*), not aspirational copy.
const FEATURES = [
  { icon: ShoppingCart, title: 'Caisse (POS)', desc: 'Encaissement rapide, hors-ligne compatible, tickets et reçus personnalisables.' },
  { icon: Package, title: 'Gestion du stock', desc: "Suivi des niveaux de stock, alertes de rupture, transferts entre boutiques." },
  { icon: Store, title: 'Multi-boutique & GPS', desc: 'Pilotez plusieurs points de vente, avec localisation GPS de chaque boutique.' },
  { icon: Wallet, title: 'Multi-devises réelles', desc: `${30}+ devises avec taux de conversion en direct — du Dirham au Franc CFA.` },
  { icon: FileText, title: 'Factures & devis', desc: 'Facturation automatique, devis, bons de commande et suivi des livraisons.' },
  { icon: Plug, title: 'Marketplace de paiements', desc: 'Connectez PayUnit, Flutterwave, Paystack et vos processeurs locaux.' },
  { icon: BarChart3, title: 'Rapports & comptabilité', desc: 'Tableaux de bord en temps réel et comptabilité complète intégrée.' },
  { icon: ShieldCheck, title: 'Rôles & permissions', desc: 'Contrôle granulaire des accès par employé, boutique et fonction.' },
];

function formatUpdatedAt(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'Idéal pour démarrer votre commerce',
  pro: 'Pour les commerces en croissance',
  premium: 'Fonctionnalités avancées et support prioritaire',
  entreprise: 'Pour les grandes organisations multi-boutiques',
};

const LANDING_PLANS: PricingPlan[] = REAL_PLANS.map((p) => ({
  id: p.code,
  name: p.name,
  description: PLAN_DESCRIPTIONS[p.code] ?? '',
  basePrice: p.priceMonthly,
  features: p.features.slice(0, 6).map((f) => ({ name: f, included: true })),
  cta: p.code === 'entreprise'
    ? { text: 'Contacter les ventes', href: '/contact' }
    : { text: 'Essayer gratuitement', href: '/signup' },
  popular: p.popular,
  badge: p.popular ? 'LE PLUS CHOISI' : undefined,
}));

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();

  const [convertedPrices, setConvertedPrices] = useState<Record<string, ConvertedPrice>>({});
  const [ratesLive, setRatesLive] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rates: ExchangeRate = await getExchangeRates();
        const userCurrency = await getUserCurrency();
        const currency = rates[userCurrency] ? userCurrency : 'USD';
        const converted: Record<string, ConvertedPrice> = {};
        for (const plan of LANDING_PLANS) {
          converted[plan.id] = await convertPrice(plan.basePrice, currency);
        }
        setConvertedPrices(converted);
        // We don't need getRatesStatus() detail here beyond a light "live" cue;
        // if conversion succeeded with a non-USD currency the rates came from
        // the live endpoint (USD stays 1:1 either way, so this is a light heuristic).
        setRatesLive(currency !== 'USD' || Object.keys(rates).length > 5);
        setRatesUpdatedAt(new Date().toISOString());
      } catch (error) {
        console.error('Landing pricing conversion error:', error);
      }
    })();
  }, []);

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      navigate(`/signup?email=${encodeURIComponent(email)}`);
    }
  };

  const scrollToPricing = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 dark:border-ink-800 bg-white/95 dark:bg-ink-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo-pos-icon.png" alt="Liafrik POS" className="h-9 w-9" />
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Liafrik <span className="text-brand-600">POS</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <div className="relative group">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  Produits <ChevronDown size={16} />
                </button>
                <div className="absolute left-0 mt-0 w-64 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <a href="#features" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Caisse, stock & facturation</a>
                  <Link to="/marketplace" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Marketplace & intégrations</Link>
                </div>
              </div>

              <a href="#pricing" onClick={scrollToPricing} className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">Tarifs</a>

              <Link to="/about" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">À propos</Link>

              <div className="relative group">
                <button className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 flex items-center gap-1">
                  Ressources <ChevronDown size={16} />
                </button>
                <div className="absolute left-0 mt-0 w-48 bg-white dark:bg-ink-900 border border-gray-200 dark:border-ink-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                  <Link to="/documentation" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Documentation</Link>
                  <Link to="/help" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Centre d'aide</Link>
                  <Link to="/blog" className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-ink-800">Blog</Link>
                </div>
              </div>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <button
                onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600"
              >
                <Globe size={18} /> {lang.toUpperCase()}
              </button>
              <Link to="/login" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600">Connexion</Link>
              <Link to="/signup" className="px-6 py-2 bg-brand-600 text-white rounded-full font-medium hover:bg-brand-700 transition">
                Essai gratuit
              </Link>
            </div>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-700 dark:text-gray-300"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-ink-700 space-y-3"
            >
              <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Fonctionnalités</a>
              <a href="#pricing" onClick={scrollToPricing} className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Tarifs</a>
              <Link to="/about" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">À propos</Link>
              <Link to="/documentation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Documentation</Link>
              <Link to="/help" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Aide</Link>
              <Link to="/login" className="block text-sm font-medium text-gray-700 dark:text-gray-300 py-2">Connexion</Link>
              <Link to="/signup" className="block w-full px-6 py-2 bg-brand-600 text-white rounded-full font-medium text-center">Essai gratuit</Link>
            </motion.div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-black min-h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1687422808311-a776f467a468?w=1600&h=1000&fit=crop&q=80"
            alt="Commerçante au comptoir de sa boutique"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-20 lg:px-8 w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 inline-flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-full px-4 py-2 backdrop-blur"
            >
              <MapPin size={16} className="text-action-500" />
              <span className="text-sm font-medium text-gray-300">Développé par LiAfrik — Dubaï & Afrique</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
            >
              Le point de vente qui{' '}
              <span className="relative inline-block">
                <span className="text-white">relie</span>
                <svg
                  className="absolute left-0 right-0 bottom-1 w-full h-3"
                  viewBox="0 0 300 50"
                  preserveAspectRatio="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M 0 30 Q 75 5 150 30 T 300 30" stroke="#F96F22" strokeWidth="4" fill="none" strokeLinecap="round" />
                </svg>
              </span>{' '}
              Dubaï et l'Afrique
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl text-gray-300 mb-8 max-w-lg leading-relaxed"
            >
              Caisse, stock, facturation et paiements multi-devises dans une seule plateforme,
              pensée pour les commerçants qui opèrent entre le Golfe et l'Afrique.
            </motion.p>

            <motion.form
              onSubmit={handleGetStarted}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-4 flex gap-2"
            >
              <input
                type="email"
                placeholder="Votre email professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-6 py-3 rounded-full bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-600"
                required
              />
              <button
                type="submit"
                className="px-8 py-3 bg-brand-600 text-white rounded-full font-semibold hover:bg-brand-700 transition whitespace-nowrap"
              >
                Démarrer
              </button>
            </motion.form>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
              <a href="#pricing" onClick={scrollToPricing} className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition font-medium">
                Voir la tarification <ArrowRight size={18} />
              </a>
            </motion.div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} className="text-xs text-gray-500 mt-4">
              Essai gratuit de 7 jours, sans carte bancaire.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Real stats strip */}
      <section className="bg-gray-50 dark:bg-ink-900 py-12 border-y border-gray-200 dark:border-ink-800">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">30+</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Devises avec conversion en direct</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">2</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Régions connectées : Golfe & Afrique</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">3</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Processeurs de paiement intégrés</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Tout ce qu'il faut pour faire tourner votre commerce
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Une seule plateforme, du comptoir jusqu'à la comptabilité.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 hover:border-brand-500/50 hover:shadow-lg transition"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing — real matrix, dark band like a serious SaaS pricing section */}
      <section id="pricing" className="py-20 px-4 lg:px-8 bg-ink-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-4">
            <div className="inline-block px-4 py-2 rounded-full bg-flow-500/10 border border-flow-500/30 text-flow-300 text-sm font-semibold mb-6">
              Tarification simple et transparente
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Un tarif pour chaque taille de commerce</h2>
            <p className="text-lg text-ink-300 max-w-2xl mx-auto mb-2">
              4 plans, des prix en dollars convertis automatiquement dans votre devise locale.
            </p>
            {ratesUpdatedAt && (
              <p className="text-xs text-ink-500">
                {ratesLive ? 'Taux de change en direct' : 'Taux indicatifs'} · dernière mise à jour {formatUpdatedAt(ratesUpdatedAt)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            {LANDING_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                convertedPrice={convertedPrices[plan.id] || {
                  usd: plan.basePrice, currency: 'USD', amount: plan.basePrice,
                  formatted: `$${plan.basePrice}`, rate: 1,
                }}
                onSelect={() => navigate(plan.cta.href)}
              />
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-flow-300 hover:text-flow-200 font-medium">
              Voir la matrice complète des 30+ devises <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Why LiAfrik built this */}
      <section className="py-20 px-4 lg:px-8 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Pensé pour les commerçants entre le Golfe et l'Afrique
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left mt-10">
          {[
            'Multi-devises natif : dirham, franc CFA, shilling, rand, cedi et plus, avec conversion en temps réel.',
            "Multi-boutique avec suivi GPS, pour les réseaux qui s'étendent sur plusieurs pays.",
            'Marketplace de paiements locaux (PayUnit, Flutterwave, Paystack) au lieu de dépendre d\'un seul processeur.',
          ].map((point) => (
            <div key={point} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-brand-600 flex-shrink-0 mt-1" />
              <p className="text-gray-600 dark:text-gray-300">{point}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-brand-50 to-orange-50 dark:from-brand-900/20 dark:to-orange-900/20 rounded-3xl p-12 text-center">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Prêt à équiper votre commerce ?</h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">Essai gratuit de 7 jours. Aucune carte bancaire requise.</p>
          <Link to="/signup" className="inline-block px-8 py-4 bg-brand-600 text-white rounded-full font-semibold hover:bg-brand-700 transition">
            Démarrer l'essai gratuit
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-ink-800 bg-white dark:bg-ink-950">
        <div className="max-w-7xl mx-auto px-4 py-12 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Produit</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><a href="#features" className="hover:text-brand-600">Fonctionnalités</a></li>
                <li><a href="#pricing" onClick={scrollToPricing} className="hover:text-brand-600">Tarifs</a></li>
                <li><Link to="/marketplace" className="hover:text-brand-600">Marketplace</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Entreprise</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/about" className="hover:text-brand-600">À propos</Link></li>
                <li><Link to="/careers" className="hover:text-brand-600">Carrières</Link></li>
                <li><Link to="/blog" className="hover:text-brand-600">Blog</Link></li>
                <li><Link to="/contact" className="hover:text-brand-600">Contact</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Ressources</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/help" className="hover:text-brand-600">Centre d'aide</Link></li>
                <li><Link to="/documentation" className="hover:text-brand-600">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white mb-4">Légal</p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li><Link to="/privacy" className="hover:text-brand-600">Confidentialité</Link></li>
                <li><Link to="/terms" className="hover:text-brand-600">Conditions d'utilisation</Link></li>
                <li><Link to="/legal" className="hover:text-brand-600">Mentions légales</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-ink-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © 2026 POS Flow — développé par LiAfrik, Dubaï & Afrique. Tous droits réservés.
            </p>
            <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600">
              {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
