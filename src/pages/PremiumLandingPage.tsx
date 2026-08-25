import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Check, Puzzle, Zap, Lock, BarChart3,
  ShoppingCart, Package, Users, TrendingUp, Smartphone,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { useI18n } from '../lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const INTEGRATIONS_SHOWCASE = [
  { name: 'Stripe', logo: '🟦', category: 'Payments' },
  { name: 'PayPal', logo: '📘', category: 'Payments' },
  { name: 'Flutterwave', logo: '🌊', category: 'Payments' },
  { name: 'Paystack', logo: '⚡', category: 'Payments' },
  { name: 'M-Pesa', logo: '📱', category: 'Mobile Money' },
  { name: 'Twilio', logo: '💬', category: 'Communication' },
  { name: 'WhatsApp', logo: '💬', category: 'Communication' },
  { name: 'DHL', logo: '📦', category: 'Logistics' },
  { name: 'Sellia', logo: '🛍️', category: 'E-commerce' },
  { name: 'Libooks', logo: '📊', category: 'Accounting' },
  { name: 'Wave', logo: '💰', category: 'Payments' },
  { name: 'Adyen', logo: '💳', category: 'Payments' },
  { name: 'Webhooks', logo: '🔗', category: 'Developers' },
];

const CORE_FEATURES = [
  { icon: ShoppingCart, label: 'POS Tactile', desc: 'Mode caisse full-featured' },
  { icon: Package, label: 'Inventory', desc: 'Stock temps réel multi-magasin' },
  { icon: Users, label: 'CRM', desc: 'Gestion clients & fidélité' },
  { icon: BarChart3, label: 'Analytics', desc: 'Reporting professionnel' },
  { icon: Zap, label: 'Performant', desc: 'Offline-first synchronisé' },
  { icon: Lock, label: 'Sécurisé', desc: 'RLS multi-tenant' },
];

export function PremiumLandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <Link to="/pricing" className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900">
              Pricing
            </Link>
            <Link to="/login" className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900">
              Sign in
            </Link>
            <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO SECTION — PayUnit + Dynamics 365 inspired */}
      <section className="relative pt-32 pb-20 overflow-hidden lg:pt-40 lg:pb-28">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />
        
        {/* Animated gradient blobs */}
        <motion.div
          aria-hidden
          className="absolute -left-32 top-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl dark:bg-blue-600/10"
          animate={{ y: [0, 40, 0], x: [0, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="absolute -right-32 bottom-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl dark:bg-purple-600/10"
          animate={{ y: [0, -40, 0], x: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 dark:bg-blue-900/30 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
          >
            <Puzzle className="w-4 h-4" />
            13+ Intégrations prêtes
          </motion.div>

          {/* Main headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white mt-8 leading-tight"
          >
            La plateforme POS
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              pour l'Afrique
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-3xl"
          >
            Gestion commerciale complète. POS tactile. Marketplace d'intégrations. 
            Chaque tenant connecte ses propres APIs. Inspirée par Dynamics 365 Commerce.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4"
          >
            <Link
              to="/signup"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              Essai gratuit 14 jours <ArrowRight className="w-5 h-5" />
            </Link>
            <button
              className="px-8 py-4 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 font-semibold text-lg transition-colors"
            >
              Regarder la démo
            </button>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-400"
          >
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Pas de carte requise
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Setup en 5 minutes
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              Support 24/7
            </div>
          </motion.div>
        </div>
      </section>

      {/* MARKETPLACE SHOWCASE SECTION */}
      <section className="py-20 lg:py-28 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Marketplace d'intégrations
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Connectez vos APIs. Chaque tenant utilise ses propres credentials. 
              13+ fournisseurs officiellement supportés dès le départ.
            </p>
          </motion.div>

          {/* Integration cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {INTEGRATIONS_SHOWCASE.map((integration, i) => (
              <motion.div
                key={integration.name}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all text-center"
              >
                <div className="text-3xl mb-2">{integration.logo}</div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">{integration.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{integration.category}</p>
              </motion.div>
            ))}
          </div>

          {/* Browse marketplace CTA */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 text-center"
          >
            <Link
              to="/marketplace"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
            >
              Parcourir le Marketplace <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CORE FEATURES SECTION */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Modules natifs complets
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour gérer votre commerce, intégré dans une plateforme cohérente.
            </p>
          </motion.div>

          {/* Features grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.label}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.6, delay: i * 0.08 }}
                  className="p-6 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-lg dark:hover:border-blue-600 transition-all"
                >
                  <Icon className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    {feature.label}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {feature.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="py-20 lg:py-28 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-5xl font-bold mb-2">2,500+</div>
              <p className="text-blue-100">Commerçants actifs</p>
            </motion.div>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="text-5xl font-bold mb-2">13+</div>
              <p className="text-blue-100">Intégrations prêtes</p>
            </motion.div>
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="text-5xl font-bold mb-2">50M+</div>
              <p className="text-blue-100">Transactions/mois</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-slate-900 dark:text-white mb-6"
          >
            Prêt à transformer votre commerce ?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-lg text-slate-600 dark:text-slate-400 mb-8"
          >
            Lancez gratuitement. Aucune carte requise. Support en français. 
          </motion.p>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
            >
              Démarrer l'essai gratuit <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-8 text-sm text-slate-600 dark:text-slate-400">
              <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white">Terms</Link>
              <Link to="/contact" className="hover:text-slate-900 dark:hover:text-white">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
